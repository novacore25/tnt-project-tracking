"use client";

import React, { useState, useEffect } from "react";
import { TrendingUp, BarChart3, Activity, ArrowUpDown, ChevronDown, ChevronRight, ChevronUp, Edit2, Check, X, Loader2, Eye, Users, PlaySquare, Download, ShoppingCart, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { exportToCSV } from "@/utils/exportCsv";
import { normalizeKurs } from "@/utils/computed";
import { useAuth } from "@/providers/AuthProvider";
import { useCampaignFilter } from "@/providers/CampaignFilterProvider";
import { fetchPerformaPageFullDataAction, updateAdsPerformanceKursAction } from "@/app/actions/campaignPageActions";

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
  const [aliasMap, setAliasMap] = useState<Record<string, string>>({});

  // Top 10 Leaderboard & Concepts Showcase States
  const [top10Tab, setTop10Tab] = useState<'gmv' | 'views' | 'er' | 'itemsSold'>('gmv');
  const [expandedConcepts, setExpandedConcepts] = useState<Record<number, boolean>>({});
  const toggleConceptExpand = (no: number) => {
    setExpandedConcepts(prev => ({ ...prev, [no]: !prev[no] }));
  };

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
      const res = await fetchPerformaPageFullDataAction(campaignId);
      if (!res.success || !res.campaign) return;

      if (res.campaign) setCampaign(res.campaign);
      if (res.concepts) {
        const sortedConcepts = [...res.concepts].sort((a: any, b: any) => (Number(a.no_konsep) || 0) - (Number(b.no_konsep) || 0));
        setMasterConcepts(sortedConcepts);
      }

      const skuList = (res.skus || []).map((s: any) => s.product_id).filter(Boolean);
      const campaignSkuIds = new Set((res.skus || []).map((s: any) => s.id).filter(Boolean));
      const currentHasSkus = skuList.length > 0;
      setHasSkus(currentHasSkus);

      const ccData = res.campaignCreators || [];
      const salesData = res.sales || [];
      const rawAdsData = res.ads || [];
      const orgVidsData = res.organicVideos || [];

      setLocalCreators(ccData);

      // 3. Fast In-Memory Aggregation of Sales and Organic Videos
      const approvedUsernames = new Set<string>();
      for (const cc of ccData) {
        const u = cc.creators?.username?.toLowerCase();
        if (u && (cc.approval === 'approved' || cc.approval === 'alternate')) {
          approvedUsernames.add(u);
        }
      }

      // Build alias-to-primary mapping so old usernames resolve to the current active username
      const aliasToPrimaryMap = new Map<string, string>();
      const aliasObj: Record<string, string> = {};
      for (const a of (res.creatorAliases || [])) {
        if (a.alias && a.primary_username) {
          aliasToPrimaryMap.set(a.alias.toLowerCase(), a.primary_username.toLowerCase());
          aliasObj[a.alias.toLowerCase()] = a.primary_username.toLowerCase();
        }
      }
      setAliasMap(aliasObj);

      // Also ensure any alias of an approved creator is recognized as approved
      for (const a of (res.creatorAliases || [])) {
        if (a.alias && a.primary_username && approvedUsernames.has(a.primary_username.toLowerCase())) {
          approvedUsernames.add(a.alias.toLowerCase());
        }
      }

      const skuSet = new Set<string>(skuList);
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

      let calcOrganicGmv = 0;
      let calcUnattributedGmv = 0;

      if (currentHasSkus) {
        salesData.forEach((s: any) => {
          if (!s.product_id || !skuSet.has(s.product_id)) return;
          const rawU = (s.creator_username || '').toLowerCase();
          const u = aliasToPrimaryMap.get(rawU) || rawU;
          const gmv = Number(s.gmv || 0);
          const qty = Number(s.quantity || 0);
          const cType = (s.content_type || '').toLowerCase();

          if (approvedUsernames.has(rawU) || approvedUsernames.has(u)) {
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

          const rawCreator = (v.creator_username || '').toLowerCase();
          const mappedCreator = aliasToPrimaryMap.get(rawCreator) || rawCreator;

          if (!orgUidMap.has(uid)) {
            orgUidMap.set(uid, {
              creator: mappedCreator,
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

      // Deduplication sets across TikTok reports and manual PIC inputs
      const allApprovedVideoIds = new Set<string>();
      const allPendingVideoIds = new Set<string>();
      const allUniqueLiveIds = new Set<string>();

      // Uid yang `organic_videos` tandai sebagai live. Dipakai untuk memisahkan
      // baris tabel `videos` yang sebenarnya livestream (keputusan owner
      // 2 Okt 2026). Tanpa ini, 654 livestream ikut terhitung sebagai video dan
      // card "Pencapaian Target Video" meleset - sudah dilaporkan ke brand.
      const liveUidSet = new Set<string>();
      for (const ov of (orgVidsData || [])) {
        if (!ov?.content_uid) continue;
        const ct = String(ov.content_type || 'video').toLowerCase();
        if (ct === 'livestream' || ct === 'live') {
          liveUidSet.add(String(ov.content_uid).trim());
        }
      }

      if (currentHasSkus) {
        for (const perf of perfMap.values()) {
          perf.video_views = 0;
          perf.video_likes = 0;
        }

        // 1. Process organic_videos from TikTok reports
        for (const [uid, v] of orgUidMap.entries()) {
          const isLive = v.contentType === 'livestream' || v.contentType === 'live';
          if (!isLive) {
            allApprovedVideoIds.add(uid);
            calcTotalViews += v.views;
            calcTotalLikes += v.likes;
          } else {
            allUniqueLiveIds.add(uid);
          }

          if (v.creator) {
            const perf = getOrCreatePerf(v.creator);
            if (!isLive) {
              perf.video_views += v.views;
              perf.video_likes += v.likes;
              perf.video_uids.add(uid);
            } else {
              perf.live_uids.add(uid);
            }
          }
        }

        // 2. Process manual videos from DB (videos table) to include real-time PIC inputs
        for (const cc of ccData) {
          const u = cc.creators?.username?.toLowerCase();
          const perf = u ? getOrCreatePerf(u) : null;
          const isApproved = cc.approval === 'approved' || cc.approval === 'alternate';
          const vids = cc.videos || [];

          for (const v of vids) {
            if (campaignSkuIds.size > 0 && v.sku_id && !campaignSkuIds.has(v.sku_id)) continue;
            const id = v.content_uid || (v.link_video ? (v.link_video.match(/video\/(\d+)/)?.[1] || v.link_video) : null);
            if (id) {
              // Pisahkan live dari video (keputusan owner 2 Okt 2026):
              // video hanya menghitung video, live hanya menghitung live.
              // Sumber kebenaran = `organic_videos.content_type`, karena
              // tabel `videos` tidak punya kolom tipe. 654 baris di tabel
              // `videos` ternyata livestream (docs/sql/58). Link video tidak
              // bisa jadi patokan: 0 link mengandung '/live/'.
              if (liveUidSet.has(id)) {
                allUniqueLiveIds.add(id);
                if (perf) perf.live_uids.add(id);
                continue;                      // BUKAN video
              }
              if (isApproved) {
                allApprovedVideoIds.add(id);
              } else {
                if (!allApprovedVideoIds.has(id)) {
                  allPendingVideoIds.add(id);
                }
              }
              if (perf) {
                perf.video_uids.add(id);
              }
            }
          }
        }

        for (const perf of perfMap.values()) {
          if (perf.video_uids.size > 0) perf.video_count = perf.video_uids.size;
          if (perf.live_uids.size > 0) perf.live_count = perf.live_uids.size;
        }

        calcUniqueVideos = allApprovedVideoIds.size;
        calcUniqueLivestreams = allUniqueLiveIds.size;

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
        const kurs = normalizeKurs(ad.kurs);
        
        const costUsd = Number(ad.cost_usd) || 0;
        const grossRevenueUsd = Number(ad.gross_revenue_usd) || 0;
        const purchases = Number(ad.purchases) || 0;

        globalAdsGmv += grossRevenueUsd * kurs;
        globalAdsGmvUsd += grossRevenueUsd;
        globalAdsSpend += costUsd;

        if (ad.creator_id) {
          mappedAdsGmv += grossRevenueUsd * kurs;
          if (!adsStatsByCreator[ad.creator_id]) {
            adsStatsByCreator[ad.creator_id] = { gmvAds: 0, costAds: 0, itemsSoldAds: 0 };
          }
          adsStatsByCreator[ad.creator_id].gmvAds += grossRevenueUsd * kurs;
          adsStatsByCreator[ad.creator_id].costAds += costUsd * kurs;
          adsStatsByCreator[ad.creator_id].itemsSoldAds += purchases;
        } else {
          unmappedAdsGmvVal += grossRevenueUsd * kurs;
          unmappedAdsCostVal += costUsd * kurs;
          unmappedAdsItemsSoldVal += purchases;
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

        // Bandingkan lowercase. `sales.creator_username` berasal dari TikTok sedangkan
        // `creators.username` diisi manual, sehingga kapitalisasi tidak selalu
        // sama. Versi lama memakai `===` sehingga video dari sales tidak ikut
        // terhitung di TOTAL VT, padahal GMV-nya sudah terhitung (yang pakai
        // toLowerCase). Akibatnya GMV dan TOTAL VT tidak konsisten.
        const autoSalesVideos = videoGmvData?.filter((v: any) => {
          const rawV = String(v.creator_username || '').toLowerCase();
          const mappedV = aliasMap[rawV] || rawV;
          return mappedV === usernameLower;
        }) || [];
        const dbVideos = currentHasSkus ? (cc.videos || []).filter((v: any) => {
          if (campaignSkuIds.size > 0 && v.sku_id && !campaignSkuIds.has(v.sku_id)) return false;
          return true;
        }) : [];
        const uniqueVideoIds = new Map<string, string>(); 
        const uniqueLiveIds = new Set<string>();

        if (currentHasSkus) {
          dbVideos.forEach((v: any) => {
            const id = v.content_uid || (v.link_video ? (v.link_video.match(/video\/(\d+)/)?.[1] || v.link_video) : null);
            if (id) {
                uniqueVideoIds.set(id, v.vt_approval || 'approved');
            }
          });

          // Also include tracked videos from TikTok reports & sales
          perf.video_uids.forEach((vid: string) => {
            if (!uniqueVideoIds.has(vid)) {
              uniqueVideoIds.set(vid, 'approved');
            }
          });
          perf.live_uids.forEach((lid: string) => {
            uniqueLiveIds.add(lid);
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
              pendingVtCount = uniqueVideoIds.size;
              approvedVtCount = 0;
          } else {
              approvedVtCount = uniqueVideoIds.size;
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

  const handleUpdateKurs = async (id: number) => {
    const numKurs = Number(editKursValue);
    if (!numKurs || numKurs <= 0) {
      alert("Kurs tidak valid!");
      return;
    }
    const res = await updateAdsPerformanceKursAction(id, numKurs);
    if (!res.success) {
      alert("Gagal update kurs: " + res.error);
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
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const formatCurrencyDisplay = (num: number | undefined) => {
    if (num === undefined || isNaN(num) || num === 0) return 'Rp 0';
    if (Math.abs(num) >= 1000000000) return `Rp ${(num / 1000000000).toFixed(2)}B`;
    if (Math.abs(num) >= 1000000) return `Rp ${(num / 1000000).toFixed(1)}M`;
    return `Rp ${num.toLocaleString('id-ID')}`;
  };

  // Performance Ratios & Metrics
  const totalItemsSold = creatorStats.reduce((sum, c) => sum + (c.itemsSold || 0), 0);
  const activeApprovedCreatorsCount = creatorStats.filter(c => 
    c.approval === 'approved' && 
    ((Number(c.totalVt) || 0) > 0 || (Number(c.totalLive) || 0) > 0)
  ).length;
  const inactiveApprovedCreatorsCount = Math.max(0, totalApprovedCreators - activeApprovedCreatorsCount);
  const revenuePerActiveCreator = activeApprovedCreatorsCount > 0 ? Math.round(totalOrganic / activeApprovedCreatorsCount) : 0;
  const revenuePerVideo = totalApprovedVideos > 0 ? Math.round(totalOrganic / totalApprovedVideos) : 0;
  const likeER = totalCampaignViews > 0 ? Number(((totalCampaignLikes / totalCampaignViews) * 100).toFixed(2)) : 0;
  const conversionRate = totalCampaignViews > 0 ? Number(((totalItemsSold / totalCampaignViews) * 100).toFixed(2)) : 0;
  const salesToLikesRatio = totalCampaignLikes > 0 ? Number(((totalItemsSold / totalCampaignLikes) * 100).toFixed(2)) : 0;

  // Top 10 Creators
  const approvedCreatorsOnly = creatorStats.filter(c => (c.approval === 'approved' || c.approval === 'alternate') && c.id !== -1);
  const top10ByGmv = [...approvedCreatorsOnly].sort((a, b) => (b.gmvOrganic || 0) - (a.gmvOrganic || 0)).slice(0, 10);
  const top10ByViews = [...approvedCreatorsOnly].sort((a, b) => (b.videoViews || 0) - (a.videoViews || 0)).slice(0, 10);
  const top10ByER = [...approvedCreatorsOnly].sort((a, b) => {
    const erA = (a.videoViews || 0) > 0 ? (a.videoLikes / a.videoViews) : 0;
    const erB = (b.videoViews || 0) > 0 ? (b.videoLikes / b.videoViews) : 0;
    return erB - erA;
  }).slice(0, 10);
  const top10ByItemsSold = [...approvedCreatorsOnly].sort((a, b) => (b.itemsSold || 0) - (a.itemsSold || 0)).slice(0, 10);

  // Winning Concepts Aggregation with Videos
  const winningConcepts = (masterConcepts || []).map((mc: any) => {
    const no = String(mc.no_konsep);
    let cVt = 0, cViews = 0, cLikes = 0, cGmv = 0, cItemsSold = 0;
    const cVideos: any[] = [];

    localCreators.forEach((cc: any) => {
      const vids = cc.videos || [];
      const u = cc.creators?.username || 'creator';
      vids.forEach((v: any) => {
        if (String(v.concept) === no) {
          cVt++;
          const link = v.link_video || (v.content_uid ? `https://www.tiktok.com/@${u}/video/${v.content_uid}` : '');
          if (link) {
            cVideos.push({
              id: v.id,
              link_video: link,
              creator_username: u,
              views: 0,
              gmv: 0
            });
          }
        }
      });
    });

    creatorStats.forEach((c: any) => {
      if (c.concepts && c.concepts.includes(no)) {
        cViews += c.videoViews || 0;
        cLikes += c.videoLikes || 0;
        cGmv += c.gmvOrganic || 0;
        cItemsSold += c.itemsSold || 0;
      }
    });

    const erVal = cViews > 0 ? Number(((cLikes / cViews) * 100).toFixed(2)) : 0;
    return {
      concept: mc,
      total_vt: cVt,
      total_views: cViews,
      total_gmv: cGmv,
      items_sold: cItemsSold,
      er: erVal,
      videos: cVideos
    };
  }).sort((a, b) => b.total_gmv - a.total_gmv || b.total_views - a.total_views);

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
                  <div className="flex flex-wrap items-center gap-2 text-[12px] mt-[8px]">
                    <span className="flex items-center gap-1.5 font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md" title="Kreator approved yang telah membuat VT dan/atau Live">
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      {activeApprovedCreatorsCount} Aktif
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md" title="Kreator approved yang belum upload VT atau Live">
                      {inactiveApprovedCreatorsCount} Belum Aktif
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-text-soft text-[11px]">
                      {totalPendingCreators} pending
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
                  <h3 className={`text-[24px] font-bold mt-[8px] ${!isAwareness ? 'text-green-900' : 'text-text'}`}>{formatCurrencyDisplay(totalAllGmv)}</h3>
                  <p className={`text-[11px] font-semibold mt-[4px] ${!isAwareness ? 'text-green-700/80' : 'text-text-soft'}`}>Rp {totalAllGmv.toLocaleString()}</p>
                </div>
                <div className={`p-[12px] rounded-[12px] shadow-sm ${!isAwareness ? 'bg-white text-green-600' : 'bg-slate-50 text-slate-500'}`}><TrendingUp className="w-6 h-6" /></div>
              </div>
              {campaign.target_gmv && (
                <div className={`mt-[16px] pt-[16px] border-t ${!isAwareness ? 'border-green-200/50' : 'border-line'}`}>
                  <div className={`flex justify-between text-[11px] mb-[4px] font-medium ${!isAwareness ? 'text-green-800' : 'text-text-soft'}`}>
                    <span>Target: {formatCurrencyDisplay(campaign.target_gmv)}</span>
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
                  <h3 className="text-[24px] font-bold mt-[8px] text-text">{formatCurrencyDisplay(totalOrganic)}</h3>
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
                  <h3 className="text-[24px] font-bold mt-[8px] text-text">{formatCurrencyDisplay(totalAdsGmv)}</h3>
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
                  <h3 className={`text-[24px] font-bold mt-[8px] ${attributionGap > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrencyDisplay(attributionGap)}</h3>
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
                    <span>Tracked (Approved): {formatCurrencyDisplay(trackedOrganic)}</span>
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
                    const adjustedKurs = normalizeKurs(ad.kurs);
                    const costUsd = Number(ad.cost_usd) || 0;
                    const revenueUsd = Number(ad.gross_revenue_usd) || 0;
                    
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

      {/* === HIGHLIGHT PERFORMANCE METRICS (Average & Productivity) === */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-[24px]">
        <div className="bg-gradient-to-br from-amber-50 to-yellow-100/50 border border-amber-100 rounded-xl overflow-hidden p-[20px] shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[12px] font-medium text-amber-800">Total Item Sold</p>
              <h3 className="text-[26px] font-bold mt-[6px] text-amber-900">{totalItemsSold.toLocaleString()} <span className="text-[14px] font-normal text-amber-700">pcs</span></h3>
              <p className="text-[11px] text-amber-700/70 mt-[2px]">Total unit produk terjual organik</p>
            </div>
            <div className="p-[10px] bg-white text-amber-600 rounded-[10px] shadow-sm"><ShoppingCart className="w-5 h-5" /></div>
          </div>
          <div className="mt-[16px] pt-[12px] border-t border-amber-200/60 flex items-center justify-between text-[11px]">
            <span className="text-amber-800 font-medium">Conv Rate: <strong className="font-bold text-amber-950">{conversionRate}%</strong></span>
            <span className="text-amber-800 font-medium">Sales/Likes: <strong className="font-bold text-amber-950">{salesToLikesRatio}%</strong></span>
          </div>
        </div>

        <div className="bg-white border border-line rounded-xl p-[20px] shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[12px] font-medium text-text-soft">Revenue per Active Creator</p>
              <h4 className="text-[22px] font-bold mt-[6px] text-text">
                Rp {revenuePerActiveCreator.toLocaleString()}
              </h4>
              <p className="text-[11px] text-text-soft mt-[2px]">
                Rata-rata performa omzet per kreator aktif
              </p>
            </div>
            <div className="p-[10px] bg-blue-50 text-blue-600 rounded-[10px]"><Users className="w-5 h-5" /></div>
          </div>
        </div>

        <div className="bg-white border border-line rounded-xl p-[20px] shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[12px] font-medium text-text-soft">Revenue per Video</p>
              <h4 className="text-[22px] font-bold mt-[6px] text-text">
                Rp {revenuePerVideo.toLocaleString()}
              </h4>
              <p className="text-[11px] text-text-soft mt-[2px]">
                Rata-rata omzet per video ({totalApprovedVideos.toLocaleString()} VT)
              </p>
            </div>
            <div className="p-[10px] bg-emerald-50 text-emerald-600 rounded-[10px]"><PlaySquare className="w-5 h-5" /></div>
          </div>
        </div>

        <div className="bg-white border border-line rounded-xl p-[20px] shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[12px] font-medium text-text-soft">Like Engagement Rate (ER)</p>
              <h4 className="text-[22px] font-bold mt-[6px] text-text">
                {likeER}%
              </h4>
              <p className="text-[11px] text-text-soft mt-[2px]">
                Rasio likes per views ({totalCampaignLikes.toLocaleString()} likes)
              </p>
            </div>
            <div className="p-[10px] bg-rose-50 text-rose-500 rounded-[10px]"><Activity className="w-5 h-5" /></div>
          </div>
        </div>
      </div>

      {/* === TOP 10 CREATOR LEADERBOARD === */}
      <div className="ccard !p-0">
        <div className="border-b border-line bg-slate-50/50 p-[16px] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="font-bold flex items-center gap-[8px] text-[16px]">
              🏆 Top 10 Creator Performance
            </h3>
            <p className="text-[12px] text-text-soft mt-1">10 Kreator dengan performa terbaik berdasarkan 4 pilar utama</p>
          </div>
          
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-[12px] font-medium">
            <button
              onClick={() => setTop10Tab('gmv')}
              className={`px-3 py-1.5 rounded-md transition-all ${top10Tab === 'gmv' ? 'bg-white text-indigo-600 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Top GMV
            </button>
            <button
              onClick={() => setTop10Tab('views')}
              className={`px-3 py-1.5 rounded-md transition-all ${top10Tab === 'views' ? 'bg-white text-indigo-600 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Top Views
            </button>
            <button
              onClick={() => setTop10Tab('er')}
              className={`px-3 py-1.5 rounded-md transition-all ${top10Tab === 'er' ? 'bg-white text-indigo-600 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Top Like ER
            </button>
            <button
              onClick={() => setTop10Tab('itemsSold')}
              className={`px-3 py-1.5 rounded-md transition-all ${top10Tab === 'itemsSold' ? 'bg-white text-indigo-600 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Top Items Sold
            </button>
          </div>
        </div>

        <div className="tbl-wrap !border-0 !rounded-none">
          <table className="w-full text-[13px]">
            <thead className="bg-white border-b border-line">
              <tr>
                <th className="py-[12px] w-12 text-center">Rank</th>
                <th className="py-[12px]">Creator</th>
                <th className="py-[12px] text-center">Total VT</th>
                <th className="py-[12px] text-center">Views</th>
                <th className="py-[12px] text-center">Like ER</th>
                <th className="py-[12px] text-center">Items Sold</th>
                <th className="py-[12px] text-right">GMV Organik</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const currentList = top10Tab === 'gmv' ? top10ByGmv :
                                    top10Tab === 'views' ? top10ByViews :
                                    top10Tab === 'er' ? top10ByER :
                                    top10ByItemsSold;

                if (!currentList || currentList.length === 0) {
                  return (
                    <tr>
                      <td colSpan={7} className="text-center py-[24px] text-text-soft">
                        Belum ada data kreator untuk kategori ini.
                      </td>
                    </tr>
                  );
                }

                return currentList.map((c: any, idx: number) => {
                  const rankColors = [
                    'bg-amber-100 text-amber-800 border-amber-300 font-bold',
                    'bg-slate-200 text-slate-800 border-slate-300 font-bold',
                    'bg-orange-100 text-orange-800 border-orange-300 font-bold'
                  ];
                  const badgeClass = idx < 3 ? rankColors[idx] : 'bg-slate-50 text-slate-600 border-slate-200';
                  const cER = (c.videoViews || 0) > 0 ? Number(((c.videoLikes / c.videoViews) * 100).toFixed(2)) : 0;

                  return (
                    <tr key={c.id || idx} className="hover:bg-slate-50 transition-colors border-b border-line">
                      <td className="text-center py-[12px]">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[12px] border ${badgeClass}`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-[12px]">
                        <Link href={`/creator-pool/${c.creator_id}`} className="font-bold text-indigo-600 hover:underline flex items-center gap-1">
                          @{c.username}
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </Link>
                      </td>
                      <td className="text-center py-[12px] font-semibold">{c.totalVt} VT</td>
                      <td className={`text-center py-[12px] ${top10Tab === 'views' ? 'font-bold text-indigo-600' : ''}`}>
                        {(c.videoViews || 0).toLocaleString()}
                      </td>
                      <td className={`text-center py-[12px] ${top10Tab === 'er' ? 'font-bold text-rose-600' : ''}`}>
                        {cER}%
                      </td>
                      <td className={`text-center py-[12px] ${top10Tab === 'itemsSold' ? 'font-bold text-amber-700' : ''}`}>
                        {(c.itemsSold || 0).toLocaleString()} pcs
                      </td>
                      <td className={`text-right py-[12px] ${top10Tab === 'gmv' ? 'font-bold text-emerald-700' : 'font-medium'}`}>
                        Rp {(c.gmvOrganic || 0).toLocaleString()}
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* === WINNING CONCEPTS SHOWCASE === */}
      <div className="ccard !p-0">
        <div className="border-b border-line bg-slate-50/50 p-[16px]">
          <h3 className="font-bold flex items-center gap-[8px] text-[16px]">
            💡 Winning Concept Performance & VT Showcase
          </h3>
          <p className="text-[12px] text-text-soft mt-1">
            Evaluasi performa master brief konsep konten, penjualan, serta tautan video TikTok langsung
          </p>
        </div>

        <div className="p-[16px] space-y-4">
          {(!winningConcepts || winningConcepts.length === 0) ? (
            <div className="text-center py-8 text-text-soft text-[13px]">
              Belum ada master konsep yang dikaitkan ke video pada campaign ini.
            </div>
          ) : (
            winningConcepts.map((item: any, idx: number) => {
              const cNo = item.concept?.no_konsep || idx + 1;
              const isExpanded = !!expandedConcepts[cNo];

              return (
                <div key={cNo} className="border border-line rounded-xl overflow-hidden hover:border-slate-300 transition-colors">
                  <div 
                    onClick={() => toggleConceptExpand(cNo)}
                    className="p-4 bg-slate-50/70 hover:bg-slate-100/60 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start md:items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold flex items-center justify-center text-sm shrink-0">
                        #{cNo}
                      </span>
                      <div>
                        <h4 className="font-bold text-text text-[14px]">
                          {item.concept?.judul_konsep || `Konsep #${cNo}`}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-text-soft">
                          {item.concept?.tier && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                              Tier: {item.concept.tier}
                            </span>
                          )}
                          {item.concept?.nama_produk && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                              Produk: {item.concept.nama_produk}
                            </span>
                          )}
                          <span>{item.total_vt} VT Terkait</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 md:gap-6 flex-wrap">
                      <div className="text-left md:text-right">
                        <p className="text-[11px] text-text-soft">Views & Like ER</p>
                        <p className="text-[13px] font-bold text-text">
                          {item.total_views.toLocaleString()} <span className="text-[11px] font-normal text-rose-600">({item.er}%)</span>
                        </p>
                      </div>
                      <div className="text-left md:text-right">
                        <p className="text-[11px] text-text-soft">Items Sold</p>
                        <p className="text-[13px] font-bold text-amber-800">
                          {item.items_sold.toLocaleString()} pcs
                        </p>
                      </div>
                      <div className="text-left md:text-right">
                        <p className="text-[11px] text-text-soft">Total GMV</p>
                        <p className="text-[14px] font-bold text-emerald-700">
                          Rp {item.total_gmv.toLocaleString()}
                        </p>
                      </div>
                      <button className="px-3 py-1.5 rounded-lg border border-line bg-white hover:bg-slate-50 text-[12px] font-medium flex items-center gap-1.5 text-text transition-colors shadow-sm">
                        {isExpanded ? (
                          <>Tutup VT <ChevronUp className="w-3.5 h-3.5" /></>
                        ) : (
                          <>Lihat VT ({item.videos?.length || 0}) <ChevronDown className="w-3.5 h-3.5" /></>
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 bg-white border-t border-line">
                      {(!item.videos || item.videos.length === 0) ? (
                        <p className="text-[12px] text-text-soft py-2">Belum ada video dengan link untuk konsep ini.</p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-text-soft mb-2">
                            Daftar Video TikTok yang Memakai Konsep Ini:
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {item.videos.map((vid: any, vIdx: number) => (
                              <div 
                                key={vid.id || vIdx}
                                className="p-3 border border-line rounded-lg bg-slate-50/50 hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors"
                              >
                                <div className="min-w-0">
                                  <p className="text-[12px] font-bold text-text truncate">
                                    @{vid.creator_username}
                                  </p>
                                </div>
                                <a
                                  href={vid.link_video}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 px-2.5 py-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 text-[11px] font-bold flex items-center gap-1 transition-colors"
                                >
                                  Buka VT <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
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
