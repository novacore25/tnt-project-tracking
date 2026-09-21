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

const toWIBDateStr = (utcString: string | null | undefined): string | null => {
  if (!utcString) return null;
  const d = new Date(utcString);
  if (isNaN(d.getTime())) return null;
  const wibTime = new Date(d.getTime() + (7 * 60 * 60 * 1000));
  return wibTime.toISOString().substring(0, 10);
};

export async function getDailyData(campaignId: number) {
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (!campaign) return null;

  const campaignStartStr = campaign.start_date ? campaign.start_date.substring(0, 10) : null;
  const campaignEndStr = campaign.end_date ? campaign.end_date.substring(0, 10) : null;

  let allSales: any[] = [];
  let allVideosFromCreators: any[] = [];
  let allLiveSessions: any[] = [];
  
  const isAwareness = campaign.tipe_campaign === 'awareness';
  const isHybrid = campaign.tipe_campaign === 'gmv_awareness';

  // 1. Fetch metadata, skus, and counts concurrently
  const [
    skusRes,
    salesCountRes,
    ccCountRes,
    vidCountRes,
    adsCountRes
  ] = await Promise.all([
    supabase.from('skus').select('product_id').eq('campaign_id', campaignId),
    supabase.from('sales').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId),
    supabase.from('campaign_creators').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId),
    supabase.from('videos').select('id, campaign_creators!inner(campaign_id)', { count: 'exact', head: true }).eq('campaign_creators.campaign_id', campaignId),
    supabase.from('ads_performance').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId)
  ]);

  const skuSet = new Set((skusRes.data || []).map((s: any) => s.product_id).filter(Boolean));
  const hasSkus = skuSet.size > 0;

  // 2. Fetch campaign_creators, videos, ads, and sales in parallel batches (pageSize = 1000)
  const ccCount = ccCountRes.count || 0;
  const vidCount = vidCountRes.count || 0;
  const adsCount = adsCountRes.count || 0;
  const salesCount = salesCountRes.count || 0;
  const batchSize = 1000;

  const ccPromises = [];
  for (let i = 0; i < ccCount; i += batchSize) {
    ccPromises.push(
      supabase
        .from('campaign_creators')
        .select('id, approval, approved_at, creators(username)')
        .eq('campaign_id', campaignId)
        .order('id', { ascending: true })
        .range(i, i + batchSize - 1)
    );
  }

  const vidPromises = [];
  for (let i = 0; i < vidCount; i += batchSize) {
    vidPromises.push(
      supabase
        .from('videos')
        .select('id, campaign_creator_id, created_at, link_video, content_uid, campaign_creators!inner(campaign_id)')
        .eq('campaign_creators.campaign_id', campaignId)
        .order('id', { ascending: true })
        .range(i, i + batchSize - 1)
    );
  }

  const adsPromises = [];
  for (let i = 0; i < adsCount; i += batchSize) {
    adsPromises.push(
      supabase
        .from('ads_performance')
        .select('ad_id, tanggal, gross_revenue_usd, kurs')
        .eq('campaign_id', campaignId)
        .order('tanggal', { ascending: true })
        .range(i, i + batchSize - 1)
    );
  }

  const salesPromises = [];
  for (let i = 0; i < salesCount; i += batchSize) {
    salesPromises.push(
      supabase
        .from('sales')
        .select('tanggal, gmv, quantity, creator_username, content_uid, content_type, product_id')
        .eq('campaign_id', campaignId)
        .range(i, i + batchSize - 1)
    );
  }

  const [ccResults, vidResults, adsResults, salesResults] = await Promise.all([
    Promise.all(ccPromises),
    Promise.all(vidPromises),
    Promise.all(adsPromises),
    Promise.all(salesPromises)
  ]);

  allVideosFromCreators = [];
  ccResults.forEach(r => { if (r.data) allVideosFromCreators = allVideosFromCreators.concat(r.data); });

  let allVideos: any[] = [];
  vidResults.forEach(r => { if (r.data) allVideos = allVideos.concat(r.data); });

  let allAds: any[] = [];
  adsResults.forEach(r => { if (r.data) allAds = allAds.concat(r.data); });

  salesResults.forEach(r => { if (r.data) allSales = allSales.concat(r.data); });

  // Map videos to creators
  const videosByCcId = new Map<number, any[]>();
  for (const v of allVideos) {
    const list = videosByCcId.get(v.campaign_creator_id);
    if (list) list.push(v);
    else videosByCcId.set(v.campaign_creator_id, [v]);
  }
  for (const cc of allVideosFromCreators) {
    cc.videos = videosByCcId.get(cc.id) || [];
  }

  // Group by Date and Month
  const grouped: Record<string, { gmv: number; gmvAds: number; creators: Set<string>; videos: Set<string>; gmvLive: number; gmvVT: number; ordersLive: number; ordersVT: number; liveSessions: Set<string> }> = {};
  const monthlyGrouped: Record<string, { gmv: number; gmvAds: number; creators: Set<string>; videos: Set<string>; gmvLive: number; gmvVT: number; ordersLive: number; ordersVT: number; liveSessions: Set<string> }> = {};

  // Compute daily sales stats directly from sales table
  const approvedUsernameSet = new Set(
    allVideosFromCreators
      .filter(cc => cc.approval === 'approved' || cc.approval === 'alternate')
      .map(cc => cc.creators?.username?.toLowerCase())
      .filter(Boolean)
  );

  const dailySalesMap = new Map<string, {
    date_str: string;
    total_gmv: number;
    gmv_live: number;
    gmv_vt: number;
    orders_live: number;
    orders_vt: number;
    active_creators: Set<string>;
    active_videos: Set<string>;
  }>();

  allSales.forEach((s: any) => {
    const u = (s.creator_username || '').toLowerCase();
    if (approvedUsernameSet.size > 0 && !approvedUsernameSet.has(u)) return;
    if (!hasSkus || !s.product_id || !skuSet.has(s.product_id)) return;

    const dateStr = s.tanggal ? (s.tanggal.includes('T') ? toWIBDateStr(s.tanggal) : s.tanggal.substring(0, 10)) : null;
    if (!dateStr) return;

    if (!dailySalesMap.has(dateStr)) {
      dailySalesMap.set(dateStr, {
        date_str: dateStr,
        total_gmv: 0,
        gmv_live: 0,
        gmv_vt: 0,
        orders_live: 0,
        orders_vt: 0,
        active_creators: new Set(),
        active_videos: new Set()
      });
    }
    const day = dailySalesMap.get(dateStr)!;
    const gmv = Number(s.gmv || 0);
    const qty = Number(s.quantity || 0);
    const cType = (s.content_type || '').toLowerCase();

    day.total_gmv += gmv;
    if (s.creator_username) day.active_creators.add(s.creator_username);

    if (cType === 'livestream' || cType === 'live') {
      day.gmv_live += gmv;
      day.orders_live += qty;
    } else {
      day.gmv_vt += gmv;
      day.orders_vt += qty;
      if (s.content_uid) day.active_videos.add(s.content_uid);
    }
  });

  const allSalesStats = Array.from(dailySalesMap.values()).map(d => ({
    ...d,
    active_creators: Array.from(d.active_creators),
    active_videos: Array.from(d.active_videos)
  }));

  if (allSalesStats.length > 0) {
    allSalesStats.forEach((stat: any) => {
      if (!stat.date_str) return;
      const dateStr = stat.date_str;
      
      if (campaignStartStr && dateStr < campaignStartStr) return;
      if (campaignEndStr && dateStr > campaignEndStr) return;

      if (!grouped[dateStr]) grouped[dateStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
      
      grouped[dateStr].gmvLive += (stat.gmv_live || 0);
      grouped[dateStr].ordersLive += (stat.orders_live || 0);
      grouped[dateStr].gmvVT += (stat.gmv_vt || 0);
      grouped[dateStr].ordersVT += (stat.orders_vt || 0);
      grouped[dateStr].gmv += (stat.total_gmv || 0);
      
      if (stat.active_creators) stat.active_creators.forEach((c: string) => grouped[dateStr].creators.add(c));
      if (stat.active_videos) stat.active_videos.forEach((v: string) => grouped[dateStr].videos.add(v));

      const monthStr = dateStr.substring(0, 7);
      if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
      
      monthlyGrouped[monthStr].gmvLive += (stat.gmv_live || 0);
      monthlyGrouped[monthStr].ordersLive += (stat.orders_live || 0);
      monthlyGrouped[monthStr].gmvVT += (stat.gmv_vt || 0);
      monthlyGrouped[monthStr].ordersVT += (stat.orders_vt || 0);
      monthlyGrouped[monthStr].gmv += (stat.total_gmv || 0);
      
      if (stat.active_creators) stat.active_creators.forEach((c: string) => monthlyGrouped[monthStr].creators.add(c));
      if (stat.active_videos) stat.active_videos.forEach((v: string) => monthlyGrouped[monthStr].videos.add(v));
    });
  }

  if (allVideosFromCreators.length > 0) {
    allVideosFromCreators.forEach(cc => {
      const username = cc.creators?.username || 'unknown';
      
      // Hitung Creator berdasarkan approved_at
      if (cc.approved_at) {
        const approvedDateStr = cc.approved_at.substring(0, 10);
        
        let countCreator = true;
        if (campaignStartStr && approvedDateStr < campaignStartStr) countCreator = false;
        if (campaignEndStr && approvedDateStr > campaignEndStr) countCreator = false;
        
        if (countCreator) {
          if (!grouped[approvedDateStr]) grouped[approvedDateStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
          grouped[approvedDateStr].creators.add(username);

          const monthStr = cc.approved_at.substring(0, 7);
          if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
          monthlyGrouped[monthStr].creators.add(username);
        }
      }

      // Hitung Video berdasarkan created_at (VT saja)
      if (!hasSkus || !cc.videos || cc.videos.length === 0) return;
      
      cc.videos.forEach((v: any) => {
        if (!v.created_at || !v.link_video) return; 
        
        const dateStr = v.created_at.substring(0, 10);
        
        if (campaignStartStr && dateStr < campaignStartStr) return;
        
        if (!grouped[dateStr]) grouped[dateStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
        
        // Gunakan content_uid untuk mencegah duplikasi ganda dengan data dari sales
        const uid = v.content_uid || v.id.toString();
        grouped[dateStr].videos.add(uid);

        const monthStr = v.created_at.substring(0, 7);
        if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
        monthlyGrouped[monthStr].videos.add(uid);
      });
    });
  }

  // Hitung Sesi Live dari RPC
  if (hasSkus && allLiveSessions.length > 0) {
    allLiveSessions.forEach((l: any) => {
      if (!l.start_time) return;
      
      // start_time is usually ISO string or timestamp
      const dateStr = String(l.start_time).substring(0, 10);
      
      if (campaignStartStr && dateStr < campaignStartStr) return;
      
      if (!grouped[dateStr]) grouped[dateStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
      if (l.content_uid) grouped[dateStr].liveSessions.add(l.content_uid);

      const monthStr = dateStr.substring(0, 7);
      if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
      if (l.content_uid) monthlyGrouped[monthStr].liveSessions.add(l.content_uid);
    });
  }

  // Calculate Ads Delta
  if (allAds.length > 0) {
    const previousAdValues: Record<string, number> = {};
    allAds.forEach(ad => {
      if (!ad.tanggal || !ad.ad_id) return;
      const dateStr = ad.tanggal.substring(0, 10);
      
      if (campaignStartStr && dateStr < campaignStartStr) return;
      
      const currentGmv = ad.gross_revenue_usd || 0;
      const prevGmv = previousAdValues[ad.ad_id] || 0;
      const deltaUsd = currentGmv - prevGmv;
      
      if (deltaUsd > 0) {
        const kurs = (ad.kurs && ad.kurs < 1000) ? ad.kurs * 1000 : (ad.kurs || 16000);
        const deltaIdr = deltaUsd * kurs;
        
        if (!grouped[dateStr]) grouped[dateStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
        grouped[dateStr].gmvAds += deltaIdr;
        
        const monthStr = dateStr.substring(0, 7);
        if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
        monthlyGrouped[monthStr].gmvAds += deltaIdr;
      }
      
      previousAdValues[ad.ad_id] = currentGmv;
    });
  }

  const formattedDaily = Object.keys(grouped).map(date => ({
    date,
    gmvOrganic: grouped[date].gmv,
    gmvLive: grouped[date].gmvLive,
    gmvVT: grouped[date].gmvVT,
    ordersLive: grouped[date].ordersLive,
    ordersVT: grouped[date].ordersVT,
    gmvAds: grouped[date].gmvAds,
    totalCreators: grouped[date].creators.size,
    totalVideos: grouped[date].videos.size,
    totalLiveSessions: grouped[date].liveSessions.size
  })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const formattedMonthly = Object.keys(monthlyGrouped).map(month => ({
    month,
    gmvOrganic: monthlyGrouped[month].gmv,
    gmvLive: monthlyGrouped[month].gmvLive,
    gmvVT: monthlyGrouped[month].gmvVT,
    ordersLive: monthlyGrouped[month].ordersLive,
    ordersVT: monthlyGrouped[month].ordersVT,
    gmvAds: monthlyGrouped[month].gmvAds,
    totalCreators: monthlyGrouped[month].creators.size,
    totalVideos: monthlyGrouped[month].videos.size,
    totalLiveSessions: monthlyGrouped[month].liveSessions.size
  })).sort((a, b) => new Date(b.month + '-01').getTime() - new Date(a.month + '-01').getTime());

  return {
    campaign,
    dailyData: formattedDaily,
    monthlyData: formattedMonthly
  };
}
