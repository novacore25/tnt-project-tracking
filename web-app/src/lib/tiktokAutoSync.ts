import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { callTikTokShopApi, getValidTikTokToken, saveTikTokAuthTokens } from '@/utils/tiktokShopApi';
import { executeSalesImportChunkAction } from '@/app/actions/importActions';
import { syncAllUnmappedGlobal } from '@/lib/syncUnmapped';

export interface SyncProgressUpdate {
  stage: 'auth' | 'campaigns' | 'products' | 'orders' | 'saving' | 'mapping' | 'done' | 'error';
  percent: number;
  message: string;
  totalCampaigns?: number;
  campaignIndex?: number;
  currentCampaign?: string;
  salesCount?: number;
  videosCount?: number;
}

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

export interface TikTokAutoSyncOptions {
  campaignId?: number;
  triggerType?: 'cron' | 'manual';
  daysBack?: number;
  startDate?: string;
  endDate?: string;
  month?: string;
  onProgress?: (progress: SyncProgressUpdate) => void;
}

/**
 * Execute Complete TikTok Shop OpenAPI Auto-Sync Pipeline
 * Syncs Sales, Video VT Performance, and Livestream Sessions
 */
export async function runTikTokAutoSync(options?: TikTokAutoSyncOptions): Promise<TikTokSyncResult> {
  const startTime = Date.now();
  const triggerType = options?.triggerType || 'cron';
  const emitProgress = (update: SyncProgressUpdate) => {
    try {
      if (options?.onProgress) options.onProgress(update);
    } catch (e) {
      // ignore
    }
  };

  try {
    console.log(`[TikTok AutoSync] Starting auto-sync pipeline (trigger: ${triggerType})...`);
    emitProgress({
      stage: 'auth',
      percent: 10,
      message: 'Memeriksa dan memvalidasi otorisasi Partner Center...'
    });

    // 1. Get Valid Access Token & Category Asset Cipher
    const tokenInfo = await getValidTikTokToken();
    if (!tokenInfo.isValid || !tokenInfo.accessToken) {
      const errMsg = tokenInfo.error || "Akses token TikTok tidak valid";
      await logSyncExecution(triggerType, 'failed', 0, 0, 0, errMsg, null, Date.now() - startTime);
      emitProgress({ stage: 'error', percent: 100, message: errMsg });
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
    const diagnosticData: Record<string, any> = {
      startTime: new Date(startTime).toISOString(),
      triggerType,
      auth: {
        sellerName: tokenInfo.sellerName,
        activeCipher: cipher,
        allAssets: []
      },
      orderApiLogs: [],
      campaignsList: [],
      productLogs: [],
      syncErrors: []
    };

    let assets: any[] = [];
    // 1b. Fetch all category assets to inspect available ciphers
    try {
      const assetRes = await callTikTokShopApi(
        '/authorization/202405/category_assets',
        'GET',
        accessToken
      );
      diagnosticData.auth.categoryAssetsApi = {
        success: assetRes.success,
        code: assetRes.data?.code,
        message: assetRes.data?.message
      };

      assets = assetRes.data?.data?.category_assets || [];
      diagnosticData.auth.allAssets = assets;
    } catch (e: any) {
      diagnosticData.auth.categoryAssetsError = e.message;
    }

    // Resolve official TAP Category Cipher (Seller and Scalable Creator Match-Up: 839312)
    const tapMatchupAsset = assets.find((a: any) => 
      (a.category?.name || '').toLowerCase().includes('match-up') ||
      (a.category?.name || '').toLowerCase().includes('seller') ||
      a.category?.id === 839312
    );
    const tapCipher = tapMatchupAsset?.cipher || tapMatchupAsset?.category_asset_cipher || cipher || 'ROW_fyGlKwAAAAB6jCmj_Z8Zc6uknZJUdZAi';
    diagnosticData.auth.activeCipher = tapCipher;

    // Persist verified TAP cipher
    if (tapCipher) {
      await db.execute(sql`
        UPDATE tiktok_authorizations
        SET category_asset_cipher = ${tapCipher}
        WHERE status = 'active'
      `);
    }

    emitProgress({
      stage: 'campaigns',
      percent: 20,
      message: 'Mengambil daftar kampanye TAP aktif dari TikTok Shop...'
    });

    // 2. Fetch All TAP Campaigns from OpenAPI (with pagination)
    let tapCampaigns: any[] = [];
    let campNextPageToken = '';
    let campPage = 0;
    do {
      campPage++;
      const campParams: Record<string, any> = {
        category_asset_cipher: tapCipher,
        page_size: 100
      };
      if (campNextPageToken) campParams.page_token = campNextPageToken;

      const tapCampRes = await callTikTokShopApi(
        '/affiliate_partner/202405/campaigns',
        'GET',
        accessToken,
        campParams
      );

      const camps = tapCampRes.data?.data?.campaigns || [];
      tapCampaigns = tapCampaigns.concat(camps);
      campNextPageToken = tapCampRes.data?.data?.next_page_token || '';
    } while (campNextPageToken && campPage < 20);

    diagnosticData.campaignsList = tapCampaigns.map((tc: any) => ({
      id: tc.id,
      name: tc.name,
      status: tc.status,
      startTime: tc.campaign_start_time,
      endTime: tc.campaign_end_time
    }));

    console.log(`[TikTok AutoSync] Found ${tapCampaigns.length} total TAP campaigns in Partner Center.`);

    // 3. Load Internal Database Campaigns & SKUs for Matching
    const internalCampaigns = (await db.execute(sql`
      SELECT c.id, c.nama as nama_campaign,
             COALESCE(json_agg(s.product_id) FILTER (WHERE s.product_id IS NOT NULL), '[]') as product_ids
      FROM campaigns c
      LEFT JOIN skus s ON s.campaign_id = c.id
      GROUP BY c.id, c.nama
    `)) as any[];

    // Map internal campaigns by Product IDs and Names
    const skuToCampaignMap = new Map<string, number>();
    internalCampaigns.forEach(ic => {
      (ic.product_ids || []).forEach((pid: any) => {
        if (pid) skuToCampaignMap.set(String(pid).trim(), ic.id);
      });
    });

    let totalSalesCount = 0;
    let totalVideosCount = 0;
    let campaignsProcessed = 0;
    const syncDetails: any[] = [];
    const salesRowsToInsert: any[] = [];
    const videoRowsToInsert: any[] = [];
    const syncErrors: string[] = [];

    // 4. SYNC TAP ORDERS ACROSS DYNAMIC TIME WINDOWS VIA 202603 OPENAPI

    // Calculate time range based on options (month, custom date range, or daysBack)
    let overallStartSec: number;
    let overallEndSec: number;
    let rangeDescription = '';

    if (options?.month) {
      const parts = options.month.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const startObj = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
      const endObj = new Date(Date.UTC(y, m, 0, 23, 59, 59));
      overallStartSec = Math.floor(startObj.getTime() / 1000);
      overallEndSec = Math.floor(endObj.getTime() / 1000);
      rangeDescription = `Bulan ${options.month}`;
    } else if (options?.startDate && options?.endDate) {
      overallStartSec = Math.floor(new Date(`${options.startDate}T00:00:00+07:00`).getTime() / 1000);
      overallEndSec = Math.floor(new Date(`${options.endDate}T23:59:59+07:00`).getTime() / 1000);
      rangeDescription = `${options.startDate} s/d ${options.endDate}`;
    } else {
      const days = options?.daysBack || 90;
      const nowSec = Math.floor(Date.now() / 1000);
      overallEndSec = nowSec;
      overallStartSec = nowSec - (days * 24 * 3600);
      rangeDescription = `${days} hari terakhir`;
    }

    emitProgress({
      stage: 'orders',
      percent: 30,
      message: `Menarik transaksi pesanan TAP (${rangeDescription}) via OpenAPI 202603...`
    });

    const THIRTY_DAYS = 30 * 24 * 3600;
    // Split the date span into <= 30-day windows to comply with TikTok Shop OpenAPI constraints
    const timeWindows: { ge: number; lt: number; label: string }[] = [];
    let curEnd = overallEndSec;
    while (curEnd > overallStartSec) {
      const curStart = Math.max(overallStartSec, curEnd - THIRTY_DAYS);
      const startLabel = new Date(curStart * 1000).toISOString().split('T')[0];
      const endLabel = new Date(curEnd * 1000).toISOString().split('T')[0];
      timeWindows.push({
        ge: curStart,
        lt: curEnd,
        label: `${startLabel} s/d ${endLabel}`
      });
      curEnd = curStart;
    }

    diagnosticData.syncRange = {
      description: rangeDescription,
      startSec: overallStartSec,
      endSec: overallEndSec,
      windowsCount: timeWindows.length,
      windows: timeWindows
    };

    const orderEndpoint = '/affiliate_partner/202603/orders/search';

    const totalWindows = timeWindows.length;
    for (let wIdx = 0; wIdx < totalWindows; wIdx++) {
      const tw = timeWindows[wIdx];
      try {
        let nextPageToken = '';
        let page = 0;
        do {
          page++;
          const progressPercent = 30 + Math.min(25, Math.round(((wIdx + (page / (page + 2))) / totalWindows) * 25));
          emitProgress({
            stage: 'orders',
            percent: progressPercent,
            message: `Menarik transaksi pesanan TAP (${tw.label}, hal. ${page}) [${salesRowsToInsert.length} order, ${videoRowsToInsert.length} konten]...`,
            salesCount: salesRowsToInsert.length,
            videosCount: videoRowsToInsert.length
          });

          const queryParams: Record<string, any> = {
            category_asset_cipher: tapCipher,
            page_size: 100
          };
          if (nextPageToken) queryParams.page_token = nextPageToken;

          const tapOrdersRes = await callTikTokShopApi(
            orderEndpoint,
            'POST',
            accessToken,
            queryParams,
            {
              create_time_ge: tw.ge,
              create_time_lt: tw.lt
            }
          );

          const tapOrders = tapOrdersRes.data?.data?.sku_orders || tapOrdersRes.data?.data?.orders || [];
          nextPageToken = tapOrdersRes.data?.data?.next_page_token || '';

          diagnosticData.orderApiLogs.push({
            endpoint: orderEndpoint,
            category: 'Seller and Scalable Creator Match-Up',
            cipher: tapCipher,
            label: tw.label,
            page,
            success: tapOrdersRes.success,
            httpStatus: tapOrdersRes.status,
            code: tapOrdersRes.data?.code,
            message: tapOrdersRes.data?.message || 'OK',
            ordersCount: tapOrders.length,
            nextPageToken: !!nextPageToken,
            rawPreview: tapOrders.length > 0 ? tapOrders.slice(0, 2) : tapOrdersRes.data
          });

          if (!tapOrdersRes.success) {
            console.warn(`[TikTok AutoSync] TAP orders fetch (${orderEndpoint}, ${tw.label}) notice:`, tapOrdersRes.data?.message || 'Failed');
            break;
          }

          for (const ord of tapOrders) {
            const orderId = String(ord.id || ord.order_id || '').trim();
            if (!orderId) continue;

            const orderDate = (ord.create_time || ord.delivery_time)
              ? new Date(Number(ord.create_time || ord.delivery_time) * 1000).toISOString()
              : new Date().toISOString();

            // Unpack SKUs from order (can be nested sku array or flat sku_orders item)
            const rawSkus = ord.skus;
            const skuList = Array.isArray(rawSkus) && rawSkus.length > 0
              ? rawSkus
              : (rawSkus && typeof rawSkus === 'object' && Object.keys(rawSkus).length > 0 ? [rawSkus] : [ord]);

            for (const sku of skuList) {
              const pId = sku.product_id ? String(sku.product_id).trim() : (ord.product_id ? String(ord.product_id).trim() : null);
              const skuId = sku.sku_id ? String(sku.sku_id).trim() : (ord.sku_id ? String(ord.sku_id).trim() : null);
              const uname = (sku.creator_username || ord.creator_username || ord.creator_name || '').toLowerCase().trim();
              const cUid = sku.content_id ? String(sku.content_id).trim() : (ord.content_id ? String(ord.content_id).trim() : null);
              const rawCType = (sku.content_type || ord.content_type || '').toUpperCase();
              const cType = (rawCType === 'LIVE' || rawCType === 'LIVESTREAM') ? 'livestream' : 'video';
              
              // GMV derivation
              const gmv = Number(
                sku.actual_commission_base?.amount ||
                sku.estimated_commission_base?.amount || 
                ord.actual_commission_base?.amount ||
                ord.estimated_commission_base?.amount ||
                sku.price?.amount || 
                ord.price?.amount || 
                ord.order_amount || 
                ord.gmv || 0
              );
              const qty = Number(sku.quantity || ord.quantity || 1);
              const price = Number(sku.price?.amount || ord.price?.amount || (qty > 0 ? (gmv / qty) : gmv));
              const status = sku.settle_status || ord.settle_status || sku.status || ord.status || 'COMPLETED';
              const isRefund = sku.fully_return || ord.fully_return || status === 'CANCELLED' || status === 'REFUND' || Number(sku.refunded_quantity || 0) > 0;
              const commRate = sku.partner_standard_commission_rate || 
                               sku.partner_tap_bonus_commission_rate || 
                               sku.tap_commission_rate || 
                               sku.creator_standard_commission_rate || 
                               ord.partner_standard_commission_rate || 
                               ord.partner_tap_bonus_commission_rate || null;
              const tapCampaignId = sku.campaign_id || ord.campaign_id || null;

              // Deduplication check
              if (salesRowsToInsert.some(s => s.order_id === orderId && (!skuId || s.raw_data?.sku?.sku_id === skuId))) {
                continue;
              }

              // Link campaign
              let matchedCampId: number | null = null;
              if (pId && skuToCampaignMap.has(pId)) {
                matchedCampId = skuToCampaignMap.get(pId)!;
              }

              salesRowsToInsert.push({
                order_id: orderId,
                campaign_id: matchedCampId,
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
                attribution_type: 'TAP',
                tiktok_campaign_id: tapCampaignId,
                raw_data: { order: ord, sku }
              });

              // Automatically register video/live content if present in sales
              if (cUid && uname && !videoRowsToInsert.some(v => v.content_uid === cUid)) {
                videoRowsToInsert.push({
                  content_uid: cUid,
                  creator_username: uname,
                  content_type: cType,
                  video_views: 0,
                  video_likes: 0,
                  video_product_rpm: 0,
                  duration_str: null,
                  product_id: pId,
                  campaign_id: matchedCampId,
                  tiktok_campaign_id: tapCampaignId,
                  tanggal: orderDate,
                  raw_data: { autoGeneratedFromOrder: orderId, sku }
                });
              }
            }
          }
        } while (nextPageToken && page < 100);
      } catch (ordErr: any) {
        console.warn('[TikTok AutoSync] TAP orders fetch error:', ordErr.message);
        syncErrors.push(`TAP Orders exception (${tw.label}): ${ordErr.message}`);
      }
    }

    // 5. SYNC CAMPAIGN PRODUCTS & CREATOR CONTENT PERFORMANCE
    const totalTap = tapCampaigns.length;
    for (let i = 0; i < totalTap; i++) {
      const tap = tapCampaigns[i];
      const tapId = String(tap.id || tap.campaign_id);
      const tapName = tap.name || tap.campaign_name || '';

      const percentBase = 45 + Math.round((i / (totalTap || 1)) * 35);
      emitProgress({
        stage: 'products',
        percent: percentBase,
        message: `Menarik performa konten & live: "${tapName}" (${i + 1}/${totalTap})...`,
        totalCampaigns: totalTap,
        campaignIndex: i + 1,
        currentCampaign: tapName,
        salesCount: salesRowsToInsert.length,
        videosCount: videoRowsToInsert.length
      });

      // 5a. Fetch Products in this TAP campaign (with pagination)
      let products: any[] = [];
      let prodNextPageToken = '';
      let prodPage = 0;
      do {
        prodPage++;
        const prodParams: Record<string, any> = {
          category_asset_cipher: tapCipher,
          page_size: 100
        };
        if (prodNextPageToken) prodParams.page_token = prodNextPageToken;

        try {
          const prodRes = await callTikTokShopApi(
            `/affiliate_partner/202405/campaigns/${tapId}/products`,
            'GET',
            accessToken,
            prodParams
          );
          const prods = prodRes.data?.data?.products || [];
          products = products.concat(prods);
          prodNextPageToken = prodRes.data?.data?.next_page_token || '';
        } catch (e) {
          console.warn(`[TikTok AutoSync] Failed to fetch products for campaign ${tapId}:`, e);
          break;
        }
      } while (prodNextPageToken && prodPage < 10);

      const productIds = products.map((p: any) => String(p.id || p.product_id));

      // Match internal campaign
      let matchedCampaign = internalCampaigns.find(ic => {
        const cProductIds: string[] = (ic.product_ids || []).map(String);
        return productIds.some(pid => cProductIds.includes(String(pid)));
      });

      if (!matchedCampaign && tapName) {
        const cleanTapName = tapName.toLowerCase().trim();
        matchedCampaign = internalCampaigns.find(ic => {
          if (!ic.nama_campaign) return false;
          const cleanCampName = ic.nama_campaign.toLowerCase().trim();
          return cleanCampName === cleanTapName || cleanTapName.includes(cleanCampName) || cleanCampName.includes(cleanTapName);
        });
      }

      const campaignDbId = matchedCampaign ? matchedCampaign.id : null;

      // Auto-register discovered TAP campaign SKUs into internal campaign skus table if missing
      if (campaignDbId && products.length > 0) {
        for (const prod of products) {
          const pId = String(prod.id || prod.product_id || '').trim();
          const pTitle = prod.title || prod.name || prod.product_name || `Produk ${pId}`;
          if (pId && !skuToCampaignMap.has(pId)) {
            try {
              await db.execute(sql`
                INSERT INTO skus (campaign_id, product_id, nama_produk)
                VALUES (${campaignDbId}, ${pId}, ${pTitle})
              `);
              skuToCampaignMap.set(pId, campaignDbId);
              console.log(`[TikTok AutoSync] Auto-registered SKU ${pId} (${pTitle}) for campaign ${campaignDbId}`);
            } catch (skuErr: any) {
              // Ignore duplicate or constraint error
            }
          }
        }
      }

      // 5b. Fetch performance per product with creator pagination
      for (const prod of products) {
        const pId = String(prod.id || prod.product_id);
        const resolvedCampId = (pId && skuToCampaignMap.has(pId)) ? skuToCampaignMap.get(pId)! : campaignDbId;

        let creators: any[] = [];
        let perfNextPageToken = '';
        let perfPage = 0;

        do {
          perfPage++;
          const perfParams: Record<string, any> = {
            category_asset_cipher: tapCipher,
            page_size: 100
          };
          if (perfNextPageToken) perfParams.page_token = perfNextPageToken;

          try {
            let perfRes = await callTikTokShopApi(
              `/affiliate_partner/202508/campaigns/${tapId}/products/${pId}/performance`,
              'GET',
              accessToken,
              perfParams
            );

            if (!perfRes.success) {
              perfRes = await callTikTokShopApi(
                `/affiliate_partner/202501/campaigns/${tapId}/products/${pId}/performance`,
                'GET',
                accessToken,
                perfParams
              );
            }

            const pageCreators = perfRes.data?.data?.promotion_creators || [];
            creators = creators.concat(pageCreators);
            perfNextPageToken = perfRes.data?.data?.next_page_token || '';

            if (diagnosticData.productLogs.length < 30) {
              diagnosticData.productLogs.push({
                campaign: tapName,
                productId: pId,
                page: perfPage,
                success: perfRes.success,
                code: perfRes.data?.code,
                message: perfRes.data?.message,
                creatorsCount: pageCreators.length,
                hasNextPage: !!perfNextPageToken
              });
            }
          } catch (perfErr: any) {
            console.warn(`[TikTok AutoSync] Performance fetch error:`, perfErr.message);
            break;
          }
        } while (perfNextPageToken && perfPage < 20);

        // For each creator with content, fetch statistics for VIDEO and LIVE_ROOM
        await Promise.all(
          creators.map(async (pc: any) => {
            const uname = (pc.creator?.user_name || pc.creator?.nick_name || '').toLowerCase().trim();
            const tempId = pc.creator?.creator_temp_id;
            const affProdId = pc.affiliate_product_id || pId;
            if (!tempId) return;

            const contentTypes = ['VIDEO', 'LIVE_ROOM'];
            for (const cTypeParam of contentTypes) {
              try {
                const statRes = await callTikTokShopApi(
                  `/affiliate_partner/202508/campaigns/${tapId}/products/${pId}/creator/${tempId}/content/statistics`,
                  'GET',
                  accessToken,
                  {
                    category_asset_cipher: tapCipher,
                    affiliate_product_id: affProdId,
                    content_type: cTypeParam
                  }
                );

                const statsList = statRes.data?.data?.creator_content_statistics || [];
                for (const stat of statsList) {
                  let cUid = '';
                  const match = (stat.source_url || stat.linked_tiktok_video || '').match(/\/video\/(\d+)/);
                  if (match && match[1]) {
                    cUid = match[1];
                  } else if (stat.source_url) {
                    cUid = stat.source_url;
                  } else if (stat.content_id) {
                    cUid = String(stat.content_id);
                  }

                  if (!cUid) continue;

                  const isLive = cTypeParam === 'LIVE_ROOM' || stat.content_type === 'LIVE_ROOM' || stat.content_type === '2';
                  const cType = isLive ? 'livestream' : 'video';
                  const views = Number(stat.view_count || 0);
                  const likes = Number(stat.like_count || 0);
                  const postTime = stat.published_date 
                    ? new Date(stat.published_date).toISOString() 
                    : (stat.content_end_date ? new Date(stat.content_end_date).toISOString() : new Date().toISOString());

                  // Check if already in videoRowsToInsert
                  const existingIdx = videoRowsToInsert.findIndex(v => v.content_uid === cUid && (!v.product_id || v.product_id === pId));
                  if (existingIdx >= 0) {
                    // Update with richer stats
                    videoRowsToInsert[existingIdx].video_views = Math.max(videoRowsToInsert[existingIdx].video_views, views);
                    videoRowsToInsert[existingIdx].video_likes = Math.max(videoRowsToInsert[existingIdx].video_likes, likes);
                    if (!videoRowsToInsert[existingIdx].campaign_id && resolvedCampId) {
                      videoRowsToInsert[existingIdx].campaign_id = resolvedCampId;
                    }
                    if (!videoRowsToInsert[existingIdx].product_id) {
                      videoRowsToInsert[existingIdx].product_id = pId;
                    }
                    videoRowsToInsert[existingIdx].raw_data = { ...videoRowsToInsert[existingIdx].raw_data, ...stat };
                  } else {
                    videoRowsToInsert.push({
                      content_uid: cUid,
                      creator_username: uname || 'unknown',
                      content_type: cType,
                      video_views: views,
                      video_likes: likes,
                      video_product_rpm: 0,
                      duration_str: null,
                      product_id: pId,
                      campaign_id: resolvedCampId,
                      tiktok_campaign_id: tapId,
                      tanggal: postTime,
                      raw_data: stat
                    });
                  }
                }
              } catch (statErr) {
                // ignore content statistics error
              }
            }
          })
        );
      }

      campaignsProcessed++;
      syncDetails.push({
        tapCampaignId: tapId,
        tapCampaignName: tapName,
        matchedCampaignId: campaignDbId,
        productsCount: products.length
      });
    }

    emitProgress({
      stage: 'saving',
      percent: 85,
      message: 'Menyimpan data penjualan & konten ke database...',
      salesCount: salesRowsToInsert.length,
      videosCount: videoRowsToInsert.length
    });

    // 6. EXECUTE BULK UPSERT
    if (salesRowsToInsert.length > 0 || videoRowsToInsert.length > 0) {
      await executeSalesImportChunkAction(salesRowsToInsert, videoRowsToInsert, false);
      totalSalesCount = salesRowsToInsert.length;
      totalVideosCount = videoRowsToInsert.length;
    }

    emitProgress({
      stage: 'mapping',
      percent: 92,
      message: 'Menghubungkan kreator & produk ke kampanye internal...',
      salesCount: totalSalesCount,
      videosCount: totalVideosCount
    });

    // 7. RUN GLOBAL AUTO-MAPPER
    const unmappedRes = await syncAllUnmappedGlobal();

    // 8. UPDATE LAST_SYNCED_AT & LOG
    const durationMs = Date.now() - startTime;
    await db.execute(sql`
      UPDATE tiktok_authorizations
      SET last_synced_at = NOW()
      WHERE status = 'active'
    `);

    const fullDiagnostics = {
      ...diagnosticData,
      syncDetails,
      unmappedRes,
      totalSalesCount,
      totalVideosCount,
      campaignsProcessed
    };

    const mappingText = (unmappedRes.totalSalesUpdated || 0) > 0
      ? `${unmappedRes.totalSalesUpdated} order re-mapped`
      : 'semua order langsung terpetakan';
    const summaryMsg = `Sukses sinkronisasi ${campaignsProcessed} kampanye (${totalSalesCount} order sales, ${totalVideosCount} video/live konten, ${mappingText}).`;
    await logSyncExecution(triggerType, 'success', totalSalesCount, totalVideosCount, campaignsProcessed, summaryMsg, fullDiagnostics, durationMs);

    emitProgress({
      stage: 'done',
      percent: 100,
      message: summaryMsg,
      salesCount: totalSalesCount,
      videosCount: totalVideosCount
    });

    console.log(`[TikTok AutoSync] Finished successfully in ${durationMs}ms.`);

    return {
      success: true,
      message: summaryMsg,
      triggerType,
      durationMs,
      campaignsProcessed,
      salesUpserted: totalSalesCount,
      videosUpserted: totalVideosCount,
      details: fullDiagnostics
    };

  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    console.error('[TikTok AutoSync] Execution error:', error);
    await logSyncExecution(triggerType, 'failed', 0, 0, 0, error.message, null, durationMs);
    emitProgress({ stage: 'error', percent: 100, message: error.message });
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
