"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { TrendingUp, BarChart3, Activity, ArrowUpDown, ChevronDown, ChevronRight, Edit2, Check, X, Loader2, Eye, Users, PlaySquare, Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { exportToCSV } from "@/utils/exportCsv";
import { useAuth } from "@/providers/AuthProvider";
import { useCampaignFilter } from "@/providers/CampaignFilterProvider";

const supabase = createClient();

export default function CampaignPerformaClient({ campaignId }: { campaignId: number }) {
  const router = useRouter();

  const { canEditCampaign } = useAuth();
  const hasAccess = canEditCampaign(campaignId);

  const [campaign, setCampaign] = useState<any>(null);
  const [rpcPerformance, setRpcPerformance] = useState<any>(null);
  const [baseCreatorStats, setBaseCreatorStats] = useState<any[]>([]);
  const [localCreators, setLocalCreators] = useState<any[]>([]);
  const [initialTotalAdsGmv, setInitialTotalAdsGmv] = useState(0);
  const [initialTotalAdsGmvUsd, setInitialTotalAdsGmvUsd] = useState(0);
  const [initialTotalAdsSpend, setInitialTotalAdsSpend] = useState(0);
  const [initialMappedAdsGmv, setInitialMappedAdsGmv] = useState(0);
  const [adsPerf, setAdsPerf] = useState<any[]>([]);
  const [initialTotalOrganic, setInitialTotalOrganic] = useState(0);
  const [initialUnattributedGmv, setInitialUnattributedGmv] = useState(0);
  const [initialTotalViews, setInitialTotalViews] = useState(0);
  const [initialTotalLikes, setInitialTotalLikes] = useState(0);
  const [initialTotalVideos, setInitialTotalVideos] = useState(0);
  const [initialTotalLivestreams, setInitialTotalLivestreams] = useState(0);
  const [hasSkus, setHasSkus] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [showAdsDetail, setShowAdsDetail] = useState(false);
  const [editingKursId, setEditingKursId] = useState<number | null>(null);
  const [editKursValue, setEditKursValue] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fastCountsData, setFastCountsData] = useState<{ approved: number; pending: number; all: number } | null>(null);
  const [fastVideoCountsData, setFastVideoCountsData] = useState<{ approved: number; pending: number; livestream: number } | null>(null);
  const [masterConcepts, setMasterConcepts] = useState<any[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<any>(null);

  // Filter Creator State from Global Context
  const { appliedFilterType, appliedFilterUsernames } = useCampaignFilter();

  const fetchData = async () => {
    setIsRefreshing(true);
    await _fetchDataInner().catch(fetchErr => {
      console.error(fetchErr);
    }).finally(() => {
      setIsLoading(false);
      setIsRefreshing(false);
    });
  };

  const _fetchDataInner = async () => {
      // 1. Phase 1: Fast indexed queries (campaign, skus, concepts, counts)
      const [
        campaignRes,
        conceptsRes,
        skusRes,
        salesCountRes,
        adsCountRes,
        countsRes,
        videoCountsRes,
        perfSummaryRes,
        creatorPerfRes,
        orgCountRes,
        ccCountRes,
        vidCountRes
      ] = await Promise.all([
        supabase.from('campaigns').select('*').eq('id', campaignId).single(),
        supabase.from('campaign_concepts').select('*, skus(nama_produk)').eq('campaign_id', campaignId).order('no_konsep', { ascending: true }),
        supabase.from('skus').select('id, product_id').eq('campaign_id', campaignId),
        supabase.from('sales').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId),
        supabase.from('ads_performance').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId),
        supabase.rpc('get_campaign_creator_counts', { p_campaign_id: campaignId }),
        supabase.rpc('get_campaign_video_counts_fast', { p_campaign_id: campaignId }),
        supabase.rpc('get_performance_summary_v2', { p_campaign_id: campaignId }),
        supabase.rpc('get_campaign_creator_performance', { p_campaign_id: campaignId }),
        supabase.from('organic_videos').select('id', { count: 'planned', head: true }).eq('campaign_id', campaignId),
        supabase.from('campaign_creators').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).in('approval', ['approved', 'pending', 'alternate']),
        supabase.from('videos').select('id, campaign_creators!inner(campaign_id)', { count: 'exact', head: true }).eq('campaign_creators.campaign_id', campaignId)
      ]);

      if (campaignRes.data) setCampaign(campaignRes.data);
      if (conceptsRes.data) {
        const sortedConcepts = [...conceptsRes.data].sort((a: any, b: any) => (Number(a.no_konsep) || 0) - (Number(b.no_konsep) || 0));
        setMasterConcepts(sortedConcepts);
      }

      const skuList = (skusRes.data || []).map((s: any) => s.product_id).filter(Boolean);
      const campaignSkuIds = new Set((skusRes.data || []).map((s: any) => s.id).filter(Boolean));
      const currentHasSkus = skuList.length > 0;
      setHasSkus(currentHasSkus);

      const rpcSummary = perfSummaryRes?.data?.[0] || null;
      if (rpcSummary) {
        setRpcPerformance(rpcSummary);
        if (currentHasSkus) {
          setInitialTotalViews(Number(rpcSummary.total_views || 0));
          setInitialTotalLikes(Number(rpcSummary.total_likes || 0));
          setInitialTotalVideos(Number(rpcSummary.total_videos || 0));
          setInitialTotalOrganic(Number(rpcSummary.organic_gmv || 0));
          setInitialUnattributedGmv(Number(rpcSummary.unattributed_gmv || 0));
        } else {
          setInitialTotalViews(0);
          setInitialTotalLikes(0);
          setInitialTotalVideos(0);
          setInitialTotalOrganic(0);
          setInitialUnattributedGmv(0);
        }
      } else if (currentHasSkus && creatorPerfRes?.data && Array.isArray(creatorPerfRes.data)) {
        // Fallback: if get_performance_summary_v2 timed out on Supabase, pre-populate totals from creatorPerfRes
        let sumViews = 0, sumLikes = 0, sumVids = 0, sumGmv = 0;
        creatorPerfRes.data.forEach((cp: any) => {
          sumViews += Number(cp.video_views || 0);
          sumLikes += Number(cp.video_likes || 0);
          sumVids += Number(cp.video_count || 0);
          sumGmv += Number(cp.gmv_organic || 0);
        });
        setInitialTotalViews(sumViews);
        setInitialTotalLikes(sumLikes);
        setInitialTotalVideos(sumVids);
        setInitialTotalOrganic(sumGmv);
      } else {
        setInitialTotalViews(0);
        setInitialTotalLikes(0);
        setInitialTotalVideos(0);
        setInitialTotalOrganic(0);
        setInitialUnattributedGmv(0);
      }

      // Fast creator counts
      let fastCounts = { approved: 0, pending: 0, all: 0 };
      if (countsRes.data && countsRes.data.length > 0) {
        fastCounts = {
          approved: Number(countsRes.data[0].approved || 0),
          pending: Number(countsRes.data[0].pending || 0),
          all: Number(countsRes.data[0].total || 0),
        };
      }
      setFastCountsData(fastCounts);

      // Fast video counts - ONLY valid if campaign has registered SKUs and RPC returned valid numbers
      let fastVideoCounts = null;
      if (currentHasSkus && videoCountsRes.data && videoCountsRes.data.length > 0) {
        const d = videoCountsRes.data[0];
        if (Number(d.total_approved || 0) > 0 || Number(d.total_livestream || 0) > 0) {
          fastVideoCounts = {
            approved: Number(d.total_approved || 0),
            pending: Number(d.total_pending || 0),
            livestream: Number(d.total_livestream || 0),
          };
        }
      }
      setFastVideoCountsData(fastVideoCounts);

      // 2. Phase 2: Fetch creators, videos, sales, ads in parallel batches, and organic_videos in controlled chunks
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

      // Fetch organic_videos reliably in batches until finished without relying on count
      const fetchOrgVideosChunked = async () => {
        const results: any[] = [];
        let from = 0;
        const size = 1000;
        while (true) {
          const res = await supabase
            .from('organic_videos')
            .select('content_uid, post_time, content_type, creator_username, video_views, video_likes, product_id')
            .eq('campaign_id', campaignId)
            .range(from, from + size - 1);
          if (res.error || !res.data || res.data.length === 0) break;
          results.push(...res.data);
          if (res.data.length < size) break;
          from += size;
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
      setLocalCreators(ccData);

      // 3. Fast In-Memory Aggregation of Sales and Organic Videos
      const approvedUsernames = new Set<string>();
      for (const cc of ccData) {
        const u = cc.creators?.username?.toLowerCase();
        if (u && (cc.approval === 'approved' || cc.approval === 'alternate')) {
          approvedUsernames.add(u);
        }
      }

      const skuSet = new Set<string>((skusRes.data || []).map((s: any) => s.product_id).filter(Boolean));
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
      if (currentHasSkus && creatorPerfRes?.data && Array.isArray(creatorPerfRes.data)) {
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

      if (currentHasSkus) {
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
      if (currentHasSkus) {
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
      let calcUniqueLivestreams = 0;

      if (currentHasSkus && orgVidsData.length > 0) {
        for (const perf of perfMap.values()) {
          perf.video_views = 0;
          perf.video_likes = 0;
        }

        for (const [uid, v] of orgUidMap.entries()) {
          if (v.contentType !== 'livestream' && v.contentType !== 'live') {
            calcUniqueVideos++;
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
        }

        for (const perf of perfMap.values()) {
          if (perf.video_uids.size > 0) perf.video_count = perf.video_uids.size;
          if (perf.live_uids.size > 0) perf.live_count = perf.live_uids.size;
        }

        setInitialTotalViews(calcTotalViews);
        setInitialTotalLikes(calcTotalLikes);
        setInitialTotalVideos(calcUniqueVideos);
        setInitialTotalLivestreams(calcUniqueLivestreams);
      }

      setInitialTotalOrganic(calcOrganicGmv);
      setInitialUnattributedGmv(calcUnattributedGmv);

      const videoGmvData = currentHasSkus
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
      
      const adsStatsByCreator: Record<number, { gmvAds: number, costAds: number, itemsSoldAds: number }> = {};
      let globalAdsGmv = 0;
      let globalAdsGmvUsd = 0;
      let globalAdsSpend = 0;
      let mappedAdsGmv = 0;
      let unmappedAdsGmvVal = 0;
      let unmappedAdsCostVal = 0;
      let unmappedAdsItemsSoldVal = 0;

      for (const ad of latestAdsMap.values()) {
        let kurs = ad.kurs || 16000;
        if (kurs < 1000) kurs = kurs * 1000;
        
        globalAdsGmv += (ad.gross_revenue_usd || 0) * kurs;
        globalAdsGmvUsd += (ad.gross_revenue_usd || 0);
        globalAdsSpend += (ad.cost_usd || 0);

        if (ad.creator_id) {
          mappedAdsGmv += (ad.gross_revenue_usd || 0) * kurs;
          if (!adsStatsByCreator[ad.creator_id]) {
            adsStatsByCreator[ad.creator_id] = { gmvAds: 0, costAds: 0, itemsSoldAds: 0 };
          }
          adsStatsByCreator[ad.creator_id].gmvAds += (ad.gross_revenue_usd || 0) * kurs;
          adsStatsByCreator[ad.creator_id].costAds += (ad.cost_usd || 0) * kurs;
          adsStatsByCreator[ad.creator_id].itemsSoldAds += (ad.purchases || 0);
        } else {
          unmappedAdsGmvVal += (ad.gross_revenue_usd || 0) * kurs;
          unmappedAdsCostVal += (ad.cost_usd || 0) * kurs;
          unmappedAdsItemsSoldVal += (ad.purchases || 0);
        }
      }

      setInitialTotalAdsGmv(globalAdsGmv);
      setInitialTotalAdsGmvUsd(globalAdsGmvUsd);
      setInitialTotalAdsSpend(globalAdsSpend);
      setInitialMappedAdsGmv(mappedAdsGmv);
      setAdsPerf(Array.from(latestAdsMap.values()));

      const computedStats = ccData.map((cc: any) => {
        const creator = Array.isArray(cc.creators) ? cc.creators[0] : cc.creators;
        const snap = creator?.creator_snapshots 
          ? (Array.isArray(creator.creator_snapshots) ? creator.creator_snapshots[0] : creator.creator_snapshots)
          : null;
        const username = creator?.username || 'Unknown';

        const usernameLower = username.toLowerCase();
        const perf = perfMap.get(usernameLower) || { gmv_organic: 0, items_sold: 0, video_views: 0, video_likes: 0, video_count: 0 };

        const gmvOrganic = perf.gmv_organic || 0;
        const itemsSold = perf.items_sold || 0;
        const videoViews = perf.video_views || 0;
        const videoLikes = perf.video_likes || 0;
        const trackedVideos = perf.video_count || 0;
        const trackedLives = perf.live_count || 0;
        
        const aggregatedAds = adsStatsByCreator[creator?.id] || { gmvAds: 0, costAds: 0, itemsSoldAds: 0 };
        const gmvAds = aggregatedAds.gmvAds;
        const costAds = aggregatedAds.costAds;
        const itemsSoldAds = aggregatedAds.itemsSoldAds || 0;
        
        const totalGmv = gmvOrganic + gmvAds;
        const roas = costAds > 0 ? (gmvAds / costAds).toFixed(2) : '-';

        const autoSalesVideos = videoGmvData?.filter((v: any) => v.creator_username === username) || [];
        const dbVideos = currentHasSkus ? (cc.videos || []).filter((v: any) => {
          if (campaignSkuIds.size > 0 && v.sku_id && !campaignSkuIds.has(v.sku_id)) return false;
          return true;
        }) : [];
        const uniqueVideoIds = new Map<string, string>(); 
        const uniqueLiveIds = new Set<string>();

        if (currentHasSkus) {
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
        
        if (currentHasSkus) {
          if (cc.approval === 'pending') {
              pendingVtCount = Math.max(trackedVideos || 0, uniqueVideoIds.size);
          } else {
              approvedVtCount = Math.max(trackedVideos || 0, uniqueVideoIds.size);
              pendingVtCount = 0;
          }
        }

        const totalVt = approvedVtCount + pendingVtCount;
        const totalLive = currentHasSkus ? Math.max(trackedLives, uniqueLiveIds.size) : 0;

        const conceptsSet = new Set<string>();
        dbVideos.forEach((v: any) => {
           if (v.concept) conceptsSet.add(v.concept);
        });
        const concepts = Array.from(conceptsSet);

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
          approvedVtCount,
          pendingVtCount,
          totalLive,
          concepts
        };
      });

      if (unmappedAdsGmvVal > 0 || unmappedAdsCostVal > 0 || unmappedAdsItemsSoldVal > 0) {
        computedStats.push({
          id: -1,
          creator_id: -1,
          approval: 'approved',
          username: 'UNMAPPED',
          followers: 0,
          gmvOrganic: 0,
          gmvAds: unmappedAdsGmvVal,
          costAds: unmappedAdsCostVal,
          roas: unmappedAdsCostVal > 0 ? (unmappedAdsGmvVal / unmappedAdsCostVal).toFixed(2) : '-',
          totalGmv: unmappedAdsGmvVal,
          itemsSold: 0,
          itemsSoldAds: unmappedAdsItemsSoldVal,
          videoViews: 0,
          videoLikes: 0,
          totalVt: 0,
          totalLive: 0
        });
      }

      setBaseCreatorStats(computedStats);
  };

  useEffect(() => {
    fetchData();
  }, [campaignId]);

  // Real-time subscription to 'sales' table
  useEffect(() => {
    if (!campaignId) return;
    
    const channel = supabase.channel('realtime_sales_updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'sales', 
        filter: `campaign_id=eq.${campaignId}` 
      }, () => {
        fetchData();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  const handleUpdateKurs = async (id: number) => {
    const numKurs = Number(editKursValue);
    if (!numKurs || numKurs <= 0) {
      alert("Kurs tidak valid!");
      return;
    }
    const { error } = await supabase.from('ads_performance').update({ kurs: numKurs }).eq('id', id);
    if (error) {
      alert("Gagal update kurs: " + error.message);
    } else {
      setAdsPerf(adsPerf.map(a => a.id === id ? { ...a, kurs: numKurs } : a));
      fetchData(); // Fetch Data again to recalculate baseCreatorStats and totals
    }
    setEditingKursId(null);
  };

  const handleExport = () => {
    const exportData = creatorStats.map(c => ({
      'Username': c.username,
      'GMV Organic': c.gmvOrganic,
      'GMV Ads': c.gmvAds,
      'Total GMV': c.totalGmv,
      'Total Views': c.videoViews,
      'Total VT': c.totalVt
    }));
    exportToCSV(exportData, `campaign_${campaignId}_performance`);
  };

  const creatorStats = React.useMemo(() => {
    if (appliedFilterType === 'none' || appliedFilterUsernames.length === 0) return baseCreatorStats;
    return baseCreatorStats.filter(c => {
      const match = appliedFilterUsernames.includes(c.username.toLowerCase());
      return appliedFilterType === 'include' ? match : !match;
    });
  }, [baseCreatorStats, appliedFilterType, appliedFilterUsernames]);

  const [sortField, setSortField] = useState<'username' | 'gmvOrganic' | 'gmvAds' | 'totalGmv' | 'totalVt' | 'totalLive' | 'videoViews'>('totalGmv');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortField, sortOrder]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="ml-3 text-slate-500 font-medium">Memuat dan Mengkalkulasi Data...</span>
      </div>
    );
  }

  if (!campaign) return <div className="text-center p-12 text-slate-500">Campaign tidak ditemukan</div>;

  const isAwareness = campaign.tipe_campaign === 'awareness' || campaign.tipe_campaign === 'gmv_awareness';
  const rpc = rpcPerformance || {};
  const totalSales = rpc;
  const isFiltered = appliedFilterType !== 'none' && appliedFilterUsernames.length > 0;

  let fbViews = 0, fbLikes = 0, fbVideos = 0, fbLivestreams = 0, fbOrganic = 0, fbAds = 0, fbAllGmv = 0, fbWithVideo = 0, fbWithLive = 0;
  let fbApprovedVideos = 0, fbPendingVideos = 0, pendingCreatorsWithVideosCount = 0;
  let fbApprovedCreators = 0, fbPendingCreators = 0;

  creatorStats.forEach(c => {
    fbViews += c.videoViews || 0;
    fbLikes += c.videoLikes || 0;
    fbVideos += c.totalVt || 0;
    fbLivestreams += c.totalLive || 0;
    fbOrganic += c.gmvOrganic || 0;
    fbAds += c.gmvAds || 0;
    fbAllGmv += c.totalGmv || 0;
    if (c.totalVt > 0) fbWithVideo++;
    if (c.totalLive > 0) fbWithLive++;
    
    // Fallback if these don't exist
    fbApprovedVideos += c.approvedVtCount || c.totalVt || 0;
    fbPendingVideos += c.pendingVtCount || 0;
    if ((c.pendingVtCount || 0) > 0) pendingCreatorsWithVideosCount++;
    if (c.approval === 'approved') fbApprovedCreators++;
    if (c.approval === 'pending') fbPendingCreators++;
  });

  const totalApprovedCreators = isFiltered 
    ? fbApprovedCreators 
    : (fastCountsData ? fastCountsData.approved : (rpc.total_approved_creators !== undefined ? Number(rpc.total_approved_creators) : localCreators.filter(c => c.approval === 'approved').length));

  const totalPendingCreators = isFiltered 
    ? fbPendingCreators 
    : (fastCountsData ? fastCountsData.pending : (rpc.total_pending_creators !== undefined ? Number(rpc.total_pending_creators) : localCreators.filter(c => c.approval === 'pending').length));

  const handleSort = (field: any) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  let filteredCreatorStats = creatorStats.filter(c => c.username.toLowerCase().includes(searchQuery.toLowerCase()));

  filteredCreatorStats = filteredCreatorStats.sort((a, b) => {
    let comparison = 0;
    if (sortField === 'username') comparison = a.username.localeCompare(b.username);
    else if (sortField === 'gmvOrganic') comparison = a.gmvOrganic - b.gmvOrganic;
    else if (sortField === 'gmvAds') comparison = a.gmvAds - b.gmvAds;
    else if (sortField === 'totalGmv') {
       comparison = a.totalGmv - b.totalGmv;
       if (comparison === 0) {
          comparison = a.totalVt - b.totalVt;
          if (comparison === 0) {
             comparison = a.totalLive - b.totalLive;
          }
       }
    }
    else if (sortField === 'totalVt') comparison = a.totalVt - b.totalVt;
    else if (sortField === 'totalLive') comparison = a.totalLive - b.totalLive;
    else if (sortField === 'videoViews') comparison = a.videoViews - b.videoViews;

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const totalPages = Math.ceil(filteredCreatorStats.length / pageSize);
  const paginatedStats = filteredCreatorStats.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Aggregation moved up to prevent TDZ

  const totalApprovedVideos = !hasSkus ? 0 : (isFiltered 
    ? fbApprovedVideos 
    : (fastVideoCountsData && fastVideoCountsData.approved > 0 
        ? fastVideoCountsData.approved 
        : (initialTotalVideos || Number(rpcPerformance?.total_videos || 0) || fbApprovedVideos)));

  const totalPendingVideos = !hasSkus ? 0 : (isFiltered 
    ? fbPendingVideos 
    : (fastVideoCountsData ? fastVideoCountsData.pending : fbPendingVideos));

  const totalCampaignLivestreams = !hasSkus ? 0 : (isFiltered 
    ? fbLivestreams 
    : (fastVideoCountsData && fastVideoCountsData.livestream > 0 
        ? fastVideoCountsData.livestream 
        : (initialTotalLivestreams > 0 
            ? initialTotalLivestreams 
            : (Number(totalSales?.totalLivestreams || 0) || fbLivestreams))));

  const totalOrganic = !hasSkus ? 0 : (isFiltered ? fbOrganic : (initialTotalOrganic || fbOrganic));
  // Total Ads GMV = ALL ads in this campaign (global, same as Ads Report page)
  // Always use client-side calculation for consistency with Ads Report
  const totalAdsGmv = isFiltered ? fbAds : initialTotalAdsGmv; 
  // Mapped Ads GMV = only ads linked to a creator in campaign_creators
  const mappedAdsGmv = isFiltered ? fbAds : initialMappedAdsGmv;
  const unmappedAdsGmv = Math.max(0, totalAdsGmv - mappedAdsGmv);
  
  const unattributedGmv = !hasSkus ? 0 : (isFiltered ? 0 : initialUnattributedGmv);
  
  // Total All = Approved GMV (totalOrganic) + Ads GMV
  // As per user request: unattributed GMV is kept separate and NOT included in Total Achievement
  const totalAllGmv = totalOrganic + totalAdsGmv;
  const percentCapai = campaign?.target_gmv ? Math.round((totalAllGmv / campaign.target_gmv) * 100) : 0;
  
  const trackedOrganic = totalOrganic;
  const attributionGap = unattributedGmv;
  const gapPercentage = totalOrganic > 0 ? Math.round((attributionGap / (totalOrganic + attributionGap)) * 100) : 0;

  const totalCampaignViews = !hasSkus ? 0 : (isFiltered ? fbViews : (initialTotalViews || Number(rpcPerformance?.total_views || 0) || fbViews));
  const totalCampaignLikes = !hasSkus ? 0 : (isFiltered ? fbLikes : (initialTotalLikes || Number(rpcPerformance?.total_likes || 0) || fbLikes));
  const totalCampaignVideos = !hasSkus ? 0 : (isFiltered 
    ? fbVideos 
    : (fastVideoCountsData && (fastVideoCountsData.approved + fastVideoCountsData.pending) > 0
        ? (fastVideoCountsData.approved + fastVideoCountsData.pending)
        : (initialTotalVideos || Number(rpcPerformance?.total_videos || 0) || fbVideos)));
  
  const creatorsWithVideo = !hasSkus ? 0 : (isFiltered ? fbWithVideo : Number(totalSales?.creatorsWithVideo || fbWithVideo));
  const creatorsWithLive = !hasSkus ? 0 : (isFiltered ? fbWithLive : Number(totalSales?.creatorsWithLive || fbWithLive));
  
  const targetVideo = campaign.target_video || 0;
  const percentCapaiVideo = targetVideo > 0 ? Math.round((totalCampaignVideos / targetVideo) * 100) : 0;
  
  const targetCreator = campaign.target_creator || 0;
  const percentCapaiCreator = targetCreator > 0 ? Math.round((totalApprovedCreators / targetCreator) * 100) : 0;

  const formatCompactNumber = (num: number | undefined) => {
    if (num === undefined || isNaN(num)) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  return (
    <div className="space-y-[32px]">
      <div className="flex justify-between items-center mb-[24px] gap-[16px] flex-wrap">
        <div>
          <h2 className="text-[20px] font-bold">
            {isAwareness ? "Performa Awareness Campaign" : "Performa Sales Campaign"}
          </h2>
          <p className="text-[13px] text-text-soft">Analitik 100% otomatis dari data impor secara <span className="font-bold text-green-600 border-b border-green-600">Real-Time</span>.</p>
        </div>
        <button className="btn btn-outline" onClick={handleExport}>
          <Download className="ico" /> Export CSV
        </button>
      </div>

      <div className="flex flex-col gap-[24px]">
        {/* === SECTION: AWARENESS METRICS === */}
        <div className={`grid grid-cols-1 md:grid-cols-4 gap-[24px] ${!isAwareness ? 'order-2' : 'order-1'}`}>
          <div className={`ccard relative overflow-hidden md:col-span-2 ${isAwareness ? 'bg-gradient-to-br from-indigo-50 to-blue-100/50 border-indigo-100' : 'bg-white border-line'}`}>
            {isRefreshing && (
               <div className="absolute top-[8px] right-[8px] flex items-center justify-center bg-white/80 p-[6px] rounded-full shadow-sm">
                  <Loader2 className={`w-3 h-3 animate-spin ${isAwareness ? 'text-indigo-600' : 'text-slate-500'}`} />
               </div>
            )}
            <div className="p-[24px]">
              <div className="flex justify-between items-start">
                <div>
                  <p className={`text-[13px] font-medium ${isAwareness ? 'text-indigo-800' : 'text-text-soft'}`}>Total Keseluruhan Views</p>
                  <h3 className={`text-[32px] font-bold mt-[8px] ${isAwareness ? 'text-indigo-900' : 'text-text'}`}>{totalCampaignViews.toLocaleString()}</h3>
                  <p className={`text-[11px] font-semibold mt-[4px] ${isAwareness ? 'text-indigo-700/80' : 'text-text-soft'}`}>Dihitung dari {totalCampaignVideos} video unik</p>
                </div>
                <div className={`p-[16px] rounded-[12px] shadow-sm ${isAwareness ? 'bg-white text-indigo-600' : 'bg-slate-50 text-slate-500'}`}><Eye className="w-8 h-8" /></div>
              </div>
              <div className={`mt-[24px] pt-[16px] border-t flex gap-[24px] ${isAwareness ? 'border-indigo-200/50' : 'border-line'}`}>
                <div>
                  <p className={`text-[11px] font-medium ${isAwareness ? 'text-indigo-600' : 'text-text-soft'}`}>Total Likes</p>
                  <p className={`font-bold ${isAwareness ? 'text-indigo-900' : 'text-text'}`}>{totalCampaignLikes.toLocaleString()}</p>
                </div>
                <div>
                  <p className={`text-[11px] font-medium ${isAwareness ? 'text-indigo-600' : 'text-text-soft'}`}>Rata-rata Views / Video</p>
                  <p className={`font-bold ${isAwareness ? 'text-indigo-900' : 'text-text'}`}>
                    {totalCampaignVideos > 0 ? Math.round(totalCampaignViews / totalCampaignVideos).toLocaleString() : 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="ccard">
            <div className="p-[24px]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[13px] font-medium text-text-soft">Pencapaian Target Creator</p>
                  <h3 className="text-[24px] font-bold mt-[8px] text-text flex items-center gap-2">
                    {totalApprovedCreators} 
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">kreator approved</span>
                  </h3>
                  <div className="flex items-center gap-3 text-[12px] mt-[6px] text-text-soft">
                    <span className="flex items-center gap-2">
                      {totalPendingCreators}
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">kreator pending</span>
                    </span>
                  </div>
                </div>
                <div className="p-[8px] bg-orange-50 rounded-[8px] text-orange-600"><Users className="w-5 h-5" /></div>
              </div>
              {targetCreator > 0 && (
                <div className="mt-[16px] pt-[16px] border-t border-line">
                  <div className="flex justify-between text-[11px] text-text-soft mb-[4px] font-medium">
                    <span>Target Total Kreator: {targetCreator}</span>
                    <span>{percentCapaiCreator}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-[6px] flex overflow-hidden">
                    <div className="bg-orange-500 h-[6px] transition-all duration-1000" style={{ width: `${Math.min(percentCapaiCreator, 100)}%` }}></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="ccard">
            <div className="p-[24px]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[13px] font-medium text-text-soft">Pencapaian Target Video</p>
                  <h3 className="text-[24px] font-bold mt-[8px] text-text">{totalApprovedVideos.toLocaleString()} <span className="text-[13px] text-text-soft font-normal">video approved</span></h3>
                  <div className="flex items-center gap-3 text-[11px] mt-[4px] text-text-soft">
                    <span>
                      {totalPendingVideos > 0 
                        ? `${totalPendingVideos.toLocaleString()} video pending dari ${pendingCreatorsWithVideosCount} kreator` 
                        : '0 video pending'}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-text-soft mt-[4px]">{totalCampaignLivestreams.toLocaleString()} <span className="font-normal">livestream</span></p>
                </div>
                <div className="p-[8px] bg-rose-50 rounded-[8px] text-rose-600"><PlaySquare className="w-5 h-5" /></div>
              </div>
              {targetVideo > 0 && (
                <div className="mt-[16px] pt-[16px] border-t border-line">
                  <div className="flex justify-between text-[11px] text-text-soft mb-[4px] font-medium">
                    <span>Target: {targetVideo} Video</span>
                    <span>{percentCapaiVideo}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-[6px] flex overflow-hidden">
                    <div className="bg-rose-500 h-[6px] transition-all duration-1000" style={{ width: `${Math.min(percentCapaiVideo, 100)}%` }}></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* === SECTION: SALES METRICS === */}
        <div className={`grid grid-cols-1 md:grid-cols-4 gap-[24px] ${!isAwareness ? 'order-1' : 'order-2'}`}>
          <div className={`ccard relative overflow-hidden ${!isAwareness ? 'bg-gradient-to-br from-green-50 to-emerald-100/50 border-green-100' : 'bg-white border-line'}`}>
            {isRefreshing && (
               <div className="absolute top-[8px] right-[8px] flex items-center justify-center bg-white/80 p-[6px] rounded-full shadow-sm">
                  <Loader2 className={`w-3 h-3 animate-spin ${!isAwareness ? 'text-green-600' : 'text-slate-500'}`} />
               </div>
            )}
            <div className="p-[24px]">
              <div className="flex justify-between items-start">
                <div>
                  <p className={`text-[13px] font-medium ${!isAwareness ? 'text-green-800' : 'text-text-soft'}`}>Total Achievement (All)</p>
                  <h3 className={`text-[24px] font-bold mt-[8px] ${!isAwareness ? 'text-green-900' : 'text-text'}`}>Rp {(totalAllGmv / 1000000).toFixed(1)}M</h3>
                  <p className={`text-[11px] font-semibold mt-[4px] ${!isAwareness ? 'text-green-700/80' : 'text-text-soft'}`}>Rp {totalAllGmv.toLocaleString()}</p>
                </div>
                <div className={`p-[12px] rounded-[12px] shadow-sm ${!isAwareness ? 'bg-white text-green-600' : 'bg-slate-50 text-slate-500'}`}><TrendingUp className="w-6 h-6" /></div>
              </div>
              {campaign.target_gmv && (
                <div className={`mt-[16px] pt-[16px] border-t ${!isAwareness ? 'border-green-200/50' : 'border-line'}`}>
                  <div className={`flex justify-between text-[11px] mb-[4px] font-medium ${!isAwareness ? 'text-green-800' : 'text-text-soft'}`}>
                    <span>Target: Rp {(campaign.target_gmv / 1000000).toFixed(1)}M</span>
                    <span>{percentCapai}%</span>
                  </div>
                  <div className={`w-full rounded-full h-[6px] ${!isAwareness ? 'bg-green-200/50' : 'bg-slate-100'}`}>
                    <div className="bg-green-600 h-[6px] rounded-full transition-all duration-1000" style={{ width: `${Math.min(percentCapai, 100)}%` }}></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="ccard">
            <div className="p-[24px]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[13px] font-medium text-text-soft">GMV Organik</p>
                  <h3 className="text-[24px] font-bold mt-[8px] text-text">Rp {(totalOrganic / 1000000).toFixed(1)}M</h3>
                  <p className="text-[11px] font-semibold text-text-soft mt-[4px]">Rp {totalOrganic.toLocaleString()}</p>
                  <p className="text-[11px] text-text-soft mt-[4px]">Total dari CSV Penjualan</p>
                </div>
                <div className="p-[8px] bg-blue-50 rounded-[8px] text-blue-600"><Activity className="w-5 h-5" /></div>
              </div>
            </div>
          </div>

          <div className="ccard">
            <div className="p-[24px]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[13px] font-medium text-text-soft">GMV Ads (Global Campaign)</p>
                  <h3 className="text-[24px] font-bold mt-[8px] text-text">Rp {(totalAdsGmv / 1000000).toFixed(1)}M</h3>
                  <p className="text-[11px] font-semibold text-text-soft mt-[4px]">Rp {totalAdsGmv.toLocaleString()}</p>
                  <div className="flex gap-2 mt-[2px]">
                    <p className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 inline-block px-1.5 py-0.5 rounded">Spend: ${initialTotalAdsSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 inline-block px-1.5 py-0.5 rounded">GMV: ${initialTotalAdsGmvUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <div className="p-[8px] bg-purple-50 rounded-[8px] text-purple-600"><BarChart3 className="w-5 h-5" /></div>
              </div>
              <div className="mt-[16px] pt-[16px] border-t border-line space-y-2">
                <div className="flex justify-between text-[11px] font-medium">
                  <span className="text-emerald-700">Terpetakan ke Kreator:</span>
                  <span className="text-emerald-700">Rp {mappedAdsGmv.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px] font-medium">
                  <span className="text-amber-600">Belum Terpetakan:</span>
                  <span className="text-amber-600">Rp {unmappedAdsGmv.toLocaleString()}</span>
                </div>
                <div className="w-full bg-amber-100 rounded-full h-[6px] flex overflow-hidden mt-1">
                  <div className="bg-emerald-500 h-[6px] transition-all duration-1000" style={{ width: `${totalAdsGmv > 0 ? (mappedAdsGmv / totalAdsGmv) * 100 : 0}%` }}></div>
                </div>
                <p className="text-[10px] text-text-soft">Total di tabel bawah hanya menjumlahkan yang terpetakan (Mapped).</p>
              </div>
            </div>
          </div>

          <div className="ccard">
            <div className="p-[24px]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[13px] font-medium text-text-soft">Unattributed GMV (Gap)</p>
                  <h3 className={`text-[24px] font-bold mt-[8px] ${attributionGap > 0 ? 'text-red-600' : 'text-green-600'}`}>Rp {(attributionGap / 1000000).toFixed(1)}M</h3>
                  <p className={`text-[11px] font-semibold mt-[4px] ${attributionGap > 0 ? 'text-red-500/80' : 'text-green-600/80'}`}>Rp {attributionGap.toLocaleString()}</p>
                  <p className="text-[11px] text-text-soft mt-[4px]">{gapPercentage}% nyangkut di kreator Pending</p>
                </div>
                <div className={`p-[8px] rounded-[8px] ${attributionGap > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                  <Activity className="w-5 h-5" />
                </div>
              </div>
              {totalOrganic > 0 && (
                <div className="mt-[16px] pt-[16px] border-t border-line">
                  <div className="flex justify-between text-[11px] text-text-soft mb-[4px]">
                    <span>Tracked (Approved): Rp {(trackedOrganic / 1000000).toFixed(1)}M</span>
                    <span>{100 - gapPercentage}%</span>
                  </div>
                  <div className="w-full bg-red-100 rounded-full h-[6px] flex overflow-hidden">
                    <div className="bg-green-500 h-[6px] transition-all duration-1000" style={{ width: `${100 - gapPercentage}%` }}></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Accordion Detail Ads Performance */}
      <div className="ccard overflow-hidden !p-0">
        <div 
          className="p-[16px] bg-slate-50 border-b border-line flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
          onClick={() => setShowAdsDetail(!showAdsDetail)}
        >
          <div className="flex items-center gap-[12px]">
            {showAdsDetail ? <ChevronDown className="w-5 h-5 text-text-soft" /> : <ChevronRight className="w-5 h-5 text-text-soft" />}
            <div>
              <h3 className="font-bold text-text">Laporan Detail Iklan (Ads Performance)</h3>
              <p className="text-[12px] text-text-soft font-medium">Berdasarkan file yang diimpor dari TikTok Ads Manager</p>
            </div>
          </div>
          <div className="bg-indigo-50 text-indigo-700 px-[12px] py-[4px] rounded-full text-[12px] font-bold border border-indigo-100">
            {adsPerf.length} Data Iklan
          </div>
        </div>
        
        {showAdsDetail && (
          <div className="tbl-wrap !border-0 !rounded-none">
            {adsPerf.length > 0 ? (
              <table className="w-full">
                <thead className="bg-white border-b border-line">
                  <tr>
                    <th className="w-[200px]">Ad Name</th>
                    <th>Ad ID</th>
                    <th>Kreator (Mapped)</th>
                    <th className="text-right">Cost (USD)</th>
                    <th className="text-right">Revenue (USD)</th>
                    <th className="text-right">GMV (IDR)</th>
                    <th className="text-center w-[150px]">Kurs (IDR)</th>
                    <th className="text-center">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {adsPerf.map((ad, i) => {
                    const creatorUsername = ad.creators?.username;
                    const kurs = ad.kurs || 16000;
                    const adjustedKurs = kurs < 1000 ? kurs * 1000 : kurs;
                    const costUsd = ad.cost_usd || 0;
                    const revenueUsd = ad.gross_revenue_usd || 0;
                    
                    const costIdr = costUsd * adjustedKurs;
                    const revenueIdr = revenueUsd * adjustedKurs;
                    const roas = costIdr > 0 ? (revenueIdr / costIdr).toFixed(2) : '-';
                    const isEditing = editingKursId === ad.id;
                    const isMapped = !!creatorUsername;

                    return (
                      <tr key={i} className={`border-b border-line ${!isMapped ? 'bg-amber-50/30' : ''}`}>
                        <td className="font-medium text-text truncate max-w-[200px]" title={ad.ad_name}>{ad.ad_name}</td>
                        <td className="font-mono text-[12px] text-text-soft">{ad.ad_id}</td>
                        <td>
                          {isMapped 
                            ? <span className="font-medium text-indigo-600">@{creatorUsername}</span> 
                            : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">UNMAPPED</span>
                          }
                        </td>
                        <td className="text-right text-red-600 font-medium">${costUsd.toFixed(2)}</td>
                        <td className="text-right text-emerald-600 font-bold">${revenueUsd.toFixed(2)}</td>
                        <td className="text-right font-semibold text-text">Rp {revenueIdr.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</td>
                        <td className="text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-[4px]">
                              <input 
                                type="number" 
                                className="input w-20 text-center !py-[4px]" 
                                value={editKursValue} 
                                onChange={e => setEditKursValue(e.target.value)} 
                                disabled={!hasAccess}
                              />
                              {hasAccess && (
                                <>
                                  <button onClick={() => handleUpdateKurs(ad.id)} className="text-green-600 hover:text-green-800"><Check className="w-4 h-4" /></button>
                                  <button onClick={() => setEditingKursId(null)} className="text-text-soft hover:text-text"><X className="w-4 h-4" /></button>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-[8px] group">
                              <span className="font-medium">Rp {adjustedKurs.toLocaleString()}</span>
                              {hasAccess && (
                                <button 
                                  onClick={() => { setEditingKursId(ad.id); setEditKursValue(adjustedKurs.toString()); }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-text-soft hover:text-indigo-600"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="text-center font-bold text-indigo-600">{roas}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-[32px] text-center text-text-soft text-[13px]">
                Belum ada data iklan diimpor untuk campaign ini.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="ccard !p-0">
        <div className="border-b border-line bg-slate-50/50 p-[16px] flex flex-row justify-between items-center flex-wrap gap-[16px]">
          <h3 className="font-bold flex items-center gap-[8px]">
            Performa per Kreator (Approved)
            {isRefreshing && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />}
          </h3>
          <input 
            type="text" 
            placeholder="Cari username..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            className="input min-w-[200px]"
          />
        </div>
        <div className="tbl-wrap !border-0 !rounded-none">
          <table className="w-full">
            <thead className="border-b border-line">
              <tr className="hover:bg-transparent">
                <th className="py-[16px] cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('username')}>Creator <ArrowUpDown className="w-3 h-3 inline ml-[4px]"/></th>
                
                {isAwareness && (
                  <th className="py-[16px] text-center cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('videoViews')}>Views <ArrowUpDown className="w-3 h-3 inline ml-[4px]"/></th>
                )}
                
                <th className="py-[16px] text-center cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('totalVt')}>Total VT <ArrowUpDown className="w-3 h-3 inline ml-[4px]"/></th>
                <th className="py-[16px] text-center cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('totalLive')}>Total Live <ArrowUpDown className="w-3 h-3 inline ml-[4px]"/></th>
                
                {!isAwareness && (
                  <>
                    <th className="py-[16px] text-center cursor-pointer hover:bg-slate-50 transition-colors select-none">Item Sold (Org)</th>
                    <th className="py-[16px] text-center cursor-pointer hover:bg-slate-50 transition-colors select-none">Item Sold (Ads)</th>
                  </>
                )}
                
                <th className="py-[16px] text-right cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('gmvOrganic')}>GMV Organik <ArrowUpDown className="w-3 h-3 inline ml-[4px]"/></th>
                
                <th className="py-[16px] text-right cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('gmvAds')}>GMV Ads <ArrowUpDown className="w-3 h-3 inline ml-[4px]"/></th>
                <th className="py-[16px] text-right cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('totalGmv')}>Total GMV <ArrowUpDown className="w-3 h-3 inline ml-[4px]"/></th>
              </tr>
            </thead>
            <tbody>
              {filteredCreatorStats.length === 0 ? (
                <tr>
                  <td colSpan={isAwareness ? 8 : 8} className="text-center py-[32px] text-text-soft">Belum ada data kreator yang di-approve atau cocok dengan pencarian.</td>
                </tr>
              ) : (
                paginatedStats.map((c) => (
                  <tr key={c.id} className="transition-all duration-300 border-b border-line">
                    <td>
                      <div className="flex flex-col gap-1 items-start">
                        <Link href={`/creator-pool/${c.creator_id}`} className="font-semibold text-blue-600 hover:underline">
                          @{c.username}
                        </Link>
                        {c.concepts && c.concepts.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {c.concepts.map((conceptNumber: string) => (
                              <button 
                                key={conceptNumber} 
                                onClick={() => {
                                  const found = masterConcepts.find(mc => String(mc.no_konsep) === String(conceptNumber));
                                  if (found) setSelectedConcept(found);
                                }}
                                className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100/50 leading-none hover:bg-indigo-100 transition-colors"
                              >
                                Konsep #{conceptNumber}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    
                    {isAwareness && (
                      <td className="text-center font-bold text-indigo-700 bg-indigo-50/30">
                        {formatCompactNumber(c.videoViews)}
                      </td>
                    )}
                    
                    <td className="text-center text-text font-medium">
                      {c.totalVt}
                    </td>
                    <td className="text-center text-rose-500 font-medium">
                      {c.totalLive}
                    </td>
                    
                    {!isAwareness && (
                      <>
                        <td className="text-center font-bold text-text">
                          {c.itemsSold} pcs
                        </td>
                        <td className="text-center font-bold text-emerald-600">
                          {c.itemsSoldAds || 0} pcs
                        </td>
                      </>
                    )}
                    
                    <td className="text-right text-text-soft">
                      Rp {c.gmvOrganic.toLocaleString()}
                    </td>
                    <td className="text-right text-text-soft">
                      Rp {c.gmvAds.toLocaleString()}
                    </td>
                    <td className="text-right font-bold text-text">
                      Rp {c.totalGmv.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="p-[16px] border-t border-line flex items-center justify-between bg-white text-[13px]">
            <div className="text-text-soft">
              Menampilkan {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredCreatorStats.length)} dari {filteredCreatorStats.length} kreator
            </div>
            <div className="flex items-center gap-[8px]">
              <button 
                className="px-[12px] py-[6px] border border-line rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors font-medium"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >Sebelumnya</button>
              <span className="font-bold px-[8px] text-indigo-600">Hal {currentPage} / {totalPages}</span>
              <button 
                className="px-[12px] py-[6px] border border-line rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors font-medium"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >Selanjutnya</button>
            </div>
          </div>
        )}
      </div>

      {selectedConcept && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-line px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-xl font-bold text-slate-800">Detail Konsep [{selectedConcept.no_konsep}]</h3>
              <button 
                onClick={() => setSelectedConcept(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                <div className="grid grid-cols-2 gap-4 text-sm mb-4 pb-4 border-b border-slate-200">
                  <div>
                    <p className="text-slate-500 mb-1">Produk</p>
                    <p className="font-semibold">{selectedConcept.skus?.nama_produk || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-1">Tier</p>
                    <p className="font-semibold">{selectedConcept.tier || '-'}</p>
                  </div>
                </div>
                
                <h4 className="font-bold text-lg text-slate-800 mb-2">{selectedConcept.judul_konsep}</h4>
                <div className="space-y-4 mt-4">
                  <div>
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">Hook</p>
                    <p className="text-slate-700 whitespace-pre-wrap">{selectedConcept.hook}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Fitur / USP</p>
                    <p className="text-slate-700 whitespace-pre-wrap">{selectedConcept.fitur_usp}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-1">Call to Action</p>
                    <p className="text-slate-700 whitespace-pre-wrap">{selectedConcept.cta}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
