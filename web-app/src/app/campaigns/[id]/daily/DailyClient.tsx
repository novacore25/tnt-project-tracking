"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { fetchDailyPerformancePageDataAction } from "@/app/actions/campaignPageActions";
import TimelineTarget from "./TimelineTarget";

const toWIBDateStr = (utcString: string | null | undefined): string | null => {
  if (!utcString) return null;
  const d = new Date(utcString);
  if (isNaN(d.getTime())) return null;
  const wibTime = new Date(d.getTime() + (7 * 60 * 60 * 1000));
  return wibTime.toISOString().substring(0, 10);
};

export default function CampaignDailyPerformanceClient({ campaignId }: { campaignId: number }) {

  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<any>(null);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

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

      const allVideosFromCreators = res.campaignCreators || [];
      const allVideos = res.videos || [];
      const allAds = res.ads || [];
      const allSales = res.sales || [];
      const allOrganicVideos = res.organicVideos || [];

      const snapshotTierMap = new Map<number, string>();

      // Grouping
      const grouped: Record<string, { gmv: number; gmvAds: number; creators: Map<string, string>; pendingCreators: Map<string, string>; videos: Set<string>; videoCreators: Set<string>; gmvLive: number; gmvVT: number; ordersLive: number; ordersVT: number; liveSessions: Set<string>; liveCreators: Map<string, string>; pendingLiveCreators: Map<string, string> }> = {};
      const monthlyGrouped: Record<string, { gmv: number; gmvAds: number; creators: Map<string, string>; pendingCreators: Map<string, string>; videos: Set<string>; videoCreators: Set<string>; gmvLive: number; gmvVT: number; ordersLive: number; ordersVT: number; liveSessions: Set<string>; liveCreators: Map<string, string>; pendingLiveCreators: Map<string, string> }> = {};

      // 4. Compute daily sales stats directly from sales table
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
      }>();

      allSales.forEach(s => {
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
            orders_vt: 0
          });
        }
        const day = dailySalesMap.get(dateStr)!;
        const gmv = Number(s.gmv || 0);
        const qty = Number(s.quantity || 0);
        const cType = (s.content_type || '').toLowerCase();

        day.total_gmv += gmv;

        if (cType === 'livestream' || cType === 'live') {
          day.gmv_live += gmv;
          day.orders_live += qty;
        } else {
          day.gmv_vt += gmv;
          day.orders_vt += qty;
        }
      });

      const allSalesStats = Array.from(dailySalesMap.values());

      if (allSalesStats.length > 0) {
        allSalesStats.forEach((stat: any) => {
          if (!stat.date_str) return;
          const dateStr = stat.date_str;
          
          if (campaignStartStr && dateStr < campaignStartStr) return;

          if (!grouped[dateStr]) grouped[dateStr] = { gmv: 0, gmvAds: 0, creators: new Map(), pendingCreators: new Map(), videos: new Set(), videoCreators: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set(), liveCreators: new Map(), pendingLiveCreators: new Map() };
          
          grouped[dateStr].gmvLive += (stat.gmv_live || 0);
          grouped[dateStr].ordersLive += (stat.orders_live || 0);
          grouped[dateStr].gmvVT += (stat.gmv_vt || 0);
          grouped[dateStr].ordersVT += (stat.orders_vt || 0);
          grouped[dateStr].gmv += (stat.total_gmv || 0);
          
          // We DO NOT add active_creators from sales to grouped[dateStr].creators, because we only want to count *approved* creators on this date.
          // We DO NOT add active_videos from sales to grouped[dateStr].videos, because we only want to count *uploaded* videos on this date, not videos that made a sale on this date.

          const monthStr = dateStr.substring(0, 7);
          if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, gmvAds: 0, creators: new Map(), pendingCreators: new Map(), videos: new Set(), videoCreators: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set(), liveCreators: new Map(), pendingLiveCreators: new Map() };
          
          monthlyGrouped[monthStr].gmvLive += (stat.gmv_live || 0);
          monthlyGrouped[monthStr].ordersLive += (stat.orders_live || 0);
          monthlyGrouped[monthStr].gmvVT += (stat.gmv_vt || 0);
          monthlyGrouped[monthStr].ordersVT += (stat.orders_vt || 0);
          monthlyGrouped[monthStr].gmv += (stat.total_gmv || 0);
          
          // We DO NOT add active_videos from sales to monthlyGrouped[monthStr].videos either.
        });
      }

      if (allVideosFromCreators.length > 0) {
        allVideosFromCreators.forEach(cc => {
          const username = cc.creators?.username || 'unknown';
          const resolvedTier = cc.tier || snapshotTierMap.get(cc.creator_id) || 'Nano';

          let cType = cc.content_type || '-';
          if (cType === '-' || !cType) {
            const qVt = Number(cc.qty_vt) || 0;
            const qLive = Number(cc.qty_live) || 0;
            if (qVt >= 1 && qLive === 0) cType = 'Video';
            else if (qVt === 0 && qLive >= 1) cType = 'Live';
            else if (qVt >= 1 && qLive >= 1) cType = 'Video & Live';
          }
          const isLiveCreator = cType.toLowerCase().includes('live');

          if (cc.created_at) {
            const addedDateStr = toWIBDateStr(cc.created_at);
            let countAdded = true;
            if (addedDateStr && campaignStartStr && addedDateStr < campaignStartStr) countAdded = false;
            
            if (countAdded && addedDateStr) {
              if (!grouped[addedDateStr]) grouped[addedDateStr] = { gmv: 0, gmvAds: 0, creators: new Map(), pendingCreators: new Map(), videos: new Set(), videoCreators: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set(), liveCreators: new Map(), pendingLiveCreators: new Map() };
              grouped[addedDateStr].pendingCreators.set(username, resolvedTier);
              if (isLiveCreator) {
                grouped[addedDateStr].pendingLiveCreators.set(username, resolvedTier);
              }

              const monthStr = cc.created_at.substring(0, 7);
              if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, gmvAds: 0, creators: new Map(), pendingCreators: new Map(), videos: new Set(), videoCreators: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set(), liveCreators: new Map(), pendingLiveCreators: new Map() };
              monthlyGrouped[monthStr].pendingCreators.set(username, resolvedTier);
              if (isLiveCreator) {
                monthlyGrouped[monthStr].pendingLiveCreators.set(username, resolvedTier);
              }
            }
          }

          if (cc.approved_at) {
            const approvedDateStr = toWIBDateStr(cc.approved_at);
            let countCreator = true;
            if (approvedDateStr && campaignStartStr && approvedDateStr < campaignStartStr) countCreator = false;
            
            if (countCreator && approvedDateStr) {
              if (!grouped[approvedDateStr]) grouped[approvedDateStr] = { gmv: 0, gmvAds: 0, creators: new Map(), pendingCreators: new Map(), videos: new Set(), videoCreators: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set(), liveCreators: new Map(), pendingLiveCreators: new Map() };
              grouped[approvedDateStr].creators.set(username, resolvedTier);
              if (isLiveCreator) {
                grouped[approvedDateStr].liveCreators.set(username, resolvedTier);
              }

              const monthStr = cc.approved_at.substring(0, 7);
              if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, gmvAds: 0, creators: new Map(), pendingCreators: new Map(), videos: new Set(), videoCreators: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set(), liveCreators: new Map(), pendingLiveCreators: new Map() };
              monthlyGrouped[monthStr].creators.set(username, resolvedTier);
              if (isLiveCreator) {
                monthlyGrouped[monthStr].liveCreators.set(username, resolvedTier);
              }
            }
          }

          if (!hasSkus || !cc.videos || cc.videos.length === 0) return;
          cc.videos.forEach((v: any) => {
            if (!v.created_at || !v.link_video) return; 
            const dateStr = toWIBDateStr(v.created_at);
            if (!dateStr) return;
            if (campaignStartStr && dateStr < campaignStartStr) return;
            
            if (!grouped[dateStr]) grouped[dateStr] = { gmv: 0, gmvAds: 0, creators: new Map(), pendingCreators: new Map(), videos: new Set(), videoCreators: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set(), liveCreators: new Map(), pendingLiveCreators: new Map() };
            
            // Extract TikTok video ID to avoid double counting with organic videos
            let videoId = v.id.toString();
            const match = v.link_video.match(/\/video\/(\d+)/);
            if (match && match[1]) {
              videoId = match[1];
            }
            
            grouped[dateStr].videos.add(videoId);
            grouped[dateStr].videoCreators.add(username);

            const monthStr = v.created_at.substring(0, 7);
            if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, gmvAds: 0, creators: new Map(), pendingCreators: new Map(), videos: new Set(), videoCreators: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set(), liveCreators: new Map(), pendingLiveCreators: new Map() };
            monthlyGrouped[monthStr].videos.add(videoId);
            monthlyGrouped[monthStr].videoCreators.add(username);
          });
        });

        // Map organic videos already fetched in parallel Phase 1
        allOrganicVideos.forEach(v => {
          if (!hasSkus || !v.product_id || !skuSet.has(v.product_id)) return;
          if (!v.post_time || !v.content_uid) return;
          const dateStr = toWIBDateStr(String(v.post_time));
          if (!dateStr) return;
          if (campaignStartStr && dateStr < campaignStartStr) return;

          if (!grouped[dateStr]) grouped[dateStr] = { gmv: 0, gmvAds: 0, creators: new Map(), pendingCreators: new Map(), videos: new Set(), videoCreators: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set(), liveCreators: new Map(), pendingLiveCreators: new Map() };
          const monthStr = dateStr.substring(0, 7);
          if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, gmvAds: 0, creators: new Map(), pendingCreators: new Map(), videos: new Set(), videoCreators: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set(), liveCreators: new Map(), pendingLiveCreators: new Map() };

          if (v.content_type === 'Video') {
            grouped[dateStr].videos.add(v.content_uid.toString());
            if (v.creator_username) grouped[dateStr].videoCreators.add(v.creator_username);
            monthlyGrouped[monthStr].videos.add(v.content_uid.toString());
            if (v.creator_username) monthlyGrouped[monthStr].videoCreators.add(v.creator_username);
          } else if (v.content_type === 'Livestream' || v.content_type === 'Live') {
            const uidStr = v.content_uid ? v.content_uid.toString() : '';
            const isDummy = !uidStr || uidStr === '-' || uidStr === '0' || uidStr.toLowerCase() === 'n/a' || uidStr === 'null';
            const uniqueKey = isDummy ? `dummy_${v.creator_username}_${dateStr}_${Math.random()}` : uidStr;
            
            grouped[dateStr].liveSessions.add(uniqueKey);
            monthlyGrouped[monthStr].liveSessions.add(uniqueKey);
          }
        });
      }



      if (allAds.length > 0) {
        const previousAdValues: Record<string, number> = {};
        allAds.forEach(ad => {
          if (!ad.tanggal || !ad.ad_id) return;
          const dateStr = toWIBDateStr(ad.tanggal);
          if (!dateStr) return;
          
          const currentGmv = ad.gross_revenue_usd || 0;
          const prevGmv = previousAdValues[ad.ad_id] || 0;
          const deltaUsd = currentGmv - prevGmv;
          
          // Ensure we record the memory of this ad's revenue even if it's before campaign start
          previousAdValues[ad.ad_id] = currentGmv;

          if (campaignStartStr && dateStr < campaignStartStr) return;
          
          if (deltaUsd > 0) {
            const kurs = (ad.kurs && ad.kurs < 1000) ? ad.kurs * 1000 : (ad.kurs || 16000);
            const deltaIdr = deltaUsd * kurs;
            
            if (!grouped[dateStr]) grouped[dateStr] = { gmv: 0, gmvAds: 0, creators: new Map(), pendingCreators: new Map(), videos: new Set(), videoCreators: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set(), liveCreators: new Map(), pendingLiveCreators: new Map() };
            grouped[dateStr].gmvAds += deltaIdr;
            
            const monthStr = dateStr.substring(0, 7);
            if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, gmvAds: 0, creators: new Map(), pendingCreators: new Map(), videos: new Set(), videoCreators: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set(), liveCreators: new Map(), pendingLiveCreators: new Map() };
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
        const pendingTiers = getTierCounts(grouped[date].pendingCreators);
        const approvedTiers = getTierCounts(grouped[date].creators);
        const pendingLiveTiers = getTierCounts(grouped[date].pendingLiveCreators);
        const approvedLiveTiers = getTierCounts(grouped[date].liveCreators);
        return {
          date,
          gmvOrganic: grouped[date].gmv,
          gmvLive: grouped[date].gmvLive,
          gmvVT: grouped[date].gmvVT,
          ordersLive: grouped[date].ordersLive,
          ordersVT: grouped[date].ordersVT,
          gmvAds: grouped[date].gmvAds,
          totalCreators: grouped[date].creators.size,
          totalPendingCreators: grouped[date].pendingCreators.size,
          pendingNano: pendingTiers.nano, pendingMicro: pendingTiers.micro, pendingMacro: pendingTiers.macro, pendingMega: pendingTiers.mega,
          approvedNano: approvedTiers.nano, approvedMicro: approvedTiers.micro, approvedMacro: approvedTiers.macro, approvedMega: approvedTiers.mega,
          totalLiveCreators: grouped[date].liveCreators.size,
          totalPendingLiveCreators: grouped[date].pendingLiveCreators.size,
          pendingLiveNano: pendingLiveTiers.nano, pendingLiveMicro: pendingLiveTiers.micro, pendingLiveMacro: pendingLiveTiers.macro, pendingLiveMega: pendingLiveTiers.mega,
          approvedLiveNano: approvedLiveTiers.nano, approvedLiveMicro: approvedLiveTiers.micro, approvedLiveMacro: approvedLiveTiers.macro, approvedLiveMega: approvedLiveTiers.mega,
          totalVideos: grouped[date].videos.size,
          totalVideoCreators: grouped[date].videoCreators.size,
          totalLiveSessions: grouped[date].liveSessions.size
        };
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const formattedMonthly = Object.keys(monthlyGrouped).map(month => {
        const pendingTiers = getTierCounts(monthlyGrouped[month].pendingCreators);
        const approvedTiers = getTierCounts(monthlyGrouped[month].creators);
        const pendingLiveTiers = getTierCounts(monthlyGrouped[month].pendingLiveCreators);
        const approvedLiveTiers = getTierCounts(monthlyGrouped[month].liveCreators);
        return {
          month,
          gmvOrganic: monthlyGrouped[month].gmv,
          gmvLive: monthlyGrouped[month].gmvLive,
          gmvVT: monthlyGrouped[month].gmvVT,
          ordersLive: monthlyGrouped[month].ordersLive,
          ordersVT: monthlyGrouped[month].ordersVT,
          gmvAds: monthlyGrouped[month].gmvAds,
          totalCreators: monthlyGrouped[month].creators.size,
          totalPendingCreators: monthlyGrouped[month].pendingCreators.size,
          pendingNano: pendingTiers.nano, pendingMicro: pendingTiers.micro, pendingMacro: pendingTiers.macro, pendingMega: pendingTiers.mega,
          approvedNano: approvedTiers.nano, approvedMicro: approvedTiers.micro, approvedMacro: approvedTiers.macro, approvedMega: approvedTiers.mega,
          totalLiveCreators: monthlyGrouped[month].liveCreators.size,
          totalPendingLiveCreators: monthlyGrouped[month].pendingLiveCreators.size,
          pendingLiveNano: pendingLiveTiers.nano, pendingLiveMicro: pendingLiveTiers.micro, pendingLiveMacro: pendingLiveTiers.macro, pendingLiveMega: pendingLiveTiers.mega,
          approvedLiveNano: approvedLiveTiers.nano, approvedLiveMicro: approvedLiveTiers.micro, approvedLiveMacro: approvedLiveTiers.macro, approvedLiveMega: approvedLiveTiers.mega,
          totalVideos: monthlyGrouped[month].videos.size,
          totalVideoCreators: monthlyGrouped[month].videoCreators.size,
          totalLiveSessions: monthlyGrouped[month].liveSessions.size
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
            <thead className="border-b border-line">
              <tr>
                <th className="py-[16px] whitespace-nowrap">Tanggal</th>
                <th className="py-[16px] text-center">Video / Sesi Live</th>
                <th className="py-[16px] text-center">Kreator Aktif</th>
                <th className="py-[16px] text-center">Orders (VT/Live)</th>
                <th className="py-[16px] text-right">GMV Organik</th>
                <th className="py-[16px] text-right pr-6">GMV Ads</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-text-soft">
                    Mengkalkulasi data dari ribuan baris CSV...
                  </td>
                </tr>
              ) : dailyData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-text-soft">
                    Belum ada data untuk campaign ini.
                  </td>
                </tr>
              ) : (
                paginatedDaily.map((d, idx) => (
                  <tr key={idx} className="border-b border-line hover:bg-slate-50/50">
                    <td className="font-medium text-text whitespace-nowrap align-top pt-[20px]">
                      {new Date(d.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    
                    <td className="text-center align-top pt-[16px]">
                      <div className="flex flex-col items-center gap-1.5">
                         <span className="font-bold text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded text-[12px] min-w-[70px] inline-block">{d.totalVideos} VT</span>
                         <span className="font-bold text-rose-700 bg-rose-50/80 px-2 py-0.5 rounded text-[12px] min-w-[70px] inline-block">{d.totalLiveSessions || 0} Live</span>
                      </div>
                    </td>
                    <td className="text-center text-text-soft font-medium align-top pt-[20px]">
                      {d.totalCreators}
                    </td>
                    <td className="text-center align-top pt-[16px]">
                      <div className="flex flex-col items-center gap-1 text-[12px] font-medium text-slate-600">
                         <span className="px-2 py-0.5">{d.ordersVT || 0} VT</span>
                         <span className="px-2 py-0.5">{d.ordersLive || 0} Live</span>
                      </div>
                    </td>
                    <td className="text-right align-top pt-[16px]">
                      <div className="flex flex-col items-end gap-1 text-[13px]">
                         <span className="font-bold text-emerald-600">VT: Rp {(d.gmvVT || 0).toLocaleString()}</span>
                         <span className="font-bold text-rose-600">Live: Rp {(d.gmvLive || 0).toLocaleString()}</span>
                         <span className="text-[11px] text-slate-400 mt-1 border-t border-slate-100 pt-1">Total: Rp {(d.gmvOrganic || 0).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="text-right font-bold text-blue-600 pr-6 align-top pt-[20px]">
                      Rp {(d.gmvAds || 0).toLocaleString()}
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
