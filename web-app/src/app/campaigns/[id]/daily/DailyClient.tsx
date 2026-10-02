"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { fetchDailyPerformancePageDataAction } from "@/app/actions/campaignPageActions";
import { normalizeKurs } from "@/utils/computed";
import TimelineTarget from "./TimelineTarget";
import { ChevronDown, ChevronRight, Video, Radio, ShoppingBag, ExternalLink, Search } from "lucide-react";

const toWIBDateStr = (utcString: string | number | null | undefined): string | null => {
  if (!utcString) return null;
  const str = String(utcString).trim();
  if (!str || str === '-' || str === '0') return null;

  let d: Date;
  if (/^\d{10}$/.test(str)) {
    d = new Date(Number(str) * 1000);
  } else if (/^\d{13}$/.test(str)) {
    d = new Date(Number(str));
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  } else {
    d = new Date(str);
  }
  if (isNaN(d.getTime())) return null;
  const wibTime = new Date(d.getTime() + (7 * 60 * 60 * 1000));
  return wibTime.toISOString().substring(0, 10);
};

function extractTikTokUploadDate(videoId: string): string | null {
  try {
    const cleanId = videoId.trim();
    if (!/^\d{15,22}$/.test(cleanId)) return null;
    const id = BigInt(cleanId);
    const timestamp = Number(id >> BigInt(32)) * 1000;
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return null;
    const wibTime = new Date(d.getTime() + (7 * 60 * 60 * 1000));
    return wibTime.toISOString().substring(0, 10);
  } catch {
    return null;
  }
}

export interface VideoDetailItem {
  videoId: string;
  creator: string;
  linkVideo?: string;
  views?: number;
  likes?: number;
  postTime?: string;
  productId?: string;
  productName?: string;
  source?: string;
}

export interface LiveDetailItem {
  roomId: string;
  creator: string;
  views?: number;
  likes?: number;
  startTime?: string;
  duration?: string;
  source?: string;
}

export interface OrderDetailItem {
  orderId: string;
  creator: string;
  contentUid?: string;
  productId?: string;
  productName?: string;
  gmv: number;
  quantity: number;
  price: number;
  status?: string;
  isRefund?: boolean;
}

interface GroupData {
  gmv: number;
  gmvAds: number;
  gmvLive: number;
  gmvVT: number;
  ordersLive: number;
  ordersVT: number;
  videos: Set<string>;
  liveSessions: Set<string>;
  videoCreators: Set<string>;
  liveCreators: Set<string>;
  pendingCreators: Map<string, string>;
  approvedCreators: Map<string, string>;
  pendingLiveCreators: Map<string, string>;
  approvedLiveCreators: Map<string, string>;
  videoList: VideoDetailItem[];
  liveList: LiveDetailItem[];
  ordersVTList: OrderDetailItem[];
  ordersLiveList: OrderDetailItem[];
}

const createEmptyGroup = (): GroupData => ({
  gmv: 0,
  gmvAds: 0,
  gmvLive: 0,
  gmvVT: 0,
  ordersLive: 0,
  ordersVT: 0,
  videos: new Set<string>(),
  liveSessions: new Set<string>(),
  videoCreators: new Set<string>(),
  liveCreators: new Set<string>(),
  pendingCreators: new Map<string, string>(),
  approvedCreators: new Map<string, string>(),
  pendingLiveCreators: new Map<string, string>(),
  approvedLiveCreators: new Map<string, string>(),
  videoList: [],
  liveList: [],
  ordersVTList: [],
  ordersLiveList: []
});

