'use server';

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function fetchImportMetadataAction() {
  const [skus, campaigns] = await Promise.all([
    db.execute(sql`SELECT * FROM skus ORDER BY id DESC`),
    db.execute(sql`SELECT * FROM campaigns ORDER BY id DESC`)
  ]);

  return {
    skus: (skus as unknown as any[]) || [],
    campaigns: (campaigns as unknown as any[]) || []
  };
}

export async function insertCustomSkuAction(payload: {
  nama_produk: string;
  product_id: string;
  campaign_id: number;
}) {
  const res = await db.execute(sql`
    INSERT INTO skus (nama_produk, product_id, campaign_id)
    VALUES (${payload.nama_produk}, ${payload.product_id}, ${payload.campaign_id})
    RETURNING *
  `);
  revalidatePath('/skus');
  return (res as unknown as any[])[0];
}

export async function executeSalesImportChunkAction(salesRows: any[], videoRows: any[], isVideoMode = false) {
  try {

    // Semua penulisan dibungkus SATU transaksi.
    // Kalau gagal di tengah (timeout, koneksi putus, constraint), PostgreSQL
    // membatalkan semuanya. Sebelumnya kalau gagal setelah sales masuk tapi
    // sebelum organic_videos selesai, data tertinggal setengah jadi tanpa error.
    const result = await db.transaction(async (tx) => {
      let salesInserted = 0;
      let videosInserted = 0;

      // 1. High-Performance Bulk Multi-Row Upsert for Sales
      if (salesRows.length > 0) {
        const dedupedSales = new Map<string, any>();
        for (const r of salesRows) {
          if (!r.order_id) continue;
          const oId = String(r.order_id).trim();
          const existing = dedupedSales.get(oId);
          if (existing) {
            existing.quantity = (existing.quantity || 0) + (r.quantity || 1);
            existing.gmv = (Number(existing.gmv) || 0) + (Number(r.gmv) || 0);
            if (r.sku_id && !existing.sku_id) existing.sku_id = r.sku_id;
            if (r.campaign_id && !existing.campaign_id) existing.campaign_id = r.campaign_id;
            if (r.creator_username && !existing.creator_username) existing.creator_username = r.creator_username;
            if (r.content_uid && !existing.content_uid) existing.content_uid = r.content_uid;
            if (r.product_id && !existing.product_id) existing.product_id = r.product_id;
            existing.raw_data = { ...(existing.raw_data || {}), ...(r.raw_data || {}) };
          } else {
            dedupedSales.set(oId, { ...r });
          }
        }

        const validSales = Array.from(dedupedSales.values());
        if (validSales.length > 0) {
          const salesTuples = validSales.map(row => {
            const rawClean = JSON.stringify(row.raw_data || {}).replace(/\\u0000/g, '');
            const rowDate = (row.tanggal && !isNaN(new Date(row.tanggal).getTime()))
              ? new Date(row.tanggal).toISOString()
              : new Date().toISOString();
            const uname = (row.creator_username && String(row.creator_username).trim())
              ? String(row.creator_username).trim().toLowerCase()
              : null;

            return sql`(
              ${String(row.order_id).trim()},
              ${row.sku_id || null},
              ${row.campaign_id || null},
              ${uname},
              ${row.content_uid ? String(row.content_uid).trim() : null},
              ${row.product_id ? String(row.product_id).trim() : null},
              ${rowDate}::timestamptz,
              ${Number(row.price) || 0},
              ${Number(row.quantity) || 1},
              ${Number(row.gmv) || 0},
              ${row.is_refund ? true : false},
              ${row.content_type || 'video'},
              ${row.order_status || null},
              ${row.commission_rate || null},
              ${row.attribution_type || null},
              ${row.tiktok_campaign_id ? String(row.tiktok_campaign_id).trim() : null},
              ${row.shop_code || null},
              ${rawClean}::jsonb
            )`;
          });

          await tx.execute(sql`
            INSERT INTO sales (
              order_id, sku_id, campaign_id, creator_username, content_uid, product_id,
              tanggal, price, quantity, gmv, is_refund, content_type, order_status,
              commission_rate, attribution_type, tiktok_campaign_id, shop_code, raw_data
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
              shop_code = EXCLUDED.shop_code,
              raw_data = EXCLUDED.raw_data
          `);
          salesInserted = validSales.length;
        }
      }

      // 2. High-Performance Bulk Multi-Row Upsert for Organic Videos
      if (videoRows.length > 0) {
        const dedupedVideos = new Map<string, any>();
        for (const v of videoRows) {
          if (!v.content_uid) continue;
          const cUid = String(v.content_uid).trim();
          const pId = v.product_id ? String(v.product_id).trim() : '';
          const key = `${cUid}:::${pId}`;
          const existing = dedupedVideos.get(key);
          if (existing) {
            existing.video_views = Math.max(Number(existing.video_views) || 0, Number(v.video_views) || 0);
            existing.video_likes = Math.max(Number(existing.video_likes) || 0, Number(v.video_likes) || 0);
            existing.video_product_rpm = Math.max(Number(existing.video_product_rpm) || 0, Number(v.video_product_rpm) || 0);
            if (v.campaign_id && !existing.campaign_id) existing.campaign_id = v.campaign_id;
            if (v.creator_username && (!existing.creator_username || existing.creator_username === 'unknown')) {
              existing.creator_username = v.creator_username;
            }
            if (v.duration_str && !existing.duration_str) existing.duration_str = v.duration_str;
            if (v.content_type && !existing.content_type) existing.content_type = v.content_type;
            if (v.tiktok_campaign_id && !existing.tiktok_campaign_id) existing.tiktok_campaign_id = v.tiktok_campaign_id;
            if (v.tanggal && (!existing.tanggal || new Date(v.tanggal) > new Date(existing.tanggal))) {
              existing.tanggal = v.tanggal;
            }
            existing.raw_data = { ...(existing.raw_data || {}), ...(v.raw_data || {}) };
          } else {
            dedupedVideos.set(key, { ...v, content_uid: cUid, product_id: pId || null });
          }
        }

        const validVideos = Array.from(dedupedVideos.values());
        if (validVideos.length > 0) {
          const videoTuples = validVideos.map(v => {
            const rawClean = JSON.stringify(v.raw_data || {}).replace(/\\u0000/g, '');
            const postTime = (v.tanggal && !isNaN(new Date(v.tanggal).getTime()))
              ? new Date(v.tanggal).toISOString()
              : new Date().toISOString();
            const uname = (v.creator_username && String(v.creator_username).trim())
              ? String(v.creator_username).trim().toLowerCase()
              : 'unknown';

            return sql`(
              ${v.content_uid},
              ${v.product_id || null},
              ${v.campaign_id || null},
              ${uname},
              ${postTime}::timestamptz,
              ${Number(v.video_views) || 0},
              ${Number(v.video_likes) || 0},
              ${v.duration_str || null},
              ${Number(v.video_product_rpm) || 0},
              ${v.content_type || 'Video'},
              ${v.tiktok_campaign_id ? String(v.tiktok_campaign_id).trim() : null},
              ${rawClean}::jsonb
            )`;
          });

          await tx.execute(sql`
            INSERT INTO organic_videos (
              content_uid, product_id, campaign_id, creator_username, post_time,
              video_views, video_likes, duration_str, video_product_rpm, content_type,
              tiktok_campaign_id, raw_data
            ) VALUES ${sql.join(videoTuples, sql`, `)}
            ON CONFLICT (content_uid, product_id) DO UPDATE SET
              campaign_id = COALESCE(EXCLUDED.campaign_id, organic_videos.campaign_id),
              creator_username = CASE WHEN EXCLUDED.creator_username <> 'unknown' THEN EXCLUDED.creator_username ELSE organic_videos.creator_username END,
              post_time = EXCLUDED.post_time,
              video_views = GREATEST(organic_videos.video_views, EXCLUDED.video_views),
              video_likes = GREATEST(organic_videos.video_likes, EXCLUDED.video_likes),
              duration_str = COALESCE(EXCLUDED.duration_str, organic_videos.duration_str),
              video_product_rpm = EXCLUDED.video_product_rpm,
              content_type = EXCLUDED.content_type,
              tiktok_campaign_id = COALESCE(EXCLUDED.tiktok_campaign_id, organic_videos.tiktok_campaign_id),
              raw_data = EXCLUDED.raw_data
          `);
          videosInserted = validVideos.length;
        }
      }

      // 3. Batch Auto-link creators (Set-based)
      const allUsernames = Array.from(new Set([
        ...salesRows.map(r => r.creator_username?.toLowerCase().trim()),
        ...videoRows.map(r => r.creator_username?.toLowerCase().trim())
      ])).filter(Boolean) as string[];

      if (allUsernames.length > 0) {
        const creatorTuples = allUsernames.map(uname => sql`(
          ${uname}, ${uname}, ${'https://tiktok.com/@' + uname}, 'system'
        )`);
        await tx.execute(sql`
          INSERT INTO creators (username, nama_asli, link_account, added_by)
          VALUES ${sql.join(creatorTuples, sql`, `)}
          ON CONFLICT (username) DO NOTHING
        `);
      }

      // 4. Auto assign SKUs to campaign_creators
      const allRows = [...salesRows, ...videoRows];
      const assignments: Record<number, Record<string, Set<number>>> = {};

      for (const item of allRows) {
        if (item.campaign_id && item.creator_username) {
          const uname = item.creator_username.toLowerCase().trim();
          if (!assignments[item.campaign_id]) assignments[item.campaign_id] = {};
          if (!assignments[item.campaign_id][uname]) assignments[item.campaign_id][uname] = new Set();
          if (typeof item.sku_id === 'number' && !isNaN(item.sku_id)) {
            assignments[item.campaign_id][uname].add(item.sku_id);
          }
        }
      }

      if (allUsernames.length > 0 && Object.keys(assignments).length > 0) {
        const creatorsRes = await tx.execute(sql`
          SELECT id, LOWER(username) as username FROM creators WHERE LOWER(username) IN (${sql.join(allUsernames.map(u => sql`${u}`), sql`, `)})
        `);
        const creatorMap = new Map<string, number>();
        for (const c of (creatorsRes as any[])) {
          creatorMap.set(c.username, c.id);
        }

        for (const campIdStr of Object.keys(assignments)) {
          const campId = parseInt(campIdStr);
          const unames = Object.keys(assignments[campId]);

          for (const uname of unames) {
            const creatorId = creatorMap.get(uname);
            if (!creatorId) continue;

            const newSkus = Array.from(assignments[campId][uname]).filter(n => typeof n === 'number' && !isNaN(n));
            const newSkusLiteral = newSkus.length > 0 ? `{${newSkus.join(',')}}` : '{}';

            const ccRes = await tx.execute(sql`
              SELECT id, assigned_sku_ids FROM campaign_creators
              WHERE campaign_id = ${campId} AND creator_id = ${creatorId}
              LIMIT 1
            `);
            const existingCc = (ccRes as unknown as any[])[0];

            if (existingCc) {
              const currentSkus = (existingCc.assigned_sku_ids as number[]) || [];
              const merged = Array.from(new Set([...currentSkus, ...newSkus])).filter(n => typeof n === 'number' && !isNaN(n));
              if (merged.length !== currentSkus.length) {
                const mergedLiteral = merged.length > 0 ? `{${merged.join(',')}}` : '{}';
                await tx.execute(sql`
                  UPDATE campaign_creators
                  SET assigned_sku_ids = ${mergedLiteral}::int[]
                  WHERE id = ${existingCc.id}
                `);
              }
            } else {
              await tx.execute(sql`
                INSERT INTO campaign_creators (
                  campaign_id, creator_id, tier, assigned_sku_ids, approval,
                  client_approval, status_bayar, qty_vt, price
                ) VALUES (
                  ${campId}, ${creatorId}, 'Nano', ${newSkusLiteral}::int[], 'pending',
                  'not_required', 'belum', 1, 0
                )
              `);
            }
          }
        }
      }

      // 5. Auto Populate Videos table if isVideoMode
      if (isVideoMode && videoRows.length > 0) {
        const uniqueVideos = Array.from(new Set(videoRows.map(p => p.content_uid).filter(Boolean)));
        if (uniqueVideos.length > 0) {
          try {
            const existingVidsRes = await tx.execute(sql`
              SELECT content_uid FROM videos WHERE content_uid IN (${sql.join(uniqueVideos.map(u => sql`${u}`), sql`, `)})
            `);
            const existingSet = new Set((existingVidsRes as any[]).map(v => v.content_uid));
            const toInsertUids = uniqueVideos.filter(uid => !existingSet.has(uid));

            for (const vUid of toInsertUids) {
              const matchingRows = videoRows.filter(p => p.content_uid === vUid && p.campaign_id && p.creator_username);
              if (matchingRows.length === 0) continue;
              const firstRow = matchingRows[0];
              const uname = firstRow.creator_username.toLowerCase().trim();

              const ccRes = await tx.execute(sql`
                SELECT cc.id FROM campaign_creators cc
                JOIN creators c ON cc.creator_id = c.id
                WHERE cc.campaign_id = ${firstRow.campaign_id} AND LOWER(c.username) = ${uname}
                LIMIT 1
              `);
              const ccId = (ccRes as unknown as any[])[0]?.id;
              if (!ccId) continue;

              const maxUrutanRes = await tx.execute(sql`
                SELECT COALESCE(MAX(urutan), 0) as max_u FROM videos WHERE campaign_creator_id = ${ccId}
              `);
              const nextUrutan = Number((maxUrutanRes as unknown as any[])[0]?.max_u || 0) + 1;
              const vidDate = (firstRow.tanggal && !isNaN(new Date(firstRow.tanggal).getTime()))
                ? new Date(firstRow.tanggal)
                : new Date();

              await tx.execute(sql`
                INSERT INTO videos (
                  campaign_creator_id, content_uid, link_video, vt_approval, urutan, sku_id, created_at
                ) VALUES (
                  ${ccId},
                  ${vUid},
                  ${'https://www.tiktok.com/@' + uname + '/video/' + vUid},
                  'pending',
                  ${nextUrutan},
                  ${firstRow.sku_id || null},
                  ${vidDate}
                )
              `);
            }
          } catch (vidErr: any) {
            console.warn('Auto-populate videos warning (non-fatal):', vidErr?.message || vidErr);
          }
        }
      }

      return { success: true, salesInserted, videosInserted };
    });

    return result;
  } catch (err: any) {
    console.error("[import] FATAL executeSalesImportChunkAction:", err);
    if (err?.stack) console.error("[import] stack:", err.stack);

    // Diagnosis: error ini muncul di UI tanpa jejak di server log, jadi
    // informasinya dititipkan di pesan yang tampil. Nama error, kode, dan
    // 2 baris pertama stack cukup untuk menemukan penyebabnya.
    const hint = [err?.name, err?.code ? `code=${err.code}` : null]
      .filter(Boolean)
      .join(' ');
    const topStack = String(err?.stack || '')
      .split('\n')
      .slice(1, 3)
      .map(s => s.trim().replace(/^at\s+/, ''))
      .filter(Boolean)
      .join(' <- ');

    const detailMsg = err?.detail || err?.cause?.message || err?.message || String(err);
    const cleanError =
      `${detailMsg} [${hint || 'no-name'}${topStack ? ' | ' + topStack : ''}]`.slice(0, 600);
    return {
      success: false,
      salesInserted: 0,
      videosInserted: 0,
      error: cleanError
    };
  }
}

