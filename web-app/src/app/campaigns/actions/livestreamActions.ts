'use server';

import { db } from '@/db';
import { sql } from 'drizzle-orm';

export async function getLivestreamData(campaignId: number) {
  try {
    // 1. Fetch Campaign Info
    const campaignRows = (await db.execute(sql`
      SELECT id, nama, brand_id, start_date, end_date, tiktok_campaign_ids
      FROM campaigns
      WHERE id = ${campaignId}
      LIMIT 1
    `).catch(() => [])) as any[];

    if (!campaignRows || campaignRows.length === 0) return null;
    const campaign = campaignRows[0];

    // 2. Fetch Campaign Creators
    const ccRows = (await db.execute(sql`
      SELECT 
        cc.id,
        cc.campaign_id,
        cc.creator_id,
        cc.approval,
        cc.qty_live,
        cc.tier,
        cc.price,
        c.username,
        c.nama_asli,
        c.link_account
      FROM campaign_creators cc
      JOIN creators c ON cc.creator_id = c.id
      WHERE cc.campaign_id = ${campaignId}
      ORDER BY cc.id ASC
    `).catch(() => [])) as any[];

    const formattedCCs = (ccRows || []).map((r: any) => ({
      ...r,
      creators: {
        id: r.creator_id,
        username: r.username,
        nama_asli: r.nama_asli,
        link_account: r.link_account,
      }
    }));

    // 3. Fetch Live Sales
    const salesRows = (await db.execute(sql`
      SELECT 
        creator_username,
        content_uid,
        COALESCE(quantity, 1) as quantity,
        COALESCE(gmv, 0) as gmv,
        tanggal,
        product_id
      FROM sales
      WHERE campaign_id = ${campaignId}
        AND (content_type ILIKE '%live%' OR content_type ILIKE '%livestream%')
    `).catch(() => [])) as any[];

    // Map sales by content_uid & creator_username
    const salesByUid = new Map<string, { gmv: number; orders: number }>();
    (salesRows || []).forEach((s: any) => {
      if (!s.content_uid) return;
      const key = s.content_uid.toString();
      const current = salesByUid.get(key) || { gmv: 0, orders: 0 };
      current.gmv += Number(s.gmv) || 0;
      current.orders += Number(s.quantity) || 1;
      salesByUid.set(key, current);
    });

    // 4. Fetch Live Sessions from `live_sessions` table
    const liveSessionsRows = (await db.execute(sql`
      SELECT 
        ls.id,
        ls.livestream_room_id as content_uid,
        ls.creator_username,
        ls.livestream_name,
        ls.start_time,
        ls.end_time,
        ls.duration_str,
        COALESCE(ls.live_views, 0) as video_views,
        COALESCE(ls.live_likes, 0) as video_likes,
        COALESCE(lsp_agg.gmv, 0) as gmv,
        COALESCE(lsp_agg.orders, 0) as orders
      FROM live_sessions ls
      LEFT JOIN (
        SELECT 
          livestream_room_id,
          SUM(COALESCE(gmv, 0)) as gmv,
          SUM(COALESCE(orders, 0)) as orders
        FROM live_session_products
        GROUP BY livestream_room_id
      ) lsp_agg ON ls.livestream_room_id = lsp_agg.livestream_room_id
      WHERE ls.tt_campaign_id = ${campaignId}::text
         OR ls.creator_username IN (
           SELECT c.username FROM campaign_creators cc
           JOIN creators c ON cc.creator_id = c.id
           WHERE cc.campaign_id = ${campaignId}
         )
    `).catch(() => [])) as any[];

    // 5. Fetch Live Sessions from `organic_videos` table (content_type = 'Livestream')
    const organicLiveRows = (await db.execute(sql`
      SELECT 
        ov.id,
        ov.content_uid,
        ov.creator_username,
        ov.raw_data->>'Livestream name' as livestream_name,
        ov.post_time as start_time,
        ov.duration_str,
        COALESCE(ov.video_views, 0) as video_views,
        COALESCE(ov.video_likes, 0) as video_likes
      FROM organic_videos ov
      WHERE ov.campaign_id = ${campaignId}
        AND (ov.content_type ILIKE '%live%' OR ov.content_type ILIKE '%livestream%')
    `).catch(() => [])) as any[];

    // 6. Merge live sessions by content_uid
    const liveStatsMap = new Map<string, any>();

    // Add organic live sessions
    (organicLiveRows || []).forEach((row: any) => {
      const uid = (row.content_uid || '').toString();
      if (!uid) return;
      const salesInfo = salesByUid.get(uid) || { gmv: 0, orders: 0 };
      liveStatsMap.set(uid, {
        id: row.id,
        content_uid: uid,
        creator_username: row.creator_username,
        livestream_name: row.livestream_name || null,
        start_time: row.start_time,
        duration_str: row.duration_str || null,
        video_views: Number(row.video_views) || 0,
        video_likes: Number(row.video_likes) || 0,
        gmv: salesInfo.gmv,
        orders: salesInfo.orders,
      });
    });

    // Add/merge live_sessions rows
    (liveSessionsRows || []).forEach((row: any) => {
      const uid = (row.content_uid || '').toString();
      if (!uid) return;
      const existing = liveStatsMap.get(uid);
      const salesInfo = salesByUid.get(uid);

      const calculatedGmv = Math.max(Number(row.gmv) || 0, salesInfo?.gmv || 0);
      const calculatedOrders = Math.max(Number(row.orders) || 0, salesInfo?.orders || 0);

      if (existing) {
        existing.livestream_name = existing.livestream_name || row.livestream_name;
        existing.video_views = Math.max(existing.video_views, Number(row.video_views) || 0);
        existing.video_likes = Math.max(existing.video_likes, Number(row.video_likes) || 0);
        existing.duration_str = existing.duration_str || row.duration_str;
        existing.gmv = Math.max(existing.gmv, calculatedGmv);
        existing.orders = Math.max(existing.orders, calculatedOrders);
      } else {
        liveStatsMap.set(uid, {
          id: row.id,
          content_uid: uid,
          creator_username: row.creator_username,
          livestream_name: row.livestream_name || null,
          start_time: row.start_time,
          duration_str: row.duration_str || null,
          video_views: Number(row.video_views) || 0,
          video_likes: Number(row.video_likes) || 0,
          gmv: calculatedGmv,
          orders: calculatedOrders,
        });
      }
    });

    const liveStats = Array.from(liveStatsMap.values());

    return {
      campaign,
      creators: formattedCCs,
      salesData: salesRows || [],
      liveMetrics: [],
      liveStats: liveStats,
    };
  } catch (error: any) {
    console.error('Error in getLivestreamData:', error);
    return null;
  }
}