export default function CampaignDailyPerformanceClient({ campaignId }: { campaignId: number }) {

  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<any>(null);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Accordion state
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [activeTabPerDate, setActiveTabPerDate] = useState<Record<string, 'videos' | 'orders_vt' | 'orders_live'>>({});
  const [searchPerDate, setSearchPerDate] = useState<Record<string, string>>({});

  const toggleExpand = (date: string) => {
    setExpandedDates(prev => ({
      ...prev,
      [date]: !prev[date]
    }));
  };

  const totalPages = Math.ceil(dailyData.length / pageSize);
  const paginatedDaily = React.useMemo(() => {
    return dailyData.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [dailyData, currentPage]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetchDailyPerformancePageDataAction(campaignId);
      if (!res.success || !res.campaign) return;

      const campaignData = res.campaign;
      setCampaign(campaignData);

      const campaignStartStr = campaignData.start_date ? campaignData.start_date.substring(0, 10) : null;
      const campaignEndStr = campaignData.end_date ? campaignData.end_date.substring(0, 10) : null;

      const skuSet = new Set((res.skus || []).map((s: any) => s.product_id).filter(Boolean));
      const hasSkus = skuSet.size > 0;

      const skuNameMap = new Map<string, string>();
      (res.skus || []).forEach((s: any) => {
        if (s.product_id) skuNameMap.set(String(s.product_id).trim(), s.nama_produk || s.product_id);
      });

      const allVideosFromCreators = res.campaignCreators || [];
      const allVideos = res.videos || [];
      const allAds = res.ads || [];
      const allSales = res.sales || [];
      const allOrganicVideos = res.organicVideos || [];
      const allLiveSessions = (res as any).liveSessions || [];

      // Catatan: `snapshotTierMap` pernah ada di sini tapi tidak pernah diisi,
      // jadi `resolvedTier` selalu jatuh ke `cc.tier || 'Nano'`. Sudah dihapus
      // karena hanya memberi ilusi bahwa tier bisa dipulihkan dari snapshot.

      // Grouping
      const grouped: Record<string, GroupData> = {};
      const monthlyGrouped: Record<string, GroupData> = {};

      const initGroup = (dateStr: string) => {
        if (!grouped[dateStr]) grouped[dateStr] = createEmptyGroup();
      };
      const initMonthlyGroup = (monthStr: string) => {
        if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = createEmptyGroup();
      };

      // 1. Compute daily sales stats directly from sales table
      const approvedUsernameSet = new Set(
        allVideosFromCreators
          .filter(cc => cc.approval === 'approved' || cc.approval === 'alternate')
          .map(cc => (cc.creators?.username || '').toLowerCase().trim())
          .filter(Boolean)
      );

      const dailySalesMap = new Map<string, {
        date_str: string;
        total_gmv: number;
        gmv_live: number;
        gmv_vt: number;
        orders_live: number;
        orders_vt: number;
      }>();

      allSales.forEach(s => {
        const u = (s.creator_username || '').toLowerCase().trim();
        if (approvedUsernameSet.size > 0 && !approvedUsernameSet.has(u)) return;
        if (!hasSkus || !s.product_id || !skuSet.has(s.product_id)) return;

        const dateStr = toWIBDateStr(s.tanggal);
        if (!dateStr) return;

        if (!dailySalesMap.has(dateStr)) {
          dailySalesMap.set(dateStr, {
            date_str: dateStr,
            total_gmv: 0,
            gmv_live: 0,
            gmv_vt: 0,
            orders_live: 0,
            orders_vt: 0
          });
        }
        const day = dailySalesMap.get(dateStr)!;
        const gmv = Number(s.gmv || 0);
        const qty = Number(s.quantity || 1);
        const price = Number(s.price || (qty > 0 ? gmv / qty : 0));
        const cType = (s.content_type || '').toLowerCase().trim();
        const isLive = cType === 'livestream' || cType === 'live';
        const pId = s.product_id ? String(s.product_id).trim() : '-';
        const prodName = skuNameMap.get(pId) || pId;

        day.total_gmv += gmv;

        if (isLive) {
          day.gmv_live += gmv;
          day.orders_live += qty;
        } else {
          day.gmv_vt += gmv;
          day.orders_vt += qty;
        }

        // Store detail item for accordion
        if (!campaignStartStr || dateStr >= campaignStartStr) {
          initGroup(dateStr);
          if (isLive) {
            grouped[dateStr].ordersLiveList.push({
              orderId: s.order_id || '-',
              creator: u || 'unknown',
              contentUid: s.content_uid || '-',
              productId: pId,
              productName: prodName,
              gmv,
              quantity: qty,
              price,
              status: s.order_status || 'COMPLETED',
              isRefund: !!s.is_refund
            });
          } else {
            grouped[dateStr].ordersVTList.push({
              orderId: s.order_id || '-',
              creator: u || 'unknown',
              contentUid: s.content_uid || '-',
              productId: pId,
              productName: prodName,
              gmv,
              quantity: qty,
              price,
              status: s.order_status || 'COMPLETED',
              isRefund: !!s.is_refund
            });
          }
        }
      });

      const allSalesStats = Array.from(dailySalesMap.values());

      if (allSalesStats.length > 0) {
        allSalesStats.forEach((stat: any) => {
          if (!stat.date_str) return;
          const dateStr = stat.date_str;
          
          if (campaignStartStr && dateStr < campaignStartStr) return;

          initGroup(dateStr);
          grouped[dateStr].gmvLive += (stat.gmv_live || 0);
          grouped[dateStr].ordersLive += (stat.orders_live || 0);
          grouped[dateStr].gmvVT += (stat.gmv_vt || 0);
          grouped[dateStr].ordersVT += (stat.orders_vt || 0);
          grouped[dateStr].gmv += (stat.total_gmv || 0);

          const monthStr = dateStr.substring(0, 7);
          initMonthlyGroup(monthStr);
          monthlyGrouped[monthStr].gmvLive += (stat.gmv_live || 0);
          monthlyGrouped[monthStr].ordersLive += (stat.orders_live || 0);
          monthlyGrouped[monthStr].gmvVT += (stat.gmv_vt || 0);
          monthlyGrouped[monthStr].ordersVT += (stat.orders_vt || 0);
          monthlyGrouped[monthStr].gmv += (stat.total_gmv || 0);
        });
      }

      // 2. Map Campaign Creators (Created / Approved targets) & uploaded videos
      if (allVideosFromCreators.length > 0) {
        allVideosFromCreators.forEach(cc => {
          const username = (cc.creators?.username || 'unknown').toLowerCase().trim();
          const resolvedTier = cc.tier || 'Nano';

          let cType = cc.content_type || '-';
          if (cType === '-' || !cType) {
            const qVt = Number(cc.qty_vt) || 0;
            const qLive = Number(cc.qty_live) || 0;
            if (qVt >= 1 && qLive === 0) cType = 'Video';
            else if (qVt === 0 && qLive >= 1) cType = 'Live';
            else if (qVt >= 1 && qLive >= 1) cType = 'Video & Live';
          }
          const isLiveCreator = cType.toLowerCase().includes('live');

          // Added / Pending creator tracking
          if (cc.created_at) {
            const addedDateStr = toWIBDateStr(cc.created_at);
            let countAdded = true;
            if (addedDateStr && campaignStartStr && addedDateStr < campaignStartStr) countAdded = false;
            
            if (countAdded && addedDateStr) {
              initGroup(addedDateStr);
              grouped[addedDateStr].pendingCreators.set(username, resolvedTier);
              if (isLiveCreator) {
                grouped[addedDateStr].pendingLiveCreators.set(username, resolvedTier);
              }

              const monthStr = addedDateStr.substring(0, 7);
              initMonthlyGroup(monthStr);
              monthlyGrouped[monthStr].pendingCreators.set(username, resolvedTier);
              if (isLiveCreator) {
                monthlyGrouped[monthStr].pendingLiveCreators.set(username, resolvedTier);
              }
            }
          }

          // Approved creator tracking
          // WAJIB cek `approval` juga. Dulu hanya `if (cc.approved_at)`, sehingga
          // kreator yang sudah di-approve lalu dibalik jadi not_approved/alternate
          // tetap terhitung "Kr Approve" pada tanggal approve yang lama.
          // Itu membuat angka Kr Approve di halaman ini beda dari tab Listing
          // (terverifikasi 265 vs 263 di campaign 57) DAN ikut menggeser
          // sisa target kreator di kartu bulanan.
          if (cc.approval === 'approved' && cc.approved_at) {
            const approvedDateStr = toWIBDateStr(cc.approved_at);
            let countCreator = true;
            if (approvedDateStr && campaignStartStr && approvedDateStr < campaignStartStr) countCreator = false;
            
            if (countCreator && approvedDateStr) {
              initGroup(approvedDateStr);
              grouped[approvedDateStr].approvedCreators.set(username, resolvedTier);
              if (isLiveCreator) {
                grouped[approvedDateStr].approvedLiveCreators.set(username, resolvedTier);
              }

              const monthStr = approvedDateStr.substring(0, 7);
              initMonthlyGroup(monthStr);
              monthlyGrouped[monthStr].approvedCreators.set(username, resolvedTier);
              if (isLiveCreator) {
                monthlyGrouped[monthStr].approvedLiveCreators.set(username, resolvedTier);
              }
            }
          }

          // Track uploaded videos from creator submissions
          if (cc.videos && cc.videos.length > 0) {
            cc.videos.forEach((v: any) => {
              if (!v.link_video) return; // Ignore empty draft slots
              
              // Extract TikTok video ID
              const match = v.link_video.match(/\/video\/(\d+)/);
              const videoId = match ? match[1] : (v.content_uid || v.id).toString();
              
              // Accurate TikTok upload date via Snowflake ID, fallback to created_at
              let uploadDateStr = match ? extractTikTokUploadDate(match[1]) : null;
              if (!uploadDateStr && v.created_at) {
                uploadDateStr = toWIBDateStr(v.created_at);
              }
              if (!uploadDateStr) return;
              if (campaignStartStr && uploadDateStr < campaignStartStr) return;

              initGroup(uploadDateStr);
              grouped[uploadDateStr].videos.add(videoId);
              if (username && username !== 'unknown') {
                grouped[uploadDateStr].videoCreators.add(username);
              }

              if (!grouped[uploadDateStr].videoList.some(item => item.videoId === videoId)) {
                grouped[uploadDateStr].videoList.push({
                  videoId,
                  creator: username || 'unknown',
                  linkVideo: v.link_video || `https://www.tiktok.com/@${username}/video/${videoId}`,
                  views: Number(v.views || 0),
                  likes: Number(v.likes || 0),
                  postTime: uploadDateStr,
                  source: 'Submission Slot'
                });
              }

              const monthStr = uploadDateStr.substring(0, 7);
              initMonthlyGroup(monthStr);
              monthlyGrouped[monthStr].videos.add(videoId);
              if (username && username !== 'unknown') {
                monthlyGrouped[monthStr].videoCreators.add(username);
              }
            });
          }
        });
      }

      // 3. Map Organic Videos & Livestreams from TikTok Sync / Organic Import
      if (allOrganicVideos.length > 0) {
        allOrganicVideos.forEach(v => {
          if (!hasSkus || !v.product_id || !skuSet.has(v.product_id)) return;
          if (!v.content_uid) return;
          const uidStr = v.content_uid.toString();
          const cType = (v.content_type || '').toLowerCase();
          const isLive = cType.includes('live') || cType.includes('livestream');

          let dateStr: string | null = null;
          if (!isLive) {
            dateStr = extractTikTokUploadDate(uidStr) || toWIBDateStr(v.post_time);
          } else {
            dateStr = toWIBDateStr(v.post_time);
          }

          if (!dateStr) return;
          if (campaignStartStr && dateStr < campaignStartStr) return;

          initGroup(dateStr);
          const monthStr = dateStr.substring(0, 7);
          initMonthlyGroup(monthStr);

          const creatorUname = (v.creator_username || '').toLowerCase().trim();
          const prodName = skuNameMap.get(String(v.product_id).trim()) || v.product_id;

          if (!isLive) {
            grouped[dateStr].videos.add(uidStr);
            if (creatorUname) grouped[dateStr].videoCreators.add(creatorUname);
            monthlyGrouped[monthStr].videos.add(uidStr);
            if (creatorUname) monthlyGrouped[monthStr].videoCreators.add(creatorUname);

            const existingVid = grouped[dateStr].videoList.find(item => item.videoId === uidStr);
            if (existingVid) {
              existingVid.views = Math.max(existingVid.views || 0, Number(v.video_views || 0));
              existingVid.likes = Math.max(existingVid.likes || 0, Number(v.video_likes || 0));
              if (!existingVid.productName && prodName) existingVid.productName = prodName;
            } else {
              grouped[dateStr].videoList.push({
                videoId: uidStr,
                creator: creatorUname || 'unknown',
                linkVideo: `https://www.tiktok.com/@${creatorUname}/video/${uidStr}`,
                views: Number(v.video_views || 0),
                likes: Number(v.video_likes || 0),
                postTime: dateStr,
                productId: v.product_id,
                productName: prodName,
                source: 'Auto-Sync / Organic'
              });
            }
          } else {
            const isDummy = !uidStr || uidStr === '-' || uidStr === '0' || uidStr.toLowerCase() === 'n/a' || uidStr === 'null';
            const uniqueKey = isDummy ? `dummy_${creatorUname}_${dateStr}_${v.id || Math.random()}` : uidStr;

            grouped[dateStr].liveSessions.add(uniqueKey);
            if (creatorUname) grouped[dateStr].liveCreators.add(creatorUname);
            monthlyGrouped[monthStr].liveSessions.add(uniqueKey);
            if (creatorUname) monthlyGrouped[monthStr].liveCreators.add(creatorUname);

            if (!grouped[dateStr].liveList.some(item => item.roomId === uniqueKey)) {
              grouped[dateStr].liveList.push({
                roomId: uidStr || uniqueKey,
                creator: creatorUname || 'unknown',
                views: Number(v.video_views || 0),
                likes: Number(v.video_likes || 0),
                startTime: dateStr,
                duration: v.duration_str || '-',
                source: 'Auto-Sync / Live'
              });
            }
          }
        });
      }

      // 4. Map Live Sessions from live_sessions table
      if (allLiveSessions.length > 0) {
        allLiveSessions.forEach((ls: any) => {
          if (!ls.start_time) return;
          const dateStr = toWIBDateStr(ls.start_time);
          if (!dateStr) return;
          if (campaignStartStr && dateStr < campaignStartStr) return;

          initGroup(dateStr);
          const monthStr = dateStr.substring(0, 7);
          initMonthlyGroup(monthStr);

          const uidStr = (ls.livestream_room_id || ls.content_uid || ls.id).toString();
          const creatorUname = (ls.username || ls.creator_username || '').toLowerCase().trim();

          grouped[dateStr].liveSessions.add(uidStr);
          if (creatorUname) grouped[dateStr].liveCreators.add(creatorUname);
          monthlyGrouped[monthStr].liveSessions.add(uidStr);
          if (creatorUname) monthlyGrouped[monthStr].liveCreators.add(creatorUname);

          if (!grouped[dateStr].liveList.some(item => item.roomId === uidStr)) {
            grouped[dateStr].liveList.push({
              roomId: uidStr,
              creator: creatorUname || 'unknown',
              views: Number(ls.live_views || 0),
              likes: Number(ls.live_likes || 0),
              startTime: dateStr,
              duration: ls.duration_str || '-',
              source: 'Live Session'
            });
          }
        });
      }

      // 5. Ads Performance delta computation
      if (allAds.length > 0) {
        const previousAdValues: Record<string, number> = {};
        allAds.forEach(ad => {
          if (!ad.tanggal || !ad.ad_id) return;
          const dateStr = toWIBDateStr(ad.tanggal);
          if (!dateStr) return;
          
          const currentGmv = ad.gross_revenue_usd || 0;
          const prevGmv = previousAdValues[ad.ad_id] || 0;
          const deltaUsd = currentGmv - prevGmv;
          
          previousAdValues[ad.ad_id] = currentGmv;

          if (campaignStartStr && dateStr < campaignStartStr) return;
          
          if (deltaUsd > 0) {
            const kurs = normalizeKurs(ad.kurs);
            const deltaIdr = deltaUsd * kurs;
            
            initGroup(dateStr);
            grouped[dateStr].gmvAds += deltaIdr;
            
            const monthStr = dateStr.substring(0, 7);
            initMonthlyGroup(monthStr);
            monthlyGrouped[monthStr].gmvAds += deltaIdr;
          }
        });
      }

      const getTierCounts = (tierMap: Map<string, string>) => {
        const counts = { nano: 0, micro: 0, macro: 0, mega: 0 };
        tierMap.forEach(t => {
          const lowerT = (t || '').toLowerCase();
          if (lowerT === 'mega') counts.mega++;
          else if (lowerT === 'macro') counts.macro++;
          else if (lowerT === 'micro') counts.micro++;
          else counts.nano++;
        });
        return counts;
      };

      const formattedDaily = Object.keys(grouped).map(date => {
        const g = grouped[date];
        const pendingTiers = getTierCounts(g.pendingCreators);
        const approvedTiers = getTierCounts(g.approvedCreators);
        const pendingLiveTiers = getTierCounts(g.pendingLiveCreators);
        const approvedLiveTiers = getTierCounts(g.approvedLiveCreators);

        // Active creators = distinct union of creators who uploaded VT or performed Live on this date
        const activeCreators = new Set([
          ...Array.from(g.videoCreators),
          ...Array.from(g.liveCreators)
        ]);

        return {
          date,
          gmvOrganic: g.gmv,
          gmvLive: g.gmvLive,
          gmvVT: g.gmvVT,
          ordersLive: g.ordersLive,
          ordersVT: g.ordersVT,
          gmvAds: g.gmvAds,
          totalActiveCreators: activeCreators.size,
          totalCreators: g.approvedCreators.size,
          totalPendingCreators: g.pendingCreators.size,
          pendingNano: pendingTiers.nano, pendingMicro: pendingTiers.micro, pendingMacro: pendingTiers.macro, pendingMega: pendingTiers.mega,
          approvedNano: approvedTiers.nano, approvedMicro: approvedTiers.micro, approvedMacro: approvedTiers.macro, approvedMega: approvedTiers.mega,
          totalLiveCreators: g.approvedLiveCreators.size,
          totalPendingLiveCreators: g.pendingLiveCreators.size,
          pendingLiveNano: pendingLiveTiers.nano, pendingLiveMicro: pendingLiveTiers.micro, pendingLiveMacro: pendingLiveTiers.macro, pendingLiveMega: pendingLiveTiers.mega,
          approvedLiveNano: approvedLiveTiers.nano, approvedLiveMicro: approvedLiveTiers.micro, approvedLiveMacro: approvedLiveTiers.macro, approvedLiveMega: approvedLiveTiers.mega,
          totalVideos: g.videos.size,
          totalVideoCreators: g.videoCreators.size,
          totalLiveSessions: g.liveSessions.size,
          // Detailed lists for drilldown
          videoList: g.videoList,
          liveList: g.liveList,
          ordersVTList: g.ordersVTList,
          ordersLiveList: g.ordersLiveList
        };
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const formattedMonthly = Object.keys(monthlyGrouped).map(month => {
        const g = monthlyGrouped[month];
        const pendingTiers = getTierCounts(g.pendingCreators);
        const approvedTiers = getTierCounts(g.approvedCreators);
        const pendingLiveTiers = getTierCounts(g.pendingLiveCreators);
        const approvedLiveTiers = getTierCounts(g.approvedLiveCreators);

        const activeCreators = new Set([
          ...Array.from(g.videoCreators),
          ...Array.from(g.liveCreators)
        ]);

        return {
          month,
          gmvOrganic: g.gmv,
          gmvLive: g.gmvLive,
          gmvVT: g.gmvVT,
          ordersLive: g.ordersLive,
          ordersVT: g.ordersVT,
          gmvAds: g.gmvAds,
          totalActiveCreators: activeCreators.size,
          totalCreators: g.approvedCreators.size,
          totalPendingCreators: g.pendingCreators.size,
          pendingNano: pendingTiers.nano, pendingMicro: pendingTiers.micro, pendingMacro: pendingTiers.macro, pendingMega: pendingTiers.mega,
          approvedNano: approvedTiers.nano, approvedMicro: approvedTiers.micro, approvedMacro: approvedTiers.macro, approvedMega: approvedTiers.mega,
          totalLiveCreators: g.approvedLiveCreators.size,
          totalPendingLiveCreators: g.pendingLiveCreators.size,
          pendingLiveNano: pendingLiveTiers.nano, pendingLiveMicro: pendingLiveTiers.micro, pendingLiveMacro: pendingLiveTiers.macro, pendingLiveMega: pendingLiveTiers.mega,
          approvedLiveNano: approvedLiveTiers.nano, approvedLiveMicro: approvedLiveTiers.micro, approvedLiveMacro: approvedLiveTiers.macro, approvedLiveMega: approvedLiveTiers.mega,
          totalVideos: g.videos.size,
          totalVideoCreators: g.videoCreators.size,
          totalLiveSessions: g.liveSessions.size
        };
      }).sort((a, b) => new Date(b.month + '-01').getTime() - new Date(a.month + '-01').getTime());

      setDailyData(formattedDaily);
      setMonthlyData(formattedMonthly);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [campaignId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-500 font-medium">
        Memuat data harian...
      </div>
    );
  }

  if (!campaign) return null;

  const isAwareness = campaign.tipe_campaign === 'awareness';
  const isHybrid = campaign.tipe_campaign === 'gmv_awareness';

  return (
    <div className="space-y-[24px] pb-[80px]">
      <div className="flex justify-between items-center mb-[24px]">
        <div>
          <h2 className="text-[20px] font-bold text-text">Performa Harian (Automated)</h2>
          <p className="text-[13px] text-text-soft">
            Rekap performa harian yang dihitung otomatis dari data organik dan ads.
          </p>
        </div>
      </div>

      {!loading && monthlyData.length > 0 && (() => {
        const targetGmv = Number(campaign.target_gmv) || 0;
        const targetVideo = Number(campaign.target_video) || 0;
        const targetLive = Number(campaign.target_live) || 0;
        const targetCreator = Number(campaign.target_creator) || 0;
        const targetCreatorLive = Number(campaign.target_creator_live) || 0;

        // Calculate chronological achievements
        const chronologicalMonths = [...monthlyData].reverse(); // Oldest first
        let runningGmv = 0;
        let runningVideo = 0;
        let runningLive = 0;
        let runningVideoCreator = 0;
        let runningApprovedCreator = 0;
        let runningCreatorLive = 0;
        
        const monthlyTargets: Record<string, any> = {};
        
        chronologicalMonths.forEach(m => {
          monthlyTargets[m.month] = {
            targetGmv: Math.max(0, targetGmv - runningGmv),
            targetVideo: Math.max(0, targetVideo - runningVideo),
            targetLive: Math.max(0, targetLive - runningLive),
            targetVideoCreator: Math.max(0, targetCreator - runningVideoCreator),
            targetApprovedCreator: Math.max(0, targetCreator - runningApprovedCreator),
            targetCreatorLive: Math.max(0, targetCreatorLive - runningCreatorLive),
          };
          
          runningGmv += (m.gmvOrganic || 0) + (m.gmvAds || 0);
          runningVideo += m.totalVideos || 0;
          runningLive += m.totalLiveSessions || 0;
          runningVideoCreator += m.totalVideoCreators || 0;
          runningApprovedCreator += m.totalCreators || 0;
          runningCreatorLive += m.totalLiveCreators || 0;
        });
        
        const formatCompact = (num: number) => {
          if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'M'; // Milyar
          if (num >= 1000000) return (num / 1000000).toFixed(1) + 'JT'; // Juta
          if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
          return num.toString();
        };

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-[24px] mb-[24px]">
          {monthlyData.map((m, idx) => {
            const dateObj = new Date(m.month + '-01');
            const monthName = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
            const tgts = monthlyTargets[m.month];
            
            return (
              <div key={idx} className="ccard bg-gradient-to-br from-indigo-50 to-blue-100/50 border-indigo-100 min-w-[340px]">
                <div className="p-[20px]">
                  <div className="flex justify-between items-center mb-4">
                     <h4 className="text-sm font-bold text-indigo-900 tracking-tight">{monthName}</h4>
                     <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[11px] font-bold">MONTHLY</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="bg-white/60 rounded-[10px] p-2 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-semibold text-indigo-800 mb-1">GMV Total</span>
                      <span className="font-bold text-indigo-900 text-[11px]">
                        {formatCompact((m.gmvOrganic || 0) + (m.gmvAds || 0))} / {tgts.targetGmv > 0 ? formatCompact(tgts.targetGmv) : '-'}
                      </span>
                    </div>
                    <div className="bg-white/60 rounded-[10px] p-2 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-semibold text-emerald-700 mb-1">Sales</span>
                      <span className="font-bold text-emerald-800 text-[11px]">
                        {formatCompact(m.gmvOrganic || 0)}
                      </span>
                    </div>
                    <div className="bg-white/60 rounded-[10px] p-2 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-semibold text-violet-700 mb-1">Ads</span>
                      <span className="font-bold text-violet-800 text-[11px]">
                        {formatCompact(m.gmvAds || 0)}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-white/60 rounded-[10px] p-2 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-semibold text-indigo-800 mb-1">Kreator w/ VT</span>
                      <span className="font-bold text-indigo-900 text-[11px]">
                        {m.totalVideoCreators} / {tgts.targetVideoCreator > 0 ? tgts.targetVideoCreator : '-'}
                      </span>
                    </div>
                    <div className="bg-white/60 rounded-[10px] p-2 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-semibold text-indigo-800 mb-1">VT</span>
                      <span className="font-bold text-indigo-900 text-[11px]">
                        {m.totalVideos} / {tgts.targetVideo > 0 ? tgts.targetVideo : '-'}
                      </span>
                    </div>
                    <div className="bg-white/60 rounded-[10px] p-2 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-semibold text-indigo-800 mb-1">Live</span>
                      <span className="font-bold text-indigo-900 text-[11px]">
                        {m.totalLiveSessions} / {tgts.targetLive > 0 ? tgts.targetLive : '-'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white/50 rounded-[12px] p-3 border border-indigo-100/50">
                     <div className="grid grid-cols-2 gap-4">
                       {/* Kreator Ditambah */}
                       <div>
                         <div className="flex items-center gap-1.5 mb-1">
                           <span className="text-[11px] font-bold text-indigo-900 leading-tight">Kr Ditambah</span>
                         </div>
                         <div className="flex flex-col gap-1">
                           <span className="font-bold text-orange-600 text-[16px] leading-none">{m.totalPendingCreators}</span>
                           <div className="text-[9px] text-indigo-700/60 font-medium">N {m.pendingNano} | Mi {m.pendingMicro} | Ma {m.pendingMacro} | Me {m.pendingMega}</div>
                         </div>
                       </div>
                       {/* Kr Approve */}
                       <div>
                         <div className="flex items-center gap-1.5 mb-1">
                           <span className="text-[11px] font-bold text-indigo-900 leading-tight">Kr Approve</span>
                         </div>
                         <div className="flex flex-col gap-1">
                           <div className="flex items-end gap-1 leading-none">
                             <span className="font-bold text-emerald-600 text-[16px]">{m.totalCreators}</span>
                             <span className="font-bold text-emerald-600/60 text-[11px] mb-[1px]">/ {tgts.targetApprovedCreator > 0 ? tgts.targetApprovedCreator : '0'}</span>
                           </div>
                           <div className="text-[9px] text-indigo-700/60 font-medium">N {m.approvedNano} | Mi {m.approvedMicro} | Ma {m.approvedMacro} | Me {m.approvedMega}</div>
                         </div>
                       </div>
                       {/* Kr Live Ditambah */}
                       <div>
                         <div className="flex items-center gap-1.5 mb-1">
                           <span className="text-[11px] font-bold text-indigo-900 leading-tight">Kr Live Ditambah</span>
                         </div>
                         <div className="flex flex-col gap-1">
                           <span className="font-bold text-purple-600 text-[16px] leading-none">{m.totalPendingLiveCreators}</span>
                           <div className="text-[9px] text-indigo-700/60 font-medium">N {m.pendingLiveNano} | Mi {m.pendingLiveMicro} | Ma {m.pendingLiveMacro} | Me {m.pendingLiveMega}</div>
                         </div>
                       </div>
                       {/* Kr Live Approve */}
                       <div>
                         <div className="flex items-center gap-1.5 mb-1">
                           <span className="text-[11px] font-bold text-indigo-900 leading-tight">Kr Live Approve</span>
                         </div>
                         <div className="flex flex-col gap-1">
                           <div className="flex items-end gap-1 leading-none">
                             <span className="font-bold text-pink-600 text-[16px]">{m.totalLiveCreators}</span>
                             <span className="font-bold text-pink-600/60 text-[11px] mb-[1px]">/ {tgts.targetCreatorLive > 0 ? tgts.targetCreatorLive : '0'}</span>
                           </div>
                           <div className="text-[9px] text-indigo-700/60 font-medium">N {m.approvedLiveNano} | Mi {m.approvedLiveMicro} | Ma {m.approvedLiveMacro} | Me {m.approvedLiveMega}</div>
                         </div>
                       </div>
                     </div>
                  </div>

                </div>
              </div>
            );
          })}
          </div>
        );
      })()}

      <TimelineTarget campaign={campaign} dailyData={dailyData} />

      <div className="ccard !p-0 overflow-hidden">
        <div className="p-[16px] border-b border-line bg-slate-50/50">
          <h3 className="text-[16px] font-bold text-text">Daily Tracker Performance</h3>
          {campaign.end_date && campaign.status !== 'selesai' && (() => {
            const endDate = new Date(campaign.end_date);
            endDate.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const diffDays = Math.round((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const countdownText = diffDays > 0 ? `(H-${diffDays})` : diffDays < 0 ? `(H+${Math.abs(diffDays)})` : `(Hari ini)`;
            
            return (
              <p className="text-[13px] text-amber-600 font-medium mt-[4px]">
                * Pengingat: Campaign ini di-setting berakhir pada {new Date(campaign.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} <span className="font-bold">{countdownText}</span>. Sistem akan terus merekap data harian hingga status campaign diubah menjadi "Selesai".
              </p>
            );
          })()}
          {campaign.end_date && campaign.status === 'selesai' && (
            <p className="text-[13px] text-emerald-600 font-medium mt-[4px]">
              ✓ Campaign telah selesai. Data setelah tanggal {new Date(campaign.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} disembunyikan.
            </p>
          )}
        </div>
        <div className="tbl-wrap !border-0 !rounded-none">
          <table className="w-full">
            <thead className="border-b border-line bg-slate-50/80">
              <tr>
                <th className="py-[16px] pl-4 whitespace-nowrap text-left font-bold text-slate-700">Tanggal</th>
                <th className="py-[16px] text-center font-bold text-slate-700">Video / Sesi Live</th>
                <th className="py-[16px] text-center font-bold text-slate-700">Kreator Aktif</th>
                <th className="py-[16px] text-center font-bold text-slate-700">Orders (VT/Live)</th>
                <th className="py-[16px] text-right font-bold text-slate-700">GMV Organik</th>
                <th className="py-[16px] text-right font-bold text-slate-700">GMV Ads</th>
                <th className="py-[16px] text-center pr-4 font-bold text-slate-700 w-16">Detail</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-text-soft">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Mengkalkulasi data dari ribuan baris CSV...</span>
                    </div>
                  </td>
                </tr>
              ) : dailyData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-text-soft">
                    Belum ada data untuk campaign ini.
                  </td>
                </tr>
              ) : (
                paginatedDaily.map((d, idx) => {
                  const isExpanded = !!expandedDates[d.date];
                  const currentTab = activeTabPerDate[d.date] || 'videos';
                  const searchTerm = (searchPerDate[d.date] || '').toLowerCase().trim();

                  // Filtered data based on search term
                  const filteredVideos = (d.videoList || []).filter((v: VideoDetailItem) => {
                    if (!searchTerm) return true;
                    return (
                      (v.creator || '').toLowerCase().includes(searchTerm) ||
                      (v.videoId || '').toLowerCase().includes(searchTerm) ||
                      (v.productName || '').toLowerCase().includes(searchTerm)
                    );
                  });

                  const filteredLive = (d.liveList || []).filter((l: LiveDetailItem) => {
                    if (!searchTerm) return true;
                    return (
                      (l.creator || '').toLowerCase().includes(searchTerm) ||
                      (l.roomId || '').toLowerCase().includes(searchTerm)
                    );
                  });

                  const filteredOrdersVT = (d.ordersVTList || []).filter((o: OrderDetailItem) => {
                    if (!searchTerm) return true;
                    return (
                      (o.orderId || '').toLowerCase().includes(searchTerm) ||
                      (o.creator || '').toLowerCase().includes(searchTerm) ||
                      (o.contentUid || '').toLowerCase().includes(searchTerm) ||
                      (o.productName || '').toLowerCase().includes(searchTerm) ||
                      (o.productId || '').toLowerCase().includes(searchTerm)
                    );
                  });

                  const filteredOrdersLive = (d.ordersLiveList || []).filter((o: OrderDetailItem) => {
                    if (!searchTerm) return true;
                    return (
                      (o.orderId || '').toLowerCase().includes(searchTerm) ||
                      (o.creator || '').toLowerCase().includes(searchTerm) ||
                      (o.contentUid || '').toLowerCase().includes(searchTerm) ||
                      (o.productName || '').toLowerCase().includes(searchTerm) ||
                      (o.productId || '').toLowerCase().includes(searchTerm)
                    );
                  });

                  return (
                    <React.Fragment key={d.date || idx}>
                      {/* Main Summary Row */}
                      <tr 
                        onClick={() => toggleExpand(d.date)}
                        className={`border-b border-line cursor-pointer transition-colors ${
                          isExpanded ? 'bg-indigo-50/60 font-medium' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="font-semibold text-text whitespace-nowrap align-top pt-[18px] pb-[16px] pl-4">
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-indigo-600" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                            </span>
                            <div>
                              <span>{new Date(d.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                              <span className="block text-[11px] text-slate-400 font-normal">
                                {isExpanded ? 'Tutup Detail' : 'Klik untuk rincian data'}
                              </span>
                            </div>
                          </div>
                        </td>
                        
                        <td className="text-center align-top pt-[16px] pb-[16px]">
                          <div className="flex flex-col items-center gap-1.5">
                             <span className="font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded text-[12px] min-w-[72px] inline-block border border-indigo-100/60">
                               {d.totalVideos} VT
                             </span>
                             <span className="font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded text-[12px] min-w-[72px] inline-block border border-rose-100/60">
                               {d.totalLiveSessions || 0} Live
                             </span>
                          </div>
                        </td>
                        <td className="text-center text-text font-bold align-top pt-[18px] pb-[16px]">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 text-sm font-bold">
                            {d.totalActiveCreators || 0}
                          </span>
                        </td>
                        <td className="text-center align-top pt-[16px] pb-[16px]">
                          <div className="flex flex-col items-center gap-1 text-[12px] font-semibold text-slate-600">
                             <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">{d.ordersVT || 0} VT</span>
                             <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">{d.ordersLive || 0} Live</span>
                          </div>
                        </td>
                        <td className="text-right align-top pt-[16px] pb-[16px]">
                          <div className="flex flex-col items-end gap-1 text-[13px]">
                             <span className="font-bold text-emerald-600">VT: Rp {(d.gmvVT || 0).toLocaleString()}</span>
                             <span className="font-bold text-rose-600">Live: Rp {(d.gmvLive || 0).toLocaleString()}</span>
                             <span className="text-[11px] text-slate-500 mt-1 border-t border-slate-200/60 pt-1 font-semibold">
                               Total: Rp {(d.gmvOrganic || 0).toLocaleString()}
                             </span>
                          </div>
                        </td>
                        <td className="text-right font-bold text-blue-600 align-top pt-[18px] pb-[16px]">
                          Rp {(d.gmvAds || 0).toLocaleString()}
                        </td>
                        <td className="text-center align-top pt-[18px] pb-[16px] pr-4">
                          <button 
                            type="button"
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                              isExpanded 
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-indigo-600'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(d.date);
                            }}
                          >
                            {isExpanded ? 'Tutup' : 'Lihat'}
                          </button>
                        </td>
                      </tr>

                      {/* Accordion Drilldown Panel */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 border-b-2 border-indigo-200/80">
                          <td colSpan={7} className="p-0">
                            <div className="p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
                              
                              {/* Tab Selector & Quick Search */}
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                                  <button
                                    type="button"
                                    onClick={() => setActiveTabPerDate(prev => ({ ...prev, [d.date]: 'videos' }))}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                      currentTab === 'videos'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                  >
                                    <Video className="w-3.5 h-3.5" />
                                    <span>Video & Sesi Live</span>
                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${currentTab === 'videos' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-700'}`}>
                                      {(d.videoList?.length || 0) + (d.liveList?.length || 0)}
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setActiveTabPerDate(prev => ({ ...prev, [d.date]: 'orders_vt' }))}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                      currentTab === 'orders_vt'
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                  >
                                    <ShoppingBag className="w-3.5 h-3.5" />
                                    <span>Orders by VT</span>
                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${currentTab === 'orders_vt' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200 text-slate-700'}`}>
                                      {d.ordersVTList?.length || 0}
                                    </span>
                                    <span className="text-[11px] opacity-90 font-normal ml-0.5">
                                      (Rp {(d.gmvVT || 0).toLocaleString()})
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setActiveTabPerDate(prev => ({ ...prev, [d.date]: 'orders_live' }))}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                      currentTab === 'orders_live'
                                        ? 'bg-rose-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                  >
                                    <Radio className="w-3.5 h-3.5" />
                                    <span>Orders by Live</span>
                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${currentTab === 'orders_live' ? 'bg-rose-800 text-rose-100' : 'bg-slate-200 text-slate-700'}`}>
                                      {d.ordersLiveList?.length || 0}
                                    </span>
                                    <span className="text-[11px] opacity-90 font-normal ml-0.5">
                                      (Rp {(d.gmvLive || 0).toLocaleString()})
                                    </span>
                                  </button>
                                </div>

                                {/* Quick Search Box */}
                                <div className="relative w-full sm:w-64">
                                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                  <input
                                    type="text"
                                    placeholder="Cari kreator / ID..."
                                    value={searchPerDate[d.date] || ''}
                                    onChange={(e) => setSearchPerDate(prev => ({ ...prev, [d.date]: e.target.value }))}
                                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                </div>
                              </div>

                              {/* TAB 1: VIDEO & SESI LIVE */}
                              {currentTab === 'videos' && (
                                <div className="space-y-4">
                                  {/* Sub-Section VT */}
                                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="px-4 py-2.5 bg-indigo-50/50 border-b border-indigo-100/60 flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Video className="w-4 h-4 text-indigo-600" />
                                        <span className="font-bold text-xs text-indigo-900">Daftar Konten Video VT</span>
                                      </div>
                                      <span className="text-[11px] text-indigo-700 font-semibold bg-indigo-100/80 px-2 py-0.5 rounded-full">
                                        {filteredVideos.length} Video Terdeteksi
                                      </span>
                                    </div>
                                    <div className="overflow-x-auto max-h-72 overflow-y-auto">
                                      <table className="w-full text-xs">
                                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-left sticky top-0">
                                          <tr>
                                            <th className="py-2 px-3 w-10 text-center">#</th>
                                            <th className="py-2 px-3">Kreator</th>
                                            <th className="py-2 px-3">Video ID & Tautan</th>
                                            <th className="py-2 px-3 text-right">Views</th>
                                            <th className="py-2 px-3 text-right">Likes</th>
                                            <th className="py-2 px-3">Produk Terkait</th>
                                            <th className="py-2 px-3">Sumber Data</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700">
                                          {filteredVideos.length === 0 ? (
                                            <tr>
                                              <td colSpan={7} className="text-center py-6 text-slate-400 italic">
                                                {searchTerm ? 'Tidak ada video yang cocok dengan pencarian.' : 'Tidak ada konten video VT yang tercatat pada tanggal ini.'}
                                              </td>
                                            </tr>
                                          ) : (
                                            filteredVideos.map((v: VideoDetailItem, vIdx: number) => {
                                              const isTikTokId = /^\d{15,22}$/.test(v.videoId);
                                              const tiktokUrl = v.linkVideo || (isTikTokId ? `https://www.tiktok.com/@${v.creator}/video/${v.videoId}` : null);

                                              return (
                                                <tr key={v.videoId || vIdx} className="hover:bg-slate-50">
                                                  <td className="py-2 px-3 text-center text-slate-400 font-mono">{vIdx + 1}</td>
                                                  <td className="py-2 px-3 font-semibold text-indigo-600">
                                                    @{v.creator}
                                                  </td>
                                                  <td className="py-2 px-3 font-mono text-[11px]">
                                                    {tiktokUrl ? (
                                                      <a
                                                        href={tiktokUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1"
                                                      >
                                                        <span>{v.videoId}</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                      </a>
                                                    ) : (
                                                      <span>{v.videoId}</span>
                                                    )}
                                                  </td>
                                                  <td className="py-2 px-3 text-right font-medium">
                                                    {(v.views || 0) > 0 ? (v.views || 0).toLocaleString() : '-'}
                                                  </td>
                                                  <td className="py-2 px-3 text-right font-medium">
                                                    {(v.likes || 0) > 0 ? (v.likes || 0).toLocaleString() : '-'}
                                                  </td>
                                                  <td className="py-2 px-3 text-slate-600 truncate max-w-xs" title={v.productName}>
                                                    {v.productName || '-'}
                                                  </td>
                                                  <td className="py-2 px-3">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                                      {v.source || 'Auto-Sync'}
                                                    </span>
                                                  </td>
                                                </tr>
                                              );
                                            })
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>

                                  {/* Sub-Section Live */}
                                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="px-4 py-2.5 bg-rose-50/50 border-b border-rose-100/60 flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Radio className="w-4 h-4 text-rose-600" />
                                        <span className="font-bold text-xs text-rose-900">Daftar Sesi Livestream</span>
                                      </div>
                                      <span className="text-[11px] text-rose-700 font-semibold bg-rose-100/80 px-2 py-0.5 rounded-full">
                                        {filteredLive.length} Sesi Terdeteksi
                                      </span>
                                    </div>
                                    <div className="overflow-x-auto max-h-60 overflow-y-auto">
                                      <table className="w-full text-xs">
                                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-left sticky top-0">
                                          <tr>
                                            <th className="py-2 px-3 w-10 text-center">#</th>
                                            <th className="py-2 px-3">Kreator</th>
                                            <th className="py-2 px-3">Livestream Room ID</th>
                                            <th className="py-2 px-3 text-right">Views Live</th>
                                            <th className="py-2 px-3 text-right">Likes Live</th>
                                            <th className="py-2 px-3">Durasi</th>
                                            <th className="py-2 px-3">Sumber Data</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700">
                                          {filteredLive.length === 0 ? (
                                            <tr>
                                              <td colSpan={7} className="text-center py-6 text-slate-400 italic">
                                                {searchTerm ? 'Tidak ada sesi live yang cocok dengan pencarian.' : 'Tidak ada sesi Live yang tercatat pada tanggal ini.'}
                                              </td>
                                            </tr>
                                          ) : (
                                            filteredLive.map((l: LiveDetailItem, lIdx: number) => (
                                              <tr key={l.roomId || lIdx} className="hover:bg-slate-50">
                                                <td className="py-2 px-3 text-center text-slate-400 font-mono">{lIdx + 1}</td>
                                                <td className="py-2 px-3 font-semibold text-rose-600">
                                                  @{l.creator}
                                                </td>
                                                <td className="py-2 px-3 font-mono text-[11px]">
                                                  {l.roomId}
                                                </td>
                                                <td className="py-2 px-3 text-right font-medium">
                                                  {(l.views || 0) > 0 ? (l.views || 0).toLocaleString() : '-'}
                                                </td>
                                                <td className="py-2 px-3 text-right font-medium">
                                                  {(l.likes || 0) > 0 ? (l.likes || 0).toLocaleString() : '-'}
                                                </td>
                                                <td className="py-2 px-3 text-slate-600">
                                                  {l.duration || '-'}
                                                </td>
                                                <td className="py-2 px-3">
                                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                                    {l.source || 'Auto-Sync / Live'}
                                                  </span>
                                                </td>
                                              </tr>
                                            ))
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* TAB 2: ORDERS BY VT */}
                              {currentTab === 'orders_vt' && (
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                  <div className="px-4 py-2.5 bg-emerald-50/50 border-b border-emerald-100/60 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <ShoppingBag className="w-4 h-4 text-emerald-600" />
                                      <span className="font-bold text-xs text-emerald-900">Rincian Order Attribution: Video (VT)</span>
                                    </div>
                                    <span className="text-[11px] text-emerald-800 font-bold bg-emerald-100 px-2.5 py-0.5 rounded-full">
                                      {filteredOrdersVT.length} Pesanan · Total Rp {(d.gmvVT || 0).toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                                    <table className="w-full text-xs">
                                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-left sticky top-0">
                                        <tr>
                                          <th className="py-2 px-3 w-10 text-center">#</th>
                                          <th className="py-2 px-3">Order ID (TikTok)</th>
                                          <th className="py-2 px-3">Kreator</th>
                                          <th className="py-2 px-3">Video ID Asal</th>
                                          <th className="py-2 px-3">Produk / SKU</th>
                                          <th className="py-2 px-3 text-center">Qty</th>
                                          <th className="py-2 px-3 text-right">Harga Satuan</th>
                                          <th className="py-2 px-3 text-right font-bold text-emerald-700">GMV (Rp)</th>
                                          <th className="py-2 px-3 text-center">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 text-slate-700">
                                        {filteredOrdersVT.length === 0 ? (
                                          <tr>
                                            <td colSpan={9} className="text-center py-8 text-slate-400 italic">
                                              {searchTerm ? 'Tidak ada order VT yang cocok dengan pencarian.' : 'Tidak ada transaksi order dari Video VT pada tanggal ini.'}
                                            </td>
                                          </tr>
                                        ) : (
                                          filteredOrdersVT.map((o: OrderDetailItem, oIdx: number) => {
                                            const isTikTokVid = /^\d{15,22}$/.test(o.contentUid || '');
                                            const vidUrl = isTikTokVid ? `https://www.tiktok.com/@${o.creator}/video/${o.contentUid}` : null;
                                            
                                            const parts = (o.orderId || '').split('_');
                                            const cleanOrderId = parts[0] || o.orderId;
                                            const skuIdFromKey = parts.length > 1 ? parts[1] : null;

                                            return (
                                              <tr key={o.orderId || oIdx} className="hover:bg-slate-50">
                                                <td className="py-2 px-3 text-center text-slate-400 font-mono">{oIdx + 1}</td>
                                                <td className="py-2 px-3 font-mono" title={`Full Key: ${o.orderId}`}>
                                                  <span className="font-bold text-slate-900 select-all">{cleanOrderId}</span>
                                                  {skuIdFromKey && (
                                                    <span className="block text-[10px] text-slate-400 font-normal">
                                                      SKU: {skuIdFromKey}
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="py-2 px-3 font-semibold text-indigo-600">
                                                  @{o.creator}
                                                </td>
                                                <td className="py-2 px-3 font-mono text-[11px]">
                                                  {vidUrl ? (
                                                    <a 
                                                      href={vidUrl} 
                                                      target="_blank" 
                                                      rel="noopener noreferrer"
                                                      className="text-indigo-600 hover:underline inline-flex items-center gap-1"
                                                    >
                                                      <span>{o.contentUid}</span>
                                                      <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                  ) : (
                                                    <span className="text-slate-500">{o.contentUid || '-'}</span>
                                                  )}
                                                </td>
                                                <td className="py-2 px-3 text-slate-700 max-w-xs truncate" title={o.productName}>
                                                  <span>{o.productName || '-'}</span>
                                                  {o.productId && o.productId !== '-' && (
                                                    <span className="block text-[10px] text-slate-400 font-mono">ID: {o.productId}</span>
                                                  )}
                                                </td>
                                                <td className="py-2 px-3 text-center font-bold text-slate-800">
                                                  {o.quantity}
                                                </td>
                                                <td className="py-2 px-3 text-right text-slate-600 font-medium">
                                                  Rp {Math.round(o.price || 0).toLocaleString()}
                                                </td>
                                                <td className="py-2 px-3 text-right font-bold text-emerald-600">
                                                  Rp {Math.round(o.gmv || 0).toLocaleString()}
                                                </td>
                                                <td className="py-2 px-3 text-center">
                                                  {o.isRefund ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                      Refund
                                                    </span>
                                                  ) : (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                      {o.status || 'Success'}
                                                    </span>
                                                  )}
                                                </td>
                                              </tr>
                                            );
                                          })
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* TAB 3: ORDERS BY LIVE */}
                              {currentTab === 'orders_live' && (
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                  <div className="px-4 py-2.5 bg-rose-50/50 border-b border-rose-100/60 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Radio className="w-4 h-4 text-rose-600" />
                                      <span className="font-bold text-xs text-rose-900">Rincian Order Attribution: Livestream</span>
                                    </div>
                                    <span className="text-[11px] text-rose-800 font-bold bg-rose-100 px-2.5 py-0.5 rounded-full">
                                      {filteredOrdersLive.length} Pesanan · Total Rp {(d.gmvLive || 0).toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                                    <table className="w-full text-xs">
                                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-left sticky top-0">
                                        <tr>
                                          <th className="py-2 px-3 w-10 text-center">#</th>
                                          <th className="py-2 px-3">Order ID (TikTok)</th>
                                          <th className="py-2 px-3">Kreator</th>
                                          <th className="py-2 px-3">Livestream Room ID</th>
                                          <th className="py-2 px-3">Produk / SKU</th>
                                          <th className="py-2 px-3 text-center">Qty</th>
                                          <th className="py-2 px-3 text-right">Harga Satuan</th>
                                          <th className="py-2 px-3 text-right font-bold text-rose-700">GMV (Rp)</th>
                                          <th className="py-2 px-3 text-center">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 text-slate-700">
                                        {filteredOrdersLive.length === 0 ? (
                                          <tr>
                                            <td colSpan={9} className="text-center py-8 text-slate-400 italic">
                                              {searchTerm ? 'Tidak ada order Live yang cocok dengan pencarian.' : 'Tidak ada transaksi order dari Livestream pada tanggal ini.'}
                                            </td>
                                          </tr>
                                        ) : (
                                          filteredOrdersLive.map((o: OrderDetailItem, oIdx: number) => {
                                            const parts = (o.orderId || '').split('_');
                                            const cleanOrderId = parts[0] || o.orderId;
                                            const skuIdFromKey = parts.length > 1 ? parts[1] : null;

                                            return (
                                              <tr key={o.orderId || oIdx} className="hover:bg-slate-50">
                                                <td className="py-2 px-3 text-center text-slate-400 font-mono">{oIdx + 1}</td>
                                                <td className="py-2 px-3 font-mono" title={`Full Key: ${o.orderId}`}>
                                                  <span className="font-bold text-slate-900 select-all">{cleanOrderId}</span>
                                                  {skuIdFromKey && (
                                                    <span className="block text-[10px] text-slate-400 font-normal">
                                                      SKU: {skuIdFromKey}
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="py-2 px-3 font-semibold text-rose-600">
                                                  @{o.creator}
                                                </td>
                                                <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                                                  {o.contentUid || '-'}
                                                </td>
                                                <td className="py-2 px-3 text-slate-700 max-w-xs truncate" title={o.productName}>
                                                  <span>{o.productName || '-'}</span>
                                                  {o.productId && o.productId !== '-' && (
                                                    <span className="block text-[10px] text-slate-400 font-mono">ID: {o.productId}</span>
                                                  )}
                                                </td>
                                                <td className="py-2 px-3 text-center font-bold text-slate-800">
                                                  {o.quantity}
                                                </td>
                                                <td className="py-2 px-3 text-right text-slate-600 font-medium">
                                                  Rp {Math.round(o.price || 0).toLocaleString()}
                                                </td>
                                                <td className="py-2 px-3 text-right font-bold text-rose-600">
                                                  Rp {Math.round(o.gmv || 0).toLocaleString()}
                                                </td>
                                                <td className="py-2 px-3 text-center">
                                                  {o.isRefund ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                      Refund
                                                    </span>
                                                  ) : (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                      {o.status || 'Success'}
                                                    </span>
                                                  )}
                                                </td>
                                              </tr>
                                            );
                                          })
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="p-[16px] border-t border-line flex items-center justify-between bg-white text-[13px]">
            <div className="text-text-soft">
              Menampilkan {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, dailyData.length)} dari {dailyData.length} hari
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
    </div>
  );
}