export async function finishSalesImportAction() {
  revalidatePath('/input-penjualan');
  revalidatePath('/campaigns');
  revalidatePath('/performa');
  return { success: true };
}

export async function executeSalesImportAction(salesRows: any[], videoRows: any[], isVideoMode = false) {
  // Fallback wrapper that chunks if someone calls this directly with huge data
  const CHUNK_SIZE = 250;
  let totalSales = 0;
  let totalVideos = 0;

  for (let i = 0; i < salesRows.length; i += CHUNK_SIZE) {
    const chunk = salesRows.slice(i, i + CHUNK_SIZE);
    const res = await executeSalesImportChunkAction(chunk, [], isVideoMode);
    totalSales += res.salesInserted;
  }

  for (let i = 0; i < videoRows.length; i += CHUNK_SIZE) {
    const chunk = videoRows.slice(i, i + CHUNK_SIZE);
    const res = await executeSalesImportChunkAction([], chunk, isVideoMode);
    totalVideos += res.videosInserted;
  }

  await finishSalesImportAction();
  return { success: true, salesInserted: totalSales, videosInserted: totalVideos };
}

export async function fetchAdNameMappingsAction() {
  const rows = await db.execute(sql`
    SELECT * FROM ad_name_mapping ORDER BY id DESC
  `);
  return (rows as unknown as any[]) || [];
}

