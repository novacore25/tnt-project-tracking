'use server'

import { createClient } from "@supabase/supabase-js";
import { syncUnmappedForProduct } from "@/lib/syncUnmapped";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: (url, options) => {
      return fetch(url, { ...options, cache: 'no-store' });
    }
  }
});

export type SkuInput = {
  nama_produk: string;
  product_id: string;
  satuan_bundle?: string | null;
  commission?: number | null;
  link_gmv_max?: string | null;
  link_tap?: string | null;
};

/**
 * Fetch all SKUs for a specific campaign with no 1000-row limit issue
 */
export async function getCampaignSkus(campaignId: number) {
  try {
    const { data, error } = await supabase
      .from('skus')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('id', { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error("Error getCampaignSkus:", err);
    return { success: false, error: err.message || 'Gagal memuat daftar produk', data: [] };
  }
}

/**
 * Safely delete a SKU by unlinking relations first, preventing FK constraint errors
 */
export async function deleteSkuAction(skuId: number, campaignId: number) {
  try {
    if (!skuId || !campaignId) {
      return { success: false, error: "ID SKU atau Campaign tidak valid" };
    }

    // 1. Unlink sales where sku_id = skuId (prevents 23503 FK error)
    const { error: salesErr } = await supabase
      .from('sales')
      .update({ sku_id: null })
      .eq('sku_id', skuId);

    if (salesErr) {
      console.warn("Warning unlinking sales:", salesErr.message);
    }

    // 2. Unlink campaign_concepts where sku_id = skuId
    const { error: conceptsErr } = await supabase
      .from('campaign_concepts')
      .update({ sku_id: null })
      .eq('sku_id', skuId);

    if (conceptsErr) {
      console.warn("Warning unlinking concepts:", conceptsErr.message);
    }

    // 3. Unlink videos where sku_id = skuId
    const { error: vidsErr } = await supabase
      .from('videos')
      .update({ sku_id: null })
      .eq('sku_id', skuId);

    if (vidsErr) {
      console.warn("Warning unlinking videos:", vidsErr.message);
    }

    // 4. Remove skuId from campaign_creators.assigned_sku_ids
    const { data: affectedCcs } = await supabase
      .from('campaign_creators')
      .select('id, assigned_sku_ids')
      .eq('campaign_id', campaignId)
      .contains('assigned_sku_ids', [skuId]);

    if (affectedCcs && affectedCcs.length > 0) {
      for (const cc of affectedCcs) {
        const updatedSkus = (cc.assigned_sku_ids || []).filter((id: number) => id !== skuId);
        await supabase
          .from('campaign_creators')
          .update({ assigned_sku_ids: updatedSkus.length > 0 ? updatedSkus : null })
          .eq('id', cc.id);
      }
    }

    // 5. Finally delete the SKU
    const { error: delErr } = await supabase
      .from('skus')
      .delete()
      .eq('id', skuId)
      .eq('campaign_id', campaignId);

    if (delErr) throw delErr;

    return { success: true };
  } catch (err: any) {
    console.error("Error deleteSkuAction:", err);
    return { success: false, error: err.message || 'Gagal menghapus produk' };
  }
}

/**
 * Safely delete multiple SKUs in a single batch operation
 */
export async function deleteBatchSkusAction(skuIds: number[], campaignId: number) {
  try {
    if (!skuIds || skuIds.length === 0 || !campaignId) {
      return { success: false, error: "Tidak ada produk yang dipilih" };
    }

    // 1. Unlink sales where sku_id in (skuIds)
    const { error: salesErr } = await supabase
      .from('sales')
      .update({ sku_id: null })
      .in('sku_id', skuIds);

    if (salesErr) console.warn("Warning unlinking sales:", salesErr.message);

    // 2. Unlink campaign_concepts where sku_id in (skuIds)
    const { error: conceptsErr } = await supabase
      .from('campaign_concepts')
      .update({ sku_id: null })
      .in('sku_id', skuIds);

    if (conceptsErr) console.warn("Warning unlinking concepts:", conceptsErr.message);

    // 3. Unlink videos where sku_id in (skuIds)
    const { error: vidsErr } = await supabase
      .from('videos')
      .update({ sku_id: null })
      .in('sku_id', skuIds);

    if (vidsErr) console.warn("Warning unlinking videos:", vidsErr.message);

    // 4. Remove skuIds from campaign_creators.assigned_sku_ids
    const { data: affectedCcs } = await supabase
      .from('campaign_creators')
      .select('id, assigned_sku_ids')
      .eq('campaign_id', campaignId);

    if (affectedCcs && affectedCcs.length > 0) {
      const skuIdSet = new Set(skuIds);
      for (const cc of affectedCcs) {
        if (!cc.assigned_sku_ids || cc.assigned_sku_ids.length === 0) continue;
        const filtered = cc.assigned_sku_ids.filter((id: number) => !skuIdSet.has(id));
        if (filtered.length !== cc.assigned_sku_ids.length) {
          await supabase
            .from('campaign_creators')
            .update({ assigned_sku_ids: filtered.length > 0 ? filtered : null })
            .eq('id', cc.id);
        }
      }
    }

    // 5. Delete all selected SKUs
    const { error: delErr } = await supabase
      .from('skus')
      .delete()
      .in('id', skuIds)
      .eq('campaign_id', campaignId);

    if (delErr) throw delErr;

    return { success: true, count: skuIds.length };
  } catch (err: any) {
    console.error("Error deleteBatchSkusAction:", err);
    return { success: false, error: err.message || 'Gagal menghapus produk terpilih' };
  }
}

/**
 * Update a SKU with validation and duplicate prevention
 */
export async function updateSkuAction(skuId: number, campaignId: number, payload: SkuInput) {
  try {
    const trimmedProductId = (payload.product_id || '').trim();
    const trimmedNama = (payload.nama_produk || '').trim();

    if (!trimmedProductId) {
      return { success: false, error: "Product ID TikTok Shop wajib diisi" };
    }
    if (!trimmedNama) {
      return { success: false, error: "Nama produk wajib diisi" };
    }

    // Check if another SKU already uses this product_id in this campaign
    const { data: duplicate } = await supabase
      .from('skus')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('product_id', trimmedProductId)
      .neq('id', skuId)
      .maybeSingle();

    if (duplicate) {
      return { success: false, error: `Product ID "${trimmedProductId}" sudah digunakan oleh produk lain di campaign ini.` };
    }

    const updatePayload: Record<string, any> = {
      nama_produk: trimmedNama,
      product_id: trimmedProductId,
      satuan_bundle: payload.satuan_bundle ? payload.satuan_bundle.trim() : null,
      commission: payload.commission !== undefined && payload.commission !== null ? Number(payload.commission) : null,
    };

    if (payload.link_gmv_max !== undefined) updatePayload.link_gmv_max = payload.link_gmv_max || null;
    if (payload.link_tap !== undefined) updatePayload.link_tap = payload.link_tap || null;

    const { data, error } = await supabase
      .from('skus')
      .update(updatePayload)
      .eq('id', skuId)
      .eq('campaign_id', campaignId)
      .select()
      .single();

    if (error) throw error;

    // Trigger direct sync unmapped in database
    await syncUnmappedForProduct(trimmedProductId, campaignId, data?.id);

    return { success: true, data };
  } catch (err: any) {
    console.error("Error updateSkuAction:", err);
    return { success: false, error: err.message || 'Gagal menyimpan perubahan produk' };
  }
}

/**
 * Save batch SKUs with deduplication, validation, and auto-sync
 */
export async function saveBatchSkusAction(
  campaignId: number,
  rows: Array<{
    nama_produk: string;
    product_id: string;
    satuan_bundle?: string;
    commission?: string | number;
  }>
) {
  try {
    if (!campaignId) {
      return { success: false, error: "Campaign ID tidak valid" };
    }

    // 1. Clean & validate rows
    const cleanedRows: Array<{
      nama_produk: string;
      product_id: string;
      satuan_bundle: string | null;
      commission: number | null;
    }> = [];

    const seenProductIds = new Set<string>();

    for (const r of rows) {
      const pid = (r.product_id || '').trim();
      if (!pid) continue;

      // Keep only latest if duplicated within same batch
      if (seenProductIds.has(pid)) {
        // Update previous entry
        const idx = cleanedRows.findIndex(item => item.product_id === pid);
        if (idx !== -1) {
          cleanedRows[idx] = {
            nama_produk: (r.nama_produk || '').trim() || cleanedRows[idx].nama_produk || 'Produk Tanpa Nama',
            product_id: pid,
            satuan_bundle: (r.satuan_bundle || '').trim() || null,
            commission: r.commission ? Number(String(r.commission).replace(/%/g, '').trim()) : null,
          };
        }
        continue;
      }

      seenProductIds.add(pid);
      cleanedRows.push({
        nama_produk: (r.nama_produk || '').trim() || 'Produk Tanpa Nama',
        product_id: pid,
        satuan_bundle: (r.satuan_bundle || '').trim() || null,
        commission: r.commission ? Number(String(r.commission).replace(/%/g, '').trim()) : null,
      });
    }

    if (cleanedRows.length === 0) {
      return { success: false, error: "Tidak ada data produk yang valid untuk disimpan." };
    }

    // 2. Fetch existing campaign SKUs
    const { data: existingSkus } = await supabase
      .from('skus')
      .select('id, product_id, nama_produk, satuan_bundle, commission')
      .eq('campaign_id', campaignId);

    const existingMap = new Map((existingSkus || []).map(s => [s.product_id, s]));

    let insertedCount = 0;
    let updatedCount = 0;

    const toInsert: any[] = [];

    for (const row of cleanedRows) {
      const existing = existingMap.get(row.product_id);
      if (existing) {
        // Update existing if different
        const shouldUpdate =
          (row.nama_produk && row.nama_produk !== existing.nama_produk) ||
          (row.satuan_bundle !== null && row.satuan_bundle !== existing.satuan_bundle) ||
          (row.commission !== null && row.commission !== existing.commission);

        if (shouldUpdate) {
          const { error: updErr } = await supabase
            .from('skus')
            .update({
              nama_produk: row.nama_produk || existing.nama_produk,
              satuan_bundle: row.satuan_bundle !== null ? row.satuan_bundle : existing.satuan_bundle,
              commission: row.commission !== null ? row.commission : existing.commission,
            })
            .eq('id', existing.id);

          if (!updErr) updatedCount++;
        }
      } else {
        toInsert.push({
          campaign_id: campaignId,
          nama_produk: row.nama_produk,
          product_id: row.product_id,
          satuan_bundle: row.satuan_bundle,
          commission: row.commission,
        });
      }
    }

    if (toInsert.length > 0) {
      const { error: insErr } = await supabase.from('skus').insert(toInsert);
      if (insErr) throw insErr;
      insertedCount = toInsert.length;
    }

    // 3. Trigger direct database sync for all product IDs
    for (const pid of Array.from(seenProductIds)) {
      await syncUnmappedForProduct(pid, campaignId);
    }

    return {
      success: true,
      inserted: insertedCount,
      updated: updatedCount,
      total: cleanedRows.length
    };
  } catch (err: any) {
    console.error("Error saveBatchSkusAction:", err);
    return { success: false, error: err.message || 'Gagal menyimpan produk massal' };
  }
}

/**
 * Manually trigger synchronization of unmapped data for all SKUs of a campaign
 */
export async function syncCampaignUnmappedAction(campaignId: number) {
  try {
    if (!campaignId) return { success: false, error: "Campaign ID tidak valid" };
    const { data: skus } = await supabase.from('skus').select('id, product_id').eq('campaign_id', campaignId);
    if (!skus || skus.length === 0) {
      return { success: true, message: "Tidak ada SKU terdaftar di campaign ini", syncedCount: 0 };
    }
    let totalSales = 0;
    let totalVideos = 0;
    let totalCreators = 0;
    for (const s of skus) {
      if (!s.product_id) continue;
      const res = await syncUnmappedForProduct(s.product_id.trim(), campaignId, s.id);
      totalSales += res.salesUpdated || 0;
      totalVideos += res.videosUpdated || 0;
      totalCreators += res.creatorsAdded || 0;
    }
    return { success: true, totalSales, totalVideos, totalCreators, skuCount: skus.length };
  } catch (err: any) {
    console.error("Error syncCampaignUnmappedAction:", err);
    return { success: false, error: err.message || 'Gagal sinkronisasi data' };
  }
}
