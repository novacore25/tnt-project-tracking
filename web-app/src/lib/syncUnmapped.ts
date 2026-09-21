'use server';

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' })
    }
  });
}

/**
 * Synchronize unmapped sales and organic videos for a specific product ID into a campaign.
 * Also auto-registers any newly discovered creators into the campaign_creators table (as pending),
 * strictly preserving existing creators and their status.
 */
export async function syncUnmappedForProduct(productId: string, campaignId: number, skuId?: number) {
  const supabase = getSupabaseClient();
  const trimmedPid = (productId || '').trim();

  if (!trimmedPid || !campaignId) {
    return { success: false, error: "Product ID dan Campaign ID wajib diisi", salesUpdated: 0, videosUpdated: 0 };
  }

  // 1. Resolve sku_id if not provided
  let resolvedSkuId = skuId;
  if (!resolvedSkuId) {
    const { data: skuRecord } = await supabase
      .from('skus')
      .select('id')
      .eq('product_id', trimmedPid)
      .eq('campaign_id', campaignId)
      .maybeSingle();
    resolvedSkuId = skuRecord?.id;
  }

  // 2. Update Sales where campaign_id is null and product_id matches
  const { data: updatedSales, error: errSales } = await supabase
    .from('sales')
    .update({ 
      campaign_id: campaignId,
      ...(resolvedSkuId ? { sku_id: resolvedSkuId } : {})
    } as any)
    .is('campaign_id', null)
    .eq('product_id', trimmedPid)
    .select('creator_username');

  if (errSales) {
    console.error(`Error updating unmapped sales for PID ${trimmedPid}:`, errSales.message);
  }

  // 3. Update Organic Videos where campaign_id is null and product_id matches
  const { data: updatedVideos, error: errVideos } = await supabase
    .from('organic_videos')
    .update({ campaign_id: campaignId } as any)
    .is('campaign_id', null)
    .eq('product_id', trimmedPid)
    .select('content_uid, creator_username, post_time');

  if (errVideos) {
    console.error(`Error updating unmapped videos for PID ${trimmedPid}:`, errVideos.message);
  }

  const sCount = updatedSales?.length || 0;
  const vCount = updatedVideos?.length || 0;

  if (sCount === 0 && vCount === 0) {
    return { success: true, salesUpdated: 0, videosUpdated: 0, creatorsAdded: 0 };
  }

  // 4. Auto-Register Creators into creators and campaign_creators
  const uniqueUsernames = new Set<string>();
  updatedSales?.forEach(s => { if (s.creator_username) uniqueUsernames.add(s.creator_username.toLowerCase().trim()); });
  updatedVideos?.forEach(v => { if (v.creator_username) uniqueUsernames.add(v.creator_username.toLowerCase().trim()); });

  const usernames = Array.from(uniqueUsernames).filter(Boolean);
  let newCcCount = 0;

  if (usernames.length > 0) {
    // a. Check creators table
    const existingCreatorMap = new Map<string, number>();
    for (let i = 0; i < usernames.length; i += 200) {
      const chunk = usernames.slice(i, i + 200);
      const { data: existing } = await supabase.from('creators').select('id, username').in('username', chunk);
      existing?.forEach(c => existingCreatorMap.set(c.username.toLowerCase(), c.id));
    }

    const missingCreators = usernames.filter(u => !existingCreatorMap.has(u));
    if (missingCreators.length > 0) {
      for (let i = 0; i < missingCreators.length; i += 200) {
        const chunk = missingCreators.slice(i, i + 200);
        const { data: inserted } = await supabase.from('creators').insert(
          chunk.map(u => ({ username: u, nama_asli: u, added_by: 'system' }))
        ).select('id, username');
        inserted?.forEach(c => existingCreatorMap.set(c.username.toLowerCase(), c.id));
      }
    }

    // b. Check campaign_creators
    const creatorIds = usernames.map(u => existingCreatorMap.get(u)).filter(Boolean) as number[];
    if (creatorIds.length > 0) {
      const existingCcMap = new Map<number, any>();
      for (let i = 0; i < creatorIds.length; i += 200) {
        const chunk = creatorIds.slice(i, i + 200);
        const { data: existingCcs } = await supabase.from('campaign_creators')
          .select('id, creator_id, assigned_sku_ids')
          .eq('campaign_id', campaignId)
          .in('creator_id', chunk);
        existingCcs?.forEach(cc => existingCcMap.set(cc.creator_id, cc));
      }

      // Update existing ccs if skuId needs to be appended
      if (resolvedSkuId) {
        for (const [cId, cc] of existingCcMap.entries()) {
          const skus = cc.assigned_sku_ids || [];
          if (!skus.includes(resolvedSkuId)) {
            await supabase.from('campaign_creators').update({
              assigned_sku_ids: [...skus, resolvedSkuId]
            }).eq('id', cc.id);
          }
        }
      }

      // Insert new ccs for creators not yet in campaign_creators
      const missingCcs = creatorIds.filter(cId => !existingCcMap.has(cId));
      if (missingCcs.length > 0) {
        const newCcs = missingCcs.map(cId => ({
          campaign_id: campaignId,
          creator_id: cId,
          tier: 'Nano',
          assigned_sku_ids: resolvedSkuId ? [resolvedSkuId] : [],
          approval: 'pending',
          client_approval: 'not_required',
          status_bayar: 'belum',
          qty_vt: 1,
          price: 0
        }));

        for (let i = 0; i < newCcs.length; i += 200) {
          const chunk = newCcs.slice(i, i + 200);
          await supabase.from('campaign_creators').insert(chunk);
        }
        newCcCount = missingCcs.length;
      }
    }
  }

  // 5. Auto-assign to videos table (with valid urutan)
  if (updatedVideos && updatedVideos.length > 0) {
    const uniqueMap = new Map<string, any>();
    updatedVideos.forEach(v => {
      if (v.content_uid && !uniqueMap.has(v.content_uid)) {
        uniqueMap.set(v.content_uid, v);
      }
    });
    const uniqueVideos = Array.from(uniqueMap.values());

    if (uniqueVideos.length > 0) {
      const uids = uniqueVideos.map(v => v.content_uid);
      const existingUids = new Set<string>();
      for (let i = 0; i < uids.length; i += 200) {
        const chunk = uids.slice(i, i + 200);
        const { data: existingVids } = await supabase.from('videos').select('content_uid').in('content_uid', chunk);
        existingVids?.forEach(v => existingUids.add(v.content_uid));
      }

      const missingVideos = uniqueVideos.filter(v => !existingUids.has(v.content_uid));
      if (missingVideos.length > 0) {
        const creatorUsernames = Array.from(new Set(missingVideos.map(m => m.creator_username?.toLowerCase()).filter(Boolean)));
        const ccMap: Record<string, number> = {};
        for (let i = 0; i < creatorUsernames.length; i += 200) {
          const chunk = creatorUsernames.slice(i, i + 200);
          const { data: ccs } = await supabase.from('campaign_creators')
            .select('id, creators!inner(username)')
            .eq('campaign_id', campaignId)
            .in('creators.username', chunk);
          ccs?.forEach((cc: any) => {
            ccMap[cc.creators.username.toLowerCase()] = cc.id;
          });
        }

        const ccIds = Object.values(ccMap);
        const maxUrutanMap: Record<number, number> = {};
        if (ccIds.length > 0) {
          for (let i = 0; i < ccIds.length; i += 200) {
            const chunk = ccIds.slice(i, i + 200);
            const { data: existingUrutan } = await supabase.from('videos')
              .select('campaign_creator_id, urutan')
              .in('campaign_creator_id', chunk);
            existingUrutan?.forEach((v: any) => {
              if ((v.urutan || 0) > (maxUrutanMap[v.campaign_creator_id] || 0)) {
                maxUrutanMap[v.campaign_creator_id] = v.urutan;
              }
            });
          }
        }

        const newVideosToInsert: any[] = [];
        for (const missing of missingVideos) {
          const ccId = ccMap[missing.creator_username?.toLowerCase()];
          if (ccId) {
            const nextUrutan = (maxUrutanMap[ccId] || 0) + 1;
            maxUrutanMap[ccId] = nextUrutan;
            newVideosToInsert.push({
              campaign_creator_id: ccId,
              content_uid: missing.content_uid,
              link_video: `https://www.tiktok.com/@${missing.creator_username}/video/${missing.content_uid}`,
              vt_approval: 'pending',
              urutan: nextUrutan,
              sku_id: resolvedSkuId || null,
              concept: null,
              created_at: missing.post_time || new Date().toISOString()
            });
          }
        }

        if (newVideosToInsert.length > 0) {
          for (let i = 0; i < newVideosToInsert.length; i += 100) {
            const chunk = newVideosToInsert.slice(i, i + 100);
            await supabase.from('videos').insert(chunk);
          }
        }
      }
    }
  }

  return {
    success: true,
    salesUpdated: sCount,
    videosUpdated: vCount,
    creatorsAdded: newCcCount
  };
}

/**
 * Scan and synchronize ALL registered SKUs in the database against unmapped sales and videos.
 */
export async function syncAllUnmappedGlobal() {
  const supabase = getSupabaseClient();
  const { data: allSkus, error: skuErr } = await supabase.from('skus').select('id, product_id, campaign_id, nama_produk');

  if (skuErr || !allSkus) {
    return { success: false, error: skuErr?.message || "Gagal mengambil daftar SKU" };
  }

  let totalSales = 0;
  let totalVideos = 0;
  let totalCreators = 0;

  for (const sku of allSkus) {
    if (!sku.product_id || !sku.campaign_id) continue;
    const res = await syncUnmappedForProduct(sku.product_id.trim(), sku.campaign_id, sku.id);
    if (res.salesUpdated) totalSales += res.salesUpdated;
    if (res.videosUpdated) totalVideos += res.videosUpdated;
    if (res.creatorsAdded) totalCreators += res.creatorsAdded;
  }

  return {
    success: true,
    totalSales,
    totalVideos,
    totalCreators,
    skusChecked: allSkus.length
  };
}
