'use server';

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

// ============================================================
// CONCEPTS (Master Konsep)
// ============================================================
export async function fetchCampaignConceptsAction(campaignId: number) {
  try {
    const data = await db.execute(sql`
      SELECT cc.*, sk.nama_produk
      FROM campaign_concepts cc
      LEFT JOIN skus sk ON cc.sku_id = sk.id
      WHERE cc.campaign_id = ${campaignId}
      ORDER BY cc.no_konsep ASC
    `) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function addCampaignConceptAction(concept: {
  campaign_id: number;
  no_konsep: number;
  judul_konsep: string;
  status_approval?: string;
  updated_by?: string;
}) {
  try {
    const [data] = await db.execute(sql`
      INSERT INTO campaign_concepts (campaign_id, no_konsep, judul_konsep, status_approval, updated_by)
      VALUES (${concept.campaign_id}, ${concept.no_konsep}, ${concept.judul_konsep},
              ${concept.status_approval || 'pending'}, ${concept.updated_by || null})
      RETURNING *
    `) as any[];
    revalidatePath(`/campaigns/${concept.campaign_id}/concepts`);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateCampaignConceptAction(id: number, updates: any) {
  try {
    const [data] = await db.execute(sql`
      UPDATE campaign_concepts SET
        no_konsep = COALESCE(${updates.no_konsep !== undefined ? updates.no_konsep : null}, no_konsep),
        sku_id = CASE WHEN ${updates.sku_id !== undefined} THEN ${updates.sku_id ?? null} ELSE sku_id END,
        judul_konsep = COALESCE(${updates.judul_konsep !== undefined ? updates.judul_konsep : null}, judul_konsep),
        tier = CASE WHEN ${updates.tier !== undefined} THEN ${updates.tier ?? null} ELSE tier END,
        hook = CASE WHEN ${updates.hook !== undefined} THEN ${updates.hook ?? null} ELSE hook END,
        fitur_usp = CASE WHEN ${updates.fitur_usp !== undefined} THEN ${updates.fitur_usp ?? null} ELSE fitur_usp END,
        cta = CASE WHEN ${updates.cta !== undefined} THEN ${updates.cta ?? null} ELSE cta END,
        status_approval = COALESCE(${updates.status_approval !== undefined ? updates.status_approval : null}, status_approval),
        notes = CASE WHEN ${updates.notes !== undefined} THEN ${updates.notes ?? null} ELSE notes END,
        updated_by = COALESCE(${updates.updated_by !== undefined ? updates.updated_by : null}, updated_by),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `) as any[];
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteCampaignConceptAction(id: number) {
  try {
    await db.execute(sql`DELETE FROM campaign_concepts WHERE id = ${id}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// LIVE STATS (Live Schedule & Realization)
// ============================================================
export async function fetchLivePageDataAction(campaignId: number, requireClientApproval: boolean = false) {
  try {
    const [ccList, liveStats] = await Promise.all([
      db.execute(sql`
        SELECT 
          cc.*,
          c.username, c.nama_lengkap as nama_asli, c.platform, c.status as creator_status
        FROM campaign_creators cc
        LEFT JOIN creators c ON cc.creator_id = c.id
        WHERE cc.campaign_id = ${campaignId}
          AND cc.approval IN ('approved', 'alternate')
          ${requireClientApproval ? sql`AND cc.client_approval IN ('approved', 'not_required')` : sql``}
        ORDER BY cc.id ASC
      `) as Promise<any[]>,
      db.execute(sql`
        SELECT 
          ls.id, ls.livestream_room_id as content_uid, ls.creator_username, ls.start_time, ls.duration_str,
          ls.live_views as video_views, ls.live_likes as video_likes,
          COALESCE(lsp_agg.gmv, 0) as gmv,
          COALESCE(lsp_agg.orders, 0) as orders
        FROM live_sessions ls
        LEFT JOIN (
          SELECT 
            livestream_room_id,
            SUM(gmv) as gmv,
            SUM(orders) as orders
          FROM live_session_products
          GROUP BY livestream_room_id
        ) lsp_agg ON ls.livestream_room_id = lsp_agg.livestream_room_id
        WHERE ls.tt_campaign_id = ${campaignId}::text
           OR ls.creator_username IN (
             SELECT c.username FROM campaign_creators cc
             JOIN creators c ON cc.creator_id = c.id
             WHERE cc.campaign_id = ${campaignId}
           )
      `).catch(() => []) as Promise<any[]>
    ]);

    const formattedCCs = (ccList || []).map(r => ({
      ...r,
      creators: {
        id: r.creator_id,
        username: r.username,
        nama_asli: r.nama_asli,
        platform: r.platform,
        status: r.creator_status,
      }
    }));

    return {
      success: true,
      creators: formattedCCs,
      actualLives: liveStats || []
    };
  } catch (err: any) {
    console.error('fetchLivePageDataAction error:', err);
    return { success: false, creators: [], actualLives: [], error: err.message };
  }
}

// ============================================================
// ADS KURS UPDATE
// ============================================================
export async function updateAdsPerformanceKursAction(id: number, kurs: number) {
  try {
    await db.execute(sql`
      UPDATE ads_performance SET kurs = ${kurs} WHERE id = ${id}
    `);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// DAILY PERFORMANCE DATA
// ============================================================
export async function fetchDailyPerformancePageDataAction(campaignId: number) {
  try {
    const [campaignRes, skusRes, ccRes, vidRes, adsRes, salesRes, orgRes] = await Promise.all([
      db.execute(sql`SELECT * FROM campaigns WHERE id = ${campaignId} LIMIT 1`) as Promise<any[]>,
      db.execute(sql`SELECT product_id FROM skus WHERE campaign_id = ${campaignId}`) as Promise<any[]>,
      db.execute(sql`
        SELECT 
          cc.id, cc.creator_id, cc.tier, cc.approval, cc.created_at, cc.approved_at, cc.content_type, cc.slot as qty_vt,
          c.username
        FROM campaign_creators cc
        LEFT JOIN creators c ON cc.creator_id = c.id
        WHERE cc.campaign_id = ${campaignId}
      `) as Promise<any[]>,
      db.execute(sql`
        SELECT v.id, v.campaign_creator_id, v.created_at, v.link as link_video
        FROM videos v
        JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
        WHERE cc.campaign_id = ${campaignId}
      `) as Promise<any[]>,
      db.execute(sql`
        SELECT ad_id, tanggal, gross_revenue_usd, kurs
        FROM ads_performance
        WHERE campaign_id = ${campaignId}
        ORDER BY tanggal ASC
      `) as Promise<any[]>,
      db.execute(sql`
        SELECT tanggal, gmv, quantity, creator_username, content_uid, content_type, product_id
        FROM sales
        WHERE campaign_id = ${campaignId}
      `) as Promise<any[]>,
      db.execute(sql`
        SELECT content_uid, post_time, content_type, creator_username, product_id
        FROM organic_videos
        WHERE campaign_id = ${campaignId}
      `).catch(() => []) as Promise<any[]>
    ]);

    const campaign = campaignRes[0] || null;
    const skus = skusRes || [];
    const campaignCreators = (ccRes || []).map(r => ({
      ...r,
      creators: { username: r.username }
    }));
    const videos = vidRes || [];
    const ads = adsRes || [];
    const sales = salesRes || [];
    const organicVideos = orgRes || [];

    // Map videos to creators
    const videosByCcId = new Map<number, any[]>();
    for (const v of videos) {
      if (!videosByCcId.has(v.campaign_creator_id)) {
        videosByCcId.set(v.campaign_creator_id, []);
      }
      videosByCcId.get(v.campaign_creator_id)!.push(v);
    }
    for (const cc of campaignCreators) {
      cc.videos = videosByCcId.get(cc.id) || [];
    }

    return {
      success: true,
      campaign,
      skus,
      campaignCreators,
      videos,
      ads,
      sales,
      organicVideos
    };
  } catch (err: any) {
    console.error('fetchDailyPerformancePageDataAction error:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================
// PERFORMA DATA
// ============================================================
export async function fetchPerformaPageFullDataAction(campaignId: number) {
  try {
    const [campaignRes, conceptsRes, skusRes, ccRes, vidRes, salesRes, adsRes, orgRes] = await Promise.all([
      db.execute(sql`SELECT * FROM campaigns WHERE id = ${campaignId} LIMIT 1`) as Promise<any[]>,
      db.execute(sql`
        SELECT cc.*, sk.nama_produk
        FROM campaign_concepts cc
        LEFT JOIN skus sk ON cc.sku_id = sk.id
        WHERE cc.campaign_id = ${campaignId}
        ORDER BY cc.no_konsep ASC
      `) as Promise<any[]>,
      db.execute(sql`SELECT id, product_id, nama_produk FROM skus WHERE campaign_id = ${campaignId}`) as Promise<any[]>,
      db.execute(sql`
        SELECT 
          cc.id, cc.creator_id, cc.approval, cc.created_at, cc.approved_at, cc.content_type, cc.slot as qty_vt,
          c.id as c_id, c.username, c.nama_lengkap as nama_asli, c.link_portofolio as link_account
        FROM campaign_creators cc
        LEFT JOIN creators c ON cc.creator_id = c.id
        WHERE cc.campaign_id = ${campaignId}
          AND cc.approval IN ('approved', 'pending', 'alternate')
        ORDER BY cc.id ASC
      `) as Promise<any[]>,
      db.execute(sql`
        SELECT v.id, v.campaign_creator_id, v.link as content_uid, v.vt_approval, v.urutan, v.link as link_video
        FROM videos v
        JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
        WHERE cc.campaign_id = ${campaignId}
        ORDER BY v.id ASC
      `) as Promise<any[]>,
      db.execute(sql`
        SELECT tanggal, gmv, quantity, creator_username, content_uid, content_type, product_id
        FROM sales
        WHERE campaign_id = ${campaignId}
      `) as Promise<any[]>,
      db.execute(sql`
        SELECT ap.*, c.username
        FROM ads_performance ap
        LEFT JOIN creators c ON ap.creator_id = c.id
        WHERE ap.campaign_id = ${campaignId}
      `) as Promise<any[]>,
      db.execute(sql`
        SELECT content_uid, post_time, content_type, creator_username, video_views, video_likes, product_id
        FROM organic_videos
        WHERE campaign_id = ${campaignId}
      `).catch(() => []) as Promise<any[]>
    ]);

    const campaign = campaignRes[0] || null;
    const concepts = conceptsRes || [];
    const skus = skusRes || [];
    const rawCc = ccRes || [];
    const videos = vidRes || [];
    const sales = salesRes || [];
    const ads = adsRes || [];
    const organicVideos = orgRes || [];

    // Map videos
    const videosByCcId = new Map<number, any[]>();
    for (const v of videos) {
      if (!videosByCcId.has(v.campaign_creator_id)) {
        videosByCcId.set(v.campaign_creator_id, []);
      }
      videosByCcId.get(v.campaign_creator_id)!.push(v);
    }

    const campaignCreators = rawCc.map(r => ({
      ...r,
      creators: {
        id: r.c_id,
        username: r.username,
        nama_asli: r.nama_asli,
        link_account: r.link_account,
      },
      videos: videosByCcId.get(r.id) || []
    }));

    return {
      success: true,
      campaign,
      concepts,
      skus,
      campaignCreators,
      videos,
      sales,
      ads,
      organicVideos
    };
  } catch (err: any) {
    console.error('fetchPerformaPageFullDataAction error:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================
// LISTING DATA (Campaign Listing page)
// ============================================================
export async function fetchListingPageDataAction(campaignId: number) {
  try {
    const [campaignRes, ccRes, skusRes, notesRes, contactsRes, snapshotsRes] = await Promise.all([
      db.execute(sql`SELECT * FROM campaigns WHERE id = ${campaignId} LIMIT 1`) as Promise<any[]>,
      db.execute(sql`
        SELECT 
          cc.*,
          c.id as creator_db_id, c.username, c.nama_lengkap as nama_asli, c.link_portofolio as link_account,
          c.status as creator_status, c.catatan as creator_catatan
        FROM campaign_creators cc
        LEFT JOIN creators c ON cc.creator_id = c.id
        WHERE cc.campaign_id = ${campaignId}
        ORDER BY cc.id DESC
      `) as Promise<any[]>,
      db.execute(sql`SELECT id, product_id, nama_produk FROM skus WHERE campaign_id = ${campaignId}`) as Promise<any[]>,
      db.execute(sql`
        SELECT cn.* FROM creator_notes cn
        JOIN campaign_creators cc ON cn.creator_id = cc.creator_id
        WHERE cc.campaign_id = ${campaignId}
        ORDER BY cn.created_at DESC
      `).catch(() => []) as Promise<any[]>,
      db.execute(sql`
        SELECT ct.* FROM creator_contacts ct
        JOIN campaign_creators cc ON ct.creator_id = cc.creator_id
        WHERE cc.campaign_id = ${campaignId}
      `).catch(() => []) as Promise<any[]>,
      db.execute(sql`
        SELECT cs.* FROM creator_snapshots cs
        JOIN campaign_creators cc ON cs.creator_id = cc.creator_id
        WHERE cc.campaign_id = ${campaignId}
        ORDER BY cs.tanggal_update DESC
      `).catch(() => []) as Promise<any[]>
    ]);

    const campaign = campaignRes[0] || null;
    const skus = skusRes || [];
    const notes = notesRes || [];
    const contacts = contactsRes || [];
    const snapshots = snapshotsRes || [];

    // Group relations
    const notesMap = new Map<number, any[]>();
    notes.forEach(n => {
      if (!notesMap.has(n.creator_id)) notesMap.set(n.creator_id, []);
      notesMap.get(n.creator_id)!.push(n);
    });

    const contactsMap = new Map<number, any[]>();
    contacts.forEach(c => {
      if (!contactsMap.has(c.creator_id)) contactsMap.set(c.creator_id, []);
      contactsMap.get(c.creator_id)!.push(c);
    });

    const snapshotsMap = new Map<number, any[]>();
    snapshots.forEach(s => {
      if (!snapshotsMap.has(s.creator_id)) snapshotsMap.set(s.creator_id, []);
      snapshotsMap.get(s.creator_id)!.push(s);
    });

    const campaignCreators = (ccRes || []).map(r => ({
      ...r,
      creators: {
        id: r.creator_db_id,
        username: r.username,
        nama_asli: r.nama_asli,
        link_account: r.link_account,
        status: r.creator_status,
        catatan: r.creator_catatan,
        creator_notes: notesMap.get(r.creator_id) || [],
        creator_contacts: contactsMap.get(r.creator_id) || [],
        creator_snapshots: snapshotsMap.get(r.creator_id) || []
      }
    }));

    return {
      success: true,
      campaign,
      skus,
      campaignCreators
    };
  } catch (err: any) {
    console.error('fetchListingPageDataAction error:', err);
    return { success: false, error: err.message };
  }
}
