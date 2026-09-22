'use server';

import { db } from '@/db';
import { sql } from 'drizzle-orm';

export async function getInternalPerformaData(campaignId: number) {
  try {
    const [campaignRes, skusRes, ccRes, vidRes, salesRes, adsRes, orgRes] = await Promise.all([
      db.execute(sql`SELECT * FROM campaigns WHERE id = ${campaignId} LIMIT 1`).catch(() => []) as Promise<any[]>,
      db.execute(sql`SELECT id, product_id, nama_produk FROM skus WHERE campaign_id = ${campaignId}`).catch(() => []) as Promise<any[]>,
      db.execute(sql`
        SELECT 
          cc.id, cc.creator_id, cc.approval, cc.created_at, cc.approved_at, cc.content_type, cc.qty_vt, cc.qty_live, cc.tier, cc.price,
          c.id as c_id, c.username, c.nama_asli, c.link_account
        FROM campaign_creators cc
        LEFT JOIN creators c ON cc.creator_id = c.id
        WHERE cc.campaign_id = ${campaignId}
          AND LOWER(cc.approval) IN ('approved', 'pending', 'alternate')
        ORDER BY cc.id ASC
      `).catch(() => []) as Promise<any[]>,
      db.execute(sql`
        SELECT v.id, v.campaign_creator_id, v.content_uid, v.vt_approval, v.urutan, v.link_video, v.link_draft, v.concept, v.sku_id
        FROM videos v
        JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
        WHERE cc.campaign_id = ${campaignId}
        ORDER BY v.id ASC
      `).catch(() => []) as Promise<any[]>,
      db.execute(sql`
        SELECT tanggal, gmv, quantity, creator_username, content_uid, content_type, product_id
        FROM sales
        WHERE campaign_id = ${campaignId}
      `).catch(() => []) as Promise<any[]>,
      db.execute(sql`
        SELECT ap.*, c.username
        FROM ads_performance ap
        LEFT JOIN creators c ON ap.creator_id = c.id
        WHERE ap.campaign_id = ${campaignId}
      `).catch(() => []) as Promise<any[]>,
      db.execute(sql`
        SELECT content_uid, post_time, content_type, creator_username, video_views, video_likes, product_id
        FROM organic_videos
        WHERE campaign_id = ${campaignId}
      `).catch(() => []) as Promise<any[]>
    ]);

    const campaign = campaignRes[0] || null;
    if (!campaign) return null;

    const skus = skusRes || [];
    const rawCc = ccRes || [];
    const allVideos = vidRes || [];
    const allSales = salesRes || [];
    const allAds = adsRes || [];
    const allOrganic = orgRes || [];

    // Group videos by campaign_creator_id
    const videosByCc = new Map<number, any[]>();
    for (const v of allVideos) {
      if (!videosByCc.has(v.campaign_creator_id)) {
        videosByCc.set(v.campaign_creator_id, []);
      }
      videosByCc.get(v.campaign_creator_id)!.push(v);
    }

    const compiledCreators = rawCc.map((r: any) => ({
      ...r,
      creators: {
        id: r.c_id,
        username: r.username,
        nama_asli: r.nama_asli,
        link_account: r.link_account,
      },
      videos: videosByCc.get(r.id) || []
    }));

    return {
      campaign,
      skus,
      creators: compiledCreators,
      videos: allVideos,
      sales: allSales,
      ads: allAds,
      organicVideos: allOrganic,
      summary: null,
    };
  } catch (error: any) {
    console.error('Error in getInternalPerformaData:', error);
    return null;
  }
}
