"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { Calendar, MoreHorizontal, CircleDollarSign, Play, Radio, User, UserPlus, CheckCircle2, BadgeCheck } from "lucide-react";

type TimelineTargetProps = {
  campaign: any;
  dailyData: any[];
};

export default function TimelineTarget({ campaign, dailyData }: TimelineTargetProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const formatCompact = (num: number) => {
    if (!num) return '0';
    if (num >= 1e9) {
      return (num / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' B';
    }
    if (num >= 1e6) {
      return (num / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' JT';
    }
    if (num >= 1e3) {
      return (num / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' K';
    }
    return num.toLocaleString('id-ID');
  };

  const isAwareness = campaign.tipe_campaign === 'awareness';
  const isHybrid = campaign.tipe_campaign === 'gmv_awareness';
  const isSales = campaign.tipe_campaign === 'sales' || !campaign.tipe_campaign;

  const targetGmv = Number(campaign.target_gmv) || 0;
  const targetVideo = Number(campaign.target_video) || 0;
  const targetLive = Number(campaign.target_live) || 0;
  const targetCreator = Number(campaign.target_creator) || 0;
  const targetCreatorLive = Number(campaign.target_creator_live) || 0;

  const hasAnyTarget = targetGmv > 0 || targetVideo > 0 || targetCreator > 0;

  const timelineData = useMemo(() => {
    if (!campaign.start_date) return [];

    const startDate = new Date(campaign.start_date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = campaign.end_date ? new Date(campaign.end_date) : new Date();
    endDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Determine the last day of the timeline
    // If it's past end_date and not finished, extend to today
    let lastTimelineDate = new Date(endDate);
    if (campaign.status !== 'selesai' && today.getTime() > endDate.getTime()) {
      lastTimelineDate = new Date(today);
    }

    // Pre-calculate total working days
    let totalWorkingDays = 0;
    let tempCurr = new Date(startDate);
    while (tempCurr.getTime() <= lastTimelineDate.getTime()) {
      if (tempCurr.getDay() !== 0 && tempCurr.getDay() !== 6) totalWorkingDays++;
      tempCurr.setDate(tempCurr.getDate() + 1);
    }

    const achievedMap = new Map();
    dailyData.forEach(d => {
      const dDate = new Date(d.date);
      dDate.setHours(0, 0, 0, 0);
      achievedMap.set(dDate.getTime(), {
        gmv: (Number(d.gmvOrganic) || 0) + (Number(d.gmvAds) || 0),
        gmvOrganic: Number(d.gmvOrganic) || 0,
        video: Number(d.totalVideos) || 0,
        live: Number(d.totalLiveSessions) || 0,
        creator: Number(d.totalCreators) || 0,
        pendingCreator: Number(d.totalPendingCreators) || 0,
        videoCreator: Number(d.totalVideoCreators) || 0,
        activeCreator: Number(d.totalActiveCreators) || 0,
        itemsSold: Number(d.itemsSold) || 0,
        views: Number(d.totalViews) || 0,
        likes: Number(d.totalLikes) || 0,
        revPerActiveCreator: Number(d.revPerActiveCreator) || 0,
        revPerVideo: Number(d.revPerVideo) || 0,
        likeER: Number(d.likeER) || 0,
        pendingNano: Number(d.pendingNano) || 0,
        pendingMicro: Number(d.pendingMicro) || 0,
        pendingMacro: Number(d.pendingMacro) || 0,
        pendingMega: Number(d.pendingMega) || 0,
        approvedNano: Number(d.approvedNano) || 0,
        approvedMicro: Number(d.approvedMicro) || 0,
        approvedMacro: Number(d.approvedMacro) || 0,
        approvedMega: Number(d.approvedMega) || 0,
        liveCreator: Number(d.totalLiveCreators) || 0,
        pendingLiveCreator: Number(d.totalPendingLiveCreators) || 0,
        pendingLiveNano: Number(d.pendingLiveNano) || 0,
        pendingLiveMicro: Number(d.pendingLiveMicro) || 0,
        pendingLiveMacro: Number(d.pendingLiveMacro) || 0,
        pendingLiveMega: Number(d.pendingLiveMega) || 0,
        approvedLiveNano: Number(d.approvedLiveNano) || 0,
        approvedLiveMicro: Number(d.approvedLiveMicro) || 0,
        approvedLiveMacro: Number(d.approvedLiveMacro) || 0,
        approvedLiveMega: Number(d.approvedLiveMega) || 0,
      });
    });

    let cumulativeGmv = 0;
    let cumulativeVideo = 0;
    let cumulativeLive = 0;
    let cumulativeVideoCreator = 0;
    let cumulativeApprovedCreator = 0;
    let cumulativePendingCreator = 0;
    let cumulativeLiveCreator = 0;
    let cumulativePendingLiveCreator = 0;

    const data = [];

    let currentWeekWorkingDaysCount = 0;
    let currentWeekGmvTargetVelocity = 0;
    let currentWeekVideoTargetVelocity = 0;
    let currentWeekLiveTargetVelocity = 0;
    let currentWeekVideoCreatorTargetVelocity = 0;
    let currentWeekApprovedCreatorTargetVelocity = 0;
    let currentWeekLiveCreatorTargetVelocity = 0;

    let currentWeekGmvAchieve = 0;
    let currentWeekGmvOrganicAchieve = 0;
    let currentWeekVideoAchieve = 0;
    let currentWeekLiveAchieve = 0;
    let currentWeekVideoCreatorAchieve = 0;
    let currentWeekApprovedCreatorAchieve = 0;
    let currentWeekPendingCreatorAchieve = 0;
    let currentWeekItemsSoldAchieve = 0;
    let currentWeekViewsAchieve = 0;
    let currentWeekLikesAchieve = 0;
    let currentWeekActiveCreatorsSet = new Set<string>();
    let currentWeekPendingNano = 0;
    let currentWeekPendingMicro = 0;
    let currentWeekPendingMacro = 0;
    let currentWeekPendingMega = 0;
    let currentWeekApprovedNano = 0;
    let currentWeekApprovedMicro = 0;
    let currentWeekApprovedMacro = 0;
    let currentWeekApprovedMega = 0;

    let currentWeekLiveCreatorAchieve = 0;
    let currentWeekPendingLiveCreatorAchieve = 0;
    let currentWeekPendingLiveNano = 0;
    let currentWeekPendingLiveMicro = 0;
    let currentWeekPendingLiveMacro = 0;
    let currentWeekPendingLiveMega = 0;
    let currentWeekApprovedLiveNano = 0;
    let currentWeekApprovedLiveMicro = 0;
    let currentWeekApprovedLiveMacro = 0;
    let currentWeekApprovedLiveMega = 0;

    let remainingWorkingDays = totalWorkingDays;
    let curr = new Date(startDate);
    let lastNodeIndex = -1;

    while (curr.getTime() <= lastTimelineDate.getTime()) {
      const time = curr.getTime();
      const dayOfWeek = curr.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isPastEndDate = time > endDate.getTime();
      
      const achievedToday = achievedMap.get(time) || { gmv: 0, video: 0, live: 0, creator: 0, pendingCreator: 0, videoCreator: 0, liveCreator: 0, pendingLiveCreator: 0, pendingNano: 0, pendingMicro: 0, pendingMacro: 0, pendingMega: 0, approvedNano: 0, approvedMicro: 0, approvedMacro: 0, approvedMega: 0, pendingLiveNano: 0, pendingLiveMicro: 0, pendingLiveMacro: 0, pendingLiveMega: 0, approvedLiveNano: 0, approvedLiveMicro: 0, approvedLiveMacro: 0, approvedLiveMega: 0 };

      currentWeekGmvAchieve += achievedToday.gmv;
      currentWeekGmvOrganicAchieve += achievedToday.gmvOrganic;
      currentWeekVideoAchieve += achievedToday.video;
      currentWeekLiveAchieve += achievedToday.live;
      currentWeekVideoCreatorAchieve += (achievedToday.videoCreator || 0);
      currentWeekApprovedCreatorAchieve += achievedToday.creator;
      currentWeekPendingCreatorAchieve += achievedToday.pendingCreator;
      currentWeekItemsSoldAchieve += achievedToday.itemsSold;
      currentWeekViewsAchieve += achievedToday.views;
      currentWeekLikesAchieve += achievedToday.likes;
      currentWeekPendingNano += achievedToday.pendingNano;
      currentWeekPendingMicro += achievedToday.pendingMicro;
      currentWeekPendingMacro += achievedToday.pendingMacro;
      currentWeekPendingMega += achievedToday.pendingMega;
      currentWeekApprovedNano += achievedToday.approvedNano;
      currentWeekApprovedMicro += achievedToday.approvedMicro;
      currentWeekApprovedMacro += achievedToday.approvedMacro;
      currentWeekApprovedMega += achievedToday.approvedMega;
      currentWeekLiveCreatorAchieve += achievedToday.liveCreator;
      currentWeekPendingLiveCreatorAchieve += achievedToday.pendingLiveCreator;
      currentWeekPendingLiveNano += achievedToday.pendingLiveNano;
      currentWeekPendingLiveMicro += achievedToday.pendingLiveMicro;
      currentWeekPendingLiveMacro += achievedToday.pendingLiveMacro;
      currentWeekPendingLiveMega += achievedToday.pendingLiveMega;
      currentWeekApprovedLiveNano += achievedToday.approvedLiveNano;
      currentWeekApprovedLiveMicro += achievedToday.approvedLiveMicro;
      currentWeekApprovedLiveMacro += achievedToday.approvedLiveMacro;
      currentWeekApprovedLiveMega += achievedToday.approvedLiveMega;

      let targetForTodayGmv = 0;
      let targetForTodayVideo = 0;
      let targetForTodayLive = 0;
      let targetForTodayVideoCreator = 0;
      let targetForTodayApprovedCreator = 0;
      let targetForTodayLiveCreator = 0;

      if (!isWeekend) {
        const remGmv = Math.max(0, targetGmv - cumulativeGmv);
        const remVideo = Math.max(0, targetVideo - cumulativeVideo);
        const remLive = Math.max(0, targetLive - cumulativeLive);
        const remVideoCreator = Math.max(0, targetCreator - cumulativeVideoCreator);
        const remApprovedCreator = Math.max(0, targetCreator - cumulativeApprovedCreator);
        const remLiveCreator = Math.max(0, targetCreatorLive - cumulativeLiveCreator);

        const divisor = isPastEndDate ? 1 : Math.max(1, remainingWorkingDays);

        targetForTodayGmv = remGmv / divisor;
        targetForTodayVideo = remVideo / divisor;
        targetForTodayLive = remLive / divisor;
        targetForTodayVideoCreator = remVideoCreator / divisor;
        targetForTodayApprovedCreator = remApprovedCreator / divisor;
        targetForTodayLiveCreator = remLiveCreator / divisor;

        if (currentWeekWorkingDaysCount === 0) {
          currentWeekGmvTargetVelocity = targetForTodayGmv;
          currentWeekVideoTargetVelocity = targetForTodayVideo;
          currentWeekLiveTargetVelocity = targetForTodayLive;
          currentWeekVideoCreatorTargetVelocity = targetForTodayVideoCreator;
          currentWeekApprovedCreatorTargetVelocity = targetForTodayApprovedCreator;
          currentWeekLiveCreatorTargetVelocity = targetForTodayLiveCreator;
        }
        currentWeekWorkingDaysCount++;

        remainingWorkingDays--;
      }

      const node = {
        date: new Date(curr),
        isPastEndDate,
        targetGmv: targetForTodayGmv,
        targetVideo: targetForTodayVideo,
        targetLive: targetForTodayLive,
        targetVideoCreator: targetForTodayVideoCreator,
        targetApprovedCreator: targetForTodayApprovedCreator,
        targetCreatorLive: targetForTodayLiveCreator,
        achievedGmv: achievedToday.gmv,
        achievedVideo: achievedToday.video,
        achievedLive: achievedToday.live,
        achievedCreator: achievedToday.creator,
        achievedPendingCreator: achievedToday.pendingCreator,
        achievedVideoCreator: achievedToday.videoCreator || 0,
        achievedActiveCreator: achievedToday.activeCreator || 0,
        itemsSold: achievedToday.itemsSold || 0,
        views: achievedToday.views || 0,
        likes: achievedToday.likes || 0,
        revPerActiveCreator: achievedToday.revPerActiveCreator || 0,
        revPerVideo: achievedToday.revPerVideo || 0,
        likeER: achievedToday.likeER || 0,
        achievedPendingNano: achievedToday.pendingNano,
        achievedPendingMicro: achievedToday.pendingMicro,
        achievedPendingMacro: achievedToday.pendingMacro,
        achievedPendingMega: achievedToday.pendingMega,
        achievedApprovedNano: achievedToday.approvedNano,
        achievedApprovedMicro: achievedToday.approvedMicro,
        achievedApprovedMacro: achievedToday.approvedMacro,
        achievedApprovedMega: achievedToday.approvedMega,
        liveCreator: achievedToday.liveCreator,
        pendingLiveCreator: achievedToday.pendingLiveCreator,
        pendingLiveNano: achievedToday.pendingLiveNano,
        pendingLiveMicro: achievedToday.pendingLiveMicro,
        pendingLiveMacro: achievedToday.pendingLiveMacro,
        pendingLiveMega: achievedToday.pendingLiveMega,
        approvedLiveNano: achievedToday.approvedLiveNano,
        approvedLiveMicro: achievedToday.approvedLiveMicro,
        approvedLiveMacro: achievedToday.approvedLiveMacro,
        approvedLiveMega: achievedToday.approvedLiveMega,
        weeklySummary: null as any
      };
      
      data.push(node);
      lastNodeIndex = data.length - 1;

      cumulativeGmv += achievedToday.gmv;
      cumulativeVideo += achievedToday.video;
      cumulativeLive += achievedToday.live;
      cumulativeVideoCreator += (achievedToday.videoCreator || 0);
      cumulativeApprovedCreator += achievedToday.creator;
      cumulativePendingCreator += achievedToday.pendingCreator;

      const isSunday = dayOfWeek === 0;
      const isLastDay = curr.getTime() === lastTimelineDate.getTime();
      
      if (isSunday || isLastDay) {
        if (lastNodeIndex >= 0) {
          const wVids = currentWeekVideoAchieve;
          const wActiveCreators = currentWeekVideoCreatorAchieve; // Atau fallback ke video creators
          const wRevPerCreator = wActiveCreators > 0 ? Math.round(currentWeekGmvOrganicAchieve / wActiveCreators) : 0;
          const wRevPerVideo = wVids > 0 ? Math.round(currentWeekGmvOrganicAchieve / wVids) : 0;
          const wLikeER = currentWeekViewsAchieve > 0 ? Number(((currentWeekLikesAchieve / currentWeekViewsAchieve) * 100).toFixed(2)) : 0;

          data[lastNodeIndex].weeklySummary = {
            targetGmv: currentWeekGmvTargetVelocity * currentWeekWorkingDaysCount,
            targetVideo: currentWeekVideoTargetVelocity * currentWeekWorkingDaysCount,
            targetLive: currentWeekLiveTargetVelocity * currentWeekWorkingDaysCount,
            targetVideoCreator: currentWeekVideoCreatorTargetVelocity * currentWeekWorkingDaysCount,
            targetApprovedCreator: currentWeekApprovedCreatorTargetVelocity * currentWeekWorkingDaysCount,
            targetCreatorLive: currentWeekLiveCreatorTargetVelocity * currentWeekWorkingDaysCount,
            achievedGmv: currentWeekGmvAchieve,
            achievedVideo: currentWeekVideoAchieve,
            achievedLive: currentWeekLiveAchieve,
            achievedVideoCreator: currentWeekVideoCreatorAchieve,
            achievedApprovedCreator: currentWeekApprovedCreatorAchieve,
            achievedPendingCreator: currentWeekPendingCreatorAchieve,
            itemsSold: currentWeekItemsSoldAchieve,
            revPerActiveCreator: wRevPerCreator,
            revPerVideo: wRevPerVideo,
            likeER: wLikeER,
            achievedPendingNano: currentWeekPendingNano,
            achievedPendingMicro: currentWeekPendingMicro,
            achievedPendingMacro: currentWeekPendingMacro,
            achievedPendingMega: currentWeekPendingMega,
            achievedApprovedNano: currentWeekApprovedNano,
            achievedApprovedMicro: currentWeekApprovedMicro,
            achievedApprovedMacro: currentWeekApprovedMacro,
            achievedApprovedMega: currentWeekApprovedMega,
            liveCreatorAchieve: currentWeekLiveCreatorAchieve,
            pendingLiveCreatorAchieve: currentWeekPendingLiveCreatorAchieve,
            pendingLiveNano: currentWeekPendingLiveNano,
            pendingLiveMicro: currentWeekPendingLiveMicro,
            pendingLiveMacro: currentWeekPendingLiveMacro,
            pendingLiveMega: currentWeekPendingLiveMega,
            approvedLiveNano: currentWeekApprovedLiveNano,
            approvedLiveMicro: currentWeekApprovedLiveMicro,
            approvedLiveMacro: currentWeekApprovedLiveMacro,
            approvedLiveMega: currentWeekApprovedLiveMega,
          };
        }
        
        // Reset for next week
        currentWeekGmvTargetVelocity = 0;
        currentWeekVideoTargetVelocity = 0;
        currentWeekLiveTargetVelocity = 0;
        currentWeekVideoCreatorTargetVelocity = 0;
        currentWeekApprovedCreatorTargetVelocity = 0;
        currentWeekLiveCreatorTargetVelocity = 0;
        currentWeekWorkingDaysCount = 0;

        currentWeekGmvAchieve = 0;
        currentWeekGmvOrganicAchieve = 0;
        currentWeekVideoAchieve = 0;
        currentWeekLiveAchieve = 0;
        currentWeekVideoCreatorAchieve = 0;
        currentWeekApprovedCreatorAchieve = 0;
        currentWeekPendingCreatorAchieve = 0;
        currentWeekItemsSoldAchieve = 0;
        currentWeekViewsAchieve = 0;
        currentWeekLikesAchieve = 0;
        currentWeekPendingNano = 0;
        currentWeekPendingMicro = 0;
        currentWeekPendingMacro = 0;
        currentWeekPendingMega = 0;
        currentWeekApprovedNano = 0;
        currentWeekApprovedMicro = 0;
        currentWeekApprovedMacro = 0;
        currentWeekApprovedMega = 0;
        currentWeekLiveCreatorAchieve = 0;
        currentWeekPendingLiveCreatorAchieve = 0;
        currentWeekPendingLiveNano = 0;
        currentWeekPendingLiveMicro = 0;
        currentWeekPendingLiveMacro = 0;
        currentWeekPendingLiveMega = 0;
        currentWeekApprovedLiveNano = 0;
        currentWeekApprovedLiveMicro = 0;
        currentWeekApprovedLiveMacro = 0;
        currentWeekApprovedLiveMega = 0;
      }

      curr.setDate(curr.getDate() + 1);
    }

    return data;
  }, [campaign, dailyData, targetGmv, targetVideo, targetLive, targetCreator]);

  const scrollToToday = () => {
    if (scrollRef.current) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let closestIdx = timelineData.length - 1;
      for (let i = 0; i < timelineData.length; i++) {
        if (timelineData[i].date.getTime() === today.getTime()) {
          closestIdx = i;
          break;
        }
      }
      
      const itemWidth = 216; // width 200 + gap 16
      const targetLeft = Math.max(0, closestIdx * itemWidth - scrollRef.current.clientWidth / 2 + 100);
      
      scrollRef.current.scrollTo({
        left: targetLeft,
        behavior: 'smooth'
      });
    }
  };

  // Auto-scroll to current day or end
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToToday();
    }, 300); // Give it a bit of time to render the DOM width correctly

    return () => clearTimeout(timer);
  }, [timelineData]);

  if (timelineData.length === 0) return null;

  return (
    <div className="ccard mb-[24px]">
      <div className="p-[16px] border-b border-line flex justify-between items-center">
        <div>
          <h3 className="text-[16px] font-bold text-text">Timeline Target Harian</h3>
          <p className="text-[13px] text-text-soft">Target otomatis disesuaikan secara dinamis (sisa target dibagi sisa hari kerja).</p>
        </div>
        <button 
          onClick={scrollToToday}
          className="px-3 py-1.5 text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200 rounded-md hover:bg-rose-100 transition-colors shadow-sm whitespace-nowrap"
        >
          Hari Ini
        </button>
      </div>
      
      <div 
        ref={scrollRef}
        className="overflow-x-auto pb-10 pt-10 px-8 custom-scrollbar"
        style={{ cursor: 'grab' }}
        onMouseDown={(e) => {
          const ele = scrollRef.current;
          if (!ele) return;
          ele.style.cursor = 'grabbing';
          ele.style.userSelect = 'none';
          
          let pos = {
            left: ele.scrollLeft,
            x: e.clientX,
          };
          
          const mouseMoveHandler = (e: MouseEvent) => {
            const dx = e.clientX - pos.x;
            ele.scrollLeft = pos.left - dx;
          };
          
          const mouseUpHandler = () => {
            ele.style.cursor = 'grab';
            ele.style.removeProperty('user-select');
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
          };
          
          document.addEventListener('mousemove', mouseMoveHandler);
          document.addEventListener('mouseup', mouseUpHandler);
        }}
      >
        <div className="relative min-w-max">
          {/* Main timeline line (now at bottom) */}
          <div className="absolute bottom-[36px] left-0 right-0 h-[2px] border-t-2 border-dashed border-slate-300 z-0"></div>
          
          <div className="flex items-end gap-[16px] relative z-10 pt-4 pb-4">
            {timelineData.map((day, idx) => {
              const isToday = day.date.getTime() === new Date().setHours(0, 0, 0, 0);
              const showWeekly = !!day.weeklySummary;
              
              return (
                <div key={idx} className="relative flex flex-col items-center min-w-[360px] justify-end">
                  
                  {/* Highlight Block for Today */}
                  {isToday && (
                    <div className="absolute inset-y-[-8px] left-[-4px] right-[-4px] bg-rose-50/50 border border-rose-100 rounded-xl z-0 shadow-sm pointer-events-none"></div>
                  )}

                  <div className="flex flex-col gap-3 w-full items-center justify-end z-20 pb-[24px]">
                    {showWeekly && day.weeklySummary ? (
                      <div className="bg-blue-50/50 border border-blue-200/60 rounded-[20px] p-5 w-[340px] shadow-sm relative z-20">
                        <div className="flex justify-between items-center mb-4">
                           <h4 className="text-sm font-bold text-blue-900 tracking-tight">Target Minggu Ini</h4>
                           <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[11px] font-bold">WEEKLY</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          <div className="bg-white/60 rounded-[10px] p-2 flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-semibold text-blue-800 mb-1">GMV</span>
                            <span className={day.weeklySummary.achievedGmv >= day.weeklySummary.targetGmv && targetGmv > 0 ? 'text-emerald-700 font-bold text-[11px]' : 'font-bold text-blue-900 text-[11px]'}>
                              {formatCompact(day.weeklySummary.achievedGmv)} / {targetGmv > 0 ? formatCompact(day.weeklySummary.targetGmv) : '-'}
                            </span>
                          </div>
                          <div className="bg-white/60 rounded-[10px] p-2 flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-semibold text-blue-800 mb-1">Kreator w/ VT</span>
                            <span className={day.weeklySummary.achievedVideoCreator >= day.weeklySummary.targetVideoCreator && targetCreator > 0 ? 'text-emerald-700 font-bold text-[11px]' : 'font-bold text-blue-900 text-[11px]'}>
                              {Math.round(day.weeklySummary.achievedVideoCreator)} / {targetCreator > 0 ? Math.round(day.weeklySummary.targetVideoCreator) : '-'}
                            </span>
                          </div>
                          <div className="bg-white/60 rounded-[10px] p-2 flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-semibold text-blue-800 mb-1">VT</span>
                            <span className={day.weeklySummary.achievedVideo >= day.weeklySummary.targetVideo && targetVideo > 0 ? 'text-emerald-700 font-bold text-[11px]' : 'font-bold text-blue-900 text-[11px]'}>
                              {Math.round(day.weeklySummary.achievedVideo)} / {targetVideo > 0 ? Math.round(day.weeklySummary.targetVideo) : '-'}
                            </span>
                          </div>
                          <div className="bg-white/60 rounded-[10px] p-2 flex flex-col items-center justify-center text-center">
                            <span className="text-[10px] font-semibold text-blue-800 mb-1">Live</span>
                            <span className={day.weeklySummary.achievedLive >= day.weeklySummary.targetLive && targetLive > 0 ? 'text-emerald-700 font-bold text-[11px]' : 'font-bold text-blue-900 text-[11px]'}>
                              {Math.round(day.weeklySummary.achievedLive)} / {targetLive > 0 ? Math.round(day.weeklySummary.targetLive) : '-'}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-1.5 mb-3 bg-white/70 rounded-[10px] p-2 border border-blue-100/60 text-center">
                          <div>
                            <div className="text-[9px] font-semibold text-slate-500 uppercase leading-tight">Item Sold</div>
                            <div className="font-bold text-amber-700 text-[11px] mt-0.5 truncate" title={`${(day.weeklySummary.itemsSold || 0).toLocaleString()} pcs`}>
                              {formatCompact(day.weeklySummary.itemsSold || 0)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[9px] font-semibold text-slate-500 uppercase leading-tight" title="Revenue per Active Creator">Rev / Kr</div>
                            <div className="font-bold text-blue-700 text-[11px] mt-0.5 truncate" title={`Rp ${(day.weeklySummary.revPerActiveCreator || 0).toLocaleString()}`}>
                              {formatCompact(day.weeklySummary.revPerActiveCreator || 0)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[9px] font-semibold text-slate-500 uppercase leading-tight" title="Revenue per Video">Rev / VT</div>
                            <div className="font-bold text-emerald-700 text-[11px] mt-0.5 truncate" title={`Rp ${(day.weeklySummary.revPerVideo || 0).toLocaleString()}`}>
                              {formatCompact(day.weeklySummary.revPerVideo || 0)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[9px] font-semibold text-slate-500 uppercase leading-tight" title="Like Engagement Rate">Like ER</div>
                            <div className="font-bold text-rose-600 text-[11px] mt-0.5">
                              {day.weeklySummary.likeER || 0}%
                            </div>
                          </div>
                        </div>

                        <div className="bg-white/50 rounded-[12px] p-3 border border-blue-100/50">
                           <div className="grid grid-cols-2 gap-4">
                             {/* Kreator Ditambah */}
                             <div>
                               <div className="flex items-center gap-1.5 mb-1">
                                 <span className="text-[11px] font-bold text-blue-900 leading-tight">Kr Ditambah</span>
                               </div>
                               <div className="flex flex-col gap-1">
                                 <span className="font-bold text-orange-600 text-[16px] leading-none">{Math.round(day.weeklySummary.achievedPendingCreator)}</span>
                                 <div className="text-[9px] text-blue-700/60 font-medium">N {day.weeklySummary.achievedPendingNano} | Mi {day.weeklySummary.achievedPendingMicro} | Ma {day.weeklySummary.achievedPendingMacro} | Me {day.weeklySummary.achievedPendingMega}</div>
                               </div>
                             </div>
                             {/* Kr Approve */}
                             <div>
                               <div className="flex items-center gap-1.5 mb-1">
                                 <span className="text-[11px] font-bold text-blue-900 leading-tight">Kr Approve</span>
                               </div>
                               <div className="flex flex-col gap-1">
                                 <div className="flex items-end gap-1 leading-none">
                                   <span className="font-bold text-emerald-600 text-[16px]">{Math.round(day.weeklySummary.achievedApprovedCreator)}</span>
                                   <span className="font-bold text-emerald-600/60 text-[11px] mb-[1px]">/ {targetCreator > 0 ? Math.round(day.weeklySummary.targetApprovedCreator) : '0'}</span>
                                 </div>
                                 <div className="text-[9px] text-blue-700/60 font-medium">N {day.weeklySummary.achievedApprovedNano} | Mi {day.weeklySummary.achievedApprovedMicro} | Ma {day.weeklySummary.achievedApprovedMacro} | Me {day.weeklySummary.achievedApprovedMega}</div>
                               </div>
                             </div>
                             {/* Kr Live Ditambah */}
                             <div>
                               <div className="flex items-center gap-1.5 mb-1">
                                 <span className="text-[11px] font-bold text-blue-900 leading-tight">Kr Live Ditambah</span>
                               </div>
                               <div className="flex flex-col gap-1">
                                 <span className="font-bold text-purple-600 text-[16px] leading-none">{Math.round(day.weeklySummary.pendingLiveCreatorAchieve)}</span>
                                 <div className="text-[9px] text-blue-700/60 font-medium">N {day.weeklySummary.pendingLiveNano} | Mi {day.weeklySummary.pendingLiveMicro} | Ma {day.weeklySummary.pendingLiveMacro} | Me {day.weeklySummary.pendingLiveMega}</div>
                               </div>
                             </div>
                             {/* Kr Live Approve */}
                             <div>
                               <div className="flex items-center gap-1.5 mb-1">
                                 <span className="text-[11px] font-bold text-blue-900 leading-tight">Kr Live Approve</span>
                               </div>
                               <div className="flex flex-col gap-1">
                                 <div className="flex items-end gap-1 leading-none">
                                   <span className="font-bold text-purple-600 text-[16px]">{Math.round(day.weeklySummary.liveCreatorAchieve)}</span>
                                   <span className="font-bold text-purple-600/60 text-[11px] mb-[1px]">/ {targetCreatorLive > 0 ? Math.round(day.weeklySummary.targetCreatorLive) : '0'}</span>
                                 </div>
                                 <div className="text-[9px] text-blue-700/60 font-medium">N {day.weeklySummary.approvedLiveNano} | Mi {day.weeklySummary.approvedLiveMicro} | Ma {day.weeklySummary.approvedLiveMacro} | Me {day.weeklySummary.approvedLiveMega}</div>
                               </div>
                             </div>
                           </div>
                        </div>
                      </div>
                    ) : null}

                    {/* Daily Block */}
                    <div className={`rounded-[20px] p-5 w-[340px] shadow-sm border relative z-20 ${isToday ? 'bg-white border-rose-200 shadow-rose-100' : 'bg-white border-slate-200'}`}>
                      {/* Header */}
                      <div className="flex justify-between items-center mb-5">
                        <div className="flex items-center gap-3">
                          <div className="bg-indigo-50 text-indigo-600 p-2 rounded-[12px]">
                            <Calendar size={20} strokeWidth={2.5} />
                          </div>
                          <div className="flex items-center gap-3">
                            <h3 className="text-[18px] font-bold text-slate-800 tracking-tight">
                              {day.date.toLocaleDateString('id-ID', { weekday: 'long' })}
                            </h3>
                            <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[12px] font-semibold">
                              {day.date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                        <button className="text-slate-400 hover:text-slate-600 p-1 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
                          <MoreHorizontal size={20} />
                        </button>
                      </div>

                      {/* 2x2 Metric Grid */}
                      <div className="grid grid-cols-2 gap-3 mb-5">
                        {/* GMV */}
                        <div className="border border-emerald-100/60 bg-emerald-50/30 rounded-[12px] p-3 flex flex-col justify-between">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[12px] font-semibold text-emerald-800">GMV</span>
                            <div className="bg-emerald-100/80 text-emerald-600 p-1.5 rounded-full">
                              <CircleDollarSign size={14} strokeWidth={2.5} />
                            </div>
                          </div>
                          <div>
                            <div className="text-[18px] font-bold text-emerald-600 tracking-tight leading-none mb-1 truncate" title={Math.round(day.achievedGmv).toLocaleString()}>
                              {formatCompact(day.achievedGmv)}
                            </div>
                            <div className="text-[10px] text-emerald-700/70 leading-tight">
                              dari target <br/>
                              <span className="font-medium text-emerald-700 truncate block" title={targetGmv > 0 ? Math.round(day.targetGmv).toLocaleString() : '- / -'}>
                                {targetGmv > 0 ? formatCompact(day.targetGmv) : '- / -'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Kreator */}
                        <div className="border border-orange-100/60 bg-orange-50/30 rounded-[12px] p-3 flex flex-col justify-between">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[12px] font-semibold text-orange-800">Kreator</span>
                            <div className="bg-orange-100/80 text-orange-600 p-1.5 rounded-full">
                              <User size={14} strokeWidth={2.5} />
                            </div>
                          </div>
                          <div>
                            <div className="text-[18px] font-bold text-orange-600 tracking-tight leading-none mb-1">
                              {Math.round(day.achievedVideoCreator)}
                            </div>
                            <div className="text-[10px] text-orange-700/70 leading-tight">
                              dari target <br/>
                              <span className="font-medium text-orange-700">{targetCreator > 0 ? Math.round(day.targetVideoCreator) : '- / -'}</span>
                            </div>
                          </div>
                        </div>

                        {/* VT */}
                        <div className="border border-blue-100/60 bg-blue-50/30 rounded-[12px] p-3 flex flex-col justify-between">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[12px] font-semibold text-blue-800">VT</span>
                            <div className="bg-blue-100/80 text-blue-600 p-1.5 rounded-full">
                              <Play size={14} strokeWidth={2.5} />
                            </div>
                          </div>
                          <div>
                            <div className="text-[18px] font-bold text-blue-600 tracking-tight leading-none mb-1">
                              {Math.round(day.achievedVideo)}
                            </div>
                            <div className="text-[10px] text-blue-700/70 leading-tight">
                              dari target <br/>
                              <span className="font-medium text-blue-700">{targetVideo > 0 ? Math.round(day.targetVideo) : '- / -'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Live */}
                        <div className="border border-purple-100/60 bg-purple-50/30 rounded-[12px] p-3 flex flex-col justify-between">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[12px] font-semibold text-purple-800">Live</span>
                            <div className="bg-purple-100/80 text-purple-600 p-1.5 rounded-full">
                              <Radio size={14} strokeWidth={2.5} />
                            </div>
                          </div>
                          <div>
                            <div className="text-[18px] font-bold text-purple-600 tracking-tight leading-none mb-1">
                              {Math.round(day.achievedLive)}
                            </div>
                            <div className="text-[10px] text-purple-700/70 leading-tight">
                              Total sesi live
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Performance Highlight Metrics (Item Sold, Rev/Kr, Rev/VT, Like ER) */}
                      <div className="grid grid-cols-4 gap-1.5 mb-5 bg-slate-50/80 rounded-[12px] p-2 border border-slate-100 text-center">
                        <div>
                          <div className="text-[9px] font-semibold text-slate-500 uppercase leading-tight">Item Sold</div>
                          <div className="font-bold text-amber-700 text-[11px] mt-0.5 truncate" title={`${(day.itemsSold || 0).toLocaleString()} pcs`}>
                            {formatCompact(day.itemsSold || 0)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-semibold text-slate-500 uppercase leading-tight" title="Revenue per Active Creator">Rev / Kr</div>
                          <div className="font-bold text-blue-700 text-[11px] mt-0.5 truncate" title={`Rp ${(day.revPerActiveCreator || 0).toLocaleString()}`}>
                            {formatCompact(day.revPerActiveCreator || 0)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-semibold text-slate-500 uppercase leading-tight" title="Revenue per Video">Rev / VT</div>
                          <div className="font-bold text-emerald-700 text-[11px] mt-0.5 truncate" title={`Rp ${(day.revPerVideo || 0).toLocaleString()}`}>
                            {formatCompact(day.revPerVideo || 0)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-semibold text-slate-500 uppercase leading-tight" title="Like Engagement Rate">Like ER</div>
                          <div className="font-bold text-rose-600 text-[11px] mt-0.5">
                            {day.likeER || 0}%
                          </div>
                        </div>
                      </div>

                      {/* Detail Quadrants */}
                      <div className="border border-slate-100 rounded-[16px] bg-white overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                        <div className="grid grid-cols-2">
                          {/* Top Left: Kr Ditambah */}
                          <div className="p-3 border-b border-r border-slate-100 border-dashed">
                            <div className="flex items-center gap-1.5 mb-2">
                              <UserPlus size={14} className="text-orange-500 shrink-0" strokeWidth={2.5} />
                              <span className="text-[11px] font-bold text-slate-700 leading-tight">Kr Ditambah</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[18px] font-bold text-orange-600 leading-none">{Math.round(day.achievedPendingCreator)}</span>
                              <div className="text-[9px] text-slate-400 font-medium tracking-wide">
                                N {day.achievedPendingNano} | Mi {day.achievedPendingMicro} | Ma {day.achievedPendingMacro} | Me {day.achievedPendingMega}
                              </div>
                            </div>
                          </div>

                          {/* Top Right: Kr Approve */}
                          <div className="p-3 border-b border-slate-100 border-dashed">
                            <div className="flex items-center gap-1.5 mb-2">
                              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
                              <span className="text-[11px] font-bold text-slate-700 leading-tight">Kr Approve</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-end gap-1 leading-none">
                                <span className="text-[18px] font-bold text-emerald-600">{Math.round(day.achievedCreator)}</span>
                                <span className="text-[11px] font-bold text-emerald-600/50 mb-[2px]">/ {targetCreator > 0 ? Math.round(day.targetCreator) : '0'}</span>
                              </div>
                              <div className="text-[9px] text-slate-400 font-medium tracking-wide">
                                N {day.achievedApprovedNano} | Mi {day.achievedApprovedMicro} | Ma {day.achievedApprovedMacro} | Me {day.achievedApprovedMega}
                              </div>
                            </div>
                          </div>
                          
                          {/* Bottom Left: Kr Live Ditambah */}
                          <div className="p-3 border-r border-slate-100 border-dashed">
                            <div className="flex items-center gap-1.5 mb-2">
                              <Radio size={14} className="text-purple-500 shrink-0" strokeWidth={2.5} />
                              <span className="text-[11px] font-bold text-slate-700 leading-tight">Kr Live Ditambah</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[18px] font-bold text-purple-600 leading-none">{Math.round(day.pendingLiveCreator)}</span>
                              <div className="text-[9px] text-slate-400 font-medium tracking-wide">
                                N {day.pendingLiveNano} | Mi {day.pendingLiveMicro} | Ma {day.pendingLiveMacro} | Me {day.pendingLiveMega}
                              </div>
                            </div>
                          </div>

                          {/* Bottom Right: Kr Live Approve */}
                          <div className="p-3">
                            <div className="flex items-center gap-1.5 mb-2">
                              <BadgeCheck size={14} className="text-purple-500 shrink-0" strokeWidth={2.5} />
                              <span className="text-[11px] font-bold text-slate-700 leading-tight">Kr Live Approve</span>
                            </div>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-end gap-1 leading-none">
                                <span className="text-[18px] font-bold text-purple-600">{Math.round(day.liveCreator)}</span>
                                <span className="text-[11px] font-bold text-purple-600/50 mb-[2px]">/ {targetCreatorLive > 0 ? Math.round(day.targetCreatorLive) : '0'}</span>
                              </div>
                              <div className="text-[9px] text-slate-400 font-medium tracking-wide">
                                N {day.approvedLiveNano} | Mi {day.approvedLiveMicro} | Ma {day.approvedLiveMacro} | Me {day.approvedLiveMega}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Footer Legend */}
                      <div className="mt-4 pt-4 border-t border-slate-50 flex justify-center items-center gap-4 text-[10px] font-medium text-slate-500">
                        <span>N: Nano</span>
                        <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                        <span>Mi: Micro</span>
                        <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                        <span>Ma: Macro</span>
                        <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                        <span>Me: Mega</span>
                      </div>
                    </div>
                  </div>

                  {/* Center Dot (Axis) */}
                  <div className="relative z-20 flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full border-2 border-white ring-2 ${isToday ? 'bg-blue-500 ring-blue-300 ring-4' : day.isPastEndDate ? 'bg-rose-400 ring-rose-200' : 'bg-emerald-500 ring-emerald-200'} relative`} title={day.date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}></div>
                    <div className="absolute top-[20px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-slate-500 px-1 rounded">
                      {day.date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}} />
    </div>
  );
}
