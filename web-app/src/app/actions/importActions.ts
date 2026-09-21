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

export async function executeSalesImportAction(salesRows: any[], videoRows: any[], isVideoMode = false) {
  let salesInserted = 0;
  let videosInserted = 0;

  // 1. Batch upsert sales
  if (salesRows.length > 0) {
    for (const row of salesRows) {
      if (!row.order_id) continue;
      await db.execute(sql`
        INSERT INTO sales (
          order_id, sku_id, campaign_id, creator_username, content_uid, product_id,
          tanggal, price, quantity, gmv, is_refund, content_type, order_status,
          commission_rate, attribution_type, tiktok_campaign_id, shop_code, raw_data
        ) VALUES (
          ${row.order_id},
          ${row.sku_id || null},
          ${row.campaign_id || null},
          ${row.creator_username || null},
          ${row.content_uid || null},
          ${row.product_id || null},
          ${row.tanggal},
          ${row.price || 0},
          ${row.quantity || 1},
          ${row.gmv || 0},
          ${row.is_refund ? true : false},
          ${row.content_type || 'video'},
          ${row.order_status || null},
          ${row.commission_rate || null},
          ${row.attribution_type || null},
          ${row.tiktok_campaign_id || null},
          ${row.shop_code || null},
          ${JSON.stringify(row.raw_data || {})}::jsonb
        )
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
      salesInserted++;
    }
  }

  // 2. Batch upsert organic_videos
  if (videoRows.length > 0) {
    for (const v of videoRows) {
      if (!v.content_uid) continue;
      await db.execute(sql`
        INSERT INTO organic_videos (
          content_uid, product_id, campaign_id, creator_username, post_time,
          video_views, video_likes, duration_str, video_product_rpm, raw_data
        ) VALUES (
          ${v.content_uid},
          ${v.product_id || null},
          ${v.campaign_id || null},
          ${v.creator_username || null},
          ${v.tanggal ? new Date(v.tanggal) : new Date()},
          ${v.video_views || 0},
          ${v.video_likes || 0},
          ${v.duration_str || null},
          ${v.video_product_rpm || 0},
          ${JSON.stringify(v.raw_data || {})}::jsonb
        )
        ON CONFLICT (content_uid, product_id) DO UPDATE SET
          campaign_id = COALESCE(EXCLUDED.campaign_id, organic_videos.campaign_id),
          creator_username = COALESCE(EXCLUDED.creator_username, organic_videos.creator_username),
          post_time = EXCLUDED.post_time,
          video_views = GREATEST(organic_videos.video_views, EXCLUDED.video_views),
          video_likes = GREATEST(organic_videos.video_likes, EXCLUDED.video_likes),
          duration_str = COALESCE(EXCLUDED.duration_str, organic_videos.duration_str),
          video_product_rpm = EXCLUDED.video_product_rpm,
          raw_data = EXCLUDED.raw_data
      `);
      videosInserted++;
    }
  }

  // 3. Auto-link creators
  const allUsernames = Array.from(new Set([
    ...salesRows.map(r => r.creator_username?.toLowerCase().trim()),
    ...videoRows.map(r => r.creator_username?.toLowerCase().trim())
  ])).filter(Boolean) as string[];

  for (const uname of allUsernames) {
    await db.execute(sql`
      INSERT INTO creators (username, nama_asli, link_account, added_by)
      VALUES (${uname}, ${uname}, ${'https://tiktok.com/@' + uname}, 'system')
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
      if (item.sku_id) assignments[item.campaign_id][uname].add(item.sku_id);
    }
  }

  for (const campIdStr of Object.keys(assignments)) {
    const campId = parseInt(campIdStr);
    const unames = Object.keys(assignments[campId]);

    for (const uname of unames) {
      const creatorRes = await db.execute(sql`SELECT id FROM creators WHERE LOWER(username) = ${uname} LIMIT 1`);
      const creatorId = (creatorRes as unknown as any[])[0]?.id;
      if (!creatorId) continue;

      const newSkus = Array.from(assignments[campId][uname]);
      const ccRes = await db.execute(sql`
        SELECT id, assigned_sku_ids FROM campaign_creators
        WHERE campaign_id = ${campId} AND creator_id = ${creatorId}
        LIMIT 1
      `);
      const existingCc = (ccRes as unknown as any[])[0];

      if (existingCc) {
        const currentSkus = (existingCc.assigned_sku_ids as number[]) || [];
        const merged = Array.from(new Set([...currentSkus, ...newSkus]));
        if (merged.length !== currentSkus.length) {
          await db.execute(sql`
            UPDATE campaign_creators
            SET assigned_sku_ids = ${merged}
            WHERE id = ${existingCc.id}
          `);
        }
      } else {
        await db.execute(sql`
          INSERT INTO campaign_creators (
            campaign_id, creator_id, tier, assigned_sku_ids, approval,
            client_approval, status_bayar, qty_vt, price
          ) VALUES (
            ${campId}, ${creatorId}, 'Nano', ${newSkus}, 'pending',
            'not_required', 'belum', 1, 0
          )
        `);
      }
    }
  }

  // 5. Auto Populate Videos table if isVideoMode
  if (isVideoMode) {
    const uniqueVideos = Array.from(new Set(videoRows.map(p => p.content_uid).filter(Boolean)));
    for (const vUid of uniqueVideos) {
      const matchingRows = videoRows.filter(p => p.content_uid === vUid && p.campaign_id && p.creator_username);
      if (matchingRows.length === 0) continue;
      const firstRow = matchingRows[0];
      const uname = firstRow.creator_username.toLowerCase().trim();

      const ccRes = await db.execute(sql`
        SELECT cc.id FROM campaign_creators cc
        JOIN creators c ON cc.creator_id = c.id
        WHERE cc.campaign_id = ${firstRow.campaign_id} AND LOWER(c.username) = ${uname}
        LIMIT 1
      `);
      const ccId = (ccRes as unknown as any[])[0]?.id;
      if (!ccId) continue;

      const vidExist = await db.execute(sql`SELECT id FROM videos WHERE content_uid = ${vUid} LIMIT 1`);
      if ((vidExist as unknown as any[]).length === 0) {
        const maxUrutanRes = await db.execute(sql`
          SELECT COALESCE(MAX(urutan), 0) as max_u FROM videos WHERE campaign_creator_id = ${ccId}
        `);
        const nextUrutan = Number((maxUrutanRes as unknown as any[])[0]?.max_u || 0) + 1;

        await db.execute(sql`
          INSERT INTO videos (
            campaign_creator_id, content_uid, link_video, vt_approval, urutan, sku_id, created_at
          ) VALUES (
            ${ccId},
            ${vUid},
            ${'https://www.tiktok.com/@' + uname + '/video/' + vUid},
            'pending',
            ${nextUrutan},
            ${firstRow.sku_id || null},
            ${firstRow.tanggal ? new Date(firstRow.tanggal) : new Date()}
          )
        `);
      }
    }
  }

  revalidatePath('/input-penjualan');
  revalidatePath('/campaigns');
  return { success: true, salesInserted, videosInserted };
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
  dateRange: { minDate: string; maxDate: string }
) {
  // Delete existing records in date range
  if (dateRange.minDate && dateRange.maxDate) {
    await db.execute(sql`
      DELETE FROM ads_performance
      WHERE tanggal >= ${dateRange.minDate} AND tanggal <= ${dateRange.maxDate}
    `);
  }

  let inserted = 0;
  for (const item of rawInserts) {
    await db.execute(sql`
      INSERT INTO ads_performance (
        ad_id, ad_name, campaign_ads_name, campaign_id, creator_id, product_id,
        tanggal, cost_usd, gross_revenue_usd, impressions, clicks, purchases, kurs, raw_data
      ) VALUES (
        ${item.ad_id},
        ${item.ad_name || null},
        ${item.campaign_ads_name || null},
        ${item.campaign_id || null},
        ${item.creator_id || null},
        ${item.product_id || null},
        ${item.tanggal},
        ${item.cost_usd || 0},
        ${item.gross_revenue_usd || 0},
        ${item.impressions || 0},
        ${item.clicks || 0},
        ${item.purchases || 0},
        ${item.kurs || 16000},
        ${JSON.stringify(item.raw_data || {})}::jsonb
      )
    `);
    inserted++;
  }

  revalidatePath('/ads-report');
  return { success: true, count: inserted };
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