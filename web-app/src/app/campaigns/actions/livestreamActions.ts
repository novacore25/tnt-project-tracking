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

export async function getLivestreamData(campaignId: number) {
  const fetchParallel = async (table: string, queryParams: (q: any) => any, selectString: string) => {
    let all: any[] = [];
    const countQuery = queryParams(supabase.from(table).select('id', { count: 'exact', head: true }));
    const { count } = await countQuery;
    
    if (count && count > 0) {
      const promises = [];
      const chunkSize = 1000;
      for (let i = 0; i < count; i += chunkSize) {
        promises.push(
          queryParams(supabase.from(table).select(selectString)).range(i, i + chunkSize - 1)
        );
      }
      const results = await Promise.all(promises);
      results.forEach(res => {
        if (res.data) all = all.concat(res.data);
      });
    }
    return all;
  };

  // 1. Fetch lean campaign metadata and skus
  const [{ data: campaign }, { data: skusData }] = await Promise.all([
    supabase
      .from('campaigns')
      .select('id, nama, brand_id, start_date, end_date')
      .eq('id', campaignId)
      .single(),
    supabase
      .from('skus')
      .select('product_id')
      .eq('campaign_id', campaignId)
  ]);

  if (!campaign) return null;

  const skuSet = new Set((skusData || []).map((s: any) => s.product_id).filter(Boolean));
  const hasSkus = skuSet.size > 0;

  // 2. Fetch lean campaign creators (only id, approval, and creator username/nama)
  // Selecting lean columns avoids transfer of huge bio, notes, raw json columns
  const ccDataPromise = fetchParallel(
    'campaign_creators', 
    (q) => q.eq('campaign_id', campaignId), 
    'id, approval, creators(username, nama_asli)'
  );

  if (!hasSkus) {
    const ccData = await ccDataPromise;
    return {
      campaign,
      creators: ccData || [],
      salesData: [],
      liveMetrics: [],
      liveStats: []
    };
  }

  // 3. Fetch lean sales for live stream (only needed attributes including product_id)
  const salesPromise = fetchParallel(
    'sales', 
    (q) => q.eq('campaign_id', campaignId).or('content_type.ilike.livestream,content_type.ilike.live'), 
    'creator_username, content_uid, quantity, gmv, tanggal, product_id'
  );

  // 4. Try getting live stats via RPC concurrently
  const rpcPromise = (async () => {
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_campaign_live_stats', {
        p_campaign_id: campaignId
      });
      if (!rpcErr && Array.isArray(rpcData)) {
        return rpcData;
      }
    } catch (e) {
      console.warn('Livestream RPC skipped or timed out on server:', e);
    }
    return [];
  })();

  const [ccData, sDataRaw, rpcLives] = await Promise.all([
    ccDataPromise,
    salesPromise,
    rpcPromise
  ]);

  const sData = (sDataRaw || []).filter((s: any) => s.product_id && skuSet.has(s.product_id));

  // If RPC returned empty (e.g. statement timeout on Supabase), build fallback session items from sales
  let liveStats = rpcLives || [];
  if (liveStats.length === 0 && sData && sData.length > 0) {
    // Deduplicate and aggregate sales by (content_uid, creator_username)
    const salesMap = new Map<string, {
      content_uid: string;
      creator_username: string;
      start_time: string;
      gmv: number;
      orders: number;
      video_views: number;
      video_likes: number;
      duration_str: string;
    }>();

    sData.forEach((s: any) => {
      const u = (s.creator_username || '').replace(/^@/, '').toLowerCase();
      const uid = s.content_uid ? s.content_uid.replace(/^video_/, '') : `session_${u}_${s.tanggal || 'unknown'}`;
      const key = `${uid}_${u}`;

      if (!salesMap.has(key)) {
        salesMap.set(key, {
          content_uid: uid,
          creator_username: u,
          start_time: s.tanggal || '',
          gmv: Number(s.gmv || 0),
          orders: Number(s.quantity || 0),
          video_views: 0,
          video_likes: 0,
          duration_str: ''
        });
      } else {
        const item = salesMap.get(key)!;
        item.gmv += Number(s.gmv || 0);
        item.orders += Number(s.quantity || 0);
      }
    });

    liveStats = Array.from(salesMap.values());
  }

  return {
    campaign,
    creators: ccData || [],
    salesData: sData || [],
    liveMetrics: [], // Empty to save egress; liveStats already contains consolidated data
    liveStats
  };
}
