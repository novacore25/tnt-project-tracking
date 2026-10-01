'use server';

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

/**
 * Synchronize unmapped sales and organic videos for a specific product ID into a campaign.
 * Also auto-registers any newly discovered creators into the campaign_creators table (as pending),
 * strictly preserving existing creators and their status.
 */
export async function syncUnmappedForProduct(productId: string, campaignId: number, skuId?: number) {
  const trimmedPid = (productId || '').trim();

  if (!trimmedPid || !campaignId) {
    return { success: false, error: "Product ID dan Campaign ID wajib diisi", salesUpdated: 0, videosUpdated: 0 };
  }

  // 1. Resolve sku_id if not provided
  let resolvedSkuId = skuId;
  if (!resolvedSkuId) {
    const skuRows = await db.execute(sql`
      SELECT id FROM skus WHERE product_id = ${trimmedPid} AND campaign_id = ${campaignId} LIMIT 1
    `);
    resolvedSkuId = (skuRows as any[])[0]?.id;
  }

  // 2. Update Sales where campaign_id is null and product_id matches
  let updatedSales: any[] = [];
  if (resolvedSkuId) {
    const sRes = await db.execute(sql`
      UPDATE sales
      SET campaign_id = ${campaignId}, sku_id = ${resolvedSkuId}
      WHERE campaign_id IS NULL AND product_id = ${trimmedPid}
      RETURNING creator_username
    `);
    updatedSales = (sRes as any[]) || [];
  } else {
    const sRes = await db.execute(sql`
      UPDATE sales
      SET campaign_id = ${campaignId}
      WHERE campaign_id IS NULL AND product_id = ${trimmedPid}
      RETURNING creator_username
    `);
    updatedSales = (sRes as any[]) || [];
  }

  // 3. Update Organic Videos where campaign_id is null and product_id matches
  const vRes = await db.execute(sql`
    UPDATE organic_videos
    SET campaign_id = ${campaignId}
    WHERE campaign_id IS NULL AND product_id = ${trimmedPid}
    RETURNING content_uid, creator_username, post_time
  `);
  const updatedVideos = (vRes as any[]) || [];

  const sCount = updatedSales.length;
  const vCount = updatedVideos.length;

  if (sCount === 0 && vCount === 0) {
    return { success: true, salesUpdated: 0, videosUpdated: 0, creatorsAdded: 0 };
  }

  // 4. Auto-Register Creators into creators and campaign_creators
  const uniqueUsernames = new Set<string>();
  updatedSales.forEach(s => { if (s.creator_username) uniqueUsernames.add(s.creator_username.toLowerCase().trim()); });
  updatedVideos.forEach(v => { if (v.creator_username) uniqueUsernames.add(v.creator_username.toLowerCase().trim()); });

  const usernames = Array.from(uniqueUsernames).filter(Boolean);
  let newCcCount = 0;

  if (usernames.length > 0) {
    for (const u of usernames) {
      // Cari dulu dengan LOWER(). Index UNIQUE(username) itu case-sensitive,
      // jadi `ON CONFLICT (username)` TIDAK pernah_trigger kalau casing beda.
      // Akibatnya baris `Bunaandshanum` dan `bunaandshanum` bisa sama-sama ada,
      // lalu `campaign_creators` dapat dua baris untuk username yang sama dan
      // GMV-nya terhitung dua kali (terverifikasi 1 Okt 2026: 582 kelompok).
      const existingC = await db.execute(sql`
        SELECT id FROM creators WHERE LOWER(username) = ${u} LIMIT 1
      `);
      let creatorId = (existingC as any[])[0]?.id;

      if (!creatorId) {
        const cRes = await db.execute(sql`
          INSERT INTO creators (username, nama_asli, added_by, link_account)
          VALUES (${u}, ${u}, 'system', ${`https://tiktok.com/@${u}`})
          ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
          RETURNING id
        `);
        creatorId = (cRes as any[])[0]?.id;
      }

      if (creatorId) {
        const ccExists = await db.execute(sql`
          SELECT id, assigned_sku_ids FROM campaign_creators
          WHERE campaign_id = ${campaignId} AND creator_id = ${creatorId}
          LIMIT 1
        `);
        const existingCc = (ccExists as any[])[0];

        if (existingCc) {
          if (resolvedSkuId) {
            const currentSkus: number[] = existingCc.assigned_sku_ids || [];
            if (!currentSkus.includes(resolvedSkuId)) {
              const updatedSkus = [...currentSkus, resolvedSkuId].filter(n => typeof n === 'number' && !isNaN(n));
              const updatedSkusLiteral = updatedSkus.length > 0 ? `{${updatedSkus.join(',')}}` : '{}';
              await db.execute(sql`
                UPDATE campaign_creators
                SET assigned_sku_ids = ${updatedSkusLiteral}::int[]
                WHERE id = ${existingCc.id}
              `);
            }
          }
        } else {
          const skuPayload = resolvedSkuId ? [resolvedSkuId] : [];
          const skuPayloadLiteral = skuPayload.length > 0 ? `{${skuPayload.join(',')}}` : '{}';
          await db.execute(sql`
            INSERT INTO campaign_creators (
              campaign_id, creator_id, tier, assigned_sku_ids, approval, client_approval, status_bayar, qty_vt, price
            ) VALUES (
              ${campaignId}, ${creatorId}, 'Nano', ${skuPayloadLiteral}::int[], 'pending', 'not_required', 'belum', 1, 0
            )
          `);
          newCcCount++;
        }
      }
    }
  }

  // 5. Auto-assign to videos table (with valid urutan)
  if (updatedVideos.length > 0) {
    const uniqueMap = new Map<string, any>();
    updatedVideos.forEach(v => {
      if (v.content_uid && !uniqueMap.has(v.content_uid)) {
        uniqueMap.set(v.content_uid, v);
      }
    });
    const uniqueVideos = Array.from(uniqueMap.values());

    for (const v of uniqueVideos) {
      if (!v.content_uid || !v.creator_username) continue;
      const cleanUname = v.creator_username.toLowerCase().trim();

      const ccRes = await db.execute(sql`
        SELECT cc.id
        FROM campaign_creators cc
        JOIN creators cr ON cc.creator_id = cr.id
        WHERE cc.campaign_id = ${campaignId} AND LOWER(cr.username) = ${cleanUname}
        LIMIT 1
      `);
      const ccId = (ccRes as any[])[0]?.id;

      if (ccId) {
        const vidExists = await db.execute(sql`
          SELECT id FROM videos WHERE content_uid = ${v.content_uid} LIMIT 1
        `);
        if ((vidExists as any[]).length === 0) {
          const maxUrutanRes = await db.execute(sql`
            SELECT COALESCE(MAX(urutan), 0) as max_u FROM videos WHERE campaign_creator_id = ${ccId}
          `);
          const nextUrutan = ((maxUrutanRes as any[])[0]?.max_u || 0) + 1;

          await db.execute(sql`
            INSERT INTO videos (
              campaign_creator_id, content_uid, link_video, vt_approval, urutan, sku_id, concept, created_at
            ) VALUES (
              ${ccId},
              ${v.content_uid},
              ${`https://www.tiktok.com/@${cleanUname}/video/${v.content_uid}`},
              'pending',
              ${nextUrutan},
              ${resolvedSkuId || null},
              null,
              ${v.post_time ? new Date(v.post_time) : new Date()}
            )
          `);
        }
      }
    }
  }

  try {
    revalidatePath('/campaigns');
    revalidatePath(`/campaigns/${campaignId}`);
    revalidatePath(`/campaigns/${campaignId}/listing`);
    revalidatePath(`/campaigns/${campaignId}/performa`);
    revalidatePath(`/campaigns/${campaignId}/video`);
    revalidatePath('/performa');
    revalidatePath('/input-penjualan');
    revalidatePath('/skus');
  } catch (e) {
    // Ignore in non-request contexts
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
  const skuRows = await db.execute(sql`
    SELECT id, product_id, campaign_id, nama_produk FROM skus
  `);
  const allSkus = (skuRows as any[]) || [];

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