export async function saveAdNameMappingAction(mapping: {
  ad_name: string;
  campaign_id?: number | null;
  creator_id?: number | null;
  product_id?: string | null;
}) {
  await db.execute(sql`
    INSERT INTO ad_name_mapping (ad_name, campaign_id, creator_id, product_id)
    VALUES (${mapping.ad_name}, ${mapping.campaign_id || null}, ${mapping.creator_id || null}, ${mapping.product_id || null})
    ON CONFLICT (ad_name) DO UPDATE SET
      campaign_id = EXCLUDED.campaign_id,
      creator_id = EXCLUDED.creator_id,
      product_id = EXCLUDED.product_id
  `);
  return { success: true };
}

export async function executeAdsImportAction(
  rawInserts: any[],
  dateRange: { minDate: string; maxDate: string },
  campaignId?: number | null
) {
  try {
    if (rawInserts.length === 0) return { success: true, count: 0 };

    // 1. Delete existing records in date range scoped to campaign (prevents deleting other campaigns)
    if (dateRange.minDate && dateRange.maxDate) {
      if (campaignId) {
        await db.execute(sql`
          DELETE FROM ads_performance
          WHERE campaign_id = ${campaignId}
            AND tanggal >= ${dateRange.minDate}
            AND tanggal <= ${dateRange.maxDate}
        `);
      } else {
        await db.execute(sql`
          DELETE FROM ads_performance
          WHERE tanggal >= ${dateRange.minDate}
            AND tanggal <= ${dateRange.maxDate}
        `);
      }
    }

    // 2. High-Performance Bulk Multi-Row Insert in Chunks (100 rows each)
    const CHUNK_SIZE = 100;
    let inserted = 0;

    for (let i = 0; i < rawInserts.length; i += CHUNK_SIZE) {
      const chunk = rawInserts.slice(i, i + CHUNK_SIZE);
      const tuples = chunk.map(item => {
        const rawClean = JSON.stringify(item.raw_data || {}).replace(/\\u0000/g, '');
        let kursVal = Number(item.kurs) || 16000;
        if (kursVal < 1000) kursVal = kursVal * 1000;

        return sql`(
          ${item.ad_id},
          ${item.ad_name || null},
          ${item.campaign_ads_name || null},
          ${item.campaign_id || null},
          ${item.creator_id || null},
          ${item.product_id || null},
          ${item.tanggal},
          ${Number(item.cost_usd) || 0},
          ${Number(item.gross_revenue_usd) || 0},
          ${Number(item.impressions) || 0},
          ${Number(item.clicks) || 0},
          ${Number(item.purchases) || 0},
          ${kursVal},
          ${Number(item.product_page_views) || 0},
          ${Number(item.checkouts_initiated) || 0},
          ${Number(item.items_purchased) || 0},
          ${rawClean}::jsonb
        )`;
      });

      await db.execute(sql`
        INSERT INTO ads_performance (
          ad_id, ad_name, campaign_ads_name, campaign_id, creator_id, product_id,
          tanggal, cost_usd, gross_revenue_usd, impressions, clicks, purchases, kurs,
          product_page_views, checkouts_initiated, items_purchased, raw_data
        ) VALUES ${sql.join(tuples, sql`, `)}
      `);
      inserted += chunk.length;
    }

    revalidatePath('/ads-report');
    revalidatePath('/ads-report/budgeting-ads');
    return { success: true, count: inserted };
  } catch (err: any) {
    console.error("FATAL ERROR in executeAdsImportAction:", err);
    return { success: false, count: 0, error: err?.message || String(err) };
  }
}

