'use server';

import { db } from '@/db';
import { sql } from 'drizzle-orm';

export async function getInternalVideoData(campaignId: number, searchKeyword: string = '') {
  try {
    // 1. Fetch Campaign
    const campaignRows = (await db.execute(sql`
      SELECT * FROM campaigns WHERE id = ${campaignId} LIMIT 1
    `).catch(() => [])) as any[];

    if (!campaignRows || campaignRows.length === 0) return null;
    const campaign = campaignRows[0];

    // 2. Fetch SKUs
    const skusList = (await db.execute(sql`
      SELECT * FROM skus WHERE campaign_id = ${campaignId}
    `).catch(() => [])) as any[];

    // 3. Fetch Organic Video stats
    const statsList = (await db.execute(sql`
      SELECT video_id as content_uid, publish_time, video_title, views, likes, comments, shares
      FROM organic_videos WHERE campaign_id = ${campaignId}
    `).catch(() => [])) as any[];

    // 4. Fetch Approved Campaign Creators with snapshots and relations
    const whereConditions = [
      sql`cc.campaign_id = ${campaignId}`,
      sql`cc.approval = 'approved'`
    ];

    if (searchKeyword && searchKeyword.trim()) {
      const s = '%' + searchKeyword.trim() + '%';
      whereConditions.push(sql`(c.username ILIKE ${s} OR c.nama_asli ILIKE ${s})`);
    }

    const whereClause = sql`WHERE ${sql.join(whereConditions, sql` AND `)}`;

    const ccsRows = (await db.execute(sql`
      SELECT 
        cc.*,
        c.id as creator_db_id, c.username, c.nama_asli, c.link_account,
        (
          SELECT json_agg(jsonb_build_object('id', ct.id, 'nomor', ct.nomor, 'status', ct.status))
          FROM creator_contacts ct WHERE ct.creator_id = cc.creator_id
        ) as creator_contacts,
        (
          SELECT json_agg(jsonb_build_object('id', cs.id, 'audience_age', cs.audience_age, 'level', cs.level, 'gmv_30d', cs.gmv_30d, 'gmv_30d_video', cs.gmv_30d_video, 'gmv_30d_live', cs.gmv_30d_live, 'tanggal_update', cs.tanggal_update, 'followers', cs.followers, 'tier', cs.tier, 'ratecard', cs.ratecard))
          FROM creator_snapshots cs WHERE cs.creator_id = cc.creator_id
        ) as creator_snapshots,
        (
          SELECT json_agg(jsonb_build_object('niche_id', cn.niche_id, 'nama', n.nama))
          FROM creator_niches cn LEFT JOIN niches n ON cn.niche_id = n.id WHERE cn.creator_id = cc.creator_id
        ) as creator_niches,
        (
          SELECT json_agg(jsonb_build_object(
            'id', v.id,
            'campaign_creator_id', v.campaign_creator_id,
            'urutan', v.urutan,
            'concept', v.concept,
            'concept_updated_at', v.concept_updated_at,
            'concept_updated_by', v.concept_updated_by,
            'link_video', v.link_video,
            'vt_approval', v.vt_approval,
            'content_uid', v.content_uid,
            'draft_url', v.draft_url,
            'notes', v.notes,
            'views', v.views,
            'likes', v.likes
          ) ORDER BY v.urutan ASC)
          FROM videos v WHERE v.campaign_creator_id = cc.id
        ) as videos
      FROM campaign_creators cc
      LEFT JOIN creators c ON cc.creator_id = c.id
      ${whereClause}
      ORDER BY cc.id DESC
    `).catch(() => [])) as any[];

    // 5. Fetch all videos for the campaign creators
    const allVideosList = (await db.execute(sql`
      SELECT v.* 
      FROM videos v
      JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
      WHERE cc.campaign_id = ${campaignId}
      ORDER BY v.urutan ASC
    `).catch(() => [])) as any[];

    const mapped = (ccsRows || []).map((r: any) => ({
      ...r,
      creator_id: r.creator_id || r.creator_db_id,
      creators: {
        id: r.creator_db_id,
        username: r.username,
        nama_asli: r.nama_asli,
        link_account: r.link_account,
        creator_contacts: r.creator_contacts || [],
        creator_snapshots: r.creator_snapshots || [],
        creator_niches: r.creator_niches || [],
      },
      videos: r.videos || [],
    }));

    return {
      campaign,
      skus: skusList,
      creators: mapped,
      listingData: mapped,
      allVideos: allVideosList,
      stats: statsList,
    };
  } catch (error: any) {
    console.error('Error in getInternalVideoData:', error);
    return null;
  }
}

