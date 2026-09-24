import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { callTikTokShopApi, getValidTikTokToken, saveTikTokAuthTokens } from '@/utils/tiktokShopApi';
import { executeSalesImportChunkAction } from '@/app/actions/importActions';
import { syncAllUnmappedGlobal } from '@/lib/syncUnmapped';

export interface TikTokSyncResult {
  success: boolean;
  message: string;
  triggerType: 'cron' | 'manual';
  durationMs: number;
  campaignsProcessed: number;
  salesUpserted: number;
  videosUpserted: number;
  details?: any;
  error?: string;
}

/**
 * Execute Complete TikTok Shop OpenAPI Auto-Sync Pipeline
 * Syncs Sales, Video VT Performance, and Livestream Sessions
 */
export async function runTikTokAutoSync(options?: {
  campaignId?: number;
  triggerType?: 'cron' | 'manual';
}): Promise<TikTokSyncResult> {
  const startTime = Date.now();
  const triggerType = options?.triggerType || 'cron';

  try {
    console.log(`[TikTok AutoSync] Starting auto-sync pipeline (trigger: ${triggerType})...`);

    // 1. Get Valid Access Token & Category Asset Cipher
    const tokenInfo = await getValidTikTokToken();
    if (!tokenInfo.isValid || !tokenInfo.accessToken) {
      const errMsg = tokenInfo.error || "Akses token TikTok tidak valid";
      await logSyncExecution(triggerType, 'failed', 0, 0, 0, errMsg, null, Date.now() - startTime);
      return {
        success: false,
        message: errMsg,
        triggerType,
        durationMs: Date.now() - startTime,
        campaignsProcessed: 0,
        salesUpserted: 0,
        videosUpserted: 0,
        error: errMsg
      };
    }

    const accessToken = tokenInfo.accessToken;
    let cipher = tokenInfo.categoryAssetCipher;

    // If cipher missing, fetch from category_assets API
    if (!cipher) {
      const assetRes = await callTikTokShopApi(
        '/authorization/202405/category_assets',
        'GET',
        accessToken
      );
      if (assetRes.success && assetRes.data?.data?.category_assets?.length > 0) {
        cipher = assetRes.data.data.category_assets[0].category_asset_cipher;
        // Save cipher to database
        await db.execute(sql`
          UPDATE tiktok_authorizations
          SET category_asset_cipher = ${cipher}
          WHERE status = 'active'
        `);
      }
    }

    if (!cipher) {
      const errMsg = "Tidak dapat menemukan category_asset_cipher dari akun Partner Center";
      await logSyncExecution(triggerType, 'failed', 0, 0, 0, errMsg, null, Date.now() - startTime);
      return {
        success: false,
        message: errMsg,
        triggerType,
        durationMs: Date.now() - startTime,
        campaignsProcessed: 0,
        salesUpserted: 0,
        videosUpserted: 0,
        error: errMsg
      };
    }

    // 2. Fetch Active TAP Campaigns from OpenAPI
    const tapCampRes = await callTikTokShopApi(
      '/affiliate_partner/202405/campaigns',
      'GET',
      accessToken,
      {
        category_asset_cipher: cipher,
        page_size: 50,
        status: 'ONGOING'
      }
    );

    const tapCampaigns = tapCampRes.data?.data?.campaigns || [];
    console.log(`[TikTok AutoSync] Found ${tapCampaigns.length} ongoing TAP campaigns in Partner Center.`);

    // 3. Load Internal Database Campaigns & SKUs for Matching
    const internalCampaigns = (await db.execute(sql`
      SELECT c.id, c.nama_campaign, c.tiktok_campaign_ids,
             COALESCE(json_agg(s.product_id) FILTER (WHERE s.product_id IS NOT NULL), '[]') as product_ids
      FROM campaigns c
      LEFT JOIN skus s ON s.campaign_id = c.id
      GROUP BY c.id
    `)) as any[];

    let totalSalesCount = 0;
    let totalVideosCount = 0;
    let campaignsProcessed = 0;
    const syncDetails: any[] = [];

    // 4. Iterate and Sync each Campaign
    for (const tap of tapCampaigns) {
      const tapId = String(tap.campaign_id || tap.id);
      const tapName = tap.campaign_name || tap.name || '';

      // Match with internal campaign
      let matchedCampaign = internalCampaigns.find(ic => {
        const ids: string[] = ic.tiktok_campaign_ids || [];
        return ids.includes(tapId);
      });

      if (!matchedCampaign) {
        // Fallback: match by name similarity or product_id
        matchedCampaign = internalCampaigns.find(ic => 
          ic.nama_campaign?.toLowerCase().trim() === tapName.toLowerCase().trim()
        );
      }

      // If campaignId filter provided, skip non-matching
      if (options?.campaignId && matchedCampaign && matchedCampaign.id !== options.campaignId) {
        continue;
      }

      const campaignDbId = matchedCampaign ? matchedCampaign.id : null;
      console.log(`[TikTok AutoSync] Processing TAP Campaign: "${tapName}" (ID: ${tapId}) -> DB Campaign ID: ${campaignDbId || 'Unassigned'}`);

      // 4a. Fetch Campaign Products
      const prodRes = await callTikTokShopApi(
        `/affiliate_partner/202405/campaigns/${tapId}/products`,
        'GET',
        accessToken,
        {
          category_asset_cipher: cipher,
          page_size: 50
        }
      );

      const products = prodRes.data?.data?.products || [];
      const productIds = products.map((p: any) => String(p.product_id || p.id));

      const salesRowsToInsert: any[] = [];
      const videoRowsToInsert: any[] = [];

      // 4b. Fetch Performance per Product
      for (const prod of products) {
        const pId = String(prod.product_id || prod.id);

        const perfRes = await callTikTokShopApi(
          `/affiliate_partner/202501/campaigns/${tapId}/products/${pId}/performance`,
          'GET',
          accessToken,
          {
            category_asset_cipher: cipher,
            page_size: 50
          }
        );

        const creatorsPerf = perfRes.data?.data?.creator_performances || perfRes.data?.data?.performances || [];

        for (const cp of creatorsPerf) {
          const uname = (cp.creator_username || cp.username || '').toLowerCase().trim();
          const contents = cp.contents || cp.content_list || [];

          // Process each content (Video VT or Livestream)
          for (const item of contents) {
            const cUid = String(item.content_uid || item.video_id || item.room_id || '').trim();
            if (!cUid) continue;

            const isLive = item.content_type === 'livestream' || item.content_type === 'live' || item.type === 2;
            const cType = isLive ? 'livestream' : 'video';
            const views = Number(item.views || item.video_views || item.play_count || 0);
            const likes = isLive ? 0 : Number(item.likes || item.video_likes || item.like_count || 0);
            const rpm = Number(item.product_rpm || item.rpm || 0);
            const durationStr = item.duration_str || item.live_duration || null;
            const postTime = item.post_time 
              ? new Date(Number(item.post_time) * 1000).toISOString()
              : (item.tanggal || new Date().toISOString());

            videoRowsToInsert.push({
              content_uid: cUid,
              creator_username: uname || 'unknown',
              content_type: cType,
              video_views: views,
              video_likes: likes,
              video_product_rpm: rpm,
              duration_str: durationStr,
              product_id: pId,
              campaign_id: campaignDbId,
              tiktok_campaign_id: tapId,
              tanggal: postTime,
              raw_data: item
            });
          }
        }
      }

      // 4c. Fetch Affiliate Orders (Sales) for the last 60 days
      const nowSec = Math.floor(Date.now() / 1000);
      const sixtyDaysAgo = nowSec - (60 * 24 * 3600);

      const ordersRes = await callTikTokShopApi(
        '/affiliate_partner/202411/orders/search',
        'POST',
        accessToken,
        {
          category_asset_cipher: cipher,
          page_size: 100
        },
        {
          campaign_id: tapId,
          create_time_ge: sixtyDaysAgo,
          create_time_lt: nowSec
        }
      );

      const ordersList = ordersRes.data?.data?.orders || ordersRes.data?.data?.order_list || [];

      for (const ord of ordersList) {
        const orderId = String(ord.order_id || ord.id || '').trim();
        if (!orderId) continue;

        const pId = ord.product_id ? String(ord.product_id).trim() : null;
        const uname = (ord.creator_username || ord.creator_name || '').toLowerCase().trim();
        const cUid = ord.content_uid ? String(ord.content_uid).trim() : null;
        const cType = (ord.content_type === 'livestream' || ord.content_type === 'live') ? 'livestream' : 'video';
        const gmv = Number(ord.gmv || ord.order_amount || ord.commission_base || 0);
        const qty = Number(ord.quantity || ord.item_count || 1);
        const price = qty > 0 ? (gmv / qty) : gmv;
        const status = ord.order_status || ord.status || 'COMPLETED';
        const isRefund = ord.is_refund || status === 'REFUND' || status === 'CANCELLED';
        const commRate = ord.commission_rate || null;
        const orderDate = ord.create_time 
          ? new Date(Number(ord.create_time) * 1000).toISOString()
          : (ord.tanggal || new Date().toISOString());

        salesRowsToInsert.push({
          order_id: orderId,
          campaign_id: campaignDbId,
          creator_username: uname || null,
          content_uid: cUid,
          product_id: pId,
          tanggal: orderDate,
          price,
          quantity: qty,
          gmv,
          is_refund: isRefund,
          content_type: cType,
          order_status: status,
          commission_rate: commRate,
          attribution_type: ord.attribution_type || 'TAP',
          tiktok_campaign_id: tapId,
          raw_data: ord
        });
      }

      // 4d. Execute Bulk Upsert
      if (salesRowsToInsert.length > 0 || videoRowsToInsert.length > 0) {
        await executeSalesImportChunkAction(salesRowsToInsert, videoRowsToInsert, false);
        totalSalesCount += salesRowsToInsert.length;
        totalVideosCount += videoRowsToInsert.length;
      }

      campaignsProcessed++;
      syncDetails.push({
        tapCampaignId: tapId,
        tapCampaignName: tapName,
        matchedCampaignId: campaignDbId,
        productsCount: products.length,
        salesCount: salesRowsToInsert.length,
        videosCount: videoRowsToInsert.length
      });
    }

    // 5. Run Global Unmapped Auto-Sync & Creator Association
    console.log('[TikTok AutoSync] Running global auto-mapping for unmapped creators & products...');
    const unmappedRes = await syncAllUnmappedGlobal();

    // 6. Update last_synced_at & Log Execution
    const durationMs = Date.now() - startTime;
    await db.execute(sql`
      UPDATE tiktok_authorizations
      SET last_synced_at = NOW()
      WHERE status = 'active'
    `);

    const summaryMsg = `Sukses sinkronisasi ${campaignsProcessed} kampanye (${totalSalesCount} order sales, ${totalVideosCount} video/live konten, ${unmappedRes.totalSalesUpdated || 0} mapping updated).`;
    await logSyncExecution(triggerType, 'success', totalSalesCount, totalVideosCount, campaignsProcessed, summaryMsg, { syncDetails, unmappedRes }, durationMs);

    console.log(`[TikTok AutoSync] Finished successfully in ${durationMs}ms.`);

    return {
      success: true,
      message: summaryMsg,
      triggerType,
      durationMs,
      campaignsProcessed,
      salesUpserted: totalSalesCount,
      videosUpserted: totalVideosCount,
      details: { syncDetails, unmappedRes }
    };

  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    console.error('[TikTok AutoSync] Execution error:', error);
    await logSyncExecution(triggerType, 'failed', 0, 0, 0, error.message, null, durationMs);
    return {
      success: false,
      message: `Gagal sinkronisasi: ${error.message}`,
      triggerType,
      durationMs,
      campaignsProcessed: 0,
      salesUpserted: 0,
      videosUpserted: 0,
      error: error.message
    };
  }
}

/**
 * Helper to record sync logs in PostgreSQL
 */
async function logSyncExecution(
  triggerType: string,
  status: string,
  salesCount: number,
  videosCount: number,
  campaignsCount: number,
  message: string,
  details: any,
  durationMs: number
) {
  try {
    const rawDetails = details ? JSON.stringify(details) : null;
    await db.execute(sql`
      INSERT INTO tiktok_sync_logs (
        trigger_type, status, sales_count, videos_count, campaigns_count,
        message, details, duration_ms, created_at
      ) VALUES (
        ${triggerType}, ${status}, ${salesCount}, ${videosCount}, ${campaignsCount},
        ${message}, ${rawDetails}::jsonb, ${durationMs}, NOW()
      )
    `);
  } catch (logErr) {
    console.warn('Failed to insert sync log:', logErr);
  }
}
