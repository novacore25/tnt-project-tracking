'use server';

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { ensureVideoColumns, ensureNotesTable } from '@/app/actions/campaignPageActions';

export async function getInternalVideoData(campaignId: number, searchKeyword: string = '') {
  try {
    await ensureVideoColumns();
    await ensureNotesTable();
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
    const organicRows = (await db.execute(sql`
      SELECT content_uid, creator_username, product_id, video_views as views, video_likes as likes, post_time
      FROM organic_videos WHERE campaign_id = ${campaignId}
    `).catch(() => [])) as any[];

    // 4. Fetch Sales stats for this campaign
    const salesRows = (await db.execute(sql`
      SELECT content_uid, creator_username, product_id, SUM(COALESCE(gmv, 0)) as gmv
      FROM sales WHERE campaign_id = ${campaignId}
      GROUP BY content_uid, creator_username, product_id
    `).catch(() => [])) as any[];

    // 5. Fetch Approved Campaign Creators with snapshots and relations
    const whereConditions = [
      sql`cc.campaign_id = ${campaignId}`,
      sql`LOWER(cc.approval) = 'approved'`
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
            'link_draft', v.link_draft,
            'vt_approval', v.vt_approval,
            'vt_approved_by', v.vt_approved_by,
            'vt_approved_at', v.vt_approved_at,
            'revision_notes', v.revision_notes,
            'revision_notes_updated_by', v.revision_notes_updated_by,
            'revision_notes_updated_at', v.revision_notes_updated_at,
            'content_uid', v.content_uid,
            'sku_id', v.sku_id,
            'created_at', v.created_at
          ) ORDER BY v.urutan ASC)
          FROM videos v WHERE v.campaign_creator_id = cc.id
        ) as videos
      FROM campaign_creators cc
      LEFT JOIN creators c ON cc.creator_id = c.id
      ${whereClause}
      ORDER BY cc.id DESC
    `).catch((err) => {
      console.error('Error querying campaign creators in getInternalVideoData:', err);
      return [];
    })) as any[];

    // 6. Fetch all videos for the approved campaign creators
    const allVideosList = (await db.execute(sql`
      SELECT v.* 
      FROM videos v
      JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
      WHERE cc.campaign_id = ${campaignId} AND LOWER(cc.approval) = 'approved'
      ORDER BY v.urutan ASC
    `).catch(() => [])) as any[];

    // 7. Build stats map by creator_username
    const videoStatsMap = new Map<string, any[]>();
    
    // Process organic videos
    (organicRows || []).forEach((row: any) => {
      const uname = (row.creator_username || '').toLowerCase().trim();
      if (!uname) return;
      if (!videoStatsMap.has(uname)) videoStatsMap.set(uname, []);
      videoStatsMap.get(uname)!.push({
        content_uid: row.content_uid,
        product_id: row.product_id,
        views: Number(row.views) || 0,
        likes: Number(row.likes) || 0,
        gmv: 0,
        post_time: row.post_time,
      });
    });

    // Process sales GMV
    (salesRows || []).forEach((row: any) => {
      const uname = (row.creator_username || '').toLowerCase().trim();
      if (!uname) return;
      if (!videoStatsMap.has(uname)) videoStatsMap.set(uname, []);
      const list = videoStatsMap.get(uname)!;
      const existing = list.find((item: any) => item.content_uid === row.content_uid);
      if (existing) {
        existing.gmv = (existing.gmv || 0) + (Number(row.gmv) || 0);
        if (!existing.product_id && row.product_id) existing.product_id = row.product_id;
      } else {
        list.push({
          content_uid: row.content_uid,
          product_id: row.product_id,
          gmv: Number(row.gmv) || 0,
          views: 0,
          likes: 0,
        });
      }
    });

    const mapped = (ccsRows || []).map((r: any) => {
      const uname = (r.username || '').toLowerCase().trim();
      return {
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
        _videoStats: videoStatsMap.get(uname) || [],
      };
    });

    // 8. Fetch revision notes server-side for initial hydration
    const ccIds = (ccsRows || []).map((r: any) => r.id).filter(Boolean);
    const initialRevisionNotes: Record<string, any> = {};
    if (ccIds.length > 0) {
      const notesRows = (await db.execute(sql`
        SELECT 
          id, 
          campaign_creator_id, 
          COALESCE(role, field_name) as role, 
          COALESCE(isi, notes) as isi, 
          COALESCE(author_id, updated_by) as author_id, 
          COALESCE(author_name, updated_by, 'Manager') as author_name, 
          created_at, 
          COALESCE(updated_at, created_at) as updated_at
        FROM campaign_creator_notes
        WHERE campaign_creator_id = ANY(${ccIds})
          AND (role ILIKE 'draft_revisi_%' OR field_name ILIKE 'draft_revisi_%')
        ORDER BY COALESCE(updated_at, created_at) ASC, id ASC
      `).catch(() => [])) as any[];

      (notesRows || []).forEach((n: any) => {
        const roleStr = n.role || '';
        const match = roleStr.match(/draft_revisi_(\d+)/i);
        if (match) {
          const urutan = parseInt(match[1]);
          initialRevisionNotes[`${n.campaign_creator_id}_${urutan}`] = n;
        }
      });
    }

    // Also populate initialRevisionNotes from videos table if any video has revision_notes
    (ccsRows || []).forEach((cc: any) => {
      (cc.videos || []).forEach((v: any) => {
        const key = `${cc.id}_${v.urutan}`;
        if (v.revision_notes && (!initialRevisionNotes[key] || !initialRevisionNotes[key].isi)) {
          initialRevisionNotes[key] = {
            id: v.id,
            campaign_creator_id: cc.id,
            role: `draft_revisi_${v.urutan}`,
            isi: v.revision_notes,
            notes: v.revision_notes,
            author_id: null,
            author_name: v.revision_notes_updated_by || 'Manager',
            created_at: v.revision_notes_updated_at || v.created_at,
            updated_at: v.revision_notes_updated_at || v.created_at,
          };
        }
      });
    });

    return {
      campaign,
      skus: skusList,
      creators: mapped,
      listingData: mapped,
      allVideos: allVideosList,
      initialRevisionNotes,
      stats: organicRows,
    };
  } catch (error: any) {
    console.error('Error in getInternalVideoData:', error);
    return null;
  }
}
