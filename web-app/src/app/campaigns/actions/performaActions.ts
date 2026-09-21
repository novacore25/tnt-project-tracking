'use server'

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  global: {
    fetch: (url, options) => {
      return fetch(url, { ...options, cache: 'no-store' });
    }
  }
});

export async function getInternalPerformaData(campaignId: number) {
  // 1. Fetch metadata, skus, and counts concurrently
  const [
    campaignRes,
    skusRes,
    salesCountRes,
    adsCountRes,
    perfSummaryRes,
    creatorPerfRes,
    orgCountRes,
    ccCountRes,
    vidCountRes
  ] = await Promise.all([
    supabase.from('campaigns').select('*').eq('id', campaignId).single(),
    supabase.from('skus').select('product_id').eq('campaign_id', campaignId),
    supabase.from('sales').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId),
    supabase.from('ads_performance').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId),
    supabase.rpc('get_performance_summary_v2', { p_campaign_id: campaignId }),
    supabase.rpc('get_campaign_creator_performance', { p_campaign_id: campaignId }),
    supabase.from('organic_videos').select('id', { count: 'planned', head: true }).eq('campaign_id', campaignId),
    supabase.from('campaign_creators').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).in('approval', ['approved', 'pending', 'alternate']),
    supabase.from('videos').select('id, campaign_creators!inner(campaign_id)', { count: 'exact', head: true }).eq('campaign_creators.campaign_id', campaignId)
  ]);

  const campaign = campaignRes.data;
  if (!campaign) return null;

  const rpcSummary = perfSummaryRes?.data?.[0] || null;
  const skuSet = new Set((skusRes.data || []).map((s: any) => s.product_id).filter(Boolean));
  const hasSkus = skuSet.size > 0;

  // 2. Fetch creators, videos, sales, ads in parallel batches, and organic_videos in controlled chunks
  const ccCount = ccCountRes.count || 0;
  const vidCount = vidCountRes.count || 0;
  const orgCount = orgCountRes.count || (rpcSummary ? Number(rpcSummary.total_videos || 0) : 0);
  const salesCount = salesCountRes.count || 0;
  const adsCount = adsCountRes.count || 0;
  const pageSize = 1000;

  const ccPromises = [];
  for (let i = 0; i < ccCount; i += pageSize) {
    ccPromises.push(
      supabase
        .from('campaign_creators')
        .select('id, creator_id, approval, created_at, approved_at, content_type, qty_vt, qty_live, creators(id, username, nama_asli, link_account)')
        .eq('campaign_id', campaignId)
        .in('approval', ['approved', 'pending', 'alternate'])
        .order('id', { ascending: true })
        .range(i, i + pageSize - 1)
    );
  }

  const vidPromises = [];
  for (let i = 0; i < vidCount; i += pageSize) {
    vidPromises.push(
      supabase
        .from('videos')
        .select('id, campaign_creator_id, content_uid, vt_approval, urutan, concept, link_video, campaign_creators!inner(campaign_id)')
        .eq('campaign_creators.campaign_id', campaignId)
        .order('id', { ascending: true })
        .range(i, i + pageSize - 1)
    );
  }

  const salesPromises = [];
  for (let i = 0; i < salesCount; i += pageSize) {
    salesPromises.push(
      supabase
        .from('sales')
        .select('tanggal, gmv, quantity, creator_username, content_uid, content_type, product_id')
        .eq('campaign_id', campaignId)
        .range(i, i + pageSize - 1)
    );
  }

  const adsPromises = [];
  for (let i = 0; i < adsCount; i += pageSize) {
    adsPromises.push(
      supabase
        .from('ads_performance')
        .select('*, creators(username)')
        .eq('campaign_id', campaignId)
        .range(i, i + pageSize - 1)
    );
  }

  // Fetch organic_videos in controlled chunks (concurrency 4) to avoid Postgres statement timeouts
  const fetchOrgVideosChunked = async () => {
    const results: any[] = [];
    if (orgCount <= 0) return results;
    const orgConcurrency = 4;
    for (let i = 0; i < orgCount; i += pageSize * orgConcurrency) {
      const chunk = [];
      for (let c = 0; c < orgConcurrency && (i + c * pageSize) < orgCount; c++) {
        const from = i + c * pageSize;
        const to = from + pageSize - 1;
        chunk.push(
          supabase
            .from('organic_videos')
            .select('content_uid, post_time, content_type, creator_username, video_views, video_likes, product_id')
            .eq('campaign_id', campaignId)
            .range(from, to)
        );
      }
      const chunkResults = await Promise.all(chunk);
      chunkResults.forEach(res => {
        if (res.data) results.push(...res.data);
      });
    }
    return results;
  };

  const [ccResults, vidResults, salesResults, adsResults, orgVidsData] = await Promise.all([
    Promise.all(ccPromises),
    Promise.all(vidPromises),
    Promise.all(salesPromises),
    Promise.all(adsPromises),
    fetchOrgVideosChunked()
  ]);

  let ccData: any[] = [];
  ccResults.forEach(res => {
    if (res.data) ccData = ccData.concat(res.data);
  });

  let vidsData: any[] = [];
  vidResults.forEach(res => {
    if (res.data) vidsData = vidsData.concat(res.data);
  });

  let salesData: any[] = [];
  salesResults.forEach(res => {
    if (res.data) salesData = salesData.concat(res.data);
  });

  let rawAdsData: any[] = [];
  adsResults.forEach(res => {
    if (res.data) rawAdsData = rawAdsData.concat(res.data);
  });

  // Map videos back to creators
  const videosByCcId = new Map<number, any[]>();
  for (const v of vidsData) {
    const list = videosByCcId.get(v.campaign_creator_id);
    if (list) list.push(v);
    else videosByCcId.set(v.campaign_creator_id, [v]);
  }
  for (const cc of ccData) {
    cc.videos = videosByCcId.get(cc.id) || [];
  }

  // 3. Fast In-Memory Aggregation of Sales and Organic Videos
  const approvedUsernames = new Set<string>();
  for (const cc of ccData) {
    const u = cc.creators?.username?.toLowerCase();
    if (u && (cc.approval === 'approved' || cc.approval === 'alternate')) {
      approvedUsernames.add(u);
    }
  }

  const perfMap = new Map<string, any>();
  const getOrCreatePerf = (usernameLower: string) => {
    if (!perfMap.has(usernameLower)) {
      perfMap.set(usernameLower, {
        username: usernameLower,
        gmv_organic: 0,
        items_sold: 0,
        video_views: 0,
        video_likes: 0,
        video_count: 0,
        live_count: 0,
        video_uids: new Set<string>(),
        live_uids: new Set<string>()
      });
    }
    return perfMap.get(usernameLower)!;
  };

  // Pre-seed perfMap with fast aggregated creator performance from PostgreSQL RPC (only if hasSkus)
  if (hasSkus && creatorPerfRes?.data && Array.isArray(creatorPerfRes.data)) {
    creatorPerfRes.data.forEach((cp: any) => {
      const u = (cp.username || '').toLowerCase();
      if (!u) return;
      const perf = getOrCreatePerf(u);
      perf.gmv_organic = Number(cp.gmv_organic || 0);
      perf.items_sold = Number(cp.items_sold || 0);
      perf.video_views = Number(cp.video_views || 0);
      perf.video_likes = Number(cp.video_likes || 0);
      perf.video_count = Number(cp.video_count || 0);
      perf.live_count = Number(cp.live_count || 0);
    });
  }

  let calcOrganicGmv = 0;
  let calcUnattributedGmv = 0;

  if (hasSkus) {
    salesData.forEach((s: any) => {
      if (!s.product_id || !skuSet.has(s.product_id)) return;
      const u = (s.creator_username || '').toLowerCase();
      const gmv = Number(s.gmv || 0);
      const qty = Number(s.quantity || 0);
      const cType = (s.content_type || '').toLowerCase();

      if (approvedUsernames.has(u)) {
        calcOrganicGmv += gmv;
        const perf = getOrCreatePerf(u);
        perf.gmv_organic += gmv;
        perf.items_sold += qty;
        if (s.content_uid) {
          if (cType === 'livestream' || cType === 'live') {
            perf.live_uids.add(s.content_uid);
          } else {
            perf.video_uids.add(s.content_uid);
          }
        }
      } else {
        calcUnattributedGmv += gmv;
      }
    });
  }

  const orgUidMap = new Map<string, { views: number; likes: number; creator: string; contentType: string }>();
  if (hasSkus) {
    (orgVidsData || []).forEach((v: any) => {
      if (!v.product_id || !skuSet.has(v.product_id)) return;
      const uid = v.content_uid;
      if (!uid) return;

      if (!orgUidMap.has(uid)) {
        orgUidMap.set(uid, {
          creator: (v.creator_username || '').toLowerCase(),
          views: Number(v.video_views || 0),
          likes: Number(v.video_likes || 0),
          contentType: (v.content_type || 'video').toLowerCase()
        });
      } else {
        const cur = orgUidMap.get(uid)!;
        cur.views = Math.max(cur.views, Number(v.video_views || 0));
        cur.likes = Math.max(cur.likes, Number(v.video_likes || 0));
      }
    });
  }

  let calcTotalViews = 0;
  let calcTotalLikes = 0;
  let calcUniqueVideos = 0;

  if (hasSkus && orgVidsData.length > 0) {
    for (const perf of perfMap.values()) {
      perf.video_views = 0;
      perf.video_likes = 0;
    }

    for (const [uid, v] of orgUidMap.entries()) {
      if (v.contentType !== 'livestream' && v.contentType !== 'live') {
        calcUniqueVideos++;
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
    }

    for (const perf of perfMap.values()) {
      if (perf.video_uids.size > 0) perf.video_count = perf.video_uids.size;
      if (perf.live_uids.size > 0) perf.live_count = perf.live_uids.size;
    }
  }

  const videoGmvData = hasSkus
    ? salesData
        .filter((s: any) => s.product_id && skuSet.has(s.product_id))
        .map((s: any) => ({
          creator_username: s.creator_username,
          content_uid: s.content_uid,
          content_type: s.content_type
        }))
    : [];
    
  const latestAdsMap = new Map();
  if (rawAdsData) {
    for (const row of rawAdsData) {
      const existing = latestAdsMap.get(row.ad_id);
      if (!existing || new Date(row.tanggal) > new Date(existing.tanggal)) {
        latestAdsMap.set(row.ad_id, row);
      }
    }
  }
  
  // Aggregate cost and gmv per creator_id and global
  const adsStatsByCreator: Record<number, { gmvAds: number, costAds: number, itemsSoldAds: number }> = {};
  let globalAdsGmv = 0;
  let globalAdsGmvUsd = 0;
  let globalAdsSpend = 0;

  for (const ad of latestAdsMap.values()) {
    let kurs = ad.kurs || 16000;
    if (kurs < 1000) kurs = kurs * 1000;
    
    globalAdsGmv += (ad.gross_revenue_usd || 0) * kurs;
    globalAdsGmvUsd += (ad.gross_revenue_usd || 0);
    globalAdsSpend += (ad.cost_usd || 0);

    if (ad.creator_id) {
      if (!adsStatsByCreator[ad.creator_id]) {
        adsStatsByCreator[ad.creator_id] = { gmvAds: 0, costAds: 0, itemsSoldAds: 0 };
      }
      adsStatsByCreator[ad.creator_id].gmvAds += (ad.gross_revenue_usd || 0) * kurs;
      adsStatsByCreator[ad.creator_id].costAds += (ad.cost_usd || 0) * kurs;
      adsStatsByCreator[ad.creator_id].itemsSoldAds += (ad.purchases || 0);
    }
  }

  // 6. Enrichment
  const baseCreatorStats = ccData.map((cc: any) => {
    const creator = Array.isArray(cc.creators) ? cc.creators[0] : cc.creators;
    const snap = creator?.creator_snapshots 
      ? (Array.isArray(creator.creator_snapshots) ? creator.creator_snapshots[0] : creator.creator_snapshots)
      : null;
    const username = creator?.username || 'Unknown';
    const perf = perfMap.get(username.toLowerCase());

    const gmvOrganic = perf?.gmv_organic || 0;
    const itemsSold = perf?.items_sold || 0;
    const videoViews = perf?.video_views || 0;
    const videoLikes = perf?.video_likes || 0;
    const trackedVideos = perf?.video_count || 0;
    
    // Use the correctly aggregated Ads Stats instead of the SQL View's inaccurate sum
    const aggregatedAds = adsStatsByCreator[creator?.id] || { gmvAds: 0, costAds: 0, itemsSoldAds: 0 };
    const gmvAds = aggregatedAds.gmvAds;
    const costAds = aggregatedAds.costAds;
    const itemsSoldAds = aggregatedAds.itemsSoldAds || 0;
    
    const totalGmv = gmvOrganic + gmvAds;
    const roas = costAds > 0 ? (gmvAds / costAds).toFixed(2) : '-';

    // Calculate Total VT and Total Live mimicking the Internal Dashboard logic
    const autoSalesVideos = videoGmvData?.filter((v: any) => v.creator_username === username) || [];
    const dbVideos = hasSkus ? (cc.videos || []) : [];
    const uniqueVideoIds = new Map<string, string>(); 
    const uniqueLiveIds = new Set<string>();

    if (hasSkus) {
      dbVideos.forEach((v: any) => {
        const id = v.content_uid;
        if (id) {
            uniqueVideoIds.set(id, v.vt_approval || 'approved');
        }
      });

      autoSalesVideos.forEach((s: any) => {
         let vid = s.content_uid;
         if (vid && vid.startsWith('video_')) {
           const parts = vid.split('_');
           if (parts.length >= 2) {
             vid = parts[1];
           }
         }
         if (vid) {
           if ((s.content_type || '').toLowerCase() === 'livestream' || (s.content_type || '').toLowerCase() === 'live') {
             uniqueLiveIds.add(vid);
           } else {
             if (!uniqueVideoIds.has(vid)) {
               uniqueVideoIds.set(vid, 'approved');
             }
           }
         }
      });
    }

    let approvedVtCount = 0;
    let pendingVtCount = 0;
    
    if (hasSkus) {
      if (cc.approval === 'pending') {
          pendingVtCount = Math.max(trackedVideos || 0, uniqueVideoIds.size);
      } else {
          approvedVtCount = Math.max(trackedVideos || 0, uniqueVideoIds.size);
          pendingVtCount = 0;
      }
    }

    const totalVt = approvedVtCount + pendingVtCount;
    const totalLive = hasSkus ? Math.max(trackedVideos || 0, uniqueLiveIds.size) : 0;

    return {
      ...cc,
      username,
      followers: snap?.followers || 0,
      gmvOrganic,
      gmvAds,
      costAds,
      roas,
      totalGmv,
      itemsSold,
      itemsSoldAds,
      videoViews,
      videoLikes,
      totalVt,
      totalLive
    };
  });

  return {
    campaign,
    rpcPerformance: {
      organic_gmv: hasSkus ? (calcOrganicGmv > 0 ? calcOrganicGmv : Number(rpcSummary?.organic_gmv || 0)) : 0,
      unattributed_gmv: hasSkus ? calcUnattributedGmv : 0,
      total_views: hasSkus ? (calcTotalViews > 0 ? calcTotalViews : Number(rpcSummary?.total_views || 0)) : 0,
      total_likes: hasSkus ? (calcTotalLikes > 0 ? calcTotalLikes : Number(rpcSummary?.total_likes || 0)) : 0,
      total_videos: hasSkus ? (calcUniqueVideos > 0 ? calcUniqueVideos : Number(rpcSummary?.total_videos || 0)) : 0
    },
    baseCreatorStats,
    totalAdsGmv: globalAdsGmv,
    totalAdsGmvUsd: globalAdsGmvUsd,
    totalAdsSpend: globalAdsSpend,
    adsData: Array.from(latestAdsMap.values()),
  };
}
