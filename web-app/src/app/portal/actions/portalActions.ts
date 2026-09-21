'use server';

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function loginPortal(campaignId: number, pin: string) {
  const [campaign] = await db.execute(sql`
    SELECT id, pin FROM campaigns WHERE id = ${campaignId} LIMIT 1
  `) as any[];

  if (!campaign) {
    return { success: false, message: 'Campaign tidak ditemukan.' };
  }

  if (!campaign.pin) {
    return { success: false, message: 'Campaign ini belum dikonfigurasi dengan PIN akses Klien.' };
  }

  if (campaign.pin !== pin) {
    return { success: false, message: 'PIN salah.' };
  }

  // Set cookie
  const cookieStore = await cookies();
  cookieStore.set(`portal_pin_${campaignId}`, pin, {
    httpOnly: true,
    secure: false,
    maxAge: 60 * 60 * 24 * 7,
    path: '/'
  });

  return { success: true };
}

export async function logoutPortal(campaignId: number) {
  const cookieStore = await cookies();
  cookieStore.delete(`portal_pin_${campaignId}`);
  return { success: true };
}

export async function getPortalData(campaignId: number) {
  const cookieStore = await cookies();
  const pin = cookieStore.get(`portal_pin_${campaignId}`)?.value;
  
  if (!pin) return { authenticated: false };

  const [campaign] = await db.execute(sql`
    SELECT * FROM campaigns WHERE id = ${campaignId} LIMIT 1
  `) as any[];

  if (!campaign || campaign.pin !== pin) return { authenticated: false };

  // Parallel fetch campaign stats
  const [
    summaryRes,
    totalSalesRes,
    totalAwarenessRes,
    ccDataRes,
    skusRes,
    rawAdsDataRes,
    dailyStatsRawRes,
    topSkusRes,
    actualLivesRes,
    videoStatsRes
  ] = await Promise.all([
    db.execute(sql`SELECT * FROM public.vw_campaign_summary WHERE campaign_id = ${campaignId} LIMIT 1`).catch(() => []),
    db.execute(sql`SELECT * FROM campaign_total_sales WHERE campaign_id = ${campaignId} LIMIT 1`).catch(() => []),
    db.execute(sql`SELECT * FROM campaign_total_awareness WHERE campaign_id = ${campaignId} LIMIT 1`).catch(() => []),
    db.execute(sql`
      SELECT 
        cc.id, cc.creator_id, cc.campaign_id, cc.approval, cc.client_approval, 
        cc.notes_pic, cc.notes_client, cc.kategori as tier, cc.tipe_konten, cc.sample_progress,
        c.username, c.nama_lengkap as nama_asli, c.link_portofolio as link_account,
        cs.followers, cs.level, cs.tier as snapshot_tier,
        ct.nomor as no_whatsapp
      FROM campaign_creators cc
      LEFT JOIN creators c ON cc.creator_id = c.id
      LEFT JOIN LATERAL (
        SELECT followers, level, tier FROM creator_snapshots WHERE creator_id = cc.creator_id ORDER BY tanggal_update DESC LIMIT 1
      ) cs ON true
      LEFT JOIN LATERAL (
        SELECT nomor FROM creator_contacts WHERE creator_id = cc.creator_id AND status = 'aktif' LIMIT 1
      ) ct ON true
      WHERE cc.campaign_id = ${campaignId} AND cc.approval = 'approved'
      ORDER BY cc.id DESC
    `).catch(() => []),
    db.execute(sql`SELECT id, product_id, nama_produk FROM skus WHERE campaign_id = ${campaignId}`).catch(() => []),
    db.execute(sql`SELECT * FROM ads_performance WHERE campaign_id = ${campaignId}`).catch(() => []),
    db.execute(sql`
      SELECT 
        DATE(tanggal) as date_str,
        COALESCE(SUM(gmv), 0) as total_gmv
      FROM sales
      WHERE campaign_id = ${campaignId}
      GROUP BY DATE(tanggal)
      ORDER BY date_str ASC
    `).catch(() => []),
    db.execute(sql`
      SELECT 
        s.sku_id, sk.nama_produk,
        COALESCE(SUM(s.quantity), 0) as items_sold,
        COALESCE(SUM(s.gmv), 0) as gmv
      FROM sales s
      LEFT JOIN skus sk ON s.sku_id = sk.id
      WHERE s.campaign_id = ${campaignId}
      GROUP BY s.sku_id, sk.nama_produk
      ORDER BY gmv DESC
      LIMIT 5
    `).catch(() => []),
    db.execute(sql`
      SELECT ls.*, cc.creator_id, c.username as creator_username
      FROM live_sessions ls
      JOIN campaign_creators cc ON ls.campaign_creator_id = cc.id
      LEFT JOIN creators c ON cc.creator_id = c.id
      WHERE cc.campaign_id = ${campaignId}
    `).catch(() => []),
    db.execute(sql`
      SELECT 
        c.username, v.link as link_video, v.vt_approval, v.urutan, v.created_at, v.id,
        v.campaign_creator_id
      FROM videos v
      JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
      LEFT JOIN creators c ON cc.creator_id = c.id
      WHERE cc.campaign_id = ${campaignId}
    `).catch(() => [])
  ]);

  const summary = (summaryRes as any[])[0] || {};
  const totalSales = (totalSalesRes as any[])[0] || null;
  const totalAwareness = (totalAwarenessRes as any[])[0] || null;
  let ccData = (ccDataRes as any[]) || [];
  const skusData = (skusRes as any[]) || [];
  const rawAdsData = (rawAdsDataRes as any[]) || [];
  const dailyStatsRaw = (dailyStatsRawRes as any[]) || [];
  const topSkusData = (topSkusRes as any[]) || [];
  const actualLives = (actualLivesRes as any[]) || [];
  const allVideos = (videoStatsRes as any[]) || [];

  // Group videos by campaign_creator_id
  const videoMapByCc = new Map<number, any[]>();
  allVideos.forEach(v => {
    if (!videoMapByCc.has(v.campaign_creator_id)) {
      videoMapByCc.set(v.campaign_creator_id, []);
    }
    videoMapByCc.get(v.campaign_creator_id)!.push(v);
  });

  const enrichedCcData = ccData.map(cc => {
    const vids = videoMapByCc.get(cc.id) || [];
    return {
      ...cc,
      creators: {
        username: cc.username,
        nama_asli: cc.nama_asli,
        link_account: cc.link_account,
      },
      videos: vids,
      followers: cc.followers || 0,
      level: cc.level || '-',
      tier: cc.snapshot_tier || cc.tier,
      no_whatsapp: cc.no_whatsapp || '',
      gmv_organic: 0,
      items_sold: 0,
      gmv_ads: 0,
      video_views: 0,
      video_likes: 0,
      total_vt: vids.length,
      total_livestreams: 0
    };
  });

  // Fetch samples / addresses
  const ccIdsForSamples = campaign.require_client_approval 
    ? enrichedCcData.filter(cc => cc.approval === 'approved' && cc.client_approval === 'approved').map(cc => cc.id)
    : enrichedCcData.filter(cc => cc.approval === 'approved').map(cc => cc.id);

  let samples: any[] = [];
  if (ccIdsForSamples.length > 0) {
    const addrData = await db.execute(sql`
      SELECT ca.*, c.username as creator_username
      FROM creator_addresses ca
      JOIN campaign_creators cc ON ca.campaign_creator_id = cc.id
      LEFT JOIN creators c ON cc.creator_id = c.id
      WHERE ca.campaign_creator_id IN (${sql.join(ccIdsForSamples.map(id => sql`${id}`), sql`, `)})
    `).catch(() => []) as any[];
    samples = addrData || [];
  }

  // Live Schedules
  let schedules: any[] = [];
  if (ccIdsForSamples.length > 0) {
    const liveData = await db.execute(sql`
      SELECT ls.*, c.username as creator_username
      FROM live_schedules ls
      JOIN campaign_creators cc ON ls.campaign_creator_id = cc.id
      LEFT JOIN creators c ON cc.creator_id = c.id
      WHERE ls.campaign_creator_id IN (${sql.join(ccIdsForSamples.map(id => sql`${id}`), sql`, `)})
    `).catch(() => []) as any[];
    schedules = liveData || [];
  }

  // Monthly stats
  const monthlyMap: Record<string, { gmvOrganic: number; gmvAds: number; videos: Set<string>; videoCreators: Set<string>; liveSessions: Set<string> }> = {};
  dailyStatsRaw.forEach((stat: any) => {
    if (!stat.date_str) return;
    const monthStr = String(stat.date_str).substring(0, 7);
    if (!monthlyMap[monthStr]) monthlyMap[monthStr] = { gmvOrganic: 0, gmvAds: 0, videos: new Set(), videoCreators: new Set(), liveSessions: new Set() };
    monthlyMap[monthStr].gmvOrganic += Number(stat.total_gmv || 0);
  });

  const monthlyStats = Object.keys(monthlyMap)
    .sort((a, b) => b.localeCompare(a))
    .map(month => ({
      month,
      gmvOrganic: monthlyMap[month].gmvOrganic,
      gmvAds: monthlyMap[month].gmvAds,
      gmvTotal: monthlyMap[month].gmvOrganic + monthlyMap[month].gmvAds,
      totalVideos: monthlyMap[month].videos.size,
      totalVideoCreators: monthlyMap[month].videoCreators.size,
      totalLiveSessions: monthlyMap[month].liveSessions.size,
    }));

  const portalVideos: any[] = [];
  enrichedCcData.forEach(cc => {
    if (cc.videos && cc.videos.length > 0) {
      portalVideos.push({
        creator_username: cc.username,
        total_videos: cc.videos.length,
        total_gmv: 0,
        total_views: 0,
        total_likes: 0,
        videos: cc.videos.map((v: any) => ({
          ...v,
          content_uid: v.id,
          creator_username: cc.username,
          gmv: 0,
          views: 0,
          likes: 0,
          isAuto: false
        }))
      });
    }
  });

  const totalItemsSold = topSkusData.reduce((sum: number, p: any) => sum + Number(p.items_sold || 0), 0);

  return {
    authenticated: true,
    campaign,
    summary,
    totalSales,
    totalAwareness,
    dailyPerf: [],
    ccData: enrichedCcData,
    samples,
    schedules,
    videos: portalVideos,
    skus: skusData,
    liveHistory: [],
    rpc: {},
    fastCountsData: {
      approved: enrichedCcData.length,
      pending: 0,
      pending_with_videos: 0
    },
    fastVideoCountsData: {
      total_approved: allVideos.length,
      total_pending: 0,
      total_livestream: actualLives.length
    },
    initialTotalAdsGmv: 0,
    topSkus: topSkusData,
    actualLives,
    salesPerProduct: topSkusData,
    totalItemsSold,
    monthlyStats
  };
}

