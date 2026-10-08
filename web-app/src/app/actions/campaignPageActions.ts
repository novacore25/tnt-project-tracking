'use server';

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireCampaignAccess } from '@/lib/guards';

function sqlInList(items: any[]) {
  if (!items || items.length === 0) return sql`(NULL)`;
  return sql`(${sql.join(items.map(it => sql`${it}`), sql`, `)})`;
}

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
    const [ccList, liveSessionsRows, organicLiveRows, salesRows] = await Promise.all([
      db.execute(sql`
        SELECT 
          cc.*,
          c.username, c.nama_asli, c.link_account
        FROM campaign_creators cc
        LEFT JOIN creators c ON cc.creator_id = c.id
        WHERE cc.campaign_id = ${campaignId}
          AND LOWER(cc.approval) IN ('approved', 'alternate')
          ${requireClientApproval ? sql`AND LOWER(cc.client_approval) IN ('approved', 'not_required')` : sql``}
        ORDER BY cc.id ASC
      `).catch(() => []) as Promise<any[]>,
      db.execute(sql`
        SELECT 
          ls.id, ls.livestream_room_id as content_uid, ls.creator_username, ls.livestream_name, ls.start_time, ls.duration_str,
          COALESCE(ls.live_views, 0) as video_views, COALESCE(ls.live_likes, 0) as video_likes,
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
      `).catch(() => []) as Promise<any[]>,
      db.execute(sql`
        SELECT 
          ov.id, ov.content_uid, ov.creator_username,
          ov.raw_data->>'Livestream name' as livestream_name,
          ov.post_time as start_time, ov.duration_str,
          COALESCE(ov.video_views, 0) as video_views,
          COALESCE(ov.video_likes, 0) as video_likes
        FROM organic_videos ov
        WHERE ov.campaign_id = ${campaignId}
          AND (ov.content_type ILIKE '%live%' OR ov.content_type ILIKE '%livestream%')
      `).catch(() => []) as Promise<any[]>,
      db.execute(sql`
        SELECT 
          content_uid,
          SUM(COALESCE(gmv, 0)) as gmv,
          SUM(COALESCE(quantity, 1)) as orders
        FROM sales
        WHERE campaign_id = ${campaignId}
          AND (content_type ILIKE '%live%' OR content_type ILIKE '%livestream%')
        GROUP BY content_uid
      `).catch(() => []) as Promise<any[]>
    ]);

    const salesByUid = new Map<string, { gmv: number; orders: number }>();
    (salesRows || []).forEach((s: any) => {
      if (!s.content_uid) return;
      salesByUid.set(s.content_uid.toString(), {
        gmv: Number(s.gmv) || 0,
        orders: Number(s.orders) || 0,
      });
    });

    const liveStatsMap = new Map<string, any>();

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

    const formattedCCs = (ccList || []).map((r: any) => ({
      ...r,
      creators: {
        id: r.creator_id,
        username: r.username,
        nama_asli: r.nama_asli,
        link_account: r.link_account,
      }
    }));

    return {
      success: true,
      creators: formattedCCs,
      actualLives: Array.from(liveStatsMap.values())
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
    // Kurs ini ditulis TANPA guard sebelumnya, jadi Someone bisa mengetik
    // 17.313 dan tersimpan 17.313, bukan 17313. Akibatnya revenue dan cost
    // baris itu 1000x terlalu kecil. importActions.ts:475 sudah punya
    // heuristics, fungsi ini tidak punya, dan itulah sebabnya 313 baris rusak
    // terverifikasi 1 Okt 2026.
    //
    // Heuristik yang sama dipakai di sini: nilai di bawah 16000 pasti salah
    // karena kurs riil IDR/USD ada di kisaran 16000 sampai 20000. Nol
    // diizinkan karena dipakai untuk menandai baris yang datanya korup.
    let kursVal = Number(kurs);
    if (!Number.isFinite(kursVal) || kursVal < 0) {
      return { success: false, error: 'Kurs tidak valid' };
    }
    if (kursVal > 0 && kursVal < 16000) kursVal = kursVal * 1000;

    await db.execute(sql`
      UPDATE ads_performance SET kurs = ${kursVal} WHERE id = ${id}
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
    const [campaignRes, skusRes, ccRes, vidRes, adsRes, salesRes, orgRes, liveRes] = await Promise.all([
      db.execute(sql`SELECT * FROM campaigns WHERE id = ${campaignId} LIMIT 1`).catch(() => []) as Promise<any[]>,
      db.execute(sql`SELECT id, product_id, nama_produk FROM skus WHERE campaign_id = ${campaignId}`).catch(() => []) as Promise<any[]>,
      db.execute(sql`
        SELECT 
          cc.id, cc.creator_id, cc.tier, cc.approval, cc.created_at, cc.approved_at, cc.content_type, cc.qty_vt, cc.qty_live,
          c.username, c.nama_asli
        FROM campaign_creators cc
        LEFT JOIN creators c ON cc.creator_id = c.id
        WHERE cc.campaign_id = ${campaignId}
      `).catch(() => []) as Promise<any[]>,
      db.execute(sql`
        SELECT v.id, v.campaign_creator_id, v.created_at, v.link_video, v.content_uid, v.views, v.likes
        FROM videos v
        JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
        WHERE cc.campaign_id = ${campaignId}
      `).catch(() => []) as Promise<any[]>,
      db.execute(sql`
        SELECT ad_id, tanggal, gross_revenue_usd, kurs
        FROM ads_performance
        WHERE campaign_id = ${campaignId}
        ORDER BY tanggal ASC
      `).catch(() => []) as Promise<any[]>,
      db.execute(sql`
        SELECT order_id, tanggal, gmv, quantity, price, creator_username, content_uid, content_type, product_id, order_status, is_refund, commission_rate
        FROM sales
        WHERE campaign_id = ${campaignId}
        ORDER BY id DESC
      `).catch(() => []) as Promise<any[]>,
      db.execute(sql`
        SELECT content_uid, post_time, content_type, creator_username, product_id, video_views, video_likes, duration_str, video_product_rpm
        FROM organic_videos
        WHERE campaign_id = ${campaignId}
      `).catch(() => []) as Promise<any[]>,
      db.execute(sql`
        SELECT ls.id, ls.livestream_room_id, ls.start_time, ls.end_time, ls.creator_username, ls.duration_str, ls.live_views, ls.live_likes
        FROM live_sessions ls
        JOIN campaign_creators cc ON ls.campaign_creator_id = cc.id
        WHERE cc.campaign_id = ${campaignId}
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
    const liveSessions = liveRes || [];

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
      organicVideos,
      liveSessions
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
    const [campaignRes, conceptsRes, skusRes, ccRes, vidRes, salesRes, adsRes, orgRes, aliasesRes] = await Promise.all([
      db.execute(sql`SELECT * FROM campaigns WHERE id = ${campaignId} LIMIT 1`) as Promise<any[]>,
      db.execute(sql`
        SELECT cc.*, sk.nama_produk
        FROM campaign_concepts cc
        LEFT JOIN skus sk ON cc.sku_id = sk.id
        WHERE cc.campaign_id = ${campaignId}
        ORDER BY cc.no_konsep ASC
      `).catch(() => []) as Promise<any[]>,
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
        SELECT tanggal, gmv, quantity, creator_username, content_uid, content_type, product_id, campaign_id
        FROM sales
        WHERE campaign_id = ${campaignId}
           OR (product_id IS NOT NULL AND product_id IN (SELECT product_id FROM skus WHERE campaign_id = ${campaignId} AND product_id IS NOT NULL))
      `).catch(() => []) as Promise<any[]>,
      db.execute(sql`
        SELECT ap.*, c.username
        FROM ads_performance ap
        LEFT JOIN creators c ON ap.creator_id = c.id
        WHERE ap.campaign_id = ${campaignId}
      `).catch(() => []) as Promise<any[]>,
      db.execute(sql`
        SELECT content_uid, post_time, content_type, creator_username, video_views, video_likes, product_id, campaign_id
        FROM organic_videos
        WHERE campaign_id = ${campaignId}
           OR (product_id IS NOT NULL AND product_id IN (SELECT product_id FROM skus WHERE campaign_id = ${campaignId} AND product_id IS NOT NULL))
      `).catch(() => []) as Promise<any[]>,
      db.execute(sql`
        SELECT ca.creator_id, LOWER(ca.alias_username) as alias, c.username as primary_username
        FROM creator_aliases ca
        JOIN creators c ON ca.creator_id = c.id
        WHERE ca.creator_id IN (SELECT creator_id FROM campaign_creators WHERE campaign_id = ${campaignId})
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
    const creatorAliases = aliasesRes || [];

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
      organicVideos,
      creatorAliases
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

// ============================================================
// REVISION NOTES (Campaign Creator Notes)
// ============================================================
let notesTableEnsured = false;
export async function ensureNotesTable() {
  if (notesTableEnsured) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS campaign_creator_notes (
        id SERIAL PRIMARY KEY,
        campaign_creator_id INTEGER REFERENCES campaign_creators(id) ON DELETE CASCADE,
        role VARCHAR(50),
        field_name TEXT,
        isi TEXT,
        notes TEXT,
        author_id TEXT,
        author_name VARCHAR(255),
        updated_by TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      DO $$
      BEGIN
        ALTER TABLE campaign_creator_notes ADD COLUMN IF NOT EXISTS role VARCHAR(50);
        ALTER TABLE campaign_creator_notes ADD COLUMN IF NOT EXISTS field_name TEXT;
        ALTER TABLE campaign_creator_notes ADD COLUMN IF NOT EXISTS isi TEXT;
        ALTER TABLE campaign_creator_notes ADD COLUMN IF NOT EXISTS notes TEXT;
        ALTER TABLE campaign_creator_notes ADD COLUMN IF NOT EXISTS author_id TEXT;
        ALTER TABLE campaign_creator_notes ADD COLUMN IF NOT EXISTS author_name VARCHAR(255);
        ALTER TABLE campaign_creator_notes ADD COLUMN IF NOT EXISTS updated_by TEXT;
        ALTER TABLE campaign_creator_notes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        ALTER TABLE campaign_creator_notes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

        ALTER TABLE campaign_creator_notes ALTER COLUMN field_name DROP NOT NULL;
        ALTER TABLE campaign_creator_notes ALTER COLUMN notes DROP NOT NULL;
        ALTER TABLE campaign_creator_notes ALTER COLUMN role DROP NOT NULL;
        ALTER TABLE campaign_creator_notes ALTER COLUMN isi DROP NOT NULL;
        ALTER TABLE campaign_creator_notes DROP CONSTRAINT IF EXISTS campaign_creator_notes_author_id_fkey;
        ALTER TABLE campaign_creator_notes ALTER COLUMN author_id TYPE TEXT USING author_id::text;
      EXCEPTION
        WHEN OTHERS THEN NULL;
      END $$;
    `);
    notesTableEnsured = true;
  } catch (err) {
    console.error('ensureNotesTable error:', err);
  }
}

export async function fetchRevisionNotesAction(ccIds: number[]) {
  if (!ccIds || ccIds.length === 0) return { success: true, data: [] };
  try {
    await ensureNotesTable();
    const data = await db.execute(sql`
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
      WHERE campaign_creator_id IN ${sqlInList(ccIds)}
        AND (role ILIKE 'draft_revisi_%' OR field_name ILIKE 'draft_revisi_%')
      ORDER BY COALESCE(updated_at, created_at) ASC, id ASC
    `) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function upsertRevisionNoteAction(params: {
  existingId?: number;
  ccId: number;
  urutan: number;
  noteText: string;
  authorId?: string;
  authorName?: string;
}) {
  try {
    await ensureNotesTable();
    const roleKey = `draft_revisi_${params.urutan}`;
    const authorName = params.authorName || 'Manager';
    const authorId = params.authorId ? String(params.authorId) : null;

    // Check if a note already exists by existingId OR by (campaign_creator_id, role)
    let noteId = params.existingId;
    if (!noteId) {
      const existing = (await db.execute(sql`
        SELECT id FROM campaign_creator_notes
        WHERE campaign_creator_id = ${params.ccId} 
          AND (role = ${roleKey} OR field_name = ${roleKey})
        ORDER BY id DESC LIMIT 1
      `)) as any[];
      if (existing && existing.length > 0) {
        noteId = existing[0].id;
      }
    }

    if (noteId) {
      const rows = (await db.execute(sql`
        UPDATE campaign_creator_notes
        SET isi = ${params.noteText},
            notes = ${params.noteText},
            role = ${roleKey},
            field_name = ${roleKey},
            author_id = ${authorId},
            author_name = ${authorName},
            updated_by = ${authorName},
            updated_at = NOW()
        WHERE id = ${noteId}
        RETURNING id, campaign_creator_id, COALESCE(role, field_name) as role, COALESCE(isi, notes) as isi, COALESCE(author_id, updated_by) as author_id, COALESCE(author_name, updated_by, 'Manager') as author_name, created_at, COALESCE(updated_at, created_at) as updated_at
      `)) as any[];

      // Dual-write directly to videos table
      try {
        await ensureVideoColumns();
        await db.execute(sql`
          UPDATE videos 
          SET revision_notes = ${params.noteText},
              revision_notes_updated_by = ${authorName},
              revision_notes_updated_at = NOW()
          WHERE campaign_creator_id = ${params.ccId} AND urutan = ${params.urutan}
        `);
      } catch (vErr) {
        console.error('Error syncing revision_notes to videos table:', vErr);
      }

      return { success: true, data: rows[0] };
    } else {
      const rows = (await db.execute(sql`
        INSERT INTO campaign_creator_notes (
          campaign_creator_id, role, field_name, isi, notes, author_id, author_name, updated_by, created_at, updated_at
        ) VALUES (
          ${params.ccId}, ${roleKey}, ${roleKey}, ${params.noteText}, ${params.noteText}, ${authorId}, ${authorName}, ${authorName}, NOW(), NOW()
        )
        RETURNING id, campaign_creator_id, COALESCE(role, field_name) as role, COALESCE(isi, notes) as isi, COALESCE(author_id, updated_by) as author_id, COALESCE(author_name, updated_by, 'Manager') as author_name, created_at, COALESCE(updated_at, created_at) as updated_at
      `)) as any[];

      // Dual-write directly to videos table
      try {
        await ensureVideoColumns();
        await db.execute(sql`
          UPDATE videos 
          SET revision_notes = ${params.noteText},
              revision_notes_updated_by = ${authorName},
              revision_notes_updated_at = NOW()
          WHERE campaign_creator_id = ${params.ccId} AND urutan = ${params.urutan}
        `);
      } catch (vErr) {
        console.error('Error syncing revision_notes to videos table:', vErr);
      }

      return { success: true, data: rows[0] };
    }
  } catch (err: any) {
    console.error('upsertRevisionNoteAction error:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================
// VIDEO OPERATIONS (Server Actions)
// ============================================================
export async function ensureVideoColumns() {
  try {
    await db.execute(sql`
      DO $$
      BEGIN
        ALTER TABLE creators ADD COLUMN IF NOT EXISTS added_by text;

        ALTER TABLE campaign_creators ADD COLUMN IF NOT EXISTS added_by text;
        ALTER TABLE campaign_creators ADD COLUMN IF NOT EXISTS client_approval text DEFAULT 'not_required';
        ALTER TABLE campaign_creators ADD COLUMN IF NOT EXISTS content_type text DEFAULT 'Video';
        ALTER TABLE campaign_creators ADD COLUMN IF NOT EXISTS qty_live integer DEFAULT 0;
        ALTER TABLE campaign_creators ADD COLUMN IF NOT EXISTS nominal_pelunasan bigint DEFAULT 0;
        ALTER TABLE campaign_creators ADD COLUMN IF NOT EXISTS approved_by text;
        ALTER TABLE campaign_creators ADD COLUMN IF NOT EXISTS approved_at timestamptz;
        ALTER TABLE campaign_creators ADD COLUMN IF NOT EXISTS not_approved_by text;
        ALTER TABLE campaign_creators ADD COLUMN IF NOT EXISTS not_approved_at timestamptz;
        ALTER TABLE campaign_creators ADD COLUMN IF NOT EXISTS assigned_sku_ids jsonb;

        ALTER TABLE videos ADD COLUMN IF NOT EXISTS link_draft text;
        ALTER TABLE videos ADD COLUMN IF NOT EXISTS link_draft_updated_by text;
        ALTER TABLE videos ADD COLUMN IF NOT EXISTS link_draft_updated_at timestamptz;
        ALTER TABLE videos ADD COLUMN IF NOT EXISTS vt_approved_by text;
        ALTER TABLE videos ADD COLUMN IF NOT EXISTS vt_approved_at timestamptz;
        ALTER TABLE videos ADD COLUMN IF NOT EXISTS vt_approval text DEFAULT 'pending';
        ALTER TABLE videos ADD COLUMN IF NOT EXISTS revision_notes text;
        ALTER TABLE videos ADD COLUMN IF NOT EXISTS revision_notes_updated_by text;
        ALTER TABLE videos ADD COLUMN IF NOT EXISTS revision_notes_updated_at timestamptz;
        ALTER TABLE videos ADD COLUMN IF NOT EXISTS concept text;
        ALTER TABLE videos ADD COLUMN IF NOT EXISTS concept_updated_at timestamptz;
        ALTER TABLE videos ADD COLUMN IF NOT EXISTS concept_updated_by text;
        ALTER TABLE videos ADD COLUMN IF NOT EXISTS link_video text;
        ALTER TABLE videos ADD COLUMN IF NOT EXISTS content_uid text;
        ALTER TABLE videos ADD COLUMN IF NOT EXISTS sku_id integer;
        ALTER TABLE videos ADD COLUMN IF NOT EXISTS added_by text;
      EXCEPTION
        WHEN OTHERS THEN NULL;
      END $$;
    `);

    // PENTING (6 Okt 2026): JANGAN drop CHECK constraint di sini.
    //
    // Blok lama melakukan `DROP CONSTRAINT ... conname ILIKE '%vt_approval%'`
    // SETIAP KALI halaman video dibuka. Efeknya: constraint itu hilang
    // permanen di produksi, jadi nilai vt_approval apa pun bisa masuk
    // tanpa ditolak. Formasi constraint yang benar sekarang dibuat ulang
    // di bawah dengan ADD CONSTRAINT (bisa diulang karena DO-blok di bawah
    // membersihkannya lebih dulu).
    await db.execute(sql`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN (
          SELECT conname
          FROM pg_constraint
          WHERE conrelid = 'videos'::regclass
            AND contype = 'c'
            AND conname ILIKE '%vt_approval%'
        ) LOOP
          EXECUTE 'ALTER TABLE videos DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
        END LOOP;

        ALTER TABLE videos
          ADD CONSTRAINT videos_vt_approval_check
          CHECK (vt_approval IN ('pending','approved','revisi','reject'));
      EXCEPTION
        WHEN OTHERS THEN NULL;
      END $$;
    `);
  } catch (err) {
    console.error('ensureVideoColumns error:', err);
  }
}

function safeDate(val: any): string | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export async function upsertVideoAction(params: {
  id?: number;
  campaign_creator_id: number;
  urutan: number;
  concept?: string;
  concept_updated_at?: string;
  concept_updated_by?: string;
  link_draft?: string;
  link_draft_updated_by?: string;
  link_draft_updated_at?: string;
  link_video?: string;
  content_uid?: string;
  sku_id?: number | null;
  vt_approval?: string;
  vt_approved_by?: string;
  vt_approved_at?: string;
  revision_notes?: string;
  revision_notes_updated_by?: string;
  revision_notes_updated_at?: string;
  added_by?: string;
}) {
  try {
    await ensureVideoColumns();

    // GUARD: pastikan campaign_creator_id benar-benar milik campaign yang
    // boleh diakses user SEBELUM menyentuh baris video.
    //
    //Sebelum ini `WHERE id = ?` saja, jadi siapa pun yang login bisa
    // menebak `id` dan mengubah video campaign lain. Ownership harus di
    // WHERE (pola yang benar sudah ada di skuActions.ts:50), bukan dicek
    // terpisah setelahnya.
    const cc = await db.execute(sql`
      SELECT cc.campaign_id FROM campaign_creators cc WHERE cc.id = ${params.campaign_creator_id} LIMIT 1
    `) as any[];
    if (!cc[0]) {
      return { success: false, error: 'campaign_creator_id tidak ditemukan' };
    }
    await requireCampaignAccess(Number(cc[0].campaign_id));

    if (params.id) {
      // Update
      const sets: any[] = [];
      if (params.concept !== undefined) sets.push(sql`concept = ${params.concept}`);
      if (params.concept_updated_at !== undefined) sets.push(sql`concept_updated_at = ${safeDate(params.concept_updated_at)}`);
      if (params.concept_updated_by !== undefined) sets.push(sql`concept_updated_by = ${params.concept_updated_by}`);
      if (params.link_draft !== undefined) sets.push(sql`link_draft = ${params.link_draft}`);
      if (params.link_draft_updated_by !== undefined) sets.push(sql`link_draft_updated_by = ${params.link_draft_updated_by}`);
      if (params.link_draft_updated_at !== undefined) sets.push(sql`link_draft_updated_at = ${safeDate(params.link_draft_updated_at)}`);
      if (params.link_video !== undefined) sets.push(sql`link_video = ${params.link_video}`);
      if (params.content_uid !== undefined) sets.push(sql`content_uid = ${params.content_uid}`);
      if (params.sku_id !== undefined) sets.push(sql`sku_id = ${params.sku_id}`);
      if (params.vt_approval !== undefined) sets.push(sql`vt_approval = ${params.vt_approval}`);
      if (params.vt_approved_by !== undefined) sets.push(sql`vt_approved_by = ${params.vt_approved_by}`);
      if (params.vt_approved_at !== undefined) sets.push(sql`vt_approved_at = ${safeDate(params.vt_approved_at)}`);
      if (params.revision_notes !== undefined) sets.push(sql`revision_notes = ${params.revision_notes}`);
      if (params.revision_notes_updated_by !== undefined) sets.push(sql`revision_notes_updated_by = ${params.revision_notes_updated_by}`);
      if (params.revision_notes_updated_at !== undefined) sets.push(sql`revision_notes_updated_at = ${safeDate(params.revision_notes_updated_at)}`);
      if (params.added_by !== undefined) sets.push(sql`added_by = ${params.added_by}`);

      if (sets.length === 0) return { success: true, data: null };
      // `AND campaign_creator_id` menambah-yakin: baris yang salah campaign
      // tidak akan ter-update walau guard di atas lolos.
      const rows = await db.execute(sql`
        UPDATE videos SET ${sql.join(sets, sql`, `)}
        WHERE id = ${params.id} AND campaign_creator_id = ${params.campaign_creator_id}
        RETURNING *
      `) as any[];
      if (!rows[0]) {
        return { success: false, error: 'Video tidak ditemukan pada campaign ini' };
      }
      return { success: true, data: rows[0] };
    } else {
      // Check existing for same ccId + urutan
      const existing = await db.execute(sql`
        SELECT id FROM videos WHERE campaign_creator_id = ${params.campaign_creator_id} AND urutan = ${params.urutan} LIMIT 1
      `) as any[];
      if (existing.length > 0) {
        // Update existing
        return upsertVideoAction({ ...params, id: existing[0].id });
      }
      // Insert new
      const rows = await db.execute(sql`
        INSERT INTO videos (
          campaign_creator_id, urutan, concept, concept_updated_at, concept_updated_by,
          link_draft, link_draft_updated_by, link_draft_updated_at,
          link_video, content_uid, sku_id, vt_approval, vt_approved_by, vt_approved_at,
          revision_notes, revision_notes_updated_by, revision_notes_updated_at, added_by
        ) VALUES (
          ${params.campaign_creator_id}, ${params.urutan}, ${params.concept || ''},
          ${safeDate(params.concept_updated_at)},
          ${params.concept_updated_by || null},
          ${params.link_draft || null},
          ${params.link_draft_updated_by || null},
          ${safeDate(params.link_draft_updated_at)},
          ${params.link_video || null},
          ${params.content_uid || null},
          ${params.sku_id || null},
          ${params.vt_approval || 'pending'},
          ${params.vt_approved_by || null},
          ${safeDate(params.vt_approved_at)},
          ${params.revision_notes || null},
          ${params.revision_notes_updated_by || null},
          ${safeDate(params.revision_notes_updated_at)},
          ${params.added_by || null}
        ) RETURNING *
      `) as any[];
      return { success: true, data: rows[0] || null };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function insertVideoAction(params: {
  campaign_creator_id: number;
  urutan: number;
  concept?: string;
  link_video?: string;
  content_uid?: string;
  sku_id?: number | null;
  vt_approval?: string;
  added_by?: string;
}) {
  try {
    await ensureVideoColumns();
    const rows = await db.execute(sql`
      INSERT INTO videos (campaign_creator_id, urutan, concept, link_video, content_uid, sku_id, vt_approval, added_by)
      VALUES (${params.campaign_creator_id}, ${params.urutan}, ${params.concept || ''}, ${params.link_video || ''}, ${params.content_uid || null}, ${params.sku_id || null}, ${params.vt_approval || 'pending'}, ${params.added_by || null})
      RETURNING *
    `) as any[];
    return { success: true, data: rows[0] || null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteVideoAction(videoId: number) {
  try {
    // Backend Safeguard: Cek apakah video sudah terhubung ke data TikTok (organic_videos atau sales)
    const connected = (await db.execute(sql`
      SELECT v.id FROM videos v
      WHERE v.id = ${videoId}
        AND v.content_uid IS NOT NULL
        AND (
          EXISTS (
            SELECT 1 FROM organic_videos ov 
            WHERE (ov.content_uid = v.content_uid OR ov.content_uid = REPLACE(v.content_uid, 'video_', ''))
              AND (ov.video_views > 0 OR ov.video_likes > 0)
          )
          OR EXISTS (
            SELECT 1 FROM sales s 
            WHERE (s.content_uid = v.content_uid OR s.content_uid = REPLACE(v.content_uid, 'video_', ''))
          )
        )
    `)) as any[];
    if (connected && connected.length > 0) {
      return { 
        success: false, 
        error: 'Video ini sudah terhubung dengan data TikTok (views/penjualan) dan tidak dapat dihapus demi integritas data.' 
      };
    }

    await db.execute(sql`DELETE FROM videos WHERE id = ${videoId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteVideosAction(videoIds: number[]) {
  if (!videoIds || videoIds.length === 0) return { success: true };
  try {
    // Backend Safeguard: Cek apakah ada video yang sudah terhubung dengan data TikTok (organic_videos atau sales)
    const connectedVideos = (await db.execute(sql`
      SELECT v.id, v.content_uid 
      FROM videos v
      WHERE v.id IN ${sqlInList(videoIds)}
        AND v.content_uid IS NOT NULL
        AND (
          EXISTS (
            SELECT 1 FROM organic_videos ov 
            WHERE (ov.content_uid = v.content_uid OR ov.content_uid = REPLACE(v.content_uid, 'video_', ''))
              AND (ov.video_views > 0 OR ov.video_likes > 0)
          )
          OR EXISTS (
            SELECT 1 FROM sales s 
            WHERE (s.content_uid = v.content_uid OR s.content_uid = REPLACE(v.content_uid, 'video_', ''))
          )
        )
    `)) as any[];

    if (connectedVideos && connectedVideos.length > 0) {
      const ids = connectedVideos.map((r: any) => r.id).join(', ');
      return { 
        success: false, 
        error: `Tindakan dibatalkan: Ada ${connectedVideos.length} video (ID: ${ids}) yang sudah terhubung dengan data TikTok (views/penjualan). Video yang memiliki data TikTok tidak dapat dihapus.` 
      };
    }

    await db.execute(sql`DELETE FROM videos WHERE id IN ${sqlInList(videoIds)}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function bulkInsertVideosAction(videoList: Array<{
  campaign_creator_id: number;
  urutan: number;
  concept?: string;
  link_video?: string;
  content_uid?: string;
  vt_approval?: string;
  added_by?: string;
}>) {
  if (!videoList || videoList.length === 0) return { success: true };
  try {
    await ensureVideoColumns();
    for (const v of videoList) {
      await db.execute(sql`
        INSERT INTO videos (campaign_creator_id, urutan, concept, link_video, content_uid, vt_approval, added_by)
        VALUES (${v.campaign_creator_id}, ${v.urutan}, ${v.concept || ''}, ${v.link_video || null}, ${v.content_uid || null}, ${v.vt_approval || 'pending'}, ${v.added_by || null})
      `);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchVideosByCcIdsAction(ccIds: number[]) {
  if (!ccIds || ccIds.length === 0) return { success: true, data: [] };
  try {
    const data = await db.execute(sql`SELECT * FROM videos WHERE campaign_creator_id IN ${sqlInList(ccIds)} ORDER BY urutan ASC`) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function bulkVerifyVideoLinksAction(
  campaignId: number,
  items: Array<{
    id: string;
    originalUrl: string;
    expandedUrl: string;
    username?: string;
    videoId?: string;
    expandError?: string;
  }>
) {
  try {
    // SEBELUMNYA tanpa cek auth: campaignId datang dari argumen, jadi
    // siapa pun yang punya session bisa memverifikasi link milik campaign
    // mana pun. Ditutup 30 Sep 2026.
    try {
      await requireCampaignAccess(campaignId);
    } catch (err: any) {
      return { success: false, results: [], error: err?.message ?? 'Akses ditolak.' };
    }

    if (!items || items.length === 0) {
      return { success: true, results: [] };
    }

    const videoIds = items.map(it => it.videoId).filter(Boolean) as string[];
    const usernames = items.map(it => it.username?.toLowerCase().trim()).filter(Boolean) as string[];

    // 1. Fetch existing videos by content_uid across database
    let existingVideos: any[] = [];
    if (videoIds.length > 0) {
      existingVideos = (await db.execute(sql`
        SELECT 
          v.id as video_id,
          v.content_uid,
          v.campaign_creator_id,
          cc.campaign_id,
          c.username as creator_username
        FROM videos v
        LEFT JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
        LEFT JOIN creators c ON cc.creator_id = c.id
        WHERE v.content_uid IN ${sqlInList(videoIds)}
      `)) as any[];
    }

    const existingVideoMap = new Map<string, any>();
    existingVideos.forEach(v => {
      if (v.content_uid) existingVideoMap.set(v.content_uid, v);
    });

    // 2. Fetch campaign creators for this campaign matching usernames
    let campaignCreators: any[] = [];
    if (usernames.length > 0) {
      campaignCreators = (await db.execute(sql`
        SELECT 
          cc.id as cc_id,
          cc.campaign_id,
          c.id as creator_id,
          LOWER(c.username) as username,
          c.nama_asli
        FROM campaign_creators cc
        JOIN creators c ON cc.creator_id = c.id
        WHERE cc.campaign_id = ${campaignId} AND LOWER(c.username) IN ${sqlInList(usernames)}
      `)) as any[];
    }
    const ccMap = new Map<string, any>();
    campaignCreators.forEach(cc => {
      if (cc.username) ccMap.set(cc.username, cc);
    });

    // 3. Fetch global creators matching usernames
    let globalCreators: any[] = [];
    if (usernames.length > 0) {
      globalCreators = (await db.execute(sql`
        SELECT id as creator_id, LOWER(username) as username, nama_asli
        FROM creators
        WHERE LOWER(username) IN ${sqlInList(usernames)}
      `)) as any[];
    }
    const globalCreatorMap = new Map<string, any>();
    globalCreators.forEach(c => {
      if (c.username) globalCreatorMap.set(c.username, c);
    });

    // Track duplicates within current batch
    const seenBatchVideoIds = new Set<string>();

    const results = items.map(item => {
      const vId = item.videoId;
      const uName = item.username?.toLowerCase().trim();

      if (!vId || !uName) {
        return {
          id: item.id,
          originalUrl: item.originalUrl,
          expandedUrl: item.expandedUrl,
          username: item.username || '',
          videoId: item.videoId || '',
          status: 'error',
          // Kalau linknya pendek tapi gagal dikonversi, tampilkan alasan aslinya
          // supaya PIC tidak mengira link-nya yang salah.
          statusText: item.expandError
            || 'Format URL TikTok tidak valid (username / Video ID tidak ditemukan)',
          canImport: false,
        };
      }

      if (seenBatchVideoIds.has(vId)) {
        return {
          id: item.id,
          originalUrl: item.originalUrl,
          expandedUrl: item.expandedUrl,
          username: item.username,
          videoId: item.videoId,
          status: 'duplicate_batch',
          statusText: 'Duplikat dalam antrean input',
          canImport: false,
        };
      }
      seenBatchVideoIds.add(vId);

      const dbVideo = existingVideoMap.get(vId);
      if (dbVideo) {
        if (Number(dbVideo.campaign_id) === Number(campaignId)) {
          return {
            id: item.id,
            originalUrl: item.originalUrl,
            expandedUrl: item.expandedUrl,
            username: item.username,
            videoId: item.videoId,
            status: 'duplicate_db',
            statusText: 'Sudah ada di campaign ini',
            canImport: false,
          };
        } else {
          return {
            id: item.id,
            originalUrl: item.originalUrl,
            expandedUrl: item.expandedUrl,
            username: item.username,
            videoId: item.videoId,
            status: 'duplicate_db',
            statusText: `Sudah terdaftar di campaign #${dbVideo.campaign_id || 'lain'}`,
            canImport: false,
          };
        }
      }

      // Check if creator is already in this campaign
      const ccMatch = ccMap.get(uName);
      if (ccMatch) {
        return {
          id: item.id,
          originalUrl: item.originalUrl,
          expandedUrl: item.expandedUrl,
          username: item.username,
          videoId: item.videoId,
          status: 'ready_existing',
          statusText: 'Kreator Terdaftar (Campaign)',
          creatorName: ccMatch.nama_asli,
          ccId: ccMatch.cc_id,
          creatorId: ccMatch.creator_id,
          canImport: true,
        };
      }

      // Check if creator exists in global master
      const globalMatch = globalCreatorMap.get(uName);
      if (globalMatch) {
        return {
          id: item.id,
          originalUrl: item.originalUrl,
          expandedUrl: item.expandedUrl,
          username: item.username,
          videoId: item.videoId,
          status: 'ready_global',
          statusText: 'Kreator Master (Akan Masuk Campaign)',
          creatorName: globalMatch.nama_asli,
          creatorId: globalMatch.creator_id,
          canImport: true,
        };
      }

      // Brand new creator
      return {
        id: item.id,
        originalUrl: item.originalUrl,
        expandedUrl: item.expandedUrl,
        username: item.username,
        videoId: item.videoId,
        status: 'ready_new',
        statusText: 'Kreator Baru (Auto-Detect)',
        canImport: true,
      };
    });

    return { success: true, results };
  } catch (err: any) {
    console.error('bulkVerifyVideoLinksAction error:', err);
    return { success: false, error: err.message, results: [] };
  }
}

export async function commitBulkImportVideosAction(
  campaignId: number,
  items: Array<{
    originalUrl: string;
    expandedUrl: string;
    username: string;
    videoId: string;
    skuId?: number | null;
  }>,
  addedById?: string,
  picName?: string
) {
  try {
    // SEBELUMNYA tanpa cek auth. Fungsi ini menulis ke `creators`,
    // `campaign_creators`, `creator_snapshots`, dan `videos` â€” hanya
    // berdasarkan campaignId dari argumen, tanpa verifikasi pemilik.
    // Ditutup 30 Sep 2026.
    try {
      await requireCampaignAccess(campaignId);
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'Akses ditolak.' };
    }

    await ensureVideoColumns();
    await ensureNotesTable();

    if (!items || items.length === 0) {
      return { success: false, error: 'Tidak ada video yang valid untuk diimport.' };
    }

    // Deduplicate items in memory by videoId
    const uniqueItemsMap = new Map<string, typeof items[0]>();
    for (const item of items) {
      if (item.videoId && !uniqueItemsMap.has(item.videoId)) {
        uniqueItemsMap.set(item.videoId, item);
      }
    }
    const cleanItems = Array.from(uniqueItemsMap.values());
    const videoIds = cleanItems.map(it => it.videoId);

    // Final safety check against DB duplicate videos
    let existingVids: any[] = [];
    if (videoIds.length > 0) {
      existingVids = (await db.execute(sql`
        SELECT content_uid FROM videos WHERE content_uid IN ${sqlInList(videoIds)}
      `)) as any[];
    }
    const existingVidSet = new Set(existingVids.map((r: any) => r.content_uid));

    const validItems = cleanItems.filter(it => !existingVidSet.has(it.videoId));
    if (validItems.length === 0) {
      return {
        success: true,
        insertedCount: 0,
        skippedCount: cleanItems.length,
        message: 'Semua video sudah ada di database (Dilewati untuk mencegah duplikasi).'
      };
    }

    // Group items by username (lowercase)
    const creatorGroup = new Map<string, typeof validItems>();
    validItems.forEach(item => {
      const u = item.username.trim().toLowerCase();
      if (!creatorGroup.has(u)) creatorGroup.set(u, []);
      creatorGroup.get(u)!.push(item);
    });

    const usernames = Array.from(creatorGroup.keys());

    // Semua penulisan DB dibungkus SATU transaksi: creators,
    // campaign_creators, creator_snapshots, dan videos.
    //
    // Sebelumnya kalau gagal di tengah (misal timeout di video ke-400 dari 500),
    // video 1-400 tetap tersimpan sementara layar menampilkan "gagal". Tidak ada
    // transaksi, jadi tidak ada yang membatalkan.
    //
    // ensureVideoColumns dan ensureNotesTable sengaja DI LUAR transaksi:
    // ALTER TABLE menahan lock, dan lock itu tidak boleh ditahan selama
    // seluruh transaksi berjalan.
    const result = await db.transaction(async (tx) => {
      let insertedTotal = 0;

      // 1. Ensure all creators exist in `creators` table
      for (const u of usernames) {
      await tx.execute(sql`
        INSERT INTO creators (username, link_account, added_by)
        VALUES (${u}, ${'https://www.tiktok.com/@' + u}, ${addedById || null})
        ON CONFLICT (lower(username)) DO UPDATE SET link_account = EXCLUDED.link_account
      `);
    }

    let creatorRows: any[] = [];
    if (usernames.length > 0) {
      creatorRows = (await tx.execute(sql`
        SELECT id, LOWER(username) as username FROM creators WHERE LOWER(username) IN ${sqlInList(usernames)}
      `)) as any[];
    }
    const creatorMap = new Map<string, number>(creatorRows.map((r: any) => [r.username, r.id]));

    // 2. Ensure `campaign_creators` exist for this campaign
    for (const u of usernames) {
      const creatorId = creatorMap.get(u);
      if (!creatorId) continue;
      const vidsCount = creatorGroup.get(u)!.length;

      const existingCc = (await tx.execute(sql`
        SELECT id, qty_vt FROM campaign_creators WHERE campaign_id = ${campaignId} AND creator_id = ${creatorId} LIMIT 1
      `)) as any[];

      if (existingCc.length === 0) {
        await tx.execute(sql`
          INSERT INTO campaign_creators (
            campaign_id, creator_id, tier, price, qty_vt, qty_live, content_type,
            approval, pic_assist, notes_manager, notes_pic, sample_progress,
            gmv_organic_legacy, gmv_ads_legacy, status_bayar, nominal_pelunasan,
            client_approval, added_by
          ) VALUES (
            ${campaignId}, ${creatorId}, 'Nano', 0, ${vidsCount}, 0, 'Video',
            'approved', ${picName || '-'}, '', '', 'Belum',
            0, 0, 'belum', 0,
            'not_required', ${addedById || null}
          )
        `);

        // Insert initial snapshot
        await tx.execute(sql`
          INSERT INTO creator_snapshots (creator_id, followers, gmv_30d, gmv_30d_organic, gmv_30d_live, tanggal_update, updated_by)
          VALUES (${creatorId}, 0, 0, 0, 0, CURRENT_DATE, ${picName || 'Bulk Import'})
          ON CONFLICT DO NOTHING
        `);
      }
    }

    // 3. Fetch final `campaign_creators` IDs for this campaign
    let ccRows: any[] = [];
    if (usernames.length > 0) {
      ccRows = (await tx.execute(sql`
        SELECT cc.id as cc_id, LOWER(c.username) as username
        FROM campaign_creators cc
        JOIN creators c ON cc.creator_id = c.id
        WHERE cc.campaign_id = ${campaignId} AND LOWER(c.username) IN ${sqlInList(usernames)}
      `)) as any[];
    }
    const ccIdMap = new Map<string, number>(ccRows.map((r: any) => [r.username, r.cc_id]));

    // 4. For each creator, get current MAX(urutan) and insert new video entries
    for (const [u, creatorItems] of creatorGroup.entries()) {
      const ccId = ccIdMap.get(u);
      if (!ccId) continue;

      const maxUrutanRes = (await tx.execute(sql`
        SELECT COALESCE(MAX(urutan), 0) as max_urutan FROM videos WHERE campaign_creator_id = ${ccId}
      `)) as any[];
      let currentUrutan = Number(maxUrutanRes[0]?.max_urutan || 0);

      for (const item of creatorItems) {
        currentUrutan++;
        const finalUrl = item.expandedUrl || item.originalUrl;
        await tx.execute(sql`
          INSERT INTO videos (
            campaign_creator_id, urutan, concept, link_video, content_uid, sku_id,
            vt_approval, added_by
          ) VALUES (
            ${ccId}, ${currentUrutan}, '', ${finalUrl}, ${item.videoId}, ${item.skuId || null},
            'pending', ${picName || 'PIC'}
          )
        `);
        insertedTotal++;
      }

      // Update qty_vt on campaign_creators if current total videos exceeds qty_vt
      await tx.execute(sql`
        UPDATE campaign_creators
        SET qty_vt = GREATEST(qty_vt, ${currentUrutan}),
            approval = 'approved'
        WHERE id = ${ccId}
      `);
    }

      return {
        success: true,
        insertedCount: insertedTotal,
        skippedCount: cleanItems.length - validItems.length,
        message: `Berhasil mengimport ${insertedTotal} video ke database!`
      };
    });

    revalidatePath(`/campaigns/${campaignId}/video`);
    revalidatePath(`/campaigns/${campaignId}/listing`);

    return result;
  } catch (err: any) {
    console.error('commitBulkImportVideosAction error:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================
// LISTING PAGE - COUNTS & RECAP
// ============================================================
export async function fetchCampaignCreatorCountsAction(campaignId: number) {
  try {
    const rows = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE approval = 'approved') as approved,
        COUNT(*) FILTER (WHERE approval = 'pending') as pending,
        COUNT(*) FILTER (WHERE approval = 'alternate') as alternate,
        COUNT(*) FILTER (WHERE approval = 'not_approved') as not_approved,
        COUNT(*) as total
      FROM campaign_creators WHERE campaign_id = ${campaignId}
    `) as any[];
    const r = rows[0] || {};
    return {
      success: true,
      approved: Number(r.approved || 0),
      pending: Number(r.pending || 0),
      alternate: Number(r.alternate || 0),
      not_approved: Number(r.not_approved || 0),
      total: Number(r.total || 0)
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchCampaignCreatorsRecapAction(campaignId: number) {
  try {
    const data = await db.execute(sql`
      SELECT cc.id, cc.approval, cc.approved_at, cc.not_approved_at, cc.created_at, cc.added_by, cc.tier, cc.creator_id,
             c.username
      FROM campaign_creators cc
      LEFT JOIN creators c ON cc.creator_id = c.id
      WHERE cc.campaign_id = ${campaignId}
      ORDER BY cc.id ASC
    `) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function fetchCampaignCreatorsDuplicateCheckAction(campaignId: number) {
  try {
    const data = await db.execute(sql`
      SELECT cc.id, cc.campaign_id, cc.creator_id, c.username
      FROM campaign_creators cc
      LEFT JOIN creators c ON cc.creator_id = c.id
      WHERE cc.campaign_id = ${campaignId}
      ORDER BY cc.id ASC
    `) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function fetchDuplicateCcDetailsAction(ccIds: number[]) {
  if (!ccIds || ccIds.length === 0) return { success: true, data: [] };
  try {
    const data = await db.execute(sql`
      SELECT 
        cc.id, cc.campaign_id, cc.creator_id, cc.price, cc.qty_vt, cc.approval, cc.sample_progress, cc.status_bayar, cc.notes_manager, cc.notes_pic,
        c.username,
        json_agg(json_build_object('id', v.id, 'urutan', v.urutan, 'concept', v.concept, 'link_video', v.link_video, 'vt_approval', v.vt_approval)) FILTER (WHERE v.id IS NOT NULL) as videos
      FROM campaign_creators cc
      LEFT JOIN creators c ON cc.creator_id = c.id
      LEFT JOIN videos v ON v.campaign_creator_id = cc.id
      WHERE cc.id IN ${sqlInList(ccIds)}
      GROUP BY cc.id, c.username
    `) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function mergeCampaignCreatorsAction(survivingId: number, otherIds: number[], updateData: any) {
  try {
    // Move all videos from otherIds to survivingId
    if (otherIds.length > 0) {
      await db.execute(sql`UPDATE videos SET campaign_creator_id = ${survivingId} WHERE campaign_creator_id IN ${sqlInList(otherIds)}`);
    }
    // Update surviving row
    const sets: any[] = [];
    if (updateData.price !== undefined) sets.push(sql`price = ${updateData.price}`);
    if (updateData.qty_vt !== undefined) sets.push(sql`qty_vt = ${updateData.qty_vt}`);
    if (updateData.qty_live !== undefined) sets.push(sql`qty_live = ${updateData.qty_live}`);
    if (updateData.approval !== undefined) sets.push(sql`approval = ${updateData.approval}`);
    if (updateData.sample_progress !== undefined) sets.push(sql`sample_progress = ${updateData.sample_progress}`);
    if (updateData.status_bayar !== undefined) sets.push(sql`status_bayar = ${updateData.status_bayar}`);
    if (updateData.content_type !== undefined) sets.push(sql`content_type = ${updateData.content_type}`);
    if (updateData.tier !== undefined) sets.push(sql`tier = ${updateData.tier}`);
    if (updateData.notes_manager !== undefined) sets.push(sql`notes_manager = ${updateData.notes_manager}`);
    if (updateData.notes_pic !== undefined) sets.push(sql`notes_pic = ${updateData.notes_pic}`);
    if (updateData.approved_by !== undefined) sets.push(sql`approved_by = ${updateData.approved_by}`);
    if (updateData.approved_at !== undefined) sets.push(sql`approved_at = ${updateData.approved_at}`);
    if (updateData.not_approved_by !== undefined) sets.push(sql`not_approved_by = ${updateData.not_approved_by}`);
    if (updateData.not_approved_at !== undefined) sets.push(sql`not_approved_at = ${updateData.not_approved_at}`);
    if (updateData.assigned_sku_ids !== undefined) sets.push(sql`assigned_sku_ids = ${updateData.assigned_sku_ids}`);
    
    if (sets.length > 0) {
      await db.execute(sql`UPDATE campaign_creators SET ${sql.join(sets, sql`, `)} WHERE id = ${survivingId}`);
    }
    // Delete other rows
    if (otherIds.length > 0) {
      await db.execute(sql`DELETE FROM campaign_creators WHERE id IN ${sqlInList(otherIds)}`);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchOrgVideoUsernamesAction(campaignId: number) {
  try {
    const data = await db.execute(sql`SELECT DISTINCT creator_username FROM organic_videos WHERE campaign_id = ${campaignId} AND creator_username IS NOT NULL`) as any[];
    return { success: true, data: (data || []).map((r: any) => r.creator_username?.toLowerCase()).filter(Boolean) };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function fetchSalesVideoUsernamesAction(campaignId: number) {
  try {
    const data = await db.execute(sql`SELECT DISTINCT creator_username FROM sales WHERE campaign_id = ${campaignId} AND content_uid IS NOT NULL AND creator_username IS NOT NULL`) as any[];
    return { success: true, data: (data || []).map((r: any) => r.creator_username?.toLowerCase()).filter(Boolean) };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function fetchCreatorIdsByUsernamesAction(usernames: string[]) {
  if (!usernames || usernames.length === 0) return { success: true, data: [] };
  try {
    const data = await db.execute(sql`SELECT id FROM creators WHERE LOWER(username) IN ${sqlInList(usernames.map(u => u.toLowerCase()))}`) as any[];
    return { success: true, data: (data || []).map((r: any) => r.id) };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function fetchVideoCreatorIdsForCampaignAction(campaignId: number) {
  try {
    const data = await db.execute(sql`
      SELECT DISTINCT cc.creator_id FROM videos v
      JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
      WHERE cc.campaign_id = ${campaignId}
    `) as any[];
    return { success: true, data: (data || []).map((r: any) => r.creator_id) };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function fetchSalesByCreatorUsernamesAction(campaignId: number, creatorUsernames: string[], skuProductIds: string[]) {
  if (!creatorUsernames || creatorUsernames.length === 0 || !skuProductIds || skuProductIds.length === 0) return { success: true, data: [] };
  try {
    const cleanUsernames = Array.from(new Set(
      creatorUsernames.map(u => (u || '').replace(/^@/, '').toLowerCase().trim()).filter(Boolean)
    ));
    if (cleanUsernames.length === 0) return { success: true, data: [] };

    const data = await db.execute(sql`
      SELECT DISTINCT content_uid, creator_username, product_id
      FROM (
        SELECT content_uid, creator_username, product_id
        FROM sales
        WHERE (campaign_id = ${campaignId} OR (product_id IS NOT NULL AND product_id IN ${sqlInList(skuProductIds)}))
          AND LOWER(REPLACE(creator_username, '@', '')) IN ${sqlInList(cleanUsernames)}
          AND content_uid IS NOT NULL
          AND content_uid != ''
          AND content_uid != '-'
          AND LOWER(COALESCE(content_type, '')) NOT IN ('live', 'livestream')
        UNION ALL
        SELECT content_uid, creator_username, product_id
        FROM organic_videos
        WHERE (campaign_id = ${campaignId} OR (product_id IS NOT NULL AND product_id IN ${sqlInList(skuProductIds)}))
          AND LOWER(REPLACE(creator_username, '@', '')) IN ${sqlInList(cleanUsernames)}
          AND content_uid IS NOT NULL
          AND content_uid != ''
          AND content_uid != '-'
          AND LOWER(COALESCE(content_type, '')) NOT IN ('live', 'livestream')
      ) combined
    `) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function fetchStaffProfilesAction() {
  try {
    const data = await db.execute(sql`SELECT id, nama FROM profiles ORDER BY nama ASC`) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

// ============================================================
// LISTING FETCH (Paginated with filters via raw SQL)
// ============================================================
export async function fetchListingPagePaginatedAction(params: {
  campaignId: number;
  pageNum: number;
  pageSize?: number;
  statusFilter?: string;
  tierFilter?: string;
  levelFilter?: string;
  nicheFilter?: string;
  addedByFilter?: string;
  actionByFilter?: string;
  contentTypeFilter?: string;
  conceptFilter?: string;
  search?: string;
  actionDateFilter?: string;
  notesFilter?: string;
  pendingWithVideoFilter?: boolean;
  unattributedFilter?: boolean;
}) {
  const {
    campaignId, pageNum, pageSize = 100,
    statusFilter, tierFilter, levelFilter, nicheFilter, addedByFilter, actionByFilter,
    contentTypeFilter, conceptFilter, search, actionDateFilter,
    notesFilter, pendingWithVideoFilter, unattributedFilter
  } = params;
  const offset = pageNum * pageSize;
  const conditions: any[] = [sql`cc.campaign_id = ${campaignId}`];
  
  if (statusFilter && statusFilter !== 'all') conditions.push(sql`cc.approval = ${statusFilter}`);
  if (tierFilter) conditions.push(sql`(cc.tier ILIKE ${'%' + tierFilter + '%'} OR EXISTS (SELECT 1 FROM creator_snapshots cs WHERE cs.creator_id = cc.creator_id AND cs.tier ILIKE ${'%' + tierFilter + '%'} LIMIT 1))`);
  if (levelFilter) conditions.push(sql`EXISTS (SELECT 1 FROM creator_snapshots cs WHERE cs.creator_id = cc.creator_id AND cs.level = ${Number(levelFilter)} LIMIT 1)`);
  if (nicheFilter) conditions.push(sql`EXISTS (SELECT 1 FROM creator_niches cn WHERE cn.creator_id = cc.creator_id AND cn.niche_id = ${Number(nicheFilter)} LIMIT 1)`);
  if (addedByFilter) conditions.push(sql`cc.added_by = ${addedByFilter}`);
  if (actionByFilter) conditions.push(sql`(cc.approved_by = ${actionByFilter} OR cc.not_approved_by = ${actionByFilter})`);
  if (contentTypeFilter) conditions.push(sql`cc.content_type = ${contentTypeFilter}`);
  if (conceptFilter) conditions.push(sql`EXISTS (SELECT 1 FROM videos v WHERE v.campaign_creator_id = cc.id AND v.concept = ${conceptFilter} LIMIT 1)`);
  if (search) {
    const s = '%' + search + '%';
    conditions.push(sql`(c.username ILIKE ${s} OR c.nama_asli ILIKE ${s})`);
  }
  if (actionDateFilter) {
    const start = new Date(`${actionDateFilter}T00:00:00+07:00`).toISOString();
    const end = new Date(`${actionDateFilter}T23:59:59+07:00`).toISOString();
    conditions.push(sql`(\
      (cc.approval = 'approved' AND (cc.approved_at >= ${start} AND cc.approved_at <= ${end})) OR\
      (cc.approval IN ('not_approved','alternate') AND (cc.not_approved_at >= ${start} AND cc.not_approved_at <= ${end})) OR\
      (cc.approval = 'pending' AND cc.created_at >= ${start} AND cc.created_at <= ${end})\
    )`);
  }
  if (notesFilter === 'Ada Notes') {
    conditions.push(sql`(
      (cc.notes_manager IS NOT NULL AND cc.notes_manager != '') OR
      (cc.notes_pic IS NOT NULL AND cc.notes_pic != '') OR
      (cc.notes_client IS NOT NULL AND cc.notes_client != '')
    )`);
  }
  if (pendingWithVideoFilter) {
    conditions.push(sql`(
      cc.approval != 'approved' AND (
        EXISTS (
          SELECT 1 FROM videos v 
          WHERE v.campaign_creator_id = cc.id 
            AND v.link_video IS NOT NULL 
            AND v.link_video != ''
        )
        OR EXISTS (
          SELECT 1 FROM organic_videos ov 
          WHERE ov.campaign_id = cc.campaign_id 
            AND LOWER(ov.creator_username) = LOWER(c.username)
        )
        OR EXISTS (
          SELECT 1 FROM sales s 
          WHERE s.campaign_id = cc.campaign_id 
            AND LOWER(s.creator_username) = LOWER(c.username) 
            AND s.content_uid IS NOT NULL 
            AND s.content_uid != ''
        )
      )
    )`);
  }
  if (unattributedFilter) {
    conditions.push(sql`(
      cc.approval != 'approved' AND (
        EXISTS (
          SELECT 1 FROM sales s 
          WHERE s.campaign_id = cc.campaign_id 
            AND LOWER(s.creator_username) = LOWER(c.username) 
            AND s.gmv > 0
        )
      )
    )`);
  }

  const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

  try {
    const data = await db.execute(sql`
      SELECT 
        cc.*,
        c.id as creator_db_id, c.username, c.nama_asli, c.link_account,
        p_add.nama as added_by_name, p_app.nama as approved_by_name, p_rej.nama as not_approved_by_name,
        (
          SELECT json_agg(jsonb_build_object('id', ct.id, 'nomor', ct.nomor, 'status', ct.status))
          FROM creator_contacts ct 
          WHERE ct.creator_id = cc.creator_id
        ) as creator_contacts,
        (
          SELECT json_agg(jsonb_build_object('id', cs.id, 'audience_age', cs.audience_age, 'level', cs.level, 'gmv_30d', cs.gmv_30d, 'gmv_30d_video', cs.gmv_30d_video, 'gmv_30d_live', cs.gmv_30d_live, 'tanggal_update', cs.tanggal_update, 'followers', cs.followers, 'tier', cs.tier, 'ratecard', cs.ratecard))
          FROM creator_snapshots cs 
          WHERE cs.creator_id = cc.creator_id
        ) as creator_snapshots,
        (
          SELECT json_agg(jsonb_build_object('niche_id', cn.niche_id, 'nama', n.nama))
          FROM creator_niches cn 
          LEFT JOIN niches n ON cn.niche_id = n.id 
          WHERE cn.creator_id = cc.creator_id
        ) as creator_niches,
        (
          SELECT json_agg(jsonb_build_object(
            'id', v.id, 
            'campaign_creator_id', v.campaign_creator_id,
            'urutan', v.urutan, 
            'concept', v.concept, 
            'concept_updated_at', v.concept_updated_at, 
            'concept_updated_by', v.concept_updated_by, 
            'link_draft', v.link_draft,
            'link_draft_updated_by', v.link_draft_updated_by,
            'link_draft_updated_at', v.link_draft_updated_at,
            'link_video', v.link_video, 
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
          FROM videos v 
          WHERE v.campaign_creator_id = cc.id
        ) as videos
      FROM campaign_creators cc
      LEFT JOIN creators c ON cc.creator_id = c.id
      LEFT JOIN profiles p_add ON cc.added_by = p_add.id
      LEFT JOIN profiles p_app ON cc.approved_by = p_app.id
      LEFT JOIN profiles p_rej ON cc.not_approved_by = p_rej.id
      ${whereClause}
      ORDER BY cc.id DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `) as any[];

    const mapped = (data || []).map((r: any) => ({
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
      added_by_profile: r.added_by_name ? { nama: r.added_by_name } : null,
      approved_by_profile: r.approved_by_name ? { nama: r.approved_by_name } : null,
      not_approved_by_profile: r.not_approved_by_name ? { nama: r.not_approved_by_name } : null,
    }));

    return { success: true, data: mapped, hasMore: mapped.length === pageSize };
  } catch (err: any) {
    console.error('fetchListingPagePaginatedAction error:', err);
    return { success: false, data: [], hasMore: false, error: err.message };
  }
}

// ============================================================
// CREATOR SEARCH & SNAPSHOT for listing add-creator modal
// ============================================================
export async function searchCreatorsWithSnapshotsAction(usernames: string[]) {
  if (!usernames || usernames.length === 0) return { success: true, data: [] };
  try {
    const data = await db.execute(sql`
      SELECT 
        c.id, c.username, c.added_by,
        json_agg(DISTINCT jsonb_build_object('id', ct.id, 'nomor', ct.nomor, 'status', ct.status)) FILTER (WHERE ct.id IS NOT NULL) as creator_contacts,
        json_agg(DISTINCT jsonb_build_object('id', cs.id, 'ratecard', cs.ratecard, 'followers', cs.followers, 'tanggal_update', cs.tanggal_update)) FILTER (WHERE cs.id IS NOT NULL) as creator_snapshots,
        json_agg(DISTINCT jsonb_build_object('niche_id', cn.niche_id)) FILTER (WHERE cn.niche_id IS NOT NULL) as creator_niches,
        json_agg(DISTINCT jsonb_build_object('campaign_id', cc2.campaign_id, 'nama', camp.nama)) FILTER (WHERE cc2.id IS NOT NULL) as campaign_creators
      FROM creators c
      LEFT JOIN creator_contacts ct ON ct.creator_id = c.id
      LEFT JOIN creator_snapshots cs ON cs.creator_id = c.id
      LEFT JOIN creator_niches cn ON cn.creator_id = c.id
      LEFT JOIN campaign_creators cc2 ON cc2.creator_id = c.id
      LEFT JOIN campaigns camp ON cc2.campaign_id = camp.id
      WHERE LOWER(c.username) IN ${sqlInList(usernames.map(u => u.toLowerCase()))}
      GROUP BY c.id
    `) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function fetchCreatorSnapshotsBatchAction(creatorIds: number[]) {
  if (!creatorIds || creatorIds.length === 0) return { success: true, data: [] };
  try {
    const data = await db.execute(sql`
      SELECT DISTINCT ON (creator_id) id, creator_id, followers, gmv_30d, gmv_30d_video, gmv_30d_live, tier, ratecard, level, audience_age, tanggal_update
      FROM creator_snapshots WHERE creator_id IN ${sqlInList(creatorIds)}
      ORDER BY creator_id, id DESC
    `) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function fetchExistingCcUsernamesAction(campaignId: number) {
  try {
    const data = await db.execute(sql`
      SELECT LOWER(c.username) as username, cc.creator_id
      FROM campaign_creators cc
      JOIN creators c ON cc.creator_id = c.id
      WHERE cc.campaign_id = ${campaignId}
    `) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function insertCreatorsAndCcAction(campaignId: number, creatorPayloads: any[], campaignCreatorPayloads: any[]) {
  try {
    // Upsert creators
    for (const c of creatorPayloads) {
      await db.execute(sql`
        INSERT INTO creators (username, link_account, added_by)
        VALUES (${c.username}, ${c.link_account}, ${c.added_by || null})
        ON CONFLICT (lower(username)) DO UPDATE SET link_account = EXCLUDED.link_account
        RETURNING id
      `);
    }
    // Get the IDs for each creator
    const allUsernames = creatorPayloads.map(c => c.username.toLowerCase());
    const crRows = await db.execute(sql`SELECT id, LOWER(username) as username FROM creators WHERE LOWER(username) IN ${sqlInList(allUsernames)}`) as any[];
    const crMap = new Map(crRows.map((r: any) => [r.username, r.id]));
    
    // Insert campaign creators
    for (const cc of campaignCreatorPayloads) {
      const cId = crMap.get(cc.username?.toLowerCase()) || cc.creator_id;
      if (!cId) continue;
      await db.execute(sql`
        INSERT INTO campaign_creators (
          campaign_id, creator_id, tier, price, qty_vt, qty_live, content_type,
          approval, pic_assist, notes_manager, notes_pic, sample_progress,
          gmv_organic_legacy, gmv_ads_legacy, status_bayar, nominal_pelunasan,
          client_approval, added_by
        ) VALUES (
          ${campaignId}, ${cId}, ${cc.tier}, ${cc.price}, ${cc.qty_vt}, ${cc.qty_live || 0}, ${cc.content_type || 'Video'},
          'pending', ${cc.pic_assist || '-'}, '', '', 'Belum',
          0, 0, 'belum', 0,
          ${cc.client_approval || 'not_required'}, ${cc.added_by || null}
        )
        ON CONFLICT DO NOTHING
      `);
    }
    
    // Insert initial snapshots for creators needing one
    for (const cc of campaignCreatorPayloads) {
      if (!cc.creator_id && !crMap.get(cc.username?.toLowerCase())) continue;
      const cId = cc.creator_id || crMap.get(cc.username?.toLowerCase());
      if (!cId || cc.hasSnapshot) continue;
      await db.execute(sql`
        INSERT INTO creator_snapshots (creator_id, followers, gmv_30d, gmv_30d_video, gmv_30d_live, ratecard, tier, tanggal_update, updated_by)
        VALUES (${cId}, 0, 0, 0, 0, ${cc.price || 0}, 'Nano', CURRENT_DATE, ${cc.pic_assist || 'System'})
        ON CONFLICT DO NOTHING
      `);
    }
    
    return { success: true };
  } catch (err: any) {
    console.error('insertCreatorsAndCcAction error:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================
// EXPORT (All creators data)
// ============================================================
export async function fetchExportCampaignCreatorsAction(campaignId: number, statuses: string[]) {
  if (!statuses || statuses.length === 0) return { success: true, data: [] };
  try {
    const data = await db.execute(sql`
      SELECT 
        cc.*,
        c.username, c.nama_asli, c.link_account,
        json_agg(DISTINCT jsonb_build_object('nomor', ct.nomor, 'status', ct.status)) FILTER (WHERE ct.id IS NOT NULL) as creator_contacts,
        json_agg(DISTINCT jsonb_build_object('id', cs.id, 'level', cs.level, 'followers', cs.followers, 'gmv_30d', cs.gmv_30d, 'gmv_30d_video', cs.gmv_30d_video, 'gmv_30d_live', cs.gmv_30d_live, 'tanggal_update', cs.tanggal_update)) FILTER (WHERE cs.id IS NOT NULL) as creator_snapshots
      FROM campaign_creators cc
      LEFT JOIN creators c ON cc.creator_id = c.id
      LEFT JOIN creator_contacts ct ON ct.creator_id = cc.creator_id
      LEFT JOIN creator_snapshots cs ON cs.creator_id = cc.creator_id
      WHERE cc.campaign_id = ${campaignId}
        AND cc.approval IN ${sqlInList(statuses)}
      GROUP BY cc.id, c.username, c.nama_asli, c.link_account
      ORDER BY cc.id DESC
    `) as any[];
    const mapped = (data || []).map((r: any) => ({
      ...r,
      creators: {
        username: r.username,
        nama_asli: r.nama_asli,
        link_account: r.link_account,
        creator_contacts: r.creator_contacts || [],
        creator_snapshots: r.creator_snapshots || [],
      }
    }));
    return { success: true, data: mapped };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

// ============================================================
// SPREADSHEET IMPORT CREATOR - Server Actions
// ============================================================
export async function fetchCreatorsWithSnapshotsForImportAction(usernames: string[]) {
  if (!usernames || usernames.length === 0) return { success: true, data: [] };
  const cleanUsernames = usernames.map(u => (u || '').toLowerCase().trim()).filter(Boolean);
  if (cleanUsernames.length === 0) return { success: true, data: [] };
  try {
    const data = await db.execute(sql`
      SELECT
        c.id, c.username,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', cs.id,
            'ratecard', cs.ratecard,
            'followers', cs.followers,
            'gmv_30d', cs.gmv_30d,
            'gmv_30d_video', cs.gmv_30d_video,
            'gmv_30d_live', cs.gmv_30d_live,
            'level', cs.level,
            'tanggal_update', cs.tanggal_update
          ) ORDER BY cs.id DESC)
           FROM creator_snapshots cs WHERE cs.creator_id = c.id), '[]'::json
        ) as creator_snapshots,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', ct.id,
            'nomor', ct.nomor,
            'status', ct.status
          ) ORDER BY ct.id DESC)
           FROM creator_contacts ct WHERE ct.creator_id = c.id), '[]'::json
        ) as creator_contacts
      FROM creators c
      WHERE LOWER(c.username) IN ${sqlInList(cleanUsernames)}
    `) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function fetchCampaignCreatorsForImportAction(campaignId: number, creatorIds: number[]) {
  if (!creatorIds || creatorIds.length === 0) return { success: true, data: [] };
  try {
    const data = await db.execute(sql`
      SELECT cc.creator_id, cc.price, cc.qty_vt, cc.qty_live,
             c.username
      FROM campaign_creators cc
      JOIN creators c ON cc.creator_id = c.id
      WHERE cc.campaign_id = ${campaignId}
        AND cc.creator_id IN ${sqlInList(creatorIds)}
    `) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function fetchCampaignCreatorsFullForImportAction(campaignId: number, approvalFilter?: string) {
  try {
    const conditions: any[] = [sql`cc.campaign_id = ${campaignId}`];
    if (approvalFilter && approvalFilter !== 'all') {
      if (approvalFilter === 'auto_detect') {
        conditions.push(sql`cc.tier = 'Auto-Detect'`);
      } else if (approvalFilter === 'approve' || approvalFilter === 'approved') {
        conditions.push(sql`LOWER(cc.approval) IN ('approve', 'approved')`);
      } else if (approvalFilter === 'not_approve' || approvalFilter === 'not_approved' || approvalFilter === 'rejected') {
        conditions.push(sql`LOWER(cc.approval) IN ('not_approve', 'not_approved', 'rejected')`);
      } else {
        conditions.push(sql`LOWER(cc.approval) = ${approvalFilter.toLowerCase()}`);
      }
    }
    const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;
    const data = await db.execute(sql`
      SELECT
        cc.id, cc.creator_id, cc.price, cc.qty_vt, cc.qty_live, cc.content_type, cc.tier, cc.approval,
        json_build_object(
          'id', c.id,
          'username', c.username,
          'creator_contacts', COALESCE(
            (SELECT json_agg(json_build_object('id', ct.id, 'nomor', ct.nomor, 'status', ct.status) ORDER BY ct.id DESC)
             FROM creator_contacts ct WHERE ct.creator_id = c.id), '[]'::json
          ),
          'creator_snapshots', COALESCE(
            (SELECT json_agg(json_build_object('id', cs.id, 'followers', cs.followers, 'level', cs.level, 'gmv_30d', cs.gmv_30d, 'gmv_30d_video', cs.gmv_30d_video, 'gmv_30d_live', cs.gmv_30d_live, 'ratecard', cs.ratecard, 'tanggal_update', cs.tanggal_update) ORDER BY cs.id DESC)
             FROM creator_snapshots cs WHERE cs.creator_id = c.id), '[]'::json
          )
        ) as creators
      FROM campaign_creators cc
      JOIN creators c ON cc.creator_id = c.id
      ${whereClause}
    `) as any[];
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err.message };
  }
}

export async function saveCreatorImportBatchAction(params: {
  campaignId: number;
  isClientApprovalRequired: boolean;
  picName?: string;
  picId?: string;
  rows: Array<{
    username: string;
    creatorId?: number;
    status: string;
    action?: string;
    followers?: number;
    gmv_30d?: number;
    gmv_30_days?: number;
    gmv_30d_video?: number;
    gmv_30_days_video?: number;
    gmv_30d_live?: number;
    gmv_30_days_live?: number;
    ratecard?: number;
    rate_card?: number;
    tier: string;
    level: number | null;
    no_wa: string;
    qty_vt: number;
    qty_live: number;
    content_type: string;
    lastSnap?: any;
  }>;
}) {
  const { campaignId, isClientApprovalRequired, picName, picId, rows } = params;
  let successCount = 0;
  const errors: any[] = [];

  for (const row of rows) {
    try {
      let cid = row.creatorId;
      const cleanUsername = (row.username || '').toLowerCase().trim();
      // Jangan `continue` diam-diam: baris yang dilewati harus dilaporkan,
      // kalau tidak jumlah "berhasil" jadi tidak jujur dengan yang tersimpan.
      if (!cleanUsername) {
        errors.push({ username: row.username, error: 'Username kosong' });
        continue;
      }
      
      if (!cid) {
        // Try to find by username (case-insensitive)
        const existing = await db.execute(sql`SELECT id FROM creators WHERE LOWER(username) = ${cleanUsername} LIMIT 1`) as any[];
        if (existing.length > 0) {
          cid = existing[0].id;
        } else {
          // Insert new creator (Note: creators table has no 'status' column)
          const inserted = await db.execute(sql`
            INSERT INTO creators (username, link_account, added_by)
            VALUES (${row.username.trim()}, ${'https://www.tiktok.com/@' + row.username.trim()}, ${picId || null})
            ON CONFLICT (lower(username)) DO UPDATE SET link_account = EXCLUDED.link_account
            RETURNING id
          `) as any[];
          cid = inserted[0]?.id;
        }
      }
      
      if (!cid) {
        errors.push({ username: row.username, error: 'Kreator gagal dibuat/ditemukan di database' });
        continue;
      }
      
      if (row.status === 'duplicate_campaign' && row.action === 'skip') {
        successCount++;
        continue;
      }
      
      // Resolve values supporting multiple property conventions
      const rowFollowers = Number(row.followers) || 0;
      const rowGmv = Number(row.gmv_30_days ?? row.gmv_30d) || 0;
      const rowGmvVid = Number(row.gmv_30_days_video ?? row.gmv_30d_video) || 0;
      const rowGmvLive = Number(row.gmv_30_days_live ?? row.gmv_30d_live) || 0;
      const rowRatecard = Number(row.rate_card ?? row.ratecard) || 0;

      // Check existing snapshot
      const snapRows = await db.execute(sql`SELECT id, followers, gmv_30d, gmv_30d_video, gmv_30d_live, ratecard, level FROM creator_snapshots WHERE creator_id = ${cid} ORDER BY id DESC LIMIT 1`) as any[];
      const lastSnap = snapRows[0];
      const newFollowers = rowFollowers || (lastSnap?.followers || 0);
      const newGmv = rowGmv || (lastSnap?.gmv_30d || 0);
      const newGmvVid = rowGmvVid || (lastSnap?.gmv_30d_video || 0);
      const newGmvLive = rowGmvLive || (lastSnap?.gmv_30d_live || 0);
      const newRateCard = rowRatecard || (lastSnap?.ratecard || 0);
      const newLevel = row.level !== undefined && row.level !== null ? Number(row.level) : (lastSnap?.level ?? null);
      
      // Insert snapshot if changed or no existing snapshot
      if (!lastSnap || lastSnap.followers !== newFollowers || lastSnap.gmv_30d !== newGmv ||
          lastSnap.ratecard !== newRateCard || lastSnap.level !== newLevel) {
        await db.execute(sql`
          INSERT INTO creator_snapshots (creator_id, followers, gmv_30d, gmv_30d_video, gmv_30d_live, ratecard, tier, level, tanggal_update, updated_by)
          VALUES (${cid}, ${newFollowers}, ${newGmv}, ${newGmvVid}, ${newGmvLive}, ${newRateCard}, ${row.tier || 'Nano'}, ${newLevel}, CURRENT_DATE, ${picName || 'System'})
        `);
      }
      
      // Update phone contact
      if (row.no_wa && row.no_wa.trim()) {
        const noWa = row.no_wa.trim();
        const activeContacts = await db.execute(sql`SELECT id, nomor FROM creator_contacts WHERE creator_id = ${cid} AND status = 'aktif'`) as any[];
        const activeContact = activeContacts[0];
        if (!activeContact || activeContact.nomor !== noWa) {
          const today = new Date().toISOString().split('T')[0];
          if (activeContact) {
            await db.execute(sql`UPDATE creator_contacts SET status = 'arsip', tanggal_diganti = ${today} WHERE id = ${activeContact.id}`);
          }
          const archived = await db.execute(sql`SELECT id FROM creator_contacts WHERE creator_id = ${cid} AND nomor = ${noWa} LIMIT 1`) as any[];
          if (archived.length > 0) {
            await db.execute(sql`UPDATE creator_contacts SET status = 'aktif', tanggal_mulai = ${today}, tanggal_diganti = NULL WHERE id = ${archived[0].id}`);
          } else {
            await db.execute(sql`INSERT INTO creator_contacts (creator_id, nomor, status, tanggal_mulai) VALUES (${cid}, ${noWa}, 'aktif', ${today})`);
          }
        }
      }
      
      // Upsert campaign_creator
      const updateData = {
        tier: row.tier || 'Nano',
        price: newRateCard,
        qty_vt: Number(row.qty_vt) || 0,
        qty_live: Number(row.qty_live) || 0,
        content_type: row.content_type || 'Video',
        pic_assist: picName || '-'
      };
      
      if (row.status === 'duplicate_campaign' && row.action === 'update') {
        await db.execute(sql`
          UPDATE campaign_creators SET
            tier = ${updateData.tier}, price = ${updateData.price}, qty_vt = ${updateData.qty_vt},\
            qty_live = ${updateData.qty_live}, content_type = ${updateData.content_type},\
            pic_assist = ${updateData.pic_assist}
          WHERE campaign_id = ${campaignId} AND creator_id = ${cid}
        `);
      } else {
        // Check if exists
        const existingCC = await db.execute(sql`SELECT id FROM campaign_creators WHERE campaign_id = ${campaignId} AND creator_id = ${cid} LIMIT 1`) as any[];
        if (existingCC.length > 0) {
          await db.execute(sql`
            UPDATE campaign_creators SET
              tier = ${updateData.tier}, price = ${updateData.price}, qty_vt = ${updateData.qty_vt},\
              qty_live = ${updateData.qty_live}, content_type = ${updateData.content_type},\
              pic_assist = ${updateData.pic_assist}
            WHERE campaign_id = ${campaignId} AND creator_id = ${cid}
          `);
        } else {
          await db.execute(sql`
            INSERT INTO campaign_creators (
              campaign_id, creator_id, tier, price, qty_vt, qty_live, content_type,
              approval, pic_assist, status_bayar, client_approval, added_by
            ) VALUES (
              ${campaignId}, ${cid}, ${updateData.tier}, ${updateData.price}, ${updateData.qty_vt}, ${updateData.qty_live}, ${updateData.content_type},
              'pending', ${updateData.pic_assist}, 'belum', ${isClientApprovalRequired ? 'pending' : 'not_required'}, ${picId || null}
            )
          `);
        }
      }
      
      successCount++;
    } catch (err: any) {
      errors.push({ username: row.username, error: err.message });
    }
  }
  
  return { success: true, successCount, errors };
}

export async function batchUpdateCampaignCreatorsApprovalAction(creatorIds: number[], status: string, profileId?: string) {
  try {
    if (!creatorIds || creatorIds.length === 0) return { success: true };
    const now = new Date().toISOString();
    const pid = profileId ? sql`${profileId}::uuid` : sql`NULL`;
    if (status === 'approved') {
      await db.execute(sql`
        UPDATE campaign_creators 
        SET approval = ${status}, approved_by = ${pid}, approved_at = ${now}
        WHERE id IN ${sqlInList(creatorIds)}
      `);
    } else if (status === 'not_approved' || status === 'alternate') {
      await db.execute(sql`
        UPDATE campaign_creators 
        SET approval = ${status}, not_approved_by = ${pid}, not_approved_at = ${now}
        WHERE id IN ${sqlInList(creatorIds)}
      `);
    } else {
      await db.execute(sql`
        UPDATE campaign_creators 
        SET approval = ${status}
        WHERE id IN ${sqlInList(creatorIds)}
      `);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function batchDeleteCampaignCreatorsAction(creatorIds: number[]) {
  try {
    if (!creatorIds || creatorIds.length === 0) return { success: true };
    await db.execute(sql`DELETE FROM campaign_creators WHERE id IN ${sqlInList(creatorIds)}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteSingleDuplicateCampaignCreatorAction(deleteId: number, keepId?: number) {
  try {
    if (keepId) {
      await db.execute(sql`UPDATE videos SET campaign_creator_id = ${keepId} WHERE campaign_creator_id = ${deleteId}`);
    }
    await db.execute(sql`DELETE FROM campaign_creators WHERE id = ${deleteId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
