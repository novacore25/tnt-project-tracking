'use server';

import { exchangeTikTokAuthCode, callTikTokShopApi, TIKTOK_CONFIG } from '@/utils/tiktokShopApi';
import { sqlInList } from '@/db';

export async function exchangeAuthCodeAction(authCode: string) {
  try {
    const res = await exchangeTikTokAuthCode(authCode);
    return res;
  } catch (error: any) {
    return { code: -1, message: error.message };
  }
}

export async function testFetchCategoryAssetsAction(accessToken: string) {
  try {
    const res = await callTikTokShopApi(
      '/authorization/202405/category_assets',
      'GET',
      accessToken
    );
    return res;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function testFetchTapCampaignsAction(
  accessToken: string, 
  categoryAssetCipher: string,
  status: string = 'ONGOING'
) {
  try {
    const res = await callTikTokShopApi(
      '/affiliate_partner/202405/campaigns',
      'GET',
      accessToken,
      {
        category_asset_cipher: categoryAssetCipher,
        page_size: 20,
        status: status || 'ONGOING'
      }
    );
    return res;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function testFetchCampaignProductsAction(
  accessToken: string,
  categoryAssetCipher: string,
  campaignId: string
) {
  try {
    const res = await callTikTokShopApi(
      `/affiliate_partner/202405/campaigns/${campaignId}/products`,
      'GET',
      accessToken,
      {
        category_asset_cipher: categoryAssetCipher,
        page_size: 20
      }
    );
    return res;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function testFetchCampaignPerformanceAction(
  accessToken: string,
  categoryAssetCipher: string,
  campaignId: string
) {
  try {
    const res = await callTikTokShopApi(
      `/affiliate_partner/202501/campaigns/${campaignId}/products/performance`,
      'GET',
      accessToken,
      {
        category_asset_cipher: categoryAssetCipher,
        page_size: 20
      }
    );
    return res;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function testFetchCampaignCreatorsAction(
  accessToken: string,
  categoryAssetCipher: string,
  campaignId: string,
  productId: string
) {
  try {
    const res = await callTikTokShopApi(
      `/affiliate_partner/202501/campaigns/${campaignId}/products/${productId}/performance`,
      'GET',
      accessToken,
      {
        category_asset_cipher: categoryAssetCipher,
        page_size: 20
      }
    );
    return res;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function testFetchShopsAction(accessToken: string) {
  try {
    const res = await callTikTokShopApi(
      '/authorization/202309/shops',
      'GET',
      accessToken
    );
    return res;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function testFetchAffiliateOrdersAction(
  accessToken: string,
  categoryAssetCipher?: string,
  campaignId?: string
) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 24 * 3600;

    const queryParams: Record<string, any> = {
      page_size: 20
    };
    
    if (categoryAssetCipher) {
      queryParams['category_asset_cipher'] = categoryAssetCipher;
    }

    const bodyData: Record<string, any> = {
      create_time_ge: thirtyDaysAgo,
      create_time_lt: now
    };

    if (campaignId) {
      bodyData['campaign_id'] = campaignId;
    }

    // Official TAP OpenAPI v202411 for affiliate orders
    const res = await callTikTokShopApi(
      '/affiliate_partner/202411/orders/search',
      'POST',
      accessToken,
      queryParams,
      bodyData
    );

    return res;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function testFetchCapOrdersAction(
  accessToken: string,
  categoryAssetCipher?: string
) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 24 * 3600;

    const queryParams: Record<string, any> = {
      page_size: 20
    };
    
    if (categoryAssetCipher) {
      queryParams['category_asset_cipher'] = categoryAssetCipher;
    }

    // Official CAP OpenAPI v202504 for CAP orders (matching partner.cap_orders.read)
    const res = await callTikTokShopApi(
      '/affiliate_partner/202504/cap_order/search',
      'POST',
      accessToken,
      queryParams,
      {
        create_time_ge: thirtyDaysAgo,
        create_time_lt: now
      }
    );

    return res;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function testFetchSellerOrdersAction(accessToken: string, shopCipher: string) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const sevenDaysAgo = now - 7 * 24 * 3600;

    const res = await callTikTokShopApi(
      '/order/202309/orders/search',
      'POST',
      accessToken,
      { shop_cipher: shopCipher },
      {
        page_size: 20,
        create_time_ge: sevenDaysAgo,
        create_time_lt: now
      }
    );

    return res;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Persist TikTok OAuth Token directly to database
 */
export async function saveTikTokAuthTokensAction(payload: {
  access_token: string;
  refresh_token: string;
  access_token_expire_in?: number;
  refresh_token_expire_in?: number;
  seller_name?: string;
  open_id?: string;
  category_asset_cipher?: string;
  seller_base_region?: string;
}) {
  try {
    const { saveTikTokAuthTokens } = await import('@/utils/tiktokShopApi');
    const res = await saveTikTokAuthTokens(payload);
    return res;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get active TikTok OAuth connection status and last sync time
 */
export async function getTikTokAuthStatusAction() {
  try {
    const { db } = await import('@/db');
    const { sql } = await import('drizzle-orm');

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tiktok_authorizations (
        id SERIAL PRIMARY KEY,
        seller_name TEXT,
        open_id TEXT,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        access_token_expire_in BIGINT,
        refresh_token_expire_in BIGINT,
        category_asset_cipher TEXT,
        seller_base_region TEXT,
        status TEXT DEFAULT 'active',
        last_synced_at TIMESTAMPTZ,
        sync_status TEXT DEFAULT 'idle',
        sync_progress_message TEXT,
        sync_progress_percent INT DEFAULT 0,
        sync_trigger_type TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE tiktok_authorizations ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'idle';
      ALTER TABLE tiktok_authorizations ADD COLUMN IF NOT EXISTS sync_progress_message TEXT;
      ALTER TABLE tiktok_authorizations ADD COLUMN IF NOT EXISTS sync_progress_percent INT DEFAULT 0;
      ALTER TABLE tiktok_authorizations ADD COLUMN IF NOT EXISTS sync_trigger_type TEXT;
      ALTER TABLE tiktok_authorizations ADD COLUMN IF NOT EXISTS is_scheduler_paused BOOLEAN DEFAULT true;
    `);

    const rows = await db.execute(sql`
      SELECT id, seller_name, open_id, category_asset_cipher, seller_base_region, 
             status, last_synced_at, sync_status, sync_progress_message, sync_progress_percent,
             sync_trigger_type, is_scheduler_paused, access_token_expire_in, created_at, updated_at
      FROM tiktok_authorizations
      WHERE status = 'active'
      ORDER BY id DESC
      LIMIT 1
    `);

    const record = (rows as any[])[0];
    if (!record) {
      return { isConnected: false, data: null };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const expireSec = Number(record.access_token_expire_in) || 0;
    const isTokenExpiringSoon = expireSec > 0 && (expireSec - nowSec < 24 * 3600);

    // Auto-heal stale 'running' status (if progress is 100% or last updated > 3 mins ago)
    let currentSyncStatus = record.sync_status || 'idle';
    const percent = Number(record.sync_progress_percent) || 0;
    const updatedAtSec = Math.floor(new Date(record.updated_at || record.created_at).getTime() / 1000);
    if (currentSyncStatus === 'running' && (percent >= 100 || (nowSec - updatedAtSec) > 180)) {
      currentSyncStatus = 'idle';
      try {
        await db.execute(sql`
          UPDATE tiktok_authorizations
          SET sync_status = 'idle'
          WHERE id = ${record.id}
        `);
      } catch (e) {
        // ignore
      }
    }

    return {
      isConnected: true,
      data: {
        sellerName: record.seller_name || 'TNT Agency',
        categoryAssetCipher: record.category_asset_cipher,
        lastSyncedAt: record.last_synced_at,
        isExpiringSoon: isTokenExpiringSoon,
        expiresAt: expireSec ? new Date(expireSec * 1000).toISOString() : null,
        syncStatus: currentSyncStatus,
        syncProgressMessage: record.sync_progress_message,
        syncProgressPercent: percent,
        syncTriggerType: record.sync_trigger_type || 'cron',
        isSchedulerPaused: record.is_scheduler_paused ?? true
      }
    };
  } catch (error: any) {
    return { isConnected: false, error: error.message };
  }
}

/**
 * Toggle Pause / Resume for background auto-sync scheduler
 */
export async function toggleTikTokSchedulerAction(paused: boolean) {
  try {
    const { requireUser } = await import('@/lib/guards');
    await requireUser();

    const { db } = await import('@/db');
    const { sql } = await import('drizzle-orm');

    await db.execute(sql`
      UPDATE tiktok_authorizations
      SET is_scheduler_paused = ${paused},
          updated_at = NOW()
      WHERE status = 'active'
    `);

    return { success: true, isPaused: paused };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Trigger manual auto-sync pipeline from UI
 */
export async function triggerManualTikTokSyncAction(options?: number | {
  campaignId?: number;
  daysBack?: number;
  startDate?: string;
  endDate?: string;
  month?: string;
}) {
  try {
    const { runTikTokAutoSync } = await import('@/lib/tiktokAutoSync');
    const opts = typeof options === 'number' ? { campaignId: options } : (options || {});
    const res = await runTikTokAutoSync({
      ...opts,
      triggerType: 'manual'
    });
    return res;
  } catch (error: any) {
    return { success: false, message: error.message, error: error.message };
  }
}

/**
 * Get recent sync logs history
 */
export async function getTikTokSyncHistoryAction(limit: number = 5) {
  try {
    const { db } = await import('@/db');
    const { sql } = await import('drizzle-orm');

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tiktok_sync_logs (
        id SERIAL PRIMARY KEY,
        trigger_type TEXT NOT NULL,
        status TEXT NOT NULL,
        sales_count INT DEFAULT 0,
        videos_count INT DEFAULT 0,
        campaigns_count INT DEFAULT 0,
        message TEXT,
        details JSONB,
        duration_ms INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const rows = await db.execute(sql`
      SELECT id, trigger_type, status, sales_count, videos_count, 
             campaigns_count, message, details, duration_ms, created_at
      FROM tiktok_sync_logs
      ORDER BY id DESC
      LIMIT ${limit}
    `);

    return (rows as any[]) || [];
  } catch (error: any) {
    return [];
  }
}


/**
 * Get staged orders from tiktok_sync_sales_staging
 */
export async function getTikTokSyncStagingAction(params?: {
  status?: 'pending' | 'applied' | 'ignored';
  limit?: number;
  offset?: number;
  search?: string;
}) {
  try {
    const { db } = await import('@/db');
    const { sql } = await import('drizzle-orm');

    const statusFilter = params?.status || 'pending';
    const limit = Math.min(params?.limit || 50, 100);
    const offset = Math.max(params?.offset || 0, 0);
    const search = params?.search?.trim();

    let whereClause = sql`s.sync_status = ${statusFilter}`;
    if (search) {
      const searchPattern = `%${search}%`;
      whereClause = sql`${whereClause} AND (
        s.order_id ILIKE ${searchPattern} OR
        s.creator_username ILIKE ${searchPattern} OR
        s.product_id ILIKE ${searchPattern} OR
        c.nama ILIKE ${searchPattern}
      )`;
    }

    const rows = await db.execute(sql`
      SELECT 
        s.id,
        s.order_id,
        s.product_id,
        s.sku_id,
        s.campaign_id,
        s.creator_username,
        s.content_uid,
        s.tanggal,
        s.price,
        s.quantity,
        s.gmv,
        s.is_refund,
        s.content_type,
        s.order_status,
        s.commission_rate,
        s.attribution_type,
        s.sync_batch_id,
        s.sync_status,
        s.created_at,
        s.applied_at,
        c.nama as campaign_nama
      FROM tiktok_sync_sales_staging s
      LEFT JOIN campaigns c ON c.id = s.campaign_id
      WHERE ${whereClause}
      ORDER BY s.tanggal DESC NULLS LAST, s.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countRows = await db.execute(sql`
      SELECT 
        count(*) as total_count,
        COALESCE(sum(gmv), 0) as total_gmv,
        COALESCE(sum(quantity), 0) as total_qty,
        count(*) FILTER (WHERE campaign_id IS NOT NULL) as mapped_count,
        count(*) FILTER (WHERE campaign_id IS NULL) as unmapped_count
      FROM tiktok_sync_sales_staging
      WHERE sync_status = ${statusFilter}
    `);

    return {
      success: true,
      items: (rows as any[]) || [],
      summary: (countRows as any[])[0] || {
        total_count: 0,
        total_gmv: 0,
        total_qty: 0,
        mapped_count: 0,
        unmapped_count: 0
      }
    };
  } catch (error: any) {
    return { success: false, items: [], summary: { total_count: 0, total_gmv: 0, total_qty: 0 }, error: error.message };
  }
}

/**
 * Apply staged orders from staging table to main 'sales' table
 */
export async function applyTikTokSyncStagingAction(orderIds?: string[]) {
  try {
    const { requireUser } = await import('@/lib/guards');
    await requireUser();

    const { db } = await import('@/db');
    const { sql } = await import('drizzle-orm');

    // Ambil baris staging yang pending
    const whereClause = orderIds && orderIds.length > 0
      ? sql`sync_status = 'pending' AND order_id IN ${sqlInList(orderIds)}`
      : sql`sync_status = 'pending'`;

    const stagingRows: any[] = await db.execute(sql`
      SELECT * FROM tiktok_sync_sales_staging
      WHERE ${whereClause}
    `);

    if (stagingRows.length === 0) {
      return { success: true, count: 0, message: 'Tidak ada data pending untuk diterapkan.' };
    }

    // Persiapkan tuple untuk insert ke sales
    const salesTuples = stagingRows.map(r => {
      const rawClean = JSON.stringify(r.raw_data || {}).replace(/\\u0000/g, '');
      const rowDate = (r.tanggal && !isNaN(new Date(r.tanggal).getTime()))
        ? new Date(r.tanggal).toISOString()
        : new Date().toISOString();
      const uname = (r.creator_username && String(r.creator_username).trim())
        ? String(r.creator_username).trim().toLowerCase()
        : null;

      return sql`(
        ${String(r.order_id).trim()},
        ${r.sku_id || null},
        ${r.campaign_id || null},
        ${uname},
        ${r.content_uid ? String(r.content_uid).trim() : null},
        ${r.product_id ? String(r.product_id).trim() : null},
        ${rowDate}::timestamptz,
        ${Number(r.price) || 0},
        ${Number(r.quantity) || 1},
        ${Number(r.gmv) || 0},
        ${r.is_refund ? true : false},
        ${r.content_type || 'video'},
        ${r.order_status || null},
        ${r.commission_rate || null},
        ${r.attribution_type || 'TAP'},
        ${r.tiktok_campaign_id ? String(r.tiktok_campaign_id).trim() : null},
        ${rawClean}::jsonb
      )`;
    });

    await db.transaction(async (tx) => {
      // 1. Upsert ke tabel sales utama
      await tx.execute(sql`
        INSERT INTO sales (
          order_id, sku_id, campaign_id, creator_username, content_uid, product_id,
          tanggal, price, quantity, gmv, is_refund, content_type, order_status,
          commission_rate, attribution_type, tiktok_campaign_id, raw_data
        ) VALUES ${sql.join(salesTuples, sql`, `)}
        ON CONFLICT (order_id) DO UPDATE SET
          sku_id = COALESCE(EXCLUDED.sku_id, sales.sku_id),
          campaign_id = COALESCE(EXCLUDED.campaign_id, sales.campaign_id),
          creator_username = COALESCE(EXCLUDED.creator_username, sales.creator_username),
          content_uid = COALESCE(EXCLUDED.content_uid, sales.content_uid),
          product_id = COALESCE(EXCLUDED.product_id, sales.product_id),
          tanggal = EXCLUDED.tanggal,
          price = EXCLUDED.price,
          quantity = EXCLUDED.quantity,
          gmv = EXCLUDED.gmv,
          is_refund = EXCLUDED.is_refund,
          content_type = EXCLUDED.content_type,
          order_status = EXCLUDED.order_status,
          commission_rate = EXCLUDED.commission_rate,
          attribution_type = EXCLUDED.attribution_type,
          tiktok_campaign_id = EXCLUDED.tiktok_campaign_id,
          raw_data = EXCLUDED.raw_data
      `);

      // 2. Tandai baris di staging sebagai 'applied'
      const appliedIds = stagingRows.map(r => r.id);
      await tx.execute(sql`
        UPDATE tiktok_sync_sales_staging
        SET sync_status = 'applied',
            applied_at = NOW()
        WHERE id IN ${sqlInList(appliedIds)}
      `);
    });

    return { 
      success: true, 
      count: stagingRows.length, 
      message: `Berhasil menerapkan ${stagingRows.length} order dari staging ke tabel sales utama!` 
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Clear or discard pending staging records
 */
export async function clearTikTokSyncStagingAction(mode: 'pending' | 'applied' | 'all' = 'pending') {
  try {
    const { requireUser } = await import('@/lib/guards');
    await requireUser();

    const { db } = await import('@/db');
    const { sql } = await import('drizzle-orm');

    if (mode === 'all') {
      await db.execute(sql`DELETE FROM tiktok_sync_sales_staging`);
    } else if (mode === 'applied') {
      await db.execute(sql`DELETE FROM tiktok_sync_sales_staging WHERE sync_status = 'applied'`);
    } else {
      await db.execute(sql`DELETE FROM tiktok_sync_sales_staging WHERE sync_status = 'pending'`);
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