export async function submitClientApproval(campaignId: number, campaignCreatorId: number, status: 'approved' | 'rejected') {
  const cookieStore = await cookies();
  const pin = cookieStore.get(`portal_pin_${campaignId}`)?.value;
  if (!pin) throw new Error('Not authenticated');

  const [campaign] = await db.execute(sql`SELECT pin FROM campaigns WHERE id = ${campaignId} LIMIT 1`) as any[];
  if (!campaign || campaign.pin !== pin) throw new Error('Unauthorized');

  await db.execute(sql`
    UPDATE campaign_creators SET client_approval = ${status}
    WHERE id = ${campaignCreatorId} AND campaign_id = ${campaignId}
  `);

  return { success: true };
}

export async function updateResiByClient(campaignId: number, addressId: number, resi: string, proses: string, produk_dikirim?: string, notes?: string, ekspedisi?: string) {
  const cookieStore = await cookies();
  const pin = cookieStore.get(`portal_pin_${campaignId}`)?.value;
  if (!pin) throw new Error('Not authenticated');

  const [campaign] = await db.execute(sql`SELECT pin FROM campaigns WHERE id = ${campaignId} LIMIT 1`) as any[];
  if (!campaign || campaign.pin !== pin) throw new Error('Unauthorized');

  const [addr] = await db.execute(sql`
    SELECT ca.id, cc.campaign_id
    FROM creator_addresses ca
    JOIN campaign_creators cc ON ca.campaign_creator_id = cc.id
    WHERE ca.id = ${addressId}
    LIMIT 1
  `) as any[];

  if (!addr || addr.campaign_id !== campaignId) {
    throw new Error('Unauthorized address modification');
  }

  const tanggalKirim = proses === 'Dikirim' ? new Date().toISOString() : null;

  await db.execute(sql`
    UPDATE creator_addresses SET
      resi = ${resi},
      proses = ${proses},
      tanggal_kirim = COALESCE(${tanggalKirim}, tanggal_kirim),
      resi_updated_at = NOW(),
      resi_updated_by = 'Brand',
      produk_dikirim = COALESCE(${produk_dikirim ?? null}, produk_dikirim),
      notes = CASE WHEN ${notes !== undefined} THEN ${notes ?? null} ELSE notes END,
      ekspedisi = COALESCE(${ekspedisi ?? null}, ekspedisi)
    WHERE id = ${addressId}
  `);

  return { success: true };
}

