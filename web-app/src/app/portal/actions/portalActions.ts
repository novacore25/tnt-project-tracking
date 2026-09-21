'use server'

import { createClient } from "@supabase/supabase-js";
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  global: {
    fetch: (url, options) => {
      return fetch(url, { ...options, cache: 'no-store' });
    }
  }
});

export async function loginPortal(campaignId: number, pin: string) {
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('id, pin')
    .eq('id', campaignId)
    .single();

  if (error || !campaign) {
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
    secure: false, // Set to false to support HTTP/Not Secure connections temporarily
    maxAge: 60 * 60 * 24 * 7, // 1 minggu
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

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (!campaign || campaign.pin !== pin) return { authenticated: false };

  // Fetch vw_campaign_summary (Tanpa financial internal)
  const { data: summary } = await supabase
    .from('vw_campaign_summary')
    .select('target_gmv, target_video, total_daily_organic, total_daily_vsa, total_gmv_achievement, achievement_video')
    .eq('campaign_id', campaignId)
    .single();

  // Fetch modern sales/awareness data from CSV imports
  const { data: totalSales } = await supabase
    .from('campaign_total_sales')
    .select('*')
    .eq('campaign_id', campaignId)
    .maybeSingle();

  const { data: totalAwareness } = await supabase
    .from('campaign_total_awareness')
    .select('*')
    .eq('campaign_id', campaignId)
    .maybeSingle();

  // Fetch daily performance
  const { data: dailyPerf } = await supabase
    .from('daily_performance')
    .select('date, organic_sales, vsa_sales')
    .eq('campaign_id', campaignId)
    .order('date', { ascending: true });

  // Fetch creators for Client Approval (hanya yang sudah disetujui internal TNT)
  let ccData: any[] = [];
  const pageSize = 500;
  
  // Parallel fetch using Promise.all to prevent Vercel Server Action Timeouts
  const { count } = await supabase
    .from('campaign_creators')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('approval', 'approved');

  if (count && count > 0) {
    const promises = [];
    for (let i = 0; i < count; i += pageSize) {
      promises.push(
        supabase
          .from('campaign_creators')
          .select(`
            id, 
            creator_id,
            approval,
            client_approval, 
            notes_pic, 
            notes_client,
            tier,
            content_type,
            sample_progress,
            creators(username, nama_asli, link_account, creator_snapshots(id, tanggal_update, followers, level, tier), creator_contacts(nomor, status)),
            videos(id, link_video, content_uid, vt_approval, urutan, created_at)
          `)
          .eq('campaign_id', campaignId)
          .eq('approval', 'approved')
          .range(i, i + pageSize - 1)
      );
    }
    
    const results = await Promise.all(promises);
    results.forEach(res => {
      if (res.data) ccData = ccData.concat(res.data);
    });
  }
  
  // Apply Global Creator Filter from Database
  let filterType = 'none';
  let filterValues: string[] = [];
  
  if (campaign.creator_filter_type === 'include' || campaign.creator_filter_type === 'exclude') {
    filterType = campaign.creator_filter_type;
    filterValues = (campaign.creator_filter_usernames || '').split(/[\s,]+/).map((u: string) => u.trim().toLowerCase()).filter((u: string) => u);
    if (filterValues.length > 0) {
      ccData = ccData.filter((cc: any) => {
        const creator = Array.isArray(cc.creators) ? cc.creators[0] : cc.creators;
        const username = (creator?.username || '').toLowerCase();
        const match = filterValues.includes(username);
        return filterType === 'include' ? match : !match;
      });
    } else {
      filterType = 'none';
    }
  }

  const rpcParams: any = { p_campaign_id: campaignId };
  if (filterType !== 'none' && filterValues.length > 0) {
    rpcParams.p_filter_type = filterType;
    rpcParams.p_filter_values = filterValues;
  }
  
  // Fetch performa summary dari RPC
  const { data: creatorPerformance } = await supabase.rpc('get_campaign_creator_performance', { p_campaign_id: campaignId });

  // Fetch RPC untuk Global Cards V2 (Mirror Internal Dashboard)
  const { data: rpcPerfArr, error: rpcError } = await supabase.rpc('get_performance_summary_v2', rpcParams);
  const rpcPerf = rpcPerfArr?.[0] || {};
  if (rpcError) console.error("RPC Error:", rpcError);

  const { data: fastCountsDataArr } = await supabase.rpc('get_campaign_creator_counts', { p_campaign_id: campaignId });
  let fastCountsData: any = null;
  if (fastCountsDataArr && fastCountsDataArr.length > 0) {
    fastCountsData = {
      approved: Number(fastCountsDataArr[0].approved || 0),
      pending: Number(fastCountsDataArr[0].pending || 0),
      pending_with_videos: Number(fastCountsDataArr[0].pending_with_videos || 0)
    };
  }

  const { data: fastVideoCountsDataArr } = await supabase.rpc('get_campaign_video_counts_fast', { p_campaign_id: campaignId });
  let fastVideoCountsData: any = null;
  if (fastVideoCountsDataArr && fastVideoCountsDataArr.length > 0) {
    fastVideoCountsData = {
      total_approved: Number(fastVideoCountsDataArr[0].total_approved || 0),
      total_pending: Number(fastVideoCountsDataArr[0].total_pending || 0),
      total_livestream: Number(fastVideoCountsDataArr[0].total_livestream || 0)
    };
  }

  // Ambil semua sesi Live via RPC
  const { data: rpcLives } = await supabase.rpc('get_campaign_live_stats', { p_campaign_id: campaignId });
  const actualLives: any[] = Array.isArray(rpcLives) ? rpcLives : [];
  const liveUids = new Set(actualLives.map((l: any) => l.content_uid).filter(Boolean));

  // Fetch stats for videos via new RPC
  const { data: videoStats } = await supabase.rpc('get_campaign_video_stats', { p_campaign_id: campaignId });
    
  const videoGmvMap = new Map();
  const videoViewsMap = new Map();
  const videoLikesMap = new Map();
  
  videoStats?.forEach((s: any) => {
    if (s.content_uid) {
      videoGmvMap.set(s.content_uid, s.gmv || 0);
      videoViewsMap.set(s.content_uid, s.views || 0);
      videoLikesMap.set(s.content_uid, s.likes || 0);
    }
  });

  // Fetch ads performance to get per-creator Ads GMV
  const { data: adsPerformance } = await supabase.from('ads_performance').select('creator_username, gmv_idr').eq('campaign_id', campaignId);
  const adsGmvMap = new Map();
  adsPerformance?.forEach((ad: any) => {
    const u = (ad.creator_username || '').toLowerCase();
    if (u) {
      adsGmvMap.set(u, (adsGmvMap.get(u) || 0) + (ad.gmv_idr || 0));
    }
  });

  // Fetch SKUs for dropdown and filtering
  const { data: skusData } = await supabase
    .from('skus')
    .select('id, product_id, nama_produk')
    .eq('campaign_id', campaignId);

  // Hapus mapping rawSales dan adsPerf karena sudah dihandle oleh View
  let fbApprovedCreators = 0;
  let fbPendingCreators = 0;
  let fbApprovedVideos = 0;
  let fbPendingVideos = 0;
  let fbLivestreams = 0;
  let pendingCreatorsWithVideosCount = 0;
  let fbAds = 0;

  const enrichedCcData = ccData?.map((cc: any) => {
    const creator = Array.isArray(cc.creators) ? cc.creators[0] : cc.creators;
    const extractLatestSnapshot = (c: any) => {
      const snaps = c?.creator_snapshots;
      const snapsArray = Array.isArray(snaps) ? snaps : (snaps ? [snaps] : []);
      const sortedSnaps = [...snapsArray].sort((a:any, b:any) => {
        const tDiff = new Date(b.tanggal_update || 0).getTime() - new Date(a.tanggal_update || 0).getTime();
        if (tDiff !== 0) return tDiff;
        return (b.id || 0) - (a.id || 0);
      });
      return sortedSnaps.reduce((acc: any, curr: any) => ({
        followers: acc.followers ?? curr.followers,
        tier: acc.tier ?? curr.tier,
        level: acc.level ?? curr.level,
      }), { followers: null, tier: null, level: null } as any);
    };

    const snap = extractLatestSnapshot(creator);
    const username = creator?.username || '';
    const creatorId = cc.creator_id;
    const contacts = Array.isArray(creator?.creator_contacts) ? creator.creator_contacts : (creator?.creator_contacts ? [creator.creator_contacts] : []);
    const activeContact = contacts.find((c: any) => c.status === 'aktif') || contacts[0];

    const perf = creatorPerformance?.find((p: any) => p.username?.toLowerCase() === username.toLowerCase());

    // Calculate Total VT and Total Live
    const creatorVideoStats = videoStats?.filter((v: any) => v.username === username.toLowerCase()) || [];
    const dbVideos = cc.videos || [];
    const uniqueVideoIds = new Map<string, string>(); 
    const uniqueLiveIds = new Set<string>();

    dbVideos.forEach((v: any) => {
      const id = v.vt_code || v.content_uid;
      if (id) {
          uniqueVideoIds.set(id, v.vt_approval || 'approved');
      }
    });

    creatorVideoStats.forEach((s: any) => {
       let vid = s.content_uid;
       if (vid) {
         if (!uniqueVideoIds.has(vid)) {
             uniqueVideoIds.set(vid, 'approved');
         }
       }
    });

    actualLives.forEach((l: any) => {
      const liveUsername = (l.creator_username || l.username || '').toLowerCase();
      if (liveUsername === username.toLowerCase() && l.content_uid) {
         uniqueLiveIds.add(l.content_uid);
      }
    });

    let approvedVtCount = 0;
    let pendingVtCount = 0;
    
    if (cc.approval === 'pending') {
        pendingVtCount = Math.max(perf?.tracked_videos || 0, uniqueVideoIds.size);
    } else {
        approvedVtCount = Math.max(perf?.tracked_videos || 0, uniqueVideoIds.size);
        pendingVtCount = 0;
    }

    const totalVt = approvedVtCount + pendingVtCount;
    const totalLive = uniqueLiveIds.size;

    if (cc.approval === 'approved') fbApprovedCreators++;
    if (cc.approval === 'pending') fbPendingCreators++;
    
    fbApprovedVideos += approvedVtCount;
    fbPendingVideos += pendingVtCount;
    if (pendingVtCount > 0) pendingCreatorsWithVideosCount++;
    fbLivestreams += totalLive;
    
    const gmvAds = adsGmvMap.get(username.toLowerCase()) || 0;
    fbAds += gmvAds;

    return {
      ...cc,
      followers: snap?.followers || 0,
      level: snap?.level || '-',
      tier: snap?.tier || cc.tier,
      no_whatsapp: activeContact?.nomor || '',
      gmv_organic: perf?.gmv_organic || 0,
      items_sold: perf?.items_sold || 0,
      gmv_ads: gmvAds,
      video_views: perf?.video_views || 0,
      video_likes: perf?.video_likes || 0,
      total_vt: totalVt,
      total_livestreams: totalLive
    };
  }) || [];

  // Override counts if a global filter is active
  if (filterType !== 'none') {
    fastCountsData = {
      approved: fbApprovedCreators,
      pending: fbPendingCreators,
      pending_with_videos: pendingCreatorsWithVideosCount
    };
    fastVideoCountsData = {
      total_approved: fbApprovedVideos,
      total_pending: fbPendingVideos,
      total_livestream: fbLivestreams
    };
  }

  // Fetch creator addresses (Pengiriman sampel)
  // Strict filter: only show if client_approval is 'approved' (if required) or 'NOT_REQUIRED' (if not required)
  // Also internal approval must be 'approved' (we fetched 'approved' and 'alternate', but for samples only 'approved' makes sense).
  // Wait, let's keep internal 'approved' or 'alternate' since they are in ccData, but strictly check client_approval.
  const ccIdsForSamples = campaign.require_client_approval 
    ? enrichedCcData.filter((cc: any) => cc.approval === 'approved' && cc.client_approval === 'approved').map((cc: any) => cc.id)
    : enrichedCcData.filter((cc: any) => cc.approval === 'approved').map((cc: any) => cc.id);

  const { data: addrData } = await supabase
    .from('creator_addresses')
    .select(`
      id,
      campaign_creator_id,
      nama_penerima,
      nama_jalan,
      provinsi,
      kabupaten_kota,
      kecamatan,
      kelurahan,
      kode_pos,
      notes,
      resi,
      proses,
      produk_dikirim,
      tanggal_kirim,
      is_cancel,
      resi_updated_at,
      resi_updated_by
    `)
    .in('campaign_creator_id', ccIdsForSamples.length > 0 ? ccIdsForSamples : [0]);
  const samples = addrData?.filter((addr: any) => ccIdsForSamples.includes(addr.campaign_creator_id)).map((addr: any) => {
    const cc = enrichedCcData.find((c: any) => c.id === addr.campaign_creator_id);
    const creatorInfo = Array.isArray(cc?.creators) ? cc.creators[0] : cc?.creators;
    return {
      ...addr,
      creator_username: creatorInfo?.username || 'Unknown'
    };
  }) || [];

  const { data: liveData } = await supabase
    .from('live_schedules')
    .select(`
      id,
      campaign_creator_id,
      tanggal_live
    `)
    .in('campaign_creator_id', ccIdsForSamples.length > 0 ? ccIdsForSamples : [0]);
  
  const schedules = liveData?.filter((l: any) => ccIdsForSamples.includes(l.campaign_creator_id)).map((l: any) => {
    const cc = enrichedCcData.find((c: any) => c.id === l.campaign_creator_id);
    const creatorInfo = Array.isArray(cc?.creators) ? cc.creators[0] : cc?.creators;
    return {
      ...l,
      creator_username: creatorInfo?.username || 'Unknown'
    };
  }) || [];

  // Fetch SKUs for dropdown already done above

  const validUsernames = enrichedCcData.filter((cc: any) => cc.client_approval === 'approved' || cc.approval === 'approved').map((cc: any) => cc.creators?.username).filter(Boolean);

  const ordersMap = new Map<string, number>();
  actualLives.forEach((l: any) => {
    if (l.content_uid) ordersMap.set(l.content_uid, l.orders || 0);
  });

  // Extract videos and attach GMV (merging DB videos + organic auto-detected videos + sales videos)
  const portalVideos: any[] = [];
  enrichedCcData.forEach((cc: any) => {
    const username = cc.creators?.username || 'Unknown';
    const creatorVideos: any[] = [];
    
    // 1. Add DB videos
    if (cc.videos && Array.isArray(cc.videos)) {
      cc.videos.forEach((v: any) => {
        let vid = v.content_uid;
        if (v.link_video && !vid) {
            const match = v.link_video.match(/video\/(\d+)/);
            if (match) vid = match[1];
        }
        creatorVideos.push({
          ...v,
          content_uid: vid,
          creator_username: username,
          gmv: videoGmvMap.get(vid) || 0,
          views: videoViewsMap.get(vid) || 0,
          likes: videoLikesMap.get(vid) || 0,
          isAuto: false
        });
      });
    }

    // 2. Add Auto-detected videos from organic_videos and sales
    const creatorVideoStats = videoStats?.filter((s: any) => s.username === username.toLowerCase()) || [];
    
    creatorVideoStats.forEach((s: any) => {
        const vid = s.content_uid;
        if (!vid) return;

        const exists = creatorVideos.some(v => v.content_uid === vid || v.vt_code === vid);
        if (!exists) {
           const isLive = liveUids.has(vid);
           
           // Exclude livestream dari daftar Video & Konten
           if (isLive) return;
           
           creatorVideos.push({
              id: `auto_${vid}`,
              content_uid: vid,
              link_video: `https://www.tiktok.com/@${username}/video/${vid}`,
              creator_username: username,
              gmv: s.gmv || 0,
              views: s.views || 0,
              likes: s.likes || 0,
              isAuto: true,
              isLive: false
           });
        }
    });

    if (creatorVideos.length > 0) {
      portalVideos.push({
        creator_username: username,
        total_videos: creatorVideos.length,
        total_gmv: creatorVideos.reduce((sum, v) => sum + (v.gmv || 0), 0),
        total_views: creatorVideos.reduce((sum, v) => sum + (v.views || 0), 0),
        total_likes: creatorVideos.reduce((sum, v) => sum + (v.likes || 0), 0),
        videos: creatorVideos
      });
    }
  });

  // Also attach campaign's target_creator to summary if missing, so progress bar shows up
  const finalSummary: any = summary || {};
  if (campaign && !finalSummary.target_creator) {
     finalSummary.target_creator = campaign.target_creator;
  }

  // Aggregate sales per product_id for Top 5 SKU insight via RPC
  const { data: topSkusData } = await supabase
    .rpc('get_campaign_top_skus', { p_campaign_id: campaignId });
    
  const salesPerProduct = topSkusData || [];
  const totalItemsSold = salesPerProduct.reduce((sum: number, p: any) => sum + Number(p.items_sold || 0), 0);

  // Aggregate Ads Data
  const { data: rawAdsData } = await supabase.from('ads_performance').select('*').eq('campaign_id', campaignId);
  let globalAdsGmv = 0;
  if (rawAdsData && rawAdsData.length > 0) {
    const latestAdsMap = new Map();
    for (const row of rawAdsData) {
      const existing = latestAdsMap.get(row.ad_id);
      if (!existing || new Date(row.tanggal) > new Date(existing.tanggal)) {
        latestAdsMap.set(row.ad_id, row);
      }
    }
    for (const ad of latestAdsMap.values()) {
      let kurs = ad.kurs || 16000;
      if (kurs < 1000) kurs = kurs * 1000;
      globalAdsGmv += (ad.gross_revenue_usd || 0) * kurs;
    }
  }

  // Override global ads GMV if a filter is active
  if (filterType !== 'none') {
    globalAdsGmv = fbAds;
  }

  // --- MONTHLY STATS for Brand Portal ---
  // Helper to get WIB date string
  const toWIBDateStr = (dateInput: string | Date | undefined | null) => {
    if (!dateInput) return null;
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return null;
      // Convert to WIB (UTC+7)
      const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
      const wib = new Date(utc + (3600000 * 7));
      return wib.toISOString().substring(0, 10);
    } catch {
      return null;
    }
  };

  const { data: dailyStatsRaw } = await supabase.rpc('get_campaign_daily_stats', { p_campaign_id: campaignId });
  const campaignStartStr = campaign.start_date ? toWIBDateStr(campaign.start_date) : '';

  const monthlyMap: Record<string, { gmvOrganic: number; gmvAds: number; videos: Set<string>; videoCreators: Set<string>; liveSessions: Set<string> }> = {};

  // 1. Organic GMV per month from RPC
  (dailyStatsRaw || []).forEach((stat: any) => {
    if (!stat.date_str) return;
    if (campaignStartStr && stat.date_str < campaignStartStr) return;
    const monthStr = stat.date_str.substring(0, 7);
    if (!monthlyMap[monthStr]) monthlyMap[monthStr] = { gmvOrganic: 0, gmvAds: 0, videos: new Set(), videoCreators: new Set(), liveSessions: new Set() };
    monthlyMap[monthStr].gmvOrganic += (stat.total_gmv || 0);
  });

  // 2. Ads GMV per month (delta from sorted daily rows)
  if (rawAdsData && rawAdsData.length > 0) {
    const adsSorted = [...rawAdsData].sort((a: any, b: any) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
    const prevAdValues: Record<string, number> = {};
    adsSorted.forEach((ad: any) => {
      if (!ad.tanggal || !ad.ad_id) return;
      const dateStr = ad.tanggal.substring(0, 10);
      const cur = ad.gross_revenue_usd || 0;
      const prev = prevAdValues[ad.ad_id] || 0;
      const delta = cur - prev;
      prevAdValues[ad.ad_id] = cur;
      if (campaignStartStr && dateStr < campaignStartStr) return;
      if (delta <= 0) return;
      let kurs = ad.kurs || 16000;
      if (kurs < 1000) kurs = kurs * 1000;
      const monthStr = dateStr.substring(0, 7);
      if (!monthlyMap[monthStr]) monthlyMap[monthStr] = { gmvOrganic: 0, gmvAds: 0, videos: new Set(), videoCreators: new Set(), liveSessions: new Set() };
      monthlyMap[monthStr].gmvAds += delta * kurs;
    });
  }

  // Fetch organic_videos to get actual post_times
  const creatorUsernames = Array.from(new Set(enrichedCcData.map(cc => cc.creators?.username).filter(Boolean)));
  let allOrganicVideos: any[] = [];
  if (creatorUsernames.length > 0) {
    const chunkSize = 200;
    for (let i = 0; i < creatorUsernames.length; i += chunkSize) {
      const chunk = creatorUsernames.slice(i, i + chunkSize);
      const { data: orgData } = await supabase
        .from('organic_videos')
        .select('content_uid, post_time, content_type, creator_username')
        .in('creator_username', chunk)
        .eq('campaign_id', campaignId);
      if (orgData) {
        allOrganicVideos = [...allOrganicVideos, ...orgData];
      }
    }
  }

  // Mutate enrichedCcData videos to attach post_time
  const postTimeMap = new Map<string, string>();
  allOrganicVideos.forEach(v => {
    if (v.content_uid && v.post_time) {
      postTimeMap.set(v.content_uid.toString(), String(v.post_time));
    }
  });
  
  enrichedCcData.forEach((cc: any) => {
    if (cc.videos && Array.isArray(cc.videos)) {
      cc.videos.forEach((v: any) => {
        if (v.content_uid && postTimeMap.has(v.content_uid.toString())) {
          v.post_time = postTimeMap.get(v.content_uid.toString());
        }
      });
    }
  });

  // 3. Count Videos from DB (ccData.videos)
  enrichedCcData.forEach((cc: any) => {
    if (cc.videos && Array.isArray(cc.videos)) {
      cc.videos.forEach((v: any) => {
        if (!v.created_at || !v.link_video) return; 
        const dateStr = toWIBDateStr(v.created_at);
        if (!dateStr) return;
        if (campaignStartStr && dateStr < campaignStartStr) return;
        const monthStr = v.created_at.substring(0, 7); // Uses UTC month string exactly like DailyClient
        if (!monthlyMap[monthStr]) monthlyMap[monthStr] = { gmvOrganic: 0, gmvAds: 0, videos: new Set(), videoCreators: new Set(), liveSessions: new Set() };
        
        let videoId = v.id.toString();
        const match = v.link_video.match(/\/video\/(\d+)/);
        if (match && match[1]) {
          videoId = match[1];
        }
        
        monthlyMap[monthStr].videos.add(videoId);
        const username = Array.isArray(cc.creators) ? cc.creators[0]?.username : cc.creators?.username;
        if (username) monthlyMap[monthStr].videoCreators.add(username);
      });
    }
  });

  // 4. Count from Organic Videos & Livestreams
  allOrganicVideos.forEach((v: any) => {
    if (!v.post_time || !v.content_uid) return;
    const dateStr = toWIBDateStr(String(v.post_time));
    if (!dateStr) return;
    if (campaignStartStr && dateStr < campaignStartStr) return;
    const monthStr = dateStr.substring(0, 7);
    if (!monthlyMap[monthStr]) monthlyMap[monthStr] = { gmvOrganic: 0, gmvAds: 0, videos: new Set(), videoCreators: new Set(), liveSessions: new Set() };

    if (v.content_type === 'Video') {
      monthlyMap[monthStr].videos.add(v.content_uid.toString());
      if (v.creator_username) monthlyMap[monthStr].videoCreators.add(v.creator_username);
    } else if (v.content_type === 'Livestream' || v.content_type === 'Live') {
      monthlyMap[monthStr].liveSessions.add(v.content_uid.toString());
    }
  });

  // 5. Count Live Sessions from actualLives (has start_time)
  actualLives.forEach((l: any) => {
    if (!l.start_time) return;
    const dateStr = toWIBDateStr(String(l.start_time));
    if (!dateStr) return;
    if (campaignStartStr && dateStr < campaignStartStr) return;
    const monthStr = dateStr.substring(0, 7);
    if (!monthlyMap[monthStr]) monthlyMap[monthStr] = { gmvOrganic: 0, gmvAds: 0, videos: new Set(), videoCreators: new Set(), liveSessions: new Set() };
    if (l.content_uid) monthlyMap[monthStr].liveSessions.add(l.content_uid.toString());
  });

  const monthlyStats = Object.keys(monthlyMap)
    .sort((a, b) => b.localeCompare(a)) // Sort by newest month first
    .map(month => ({
      month,
      gmvOrganic: monthlyMap[month].gmvOrganic,
      gmvAds: monthlyMap[month].gmvAds,
      gmvTotal: monthlyMap[month].gmvOrganic + monthlyMap[month].gmvAds,
      totalVideos: monthlyMap[month].videos.size,
      totalVideoCreators: monthlyMap[month].videoCreators.size,
      totalLiveSessions: monthlyMap[month].liveSessions.size,
    }));

  return { 
    authenticated: true, 
    campaign, 
    summary: finalSummary, 
    totalSales: totalSales,
    totalAwareness: totalAwareness,
    dailyPerf: [], 
    ccData: enrichedCcData, 
    samples,
    schedules,
    videos: portalVideos,
    skus: skusData || [],
    liveHistory: [],
    rpc: rpcPerf,
    fastCountsData,
    fastVideoCountsData,
    initialTotalAdsGmv: globalAdsGmv,
    topSkus: salesPerProduct,
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

  // Cek otorisasi
  const { data: campaign } = await supabase.from('campaigns').select('pin').eq('id', campaignId).single();
  if (!campaign || campaign.pin !== pin) throw new Error('Unauthorized');

  // Update
  const { error } = await supabase
    .from('campaign_creators')
    .update({ client_approval: status })
    .eq('id', campaignCreatorId)
    .eq('campaign_id', campaignId); // Proteksi tambahan

  if (error) throw error;
  return { success: true };
}

export async function updateResiByClient(campaignId: number, addressId: number, resi: string, proses: string, produk_dikirim?: string, notes?: string, ekspedisi?: string) {
  const cookieStore = await cookies();
  const pin = cookieStore.get(`portal_pin_${campaignId}`)?.value;
  if (!pin) throw new Error('Not authenticated');

  // Cek otorisasi
  const { data: campaign } = await supabase.from('campaigns').select('pin').eq('id', campaignId).single();
  if (!campaign || campaign.pin !== pin) throw new Error('Unauthorized');

  // Verifikasi bahwa addressId ini benar-benar milik campaignId ini
  // (mencegah eksploitasi jika brand menginput addressId milik brand lain)
  const { data: addr } = await supabase
    .from('creator_addresses')
    .select('campaign_creators(campaign_id)')
    .eq('id', addressId)
    .single() as any;

  if (!addr || addr.campaign_creators?.campaign_id !== campaignId) {
    throw new Error('Unauthorized address modification');
  }

  const updatePayload: any = { 
    resi: resi, 
    proses: proses,
    tanggal_kirim: proses === 'Dikirim' ? new Date().toISOString() : undefined,
    resi_updated_at: new Date().toISOString(),
    resi_updated_by: 'Brand'
  };
  
  if (produk_dikirim !== undefined) {
    updatePayload.produk_dikirim = produk_dikirim;
  }
  if (notes !== undefined) {
    updatePayload.notes = notes;
  }
  if (ekspedisi !== undefined) {
    updatePayload.ekspedisi = ekspedisi;
  }

  // Update
  const { error } = await supabase
    .from('creator_addresses')
    .update(updatePayload)
    .eq('id', addressId);

  if (error) throw error;
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

  // Cek otorisasi
  const { data: campaign } = await supabase.from('campaigns').select('pin').eq('id', campaignId).single();
  if (!campaign || campaign.pin !== pin) throw new Error('Unauthorized');

  // Ambil semua addressIds yang akan diupdate
  const addressIds = updates.map(u => u.addressId);

  // Verifikasi bahwa semua addressId ini benar-benar milik campaignId ini
  const { data: addrs } = await supabase
    .from('creator_addresses')
    .select('id, campaign_creators(campaign_id)')
    .in('id', addressIds);

  const invalidAddrs = addrs?.filter((a: any) => a.campaign_creators?.campaign_id !== campaignId) || [];
  if (invalidAddrs.length > 0 || (addrs && addrs.length !== addressIds.length)) {
    throw new Error('Unauthorized address modification detected in batch');
  }

  // Update batch sequentially
  // Supabase JS tidak punya upsert multiple fields gampang kecuali semua fields lengkap
  // Jadi kita loop dan update satu-satu secara berurutan. Karena jalan di server action (backend), latency db sangat kecil.
  for (const update of updates) {
    const updatePayload: any = {};
    if (update.resi !== undefined) {
      updatePayload.resi = update.resi;
      updatePayload.resi_updated_at = new Date().toISOString();
      updatePayload.resi_updated_by = 'Brand';
    }
    if (update.proses !== undefined) {
      updatePayload.proses = update.proses;
      if (update.proses === 'Dikirim') {
        updatePayload.tanggal_kirim = new Date().toISOString();
      }
    }
    if (update.ekspedisi !== undefined) {
      updatePayload.ekspedisi = update.ekspedisi;
    }
    if (update.produk_dikirim !== undefined) updatePayload.produk_dikirim = update.produk_dikirim;
    if (update.notes !== undefined) updatePayload.notes = update.notes;

    if (Object.keys(updatePayload).length > 0) {
      const { error } = await supabase
        .from('creator_addresses')
        .update(updatePayload)
        .eq('id', update.addressId);
        
      if (error) throw error;
    }
  }

  return { success: true };
}

export async function updateClientNotes(campaignId: number, ccId: number, notes: string) {
  const { error } = await supabase
    .from('campaign_creators')
    .update({ notes_client: notes })
    .eq('id', ccId)
    .eq('campaign_id', campaignId);

  if (error) {
    console.error("Error updating client notes:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}
