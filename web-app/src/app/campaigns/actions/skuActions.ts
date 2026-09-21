'use server';

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { syncUnmappedForProduct } from '@/lib/syncUnmapped';

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
    const data = await db.execute(sql`
      SELECT * FROM skus WHERE campaign_id = ${campaignId} ORDER BY id ASC
    `) as any[];
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

    // 1. Unlink sales where sku_id = skuId
    await db.execute(sql`UPDATE sales SET sku_id = NULL WHERE sku_id = ${skuId}`).catch(() => {});

    // 2. Unlink campaign_concepts where sku_id = skuId
    await db.execute(sql`UPDATE campaign_concepts SET sku_id = NULL WHERE sku_id = ${skuId}`).catch(() => {});

    // 3. Unlink videos where sku_id = skuId
    await db.execute(sql`UPDATE videos SET sku_id = NULL WHERE sku_id = ${skuId}`).catch(() => {});

    // 4. Finally delete the SKU
    await db.execute(sql`DELETE FROM skus WHERE id = ${skuId} AND campaign_id = ${campaignId}`);

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

    const idsSql = sql.join(skuIds.map(id => sql`${id}`), sql`, `);

    // 1. Unlink sales
    await db.execute(sql`UPDATE sales SET sku_id = NULL WHERE sku_id IN (${idsSql})`).catch(() => {});

    // 2. Unlink campaign_concepts
    await db.execute(sql`UPDATE campaign_concepts SET sku_id = NULL WHERE sku_id IN (${idsSql})`).catch(() => {});

    // 3. Unlink videos
    await db.execute(sql`UPDATE videos SET sku_id = NULL WHERE sku_id IN (${idsSql})`).catch(() => {});

    // 4. Delete all selected SKUs
    await db.execute(sql`DELETE FROM skus WHERE id IN (${idsSql}) AND campaign_id = ${campaignId}`);

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

    // Check duplicate
    const duplicate = await db.execute(sql`
      SELECT id FROM skus
      WHERE campaign_id = ${campaignId} AND product_id = ${trimmedProductId} AND id != ${skuId}
      LIMIT 1
    `) as any[];

    if (duplicate && duplicate.length > 0) {
      return { success: false, error: `Product ID "${trimmedProductId}" sudah digunakan oleh produk lain di campaign ini.` };
    }

    const [data] = await db.execute(sql`
      UPDATE skus SET
        nama_produk = ${trimmedNama},
        product_id = ${trimmedProductId},
        satuan_bundle = ${payload.satuan_bundle ? payload.satuan_bundle.trim() : null},
        commission = ${payload.commission !== undefined && payload.commission !== null ? Number(payload.commission) : null},
        link_gmv_max = ${payload.link_gmv_max !== undefined ? payload.link_gmv_max || null : null},
        link_tap = ${payload.link_tap !== undefined ? payload.link_tap || null : null}
      WHERE id = ${skuId} AND campaign_id = ${campaignId}
      RETURNING *
    `) as any[];

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

      if (seenProductIds.has(pid)) {
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
    const existingSkus = await db.execute(sql`
      SELECT id, product_id, nama_produk, satuan_bundle, commission
      FROM skus
      WHERE campaign_id = ${campaignId}
    `) as any[];

    const existingMap = new Map((existingSkus || []).map(s => [s.product_id, s]));

    let insertedCount = 0;
    let updatedCount = 0;

    for (const row of cleanedRows) {
      const existing = existingMap.get(row.product_id);
      if (existing) {
        await db.execute(sql`
          UPDATE skus SET
            nama_produk = ${row.nama_produk || existing.nama_produk},
            satuan_bundle = ${row.satuan_bundle !== null ? row.satuan_bundle : existing.satuan_bundle},
            commission = ${row.commission !== null ? row.commission : existing.commission}
          WHERE id = ${existing.id}
        `);
        updatedCount++;
      } else {
        await db.execute(sql`
          INSERT INTO skus (campaign_id, nama_produk, product_id, satuan_bundle, commission)
          VALUES (${campaignId}, ${row.nama_produk}, ${row.product_id}, ${row.satuan_bundle}, ${row.commission})
        `);
        insertedCount++;
      }
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
    const skus = await db.execute(sql`
      SELECT id, product_id FROM skus WHERE campaign_id = ${campaignId}
    `) as any[];

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
