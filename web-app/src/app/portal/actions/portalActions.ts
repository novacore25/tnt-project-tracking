'use server';

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { normalizeKurs } from '@/utils/computed';

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

  // Parallel fetch campaign dataset using 100% verified schema
  const [
    skusRes,
    ccDataRes,
    videosRes,
    salesRes,
    organicVideosRes,
    adsRes,
    samplesRes,
    schedulesRes,
    liveSessionsRes
  ] = await Promise.all([
    // 1. SKUs
    db.execute(sql`
      SELECT id, product_id, nama_produk 
      FROM skus 
      WHERE campaign_id = ${campaignId}
    `).catch(err => {
      console.error('Error fetching skus:', err);
      return [];
    }) as Promise<any[]>,

    // 2. Campaign Creators with Snapshots & Contacts
    //    Filter approval WAJIB sama dengan `performaActions.ts:18`.
    //    Tanpa filter ini portal menampilkan 6.160 baris `not_approved`
    //    yang PIC tidak lihat di halaman internal (audit 2 Okt 2026).
    //    Keputusan user: `not_approved` disembunyikan dari portal.
    db.execute(sql`
      SELECT 
        cc.id, cc.creator_id, cc.campaign_id, cc.approval, cc.client_approval, 
        cc.notes_pic, cc.notes_client, cc.tier, cc.content_type, cc.sample_progress,
        cc.assigned_sku_ids, cc.qty_vt, cc.qty_live,
        c.username, c.nama_asli, c.link_account,
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
      WHERE cc.campaign_id = ${campaignId}
        AND LOWER(COALESCE(cc.approval, '')) IN ('approved', 'pending', 'alternate')
      ORDER BY cc.id DESC
    `).catch(err => {
      console.error('Error fetching campaign_creators:', err);
      return [];
    }) as Promise<any[]>,

    // 3. Manual Videos
    db.execute(sql`
      SELECT 
        v.id, v.campaign_creator_id, v.content_uid, v.vt_approval, v.urutan, 
        v.link_video, v.concept, v.sku_id, v.created_at,
        c.username as creator_username
      FROM videos v
      JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
      LEFT JOIN creators c ON cc.creator_id = c.id
      WHERE cc.campaign_id = ${campaignId}
      ORDER BY v.id ASC
    `).catch(err => {
      console.error('Error fetching manual videos:', err);
      return [];
    }) as Promise<any[]>,

    // 4. Sales Records
    db.execute(sql`
      SELECT tanggal, gmv, quantity, creator_username, content_uid, content_type, product_id, sku_id
      FROM sales
      WHERE campaign_id = ${campaignId}
    `).catch(err => {
      console.error('Error fetching sales:', err);
      return [];
    }) as Promise<any[]>,

    // 5. Organic Videos
    db.execute(sql`
      SELECT id, content_uid, post_time, content_type, creator_username, video_views, video_likes, product_id, raw_data, duration_str
      FROM organic_videos
      WHERE campaign_id = ${campaignId}
    `).catch(err => {
      console.error('Error fetching organic_videos:', err);
      return [];
    }) as Promise<any[]>,

    // 6. Ads Performance
    db.execute(sql`
      SELECT ap.*, c.username
      FROM ads_performance ap
      LEFT JOIN creators c ON ap.creator_id = c.id
      WHERE ap.campaign_id = ${campaignId}
    `).catch(err => {
      console.error('Error fetching ads_performance:', err);
      return [];
    }) as Promise<any[]>,

    // 7. Creator Addresses (Sampel) - direct join on campaign_id
    db.execute(sql`
      SELECT ca.*, c.username as creator_username, cc.approval, cc.client_approval
      FROM creator_addresses ca
      JOIN campaign_creators cc ON ca.campaign_creator_id = cc.id
      LEFT JOIN creators c ON cc.creator_id = c.id
      WHERE cc.campaign_id = ${campaignId}
      ORDER BY ca.id DESC
    `).catch(err => {
      console.error('Error fetching creator_addresses:', err);
      return [];
    }) as Promise<any[]>,

    // 8. Live Schedules - direct join on campaign_id
    db.execute(sql`
      SELECT ls.*, c.username as creator_username
      FROM live_schedules ls
      JOIN campaign_creators cc ON ls.campaign_creator_id = cc.id
      LEFT JOIN creators c ON cc.creator_id = c.id
      WHERE cc.campaign_id = ${campaignId}
      ORDER BY ls.tanggal_live ASC
    `).catch(err => {
      console.error('Error fetching live_schedules:', err);
      return [];
    }) as Promise<any[]>,

    // 9. Actual Live Sessions
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
    `).catch(err => {
      console.error('Error fetching live_sessions:', err);
      return [];
    }) as Promise<any[]>
  ]);

  const skusData = (skusRes as any[]) || [];
  const rawCc = (ccDataRes as any[]) || [];
  const manualVideos = (videosRes as any[]) || [];
  const salesData = (salesRes as any[]) || [];
  const organicVideos = (organicVideosRes as any[]) || [];
  const rawAdsData = (adsRes as any[]) || [];
  const samplesData = (samplesRes as any[]) || [];
  const schedulesData = (schedulesRes as any[]) || [];
  const liveSessions = (liveSessionsRes as any[]) || [];

  const skuList = skusData.map((s: any) => String(s.product_id || '').trim()).filter(Boolean);
  const skuSet = new Set<string>(skuList);
  const hasSkus = skuList.length > 0;

  // 1. Approved Creators (matching internal logic: approved or alternate)
  const approvedUsernames = new Set<string>();
  const allUsernames = new Set<string>();
  
  rawCc.forEach((cc: any) => {
    const u = (cc.username || '').toLowerCase().trim();
    if (u) {
      allUsernames.add(u);
      if (cc.approval === 'approved' || cc.approval === 'alternate') {
        approvedUsernames.add(u);
      }
    }
  });

  // Fast In-Memory Map of Creator Performance
  const creatorPerfMap = new Map<string, {
    gmv_organic: number;
    items_sold: number;
    video_views: number;
    video_likes: number;
    video_uids: Set<string>;
    live_uids: Set<string>;
  }>();

  const getOrCreatePerf = (usernameLower: string) => {
    if (!creatorPerfMap.has(usernameLower)) {
      creatorPerfMap.set(usernameLower, {
        gmv_organic: 0,
        items_sold: 0,
        video_views: 0,
        video_likes: 0,
        video_uids: new Set<string>(),
        live_uids: new Set<string>()
      });
    }
    return creatorPerfMap.get(usernameLower)!;
  };

  // 2. Sales Aggregation (matching internal PerformaClient logic)
  let calcOrganicGmv = 0;
  let calcUnattributedGmv = 0;
  let totalItemsSold = 0;
  const skuSalesMap = new Map<string, { product_id: string; nama_produk: string; gmv: number; items_sold: number }>();
  const salesByUid = new Map<string, { gmv: number; quantity: number }>();
  const monthlyMap: Record<string, { gmvOrganic: number; gmvAds: number; videos: Set<string>; videoCreators: Set<string>; liveSessions: Set<string> }> = {};

  if (hasSkus) {
    salesData.forEach((s: any) => {
      const pidStr = String(s.product_id || '').trim();
      if (!skuSet.has(pidStr)) return;

      const u = (s.creator_username || '').toLowerCase().trim();
      const gmv = Number(s.gmv || 0);
      const qty = Number(s.quantity || 0);
      const cType = (s.content_type || '').toLowerCase();
      const uid = s.content_uid ? String(s.content_uid).trim() : '';

      if (uid) {
        const existingUid = salesByUid.get(uid) || { gmv: 0, quantity: 0 };
        salesByUid.set(uid, {
          gmv: existingUid.gmv + gmv,
          quantity: existingUid.quantity + qty
        });
      }

      // SKU aggregation
      if (pidStr) {
        const skuObj = skusData.find((sk: any) => String(sk.product_id || '').trim() === pidStr);
        const skuName = skuObj ? skuObj.nama_produk : (s.nama_produk || pidStr);
        const prevSku = skuSalesMap.get(pidStr) || { product_id: pidStr, nama_produk: skuName, gmv: 0, items_sold: 0 };
        skuSalesMap.set(pidStr, {
          ...prevSku,
          gmv: prevSku.gmv + gmv,
          items_sold: prevSku.items_sold + qty
        });
      }

      if (approvedUsernames.has(u)) {
        calcOrganicGmv += gmv;
        totalItemsSold += qty;
        const perf = getOrCreatePerf(u);
        perf.gmv_organic += gmv;
        perf.items_sold += qty;
        if (uid) {
          if (cType === 'livestream' || cType === 'live') {
            perf.live_uids.add(uid);
          } else {
            perf.video_uids.add(uid);
          }
        }
      } else {
        calcUnattributedGmv += gmv;
      }

      // Monthly bucket
      if (s.tanggal) {
        const monthStr = String(s.tanggal).substring(0, 7);
        if (!monthlyMap[monthStr]) monthlyMap[monthStr] = { gmvOrganic: 0, gmvAds: 0, videos: new Set(), videoCreators: new Set(), liveSessions: new Set() };
        if (approvedUsernames.has(u)) {
          monthlyMap[monthStr].gmvOrganic += gmv;
        }
      }
    });
  }

  // 3. Organic Videos Aggregation (matching internal PerformaClient orgUidMap logic)
  const orgUidMap = new Map<string, { views: number; likes: number; creator: string; contentType: string; postTime: string }>();

  if (hasSkus) {
    organicVideos.forEach((v: any) => {
      const pidStr = String(v.product_id || '').trim();
      if (!skuSet.has(pidStr)) return;

      const uid = v.content_uid ? String(v.content_uid).trim() : '';
      if (!uid) return;

      const views = Number(v.video_views || 0);
      const likes = Number(v.video_likes || 0);
      const cType = (v.content_type || 'video').toLowerCase();

      if (!orgUidMap.has(uid)) {
        orgUidMap.set(uid, {
          creator: (v.creator_username || '').toLowerCase().trim(),
          views,
          likes,
          contentType: cType,
          postTime: v.post_time
        });
      } else {
        const cur = orgUidMap.get(uid)!;
        cur.views = Math.max(cur.views, views);
        cur.likes = Math.max(cur.likes, likes);
      }
    });
  }

  let calcTotalViews = 0;
  let calcTotalLikes = 0;
  let calcUniqueVideos = 0;
  let calcUniqueLivestreams = 0;
  // Uid video organik (bukan live). Dasar untuk hitungan video approved
  // setelah video manual ikut ditambahkan di blok 3b.
  const calcApprovedOrgVideoUids = new Set<string>();

  for (const [uid, v] of orgUidMap.entries()) {
    if (v.contentType !== 'livestream' && v.contentType !== 'live') {
      calcUniqueVideos++;
      calcApprovedOrgVideoUids.add(uid);
    } else {
      calcUniqueLivestreams++;
    }
    calcTotalViews += v.views;
    calcTotalLikes += v.likes;

    if (v.creator) {
      const perf = getOrCreatePerf(v.creator);
      perf.video_views += v.views;
      perf.video_likes += v.likes;
      if (v.contentType === 'livestream' || v.contentType === 'live') {
        perf.live_uids.add(uid);
      } else {
        perf.video_uids.add(uid);
      }
    }

    if (v.postTime) {
      const mStr = String(v.postTime).substring(0, 7);
      if (monthlyMap[mStr]) {
        if (v.contentType !== 'livestream' && v.contentType !== 'live') {
          monthlyMap[mStr].videos.add(uid);
          if (v.creator) monthlyMap[mStr].videoCreators.add(v.creator);
        } else {
          monthlyMap[mStr].liveSessions.add(uid);
        }
      }
    }
  }

  // 3b. Video manual dari tabel `videos` (input PIC) -- WAJIB ikut dihitung.
  //
  //     Tanpa blok ini portal hanya menghitung video organik, padahal
  //     `PerformaClient.tsx:202-224` menghitung video organik + video manual
  //     dari kreator approved. Akibatnya portal menampilkan ~48% dari
  //     jumlah video sebenarnya, di SEMUA campaign (audit 2 Okt 2026:
  //     26.439 portal vs 54.736 internal).
  //
  //     Meniru logika internal persis:
  //       - skip kalau `sku_id` tidak termasuk SKU campaign
  //       - id dari `content_uid`, atau digit dari `link_video`
  //       - hanya kreator approved/alternate yang menambah ke total approved
  //       - `not_approved` menambah ke pending, TAPI hanya kalau id-nya
  //         belum masuk approved (supaya tidak dobel hitung)
  const campaignSkuIds = new Set<number>(skusData.map((sk: any) => Number(sk.id)));
  const allApprovedVideoIds = new Set<string>(calcApprovedOrgVideoUids);
  const allPendingVideoIds = new Set<string>();
  // Username kreator pending yang punya minimal satu video pending.
  const pendingCreatorsWithVideoUids = new Set<string>();
  // Uid dari tabel `videos` yang ternyata LIVESTREAM. Dihitung sebagai live,
  // bukan video (keputusan owner 2 Okt 2026).
  const manualLiveUids = new Set<string>();
  // Peta content_uid -> 'live' dari organic_videos. Sumber kebenaran tipe.
  const vStatsByUid = new Map<string, 'live' | 'video'>();
  for (const ov of organicVideos) {
    if (!ov.content_uid) continue;
    const ct = String(ov.content_type || 'video').toLowerCase();
    const isLive = ct === 'livestream' || ct === 'live';
    const uid = String(ov.content_uid).trim();
    if (isLive) vStatsByUid.set(uid, 'live');
    else if (!vStatsByUid.has(uid)) vStatsByUid.set(uid, 'video');
  }

  // Group manual videos by campaign_creator_id (dipakai blok 3b di atas)
  const videoMapByCc = new Map<number, any[]>();
  manualVideos.forEach((v: any) => {
    if (!videoMapByCc.has(v.campaign_creator_id)) {
      videoMapByCc.set(v.campaign_creator_id, []);
    }
    videoMapByCc.get(v.campaign_creator_id)!.push(v);
  });

  for (const cc of rawCc) {
    const u = (cc.username || '').toLowerCase().trim();
    const perf = u ? getOrCreatePerf(u) : null;
    const isApproved = cc.approval === 'approved' || cc.approval === 'alternate';
    const vids = videoMapByCc.get(cc.id) || [];

    for (const v of vids) {
      if (campaignSkuIds.size > 0 && v.sku_id && !campaignSkuIds.has(Number(v.sku_id))) continue;
      const id = v.content_uid
        ? String(v.content_uid).trim()
        : (v.link_video ? (v.link_video.match(/video\/(\d+)/)?.[1] || v.link_video) : null);
      if (!id) continue;

      // Pisahkan live dari video (keputusan owner 2 Okt 2026):
      // "kalo video yaa harusnya menghitung video aja, kalo live ya menghitung
      //  live aja... live juga bagian dari campaign juga ada menu live stream"
      //
      // Tabel `videos` tidak punya kolom content_type. Sumber kebenaran-nya
      // `organic_videos.content_type`, dan 654 baris di tabel `videos` ternyata
      // livestream (docs/sql/58). Link video tidak bisa jadi patokan: 0 link
      // mengandung '/live/', livestream pun ditulis '/video/<room_id>'.
      const liveStat = vStatsByUid.get(id);
      if (liveStat === 'live') {
        manualLiveUids.add(id);
        continue;                      // BUKAN video
      }

      if (isApproved) {
        allApprovedVideoIds.add(id);
      } else if (!allApprovedVideoIds.has(id)) {
        allPendingVideoIds.add(id);
        if (u) pendingCreatorsWithVideoUids.add(u);
      }
      if (perf) perf.video_uids.add(id);
    }
  }

  // 4. Ads Aggregation (deduplicated by latest ad_id, matching internal PerformaClient)
  const latestAdsMap = new Map<string, any>();
  if (rawAdsData) {
    for (const row of rawAdsData) {
      const existing = latestAdsMap.get(row.ad_id);
      if (!existing || new Date(row.tanggal) > new Date(existing.tanggal)) {
        latestAdsMap.set(row.ad_id, row);
      }
    }
  }

  const adsStatsByCreator: Record<number, { gmvAds: number; costAds: number; itemsSoldAds: number }> = {};
  let globalAdsGmv = 0;
  let globalAdsSpend = 0;

  for (const ad of latestAdsMap.values()) {
    const kurs = normalizeKurs(ad.kurs);

    const grossRevenueUsd = Number(ad.gross_revenue_usd) || 0;
    const costUsd = Number(ad.cost_usd) || 0;
    const purchases = Number(ad.purchases) || 0;
    const adGmvIdr = grossRevenueUsd * kurs;

    globalAdsGmv += adGmvIdr;
    globalAdsSpend += costUsd;

    if (ad.creator_id) {
      if (!adsStatsByCreator[ad.creator_id]) {
        adsStatsByCreator[ad.creator_id] = { gmvAds: 0, costAds: 0, itemsSoldAds: 0 };
      }
      adsStatsByCreator[ad.creator_id].gmvAds += adGmvIdr;
      adsStatsByCreator[ad.creator_id].costAds += costUsd * kurs;
      adsStatsByCreator[ad.creator_id].itemsSoldAds += purchases;
    }

    if (ad.tanggal) {
      const monthStr = String(ad.tanggal).substring(0, 7);
      if (!monthlyMap[monthStr]) monthlyMap[monthStr] = { gmvOrganic: 0, gmvAds: 0, videos: new Set(), videoCreators: new Set(), liveSessions: new Set() };
      monthlyMap[monthStr].gmvAds += adGmvIdr;
    }
  }

  // Group manual videos by campaign_creator_id
  // (sudah didefinisikan di blok 3b, jangan diduplikasi)

  // 5. Build Enriched CC Data
  const enrichedCcData = rawCc.map((cc: any) => {
    const u = (cc.username || '').toLowerCase().trim();
    const perf = getOrCreatePerf(u);
    const vids = videoMapByCc.get(cc.id) || [];
    const adsInfo = adsStatsByCreator[cc.creator_id] || { gmvAds: 0, costAds: 0, itemsSoldAds: 0 };

    const totalVt = perf.video_uids.size > 0 ? perf.video_uids.size : vids.length;
    const totalLive = perf.live_uids.size;

    return {
      ...cc,
      creators: {
        id: cc.creator_id,
        username: cc.username,
        nama_asli: cc.nama_asli,
        link_account: cc.link_account,
      },
      videos: vids,
      followers: Number(cc.followers || 0),
      level: cc.level || '-',
      tier: cc.snapshot_tier || cc.tier || '-',
      no_whatsapp: cc.no_whatsapp || '',
      gmv_organic: perf.gmv_organic,
      items_sold: perf.items_sold,
      gmv_ads: adsInfo.gmvAds,
      video_views: perf.video_views,
      video_likes: perf.video_likes,
      total_vt: totalVt,
      total_livestreams: totalLive
    };
  });

  // 6. Build Video Tab Dataset
  const creatorVideoGroupsMap = new Map<string, any>();

  orgUidMap.forEach((meta, uid) => {
    if (meta.contentType === 'livestream' || meta.contentType === 'live') return;
    const u = meta.creator;
    if (!creatorVideoGroupsMap.has(u)) {
      creatorVideoGroupsMap.set(u, {
        creator_username: u,
        total_videos: 0,
        total_gmv: 0,
        total_views: 0,
        total_likes: 0,
        videos: []
      });
    }

    const group = creatorVideoGroupsMap.get(u)!;
    const salesInfo = salesByUid.get(uid) || { gmv: 0, quantity: 0 };
    const vObj = {
      id: uid,
      content_uid: uid,
      creator_username: u,
      link_video: `https://www.tiktok.com/@${u}/video/${uid}`,
      views: meta.views,
      likes: meta.likes,
      gmv: salesInfo.gmv,
      post_time: meta.postTime,
      isAuto: true
    };

    group.videos.push(vObj);
    group.total_videos += 1;
    group.total_views += meta.views;
    group.total_likes += meta.likes;
    group.total_gmv += salesInfo.gmv;
  });

  manualVideos.forEach((v: any) => {
    const u = (v.creator_username || '').toLowerCase().trim();
    if (!u) return;

    if (!creatorVideoGroupsMap.has(u)) {
      creatorVideoGroupsMap.set(u, {
        creator_username: u,
        total_videos: 0,
        total_gmv: 0,
        total_views: 0,
        total_likes: 0,
        videos: []
      });
    }

    const group = creatorVideoGroupsMap.get(u)!;
    const uid = v.content_uid ? String(v.content_uid).trim() : '';
    const orgData = uid ? orgUidMap.get(uid) : null;
    const salesInfo = uid ? (salesByUid.get(uid) || { gmv: 0, quantity: 0 }) : { gmv: 0, quantity: 0 };

    const alreadyExists = group.videos.some((ex: any) => ex.content_uid && ex.content_uid === uid);
    if (!alreadyExists) {
      const vObj = {
        id: v.id,
        content_uid: uid || v.id,
        creator_username: u,
        link_video: v.link_video,
        views: orgData ? orgData.views : 0,
        likes: orgData ? orgData.likes : 0,
        gmv: salesInfo.gmv,
        post_time: v.created_at,
        isAuto: false
      };
      group.videos.push(vObj);
      group.total_videos += 1;
      group.total_views += vObj.views;
      group.total_likes += vObj.likes;
      group.total_gmv += vObj.gmv;
    }
  });

  const portalVideos = Array.from(creatorVideoGroupsMap.values());

  // 7. Actual Lives Aggregation
  const liveStatsMap = new Map<string, any>();
  
  organicVideos.forEach((ov: any) => {
    const cType = (ov.content_type || '').toLowerCase();
    if (cType === 'livestream' || cType === 'live') {
      const uid = ov.content_uid ? String(ov.content_uid).trim() : '';
      if (!uid) return;
      const salesInfo = salesByUid.get(uid) || { gmv: 0, quantity: 0 };
      liveStatsMap.set(uid, {
        id: ov.id,
        content_uid: uid,
        creator_username: ov.creator_username,
        livestream_name: ov.raw_data?.['Livestream name'] || null,
        start_time: ov.post_time,
        duration_str: ov.duration_str || null,
        video_views: Number(ov.video_views) || 0,
        video_likes: Number(ov.video_likes) || 0,
        gmv: salesInfo.gmv,
        orders: salesInfo.quantity
      });
    }
  });

  liveSessions.forEach((ls: any) => {
    const uid = ls.content_uid ? String(ls.content_uid).trim() : '';
    if (!uid) return;
    const existing = liveStatsMap.get(uid);
    const salesInfo = salesByUid.get(uid);
    const calculatedGmv = Math.max(Number(ls.gmv) || 0, salesInfo?.gmv || 0);
    const calculatedOrders = Math.max(Number(ls.orders) || 0, salesInfo?.quantity || 0);

    if (existing) {
      existing.livestream_name = existing.livestream_name || ls.livestream_name;
      existing.video_views = Math.max(existing.video_views, Number(ls.video_views) || 0);
      existing.video_likes = Math.max(existing.video_likes, Number(ls.video_likes) || 0);
      existing.duration_str = existing.duration_str || ls.duration_str;
      existing.gmv = Math.max(existing.gmv, calculatedGmv);
      existing.orders = Math.max(existing.orders, calculatedOrders);
    } else {
      liveStatsMap.set(uid, {
        id: ls.id,
        content_uid: uid,
        creator_username: ls.creator_username,
        livestream_name: ls.livestream_name || null,
        start_time: ls.start_time,
        duration_str: ls.duration_str || null,
        video_views: Number(ls.video_views) || 0,
        video_likes: Number(ls.video_likes) || 0,
        gmv: calculatedGmv,
        orders: calculatedOrders
      });
    }
  });

  const actualLives = Array.from(liveStatsMap.values());

  // 8. Monthly Stats
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

  const salesPerProduct = Array.from(skuSalesMap.values()).sort((a, b) => b.gmv - a.gmv);

  // Status counts (matching internal: approved = approved + alternate, pending = pending)
  const approvedCreatorsCount = rawCc.filter((cc: any) => cc.approval === 'approved' || cc.approval === 'alternate').length;
  const pendingCreatorsCount = rawCc.filter((cc: any) => cc.approval === 'pending').length;

  return {
    authenticated: true,
    campaign,
    summary: {
      organic_gmv: calcOrganicGmv,
      total_views: calcTotalViews,
      total_likes: calcTotalLikes,
      total_videos: calcUniqueVideos
    },
    totalSales: {
      creatorsWithVideo: enrichedCcData.filter((c: any) => (c.approval === 'approved' || c.approval === 'alternate') && c.total_vt > 0).length,
      creatorsWithLive: enrichedCcData.filter((c: any) => (c.approval === 'approved' || c.approval === 'alternate') && c.total_livestreams > 0).length
    },
    totalAwareness: {
      total_views: calcTotalViews,
      total_likes: calcTotalLikes
    },
    dailyPerf: [],
    ccData: enrichedCcData,
    samples: samplesData,
    schedules: schedulesData,
    videos: portalVideos,
    skus: skusData,
    liveHistory: [],
    rpc: {
      organic_gmv: calcOrganicGmv,
      unattributed_gmv: calcUnattributedGmv,
      total_views: calcTotalViews,
      total_likes: calcTotalLikes,
      total_videos: calcUniqueVideos,
      total_approved_creators: approvedCreatorsCount,
      total_pending_creators: pendingCreatorsCount
    },
    fastCountsData: {
      approved: approvedCreatorsCount,
      pending: pendingCreatorsCount,
      // Kreator pending yang punya minimal satu video pending. Bukan
      // hardcoded 0 seperti sebelumnya. `pendingCreatorsWithVideoUids`
      // diisi di blok 3b.
      pending_with_videos: pendingCreatorsWithVideoUids.size
    },
    fastVideoCountsData: {
      // SAMPAI dengan internal: organik + video manual dari kreator approved.
      // Sebelumnya `calcUniqueVideos` (organik saja) sehingga portal hanya
      // menampilkan ~48% dari jumlah video sebenarnya.
      total_approved: allApprovedVideoIds.size,
      total_pending: allPendingVideoIds.size,
      total_livestream: calcUniqueLivestreams + manualLiveUids.size
    },
    initialTotalAdsGmv: globalAdsGmv,
    topSkus: salesPerProduct.slice(0, 5),
    actualLives,
    salesPerProduct,
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