export type BatchUpdateData = {
  addressId: number;
  resi?: string;
  proses?: string;
  produk_dikirim?: string;
  notes?: string;
  ekspedisi?: string;
};

export async function batchUpdateResiByClient(campaignId: number, updates: BatchUpdateData[]) {
  if (!updates || updates.length === 0) return { success: true };

  const cookieStore = await cookies();
  const pin = cookieStore.get(`portal_pin_${campaignId}`)?.value;
  if (!pin) throw new Error('Not authenticated');

  const [campaign] = await db.execute(sql`SELECT pin FROM campaigns WHERE id = ${campaignId} LIMIT 1`) as any[];
  if (!campaign || campaign.pin !== pin) throw new Error('Unauthorized');

  for (const update of updates) {
    const tanggalKirim = update.proses === 'Dikirim' ? new Date().toISOString() : null;
    await db.execute(sql`
      UPDATE creator_addresses SET
        resi = COALESCE(${update.resi ?? null}, resi),
        proses = COALESCE(${update.proses ?? null}, proses),
        tanggal_kirim = COALESCE(${tanggalKirim}, tanggal_kirim),
        resi_updated_at = NOW(),
        resi_updated_by = 'Brand',
        produk_dikirim = COALESCE(${update.produk_dikirim ?? null}, produk_dikirim),
        notes = CASE WHEN ${update.notes !== undefined} THEN ${update.notes ?? null} ELSE notes END,
        ekspedisi = COALESCE(${update.ekspedisi ?? null}, ekspedisi)
      WHERE id = ${update.addressId}
    `);
  }

  return { success: true };
}

export async function updateClientNotes(campaignId: number, ccId: number, notes: string) {
  try {
    await db.execute(sql`
      UPDATE campaign_creators SET notes_client = ${notes}
      WHERE id = ${ccId} AND campaign_id = ${campaignId}
    `);
    return { success: true };
  } catch (error: any) {
    console.error("Error updating client notes:", error);
    return { success: false, error: error.message };
  }
}
