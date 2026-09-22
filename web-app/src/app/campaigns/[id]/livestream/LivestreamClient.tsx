"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Search, Radio, Loader2, ChevronLeft, ChevronRight, User, Calendar, Users, Eye, ShoppingCart, DollarSign, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { useCampaignFilter } from "@/providers/CampaignFilterProvider";
import { fetchLivePageDataAction } from "@/app/actions/campaignPageActions";

export default function CampaignLiveStreamClient({
  campaign,
  initialCreators,
  initialSalesData,
  initialLiveMetrics,
  initialLiveStats
}: {
  campaign: any;
  initialCreators: any[];
  initialSalesData: any[];
  initialLiveMetrics?: any[];
  initialLiveStats?: any[];
}) {
  const campaignId = campaign.id;

  const [creators] = useState<any[]>(initialCreators || []);
  const [salesData] = useState<any[]>(initialSalesData || []);
  const [actualLives, setActualLives] = useState<any[]>(initialLiveStats || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('sesi');
    const [statusFilter, setStatusFilter] = useState('all');

  // --- Date Mode States ---
  const [viewMode, setViewMode] = useState<'creator' | 'date'>('creator');
  const [dateSearchQuery, setDateSearchQuery] = useState('');
  const [dateFilterStart, setDateFilterStart] = useState('');
  const [dateFilterEnd, setDateFilterEnd] = useState('');
  const [dateSortBy, setDateSortBy] = useState<'latest'|'oldest'|'gmv_desc'|'sessions_desc'>('latest');
  const [expandedDates, setExpandedDates] = useState<string[]>([]);
  const toggleDateExpanded = (d: string) => {
    setExpandedDates(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const aggregatedByDate = useMemo(() => {
    let filtered = actualLives.filter(l => {
      if (!l.start_time) return false;
      if (dateSearchQuery.trim()) {
        const u = (l.creator_username || '').toLowerCase();
        if (!u.includes(dateSearchQuery.trim().toLowerCase())) return false;
      }
      const sessionDate = l.start_time.split('T')[0]; 
      if (dateFilterStart && sessionDate < dateFilterStart) return false;
      if (dateFilterEnd && sessionDate > dateFilterEnd) return false;
      return true;
    });

    const grouped = new Map<string, any[]>();
    filtered.forEach(l => {
      const d = new Date(l.start_time);
      if (isNaN(d.getTime())) return;
      const pad = (n: number) => n.toString().padStart(2, '0');
      const dateKey = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      if (!grouped.has(dateKey)) grouped.set(dateKey, []);
      grouped.get(dateKey)!.push(l);
    });

    const result = Array.from(grouped.entries()).map(([dateStr, sessions]) => {
      const creatorsSet = new Set(sessions.map(s => (s.creator_username || '').toLowerCase()));
      const totalCreators = creatorsSet.size;
      const totalSessions = sessions.length;
      const totalViews = sessions.reduce((acc, s) => acc + (Number(s.video_views) || 0), 0);
      const totalOrders = sessions.reduce((acc, s) => acc + (Number(s.orders) || 0), 0);
      const totalGmv = sessions.reduce((acc, s) => acc + (Number(s.gmv) || 0), 0);
      return {
        dateStr,
        dateObj: new Date(dateStr),
        totalCreators,
        totalSessions,
        totalViews,
        totalOrders,
        totalGmv,
        sessions: sessions.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      };
    });

    result.sort((a, b) => {
      if (dateSortBy === 'latest') return b.dateObj.getTime() - a.dateObj.getTime();
      if (dateSortBy === 'oldest') return a.dateObj.getTime() - b.dateObj.getTime();
      if (dateSortBy === 'gmv_desc') return b.totalGmv - a.totalGmv;
      if (dateSortBy === 'sessions_desc') return b.totalSessions - a.totalSessions;
      return 0;
    });
    return result;
  }, [actualLives, dateSearchQuery, dateFilterStart, dateFilterEnd, dateSortBy]);


  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  const { isCreatorVisible } = useCampaignFilter();

  // ─── Fetch Actual Lives via Server Action (background refresh if initial was empty) ──
  useEffect(() => {
    if (!campaignId) return;
    // Only refetch if initialLiveStats was empty
    if (!initialLiveStats || initialLiveStats.length === 0) {
      const fetchActualLives = async () => {
        try {
          const res = await fetchLivePageDataAction(campaignId);
          if (res.success && res.actualLives && res.actualLives.length > 0) {
            setActualLives(res.actualLives);
          }
        } catch (e) {
          console.warn("Client live stats fetch skipped:", e);
        }
      };
      fetchActualLives();
    }
  }, [campaignId, initialLiveStats]);

  // ─── Pre-compute maps & Leaderboard in single O(M) pass ──
  const { creatorLiveStatsMap, top5CreatorsBySession, top5CreatorsByGmv, top5SessionsByGmv } = useMemo(() => {
    const statsMap = new Map<string, {
      gmv: number;
      sessions: number;
      views: number;
      likes: number;
      orders: number;
    }>();

    actualLives.forEach(l => {
      const raw = l.creator_username;
      if (!raw) return;
      const u = raw.replace(/^@/, '').toLowerCase();
      const cur = statsMap.get(u) || { gmv: 0, sessions: 0, views: 0, likes: 0, orders: 0 };
      cur.gmv += (Number(l.gmv) || 0);
      cur.sessions += 1;
      cur.views += (Number(l.video_views) || 0);
      cur.likes += (Number(l.video_likes) || 0);
      cur.orders += (Number(l.orders) || 0);
      statsMap.set(u, cur);
    });

    // Complement orders from salesData if not present in actualLives
    salesData.forEach(s => {
      const raw = s.creator_username;
      if (!raw) return;
      const u = raw.replace(/^@/, '').toLowerCase();
      const cur = statsMap.get(u);
      if (cur && cur.orders === 0) {
        cur.orders += (Number(s.quantity) || 0);
      } else if (!cur) {
        statsMap.set(u, {
          gmv: Number(s.gmv) || 0,
          sessions: 0,
          views: 0,
          likes: 0,
          orders: Number(s.quantity) || 0
        });
      }
    });

    // Top 5 by Session
    const top5BySession = Array.from(statsMap.entries())
      .filter(([_, data]) => data.sessions > 0)
      .sort((a, b) => b[1].sessions - a[1].sessions || b[1].gmv - a[1].gmv)
      .slice(0, 5)
      .map(([username, data]) => ({
        username,
        sessions: data.sessions,
        gmv: data.gmv,
        views: data.views,
        likes: data.likes,
      }));

    // Top 5 by GMV
    const top5ByGmv = Array.from(statsMap.entries())
      .filter(([_, data]) => data.gmv > 0)
      .sort((a, b) => b[1].gmv - a[1].gmv || b[1].sessions - a[1].sessions)
      .slice(0, 5)
      .map(([username, data]) => ({
        username,
        gmv: data.gmv,
        sessions: data.sessions,
        views: data.views,
        likes: data.likes,
      }));

    // Top 5 Sessions by GMV
    const top5Sessions = [...actualLives]
      .filter(l => (Number(l.gmv) || 0) > 0)
      .sort((a, b) => (Number(b.gmv) || 0) - (Number(a.gmv) || 0))
      .slice(0, 5);

    return {
      creatorLiveStatsMap: statsMap,
      top5CreatorsBySession: top5BySession,
      top5CreatorsByGmv: top5ByGmv,
      top5SessionsByGmv: top5Sessions,
    };
  }, [actualLives, salesData]);

  const rankBadge = (rank: number) => {
    const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
    return medals[rank] ?? `#${rank}`;
  };

  // ─── Filter & Sort via O(1) Map Lookup ──
  const aggregatedData = useMemo(() => {
    let data = creators.map(cc => {
      const creatorUsername = cc.creators?.username || cc.username || '';
      const normalizedCreatorUname = (creatorUsername || '').replace(/^@/, '').toLowerCase();
      
      const stats = creatorLiveStatsMap.get(normalizedCreatorUname) || {
        gmv: 0,
        sessions: 0,
        views: 0,
        likes: 0,
        orders: 0
      };

      return {
        ...cc,
        totalGmv: stats.gmv,
        totalOrders: stats.orders,
        totalViews: stats.views,
        totalLikes: stats.likes,
        liveCount: stats.sessions,
        _uname: creatorUsername
      };
    });

    if (statusFilter !== 'all') {
      data = data.filter(d => d.approval === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      data = data.filter(d => d._uname.toLowerCase().includes(q));
    }

    if (sortBy === 'gmv') {
      data.sort((a, b) => b.totalGmv - a.totalGmv || b.liveCount - a.liveCount);
    } else if (sortBy === 'views') {
      data.sort((a, b) => b.totalViews - a.totalViews);
    } else if (sortBy === 'orders') {
      data.sort((a, b) => b.totalOrders - a.totalOrders);
    } else if (sortBy === 'sesi') {
      data.sort((a, b) => b.liveCount - a.liveCount || b.totalGmv - a.totalGmv);
    }

    return data;
  }, [creators, creatorLiveStatsMap, searchQuery, sortBy, statusFilter]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortBy, pageSize]);

  // Pagination calculation
  const totalItems = aggregatedData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const paginatedData = useMemo(() => {
    return aggregatedData.slice(startIndex, endIndex);
  }, [aggregatedData, startIndex, endIndex]);

  // Smart page numbers calculation
  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (validCurrentPage > 3) pages.push('...');
      
      const start = Math.max(2, validCurrentPage - 1);
      const end = Math.min(totalPages - 1, validCurrentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      
      if (validCurrentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, validCurrentPage]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-bold text-slate-800">Performa Live Stream</h2>
          <p className="text-[13px] text-slate-500">Analitik performa khusus untuk Live Stream berdasarkan data impor organik.</p>
        </div>
      </div>

      {/* ── Stats / Leaderboard Section ── */}
      {actualLives.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[20px]">
          {/* Card 1: Top 5 Kreator — Sesi Live Terbanyak */}
          <div className="ccard">
            <h3 className="font-semibold text-text text-[14px] mb-[14px] flex items-center gap-2">
              🏆 Top 5 Kreator — Live Terbanyak
            </h3>
            {top5CreatorsBySession.length === 0 ? (
              <p className="text-sm text-text-soft italic">Belum ada data</p>
            ) : (
              <ol className="space-y-[12px]">
                {top5CreatorsBySession.map((c, idx) => {
                  const gpm = c.views > 0 ? (c.gmv / c.views * 1000) : 0;
                  return (
                    <li key={c.username} className="space-y-[6px]">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] w-7 shrink-0 text-center">{rankBadge(idx + 1)}</span>
                        <span className="flex-1 text-[13px] font-semibold text-text truncate">@{c.username}</span>
                        <span className="text-[13px] font-bold text-blue-600 shrink-0">{c.sessions} sesi</span>
                      </div>
                      <div className="ml-9 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-text-soft">
                        <span>👁 {c.views.toLocaleString('id-ID')} views</span>
                        <span>❤️ {c.likes.toLocaleString('id-ID')} likes</span>
                        <span>💰 Rp {c.gmv.toLocaleString('id-ID')}</span>
                        <span>📊 GPM Rp {gpm.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Card 2: Top 5 Kreator — GMV Live Terbanyak */}
          <div className="ccard">
            <h3 className="font-semibold text-text text-[14px] mb-[14px] flex items-center gap-2">
              💰 Top 5 Kreator — GMV Live Terbanyak
            </h3>
            {top5CreatorsByGmv.length === 0 ? (
              <p className="text-sm text-text-soft italic">Belum ada data GMV</p>
            ) : (
              <ol className="space-y-[12px]">
                {top5CreatorsByGmv.map((c, idx) => {
                  const gpm = c.views > 0 ? (c.gmv / c.views * 1000) : 0;
                  return (
                    <li key={c.username} className="space-y-[6px]">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] w-7 shrink-0 text-center">{rankBadge(idx + 1)}</span>
                        <span className="flex-1 text-[13px] font-semibold text-text truncate">@{c.username}</span>
                        <span className="text-[13px] font-bold text-green-600 shrink-0">Rp {c.gmv.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="ml-9 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-text-soft">
                        <span>🎬 {c.sessions} sesi</span>
                        <span>👁 {c.views.toLocaleString('id-ID')} views</span>
                        <span>❤️ {c.likes.toLocaleString('id-ID')} likes</span>
                        <span>📊 GPM Rp {gpm.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Card 3: Top 5 Sesi Live — GMV Terbanyak (per sesi) */}
          <div className="ccard">
            <h3 className="font-semibold text-text text-[14px] mb-[14px] flex items-center gap-2">
              🔥 Top 5 Sesi Live — GMV Per Sesi
            </h3>
            {top5SessionsByGmv.length === 0 ? (
              <p className="text-sm text-text-soft italic">Belum ada data GMV</p>
            ) : (
              <ol className="space-y-[12px]">
                {top5SessionsByGmv.map((live, idx) => {
                  const views  = Number(live.video_views) || 0;
                  const likes  = Number(live.video_likes) || 0;
                  const gmv    = Number(live.gmv) || 0;
                  const gpm    = views > 0 ? (gmv / views * 1000) : 0;
                  return (
                    <li key={live.content_uid || idx} className="space-y-[6px]">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] w-7 shrink-0 text-center">{rankBadge(idx + 1)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-text truncate">@{(live.creator_username || '').replace(/^@/, '').toLowerCase()}</div>
                          <div className="text-[11px] text-text-soft">
                            {live.start_time ? new Date(live.start_time).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                            {live.duration_str ? ` · ${live.duration_str}` : ''}
                          </div>
                        </div>
                        <span className="text-[13px] font-bold text-green-600 shrink-0">Rp {gmv.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="ml-9 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-text-soft">
                        <span>👁 {views.toLocaleString('id-ID')} views</span>
                        <span>❤️ {likes.toLocaleString('id-ID')} likes</span>
                        <span>📊 GPM Rp {gpm.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      )}

            {/* ── Mode Content ── */}
      {viewMode === 'creator' ? (
        <>
          {/* ── Search & Filter Controls ── */}
          <div className="ccard p-4 flex flex-wrap gap-4 items-center bg-white border border-slate-200 rounded-xl shadow-sm">
            {/* Toggle Switch Mode */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 mr-2">
              <button onClick={() => setViewMode('creator')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${viewMode === 'creator' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <User className="w-4 h-4" /> Per Kreator
              </button>
              <button onClick={() => setViewMode('date')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${viewMode === 'date' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Calendar className="w-4 h-4" /> Per Tanggal
              </button>
            </div>

            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Cari username kreator..." 
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <select 
                className="px-3 py-2 border rounded-lg text-[13px] outline-none"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Semua Status</option>
                <option value="approved">Approved</option>
                <option value="alternate">Alternate</option>
                <option value="not_approved">Not Approved</option>
                <option value="pending">Pending</option>
              </select>
              <select 
                className="px-3 py-2 border rounded-lg text-[13px] outline-none"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="none">Urutkan</option>
                <option value="sesi">Sesi Terbanyak</option>
                <option value="gmv">GMV Tertinggi</option>
                <option value="views">Views Terbanyak</option>
                <option value="orders">Order Terbanyak</option>
              </select>
              <select
                className="px-3 py-2 border rounded-lg text-[13px] outline-none bg-slate-50 text-slate-700"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={25}>25 / halaman</option>
                <option value={50}>50 / halaman</option>
                <option value={100}>100 / halaman</option>
              </select>
            </div>
          </div>

          {/* ── Main Table ── */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-[12px] font-semibold text-slate-600">Kreator</th>
                    <th className="px-4 py-3 text-[12px] font-semibold text-slate-600">Sesi Live</th>
                    <th className="px-4 py-3 text-[12px] font-semibold text-slate-600 text-right">Live Views</th>
                    <th className="px-4 py-3 text-[12px] font-semibold text-slate-600 text-right">Live Orders</th>
                    <th className="px-4 py-3 text-[12px] font-semibold text-slate-600 text-right">Live GMV</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((item) => {
                    const uname = item._uname || item.creators?.username || item.username || 'creator';
                    return (
                      <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-[12px]">
                              {uname.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-[13px] font-medium text-slate-900">@{uname}</p>
                              {item.approval && (
                                <span className="text-[10px] text-slate-400 capitalize">{item.approval}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-[13px] text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <Radio className="w-3.5 h-3.5 text-rose-500" />
                            {item.liveCount} Sesi
                          </div>
                        </td>
                        <td className="px-4 py-4 text-[13px] text-slate-600 font-medium text-right">
                          {item.totalViews.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-4 text-[13px] text-slate-600 font-medium text-right">
                          {item.totalOrders.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-4 text-[13px] text-slate-900 font-semibold text-right">
                          Rp {item.totalGmv.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedData.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[13px] text-slate-500">
                        {searchQuery ? `Tidak ada kreator yang cocok dengan "${searchQuery}".` : 'Tidak ada data performa Live Stream. Silakan import Custom Report Livestream.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Pagination Bar ── */}
            {totalItems > 0 && (
              <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/70 text-[13px] text-slate-600">
                <div>
                  Menampilkan <span className="font-semibold text-slate-900">{startIndex + 1}</span> - <span className="font-semibold text-slate-900">{endIndex}</span> dari <span className="font-semibold text-slate-900">{totalItems.toLocaleString('id-ID')}</span> kreator
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={validCurrentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Halaman Sebelumnya"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {pageNumbers.map((p, idx) => {
                    if (p === '...') {
                      return (
                        <span key={`dots-${idx}`} className="px-2 py-1 text-slate-400">...</span>
                      );
                    }
                    const isSelected = p === validCurrentPage;
                    return (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(Number(p))}
                        className={`min-w-[32px] h-8 px-2 rounded-lg text-[13px] font-medium transition-colors ${
                          isSelected
                            ? 'bg-orange-500 text-white shadow-sm'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={validCurrentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Halaman Berikutnya"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* ── Date Mode Controls ── */}
          <div className="ccard p-4 flex flex-wrap gap-4 items-center bg-white border border-slate-200 rounded-xl shadow-sm">
            {/* Toggle Switch Mode */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 mr-2">
              <button onClick={() => setViewMode('creator')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${viewMode === 'creator' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <User className="w-4 h-4" /> Per Kreator
              </button>
              <button onClick={() => setViewMode('date')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${viewMode === 'date' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Calendar className="w-4 h-4" /> Per Tanggal
              </button>
            </div>

              <div className="relative max-w-sm flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Cari username kreator..." 
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={dateSearchQuery}
                  onChange={(e) => setDateSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
                  <input
                    type="date"
                    className="px-2 py-1.5 bg-white border border-slate-300 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
                    value={dateFilterStart}
                    onChange={(e) => setDateFilterStart(e.target.value)}
                    title="Mulai Tanggal"
                  />
                  <span className="text-slate-400 text-xs font-medium">s/d</span>
                  <input
                    type="date"
                    className="px-2 py-1.5 bg-white border border-slate-300 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
                    value={dateFilterEnd}
                    onChange={(e) => setDateFilterEnd(e.target.value)}
                    title="Sampai Tanggal"
                  />
                </div>
                <select 
                  className="px-3 py-2 border rounded-lg text-[13px] outline-none"
                  value={dateSortBy}
                  onChange={(e) => setDateSortBy(e.target.value as any)}
                >
                  <option value="latest">Tanggal Terbaru</option>
                  <option value="oldest">Tanggal Terlama</option>
                  <option value="gmv_desc">GMV Tertinggi</option>
                  <option value="sessions_desc">Sesi Terbanyak</option>
                </select>
              </div>
          </div>

          {/* ── Date Mode Accordions ── */}
          <div className="space-y-4">
            {aggregatedByDate.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-[13px] text-slate-500 shadow-sm">
                Tidak ada data sesi live yang sesuai dengan pencarian atau filter tanggal.
              </div>
            ) : (
              aggregatedByDate.map(day => (
                <div key={day.dateStr} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-all">
                  <div 
                    onClick={() => toggleDateExpanded(day.dateStr)}
                    className="flex flex-col xl:flex-row xl:items-center justify-between p-4 cursor-pointer hover:bg-slate-50/80 transition-colors gap-4 select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 shrink-0 rounded-full bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-[15px]">
                          {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(day.dateObj)}
                        </h3>
                        <div className="flex items-center gap-3 mt-1.5 text-[12px] text-slate-500 font-medium">
                          <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-md text-slate-600"><Users className="w-3.5 h-3.5 text-slate-400"/> {day.totalCreators} Kreator</span>
                          <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-md text-slate-600"><Radio className="w-3.5 h-3.5 text-rose-400"/> {day.totalSessions} Sesi</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 lg:gap-5 text-[13px] font-semibold text-slate-700 bg-white border border-slate-200 shadow-sm rounded-lg px-4 py-2.5 ml-12 xl:ml-0">
                      <div className="flex items-center gap-2" title="Total Views">
                        <Eye className="w-4 h-4 text-slate-400" />
                        {day.totalViews.toLocaleString('id-ID')}
                      </div>
                      <div className="w-px h-4 bg-slate-200 hidden sm:block"></div>
                      <div className="flex items-center gap-2" title="Total Orders">
                        <ShoppingCart className="w-4 h-4 text-slate-400" />
                        {day.totalOrders.toLocaleString('id-ID')}
                      </div>
                      <div className="w-px h-4 bg-slate-200 hidden sm:block"></div>
                      <div className="flex items-center gap-2 text-green-600" title="Total GMV">
                        <DollarSign className="w-4 h-4 text-green-500" />
                        Rp {day.totalGmv.toLocaleString('id-ID')}
                      </div>
                    </div>

                    <button className="text-slate-400 p-1.5 hover:bg-slate-100 rounded-md transition-colors hidden xl:block">
                      {expandedDates.includes(day.dateStr) ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>

                  {expandedDates.includes(day.dateStr) && (
                    <div className="border-t border-slate-200 bg-slate-50/50 p-4 sm:p-5">
                      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 border-b border-slate-200 text-[12px] font-semibold text-slate-600 uppercase tracking-wider">
                            <tr>
                              <th className="px-4 py-3">Waktu</th>
                              <th className="px-4 py-3">Kreator</th>
                              
                              <th className="px-4 py-3 text-right">Orders</th>
                              <th className="px-4 py-3 text-right">Live GMV</th>
                              
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {day.sessions.map((session: any, sidx: number) => {
                              const sTime = new Date(session.start_time);
                              let endTimeStr = 'Selesai';
                              if (!isNaN(sTime.getTime()) && session.duration_str) {
                                let totalSeconds = 0;
                                const dStr = session.duration_str.toString().toLowerCase();
                                if (/^\d{2}:\d{2}:\d{2}$/.test(dStr)) {
                                  const parts = dStr.split(':');
                                  totalSeconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
                                } else {
                                  const h = dStr.match(/(\d+)\s*(j|h)/);
                                  const m = dStr.match(/(\d+)\s*(m)/);
                                  const s = dStr.match(/(\d+)\s*(s|d)/);
                                  if (h) totalSeconds += parseInt(h[1]) * 3600;
                                  if (m) totalSeconds += parseInt(m[1]) * 60;
                                  if (s) totalSeconds += parseInt(s[1]);
                                }
                                if (totalSeconds > 0) {
                                  const eTime = new Date(sTime.getTime() + totalSeconds * 1000);
                                  endTimeStr = eTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
                                }
                              }
                              const startTimeStr = !isNaN(sTime.getTime()) ? sTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB' : '-';
                              const timeStr = startTimeStr !== '-' ? `${startTimeStr} - ${endTimeStr}` : '-';
                              
                              const vOrders = Number(session.orders) || 0;
                              const vGmv = Number(session.gmv) || 0;
                              
                              return (
                                <tr key={session.content_uid || sidx} className="hover:bg-slate-50 text-[13px] transition-colors">
                                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium">
                                    <div className="flex items-center gap-1.5">
                                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                                      {timeStr}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 font-semibold text-slate-800">
                                    @{session.creator_username?.replace(/^@/, '')}
                                  </td>
                                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                                    {vOrders.toLocaleString('id-ID')}
                                  </td>
                                  <td className="px-4 py-3 text-right font-semibold text-green-600">
                                    Rp {vGmv.toLocaleString('id-ID')}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

    </div>
  );
}