export async function syncOrphanedSalesAction() {
  const res = await db.execute(sql`
    WITH mapped_sales AS (
      SELECT 
        s.id,
        sk.campaign_id as target_campaign_id,
        sk.id as target_sku_id
      FROM sales s
      JOIN skus sk ON s.product_id = sk.product_id
      WHERE s.campaign_id IS NULL
    )
    UPDATE sales s
    SET 
      campaign_id = ms.target_campaign_id,
      sku_id = COALESCE(s.sku_id, ms.target_sku_id)
    FROM mapped_sales ms
    WHERE s.id = ms.id
    RETURNING s.id
  `);

  const updatedCount = (res as any[])?.length || 0;
  revalidatePath('/skus');
  return { success: true, updatedCount };
}

export async function importLiveOrganicAction(sessions: any[], products: any[]) {
  try {
    // 1. Batch upsert live_sessions
    for (const s of sessions) {
      await db.execute(sql`
        INSERT INTO live_sessions (
          livestream_room_id, creator_username, tt_campaign_id, livestream_name,
          start_time, end_time, duration_str, live_views, live_likes, live_product_rpm
        ) VALUES (
          ${s.livestream_room_id},
          ${s.creator_username},
          ${s.tt_campaign_id || null},
          ${s.livestream_name || null},
          ${s.start_time || null},
          ${s.end_time || null},
          ${s.duration_str || null},
          ${s.live_views || 0},
          ${s.live_likes || 0},
          ${s.live_product_rpm || 0}
        )
        ON CONFLICT (livestream_room_id) DO UPDATE SET
          creator_username = EXCLUDED.creator_username,
          tt_campaign_id = EXCLUDED.tt_campaign_id,
          livestream_name = EXCLUDED.livestream_name,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          duration_str = EXCLUDED.duration_str,
          live_views = EXCLUDED.live_views,
          live_likes = EXCLUDED.live_likes,
          live_product_rpm = EXCLUDED.live_product_rpm
      `);
    }

    // 2. Clean old products for these room IDs
    const roomIds = sessions.map(s => s.livestream_room_id).filter(Boolean);
    if (roomIds.length > 0) {
      await db.execute(sql`
        DELETE FROM live_session_products
        WHERE livestream_room_id IN (${sql.join(roomIds.map(id => sql`${id}`), sql`, `)})
      `);
    }

    // 3. Insert new products in batches
    for (const p of products) {
      await db.execute(sql`
        INSERT INTO live_session_products (
          livestream_room_id, product_id, product_name, shop_id, shop_name,
          category_1, category_2, gmv, orders, items_sold, commission, actual_commission
        ) VALUES (
          ${p.livestream_room_id},
          ${p.product_id},
          ${p.product_name || null},
          ${p.shop_id || null},
          ${p.shop_name || null},
          ${p.category_1 || null},
          ${p.category_2 || null},
          ${p.gmv || 0},
          ${p.orders || 0},
          ${p.items_sold || 0},
          ${p.commission || 0},
          ${p.actual_commission || 0}
        )
      `);
    }

    revalidatePath('/import-data');
    return { success: true, sessionsCount: sessions.length, productsCount: products.length };
  } catch (error: any) {
    console.error('Error importing live organic data:', error);
    return { success: false, error: error.message };
  }
}