"use client";

import React, { useState, useMemo, useTransition } from 'react';
import { 
  PICControllingDataResponse, 
  ControllingCampaign, 
  MilestoneItem, 
  updateWeeklyMilestone,
  getPICControllingData 
} from './actions';
import { 
  Target, 
  Users, 
  Video, 
  TrendingUp, 
  Calendar, 
  Search, 
  AlertTriangle, 
  Lightbulb, 
  CheckCircle2, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Edit3, 
  RefreshCw, 
  X, 
  Check, 
  Layers,
  ArrowRight,
  Filter
} from 'lucide-react';
import { formatAbbreviated, formatRupiah, formatDate } from '@/utils/formatters';
import { toNum } from '@/utils/computed';

interface Props {
  initialData: PICControllingDataResponse;
}

export default function PICControllingClient({ initialData }: Props) {
  // Semua hook diletakkan paling atas (Aturan 26)
  const [data, setData] = useState<PICControllingDataResponse>(initialData);
  const [selectedPic, setSelectedPic] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'aktif' | 'selesai'>('all');
  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<number, boolean>>({});
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Form edit state
  const [editStatus, setEditStatus] = useState<MilestoneItem['status']>('on_track');
  const [editKendala, setEditKendala] = useState<string>('');
  const [editProblemSolving, setEditProblemSolving] = useState<string>('');
  const [editActionPlan, setEditActionPlan] = useState<string>('');
  const [editHowToAchieve, setEditHowToAchieve] = useState<string>('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');

  // Handle refresh data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const refreshed = await getPICControllingData();
      setData(refreshed);
    } catch (err) {
      console.error('Failed to refresh data', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    return data.campaigns.filter(c => {
      // Filter PIC
      if (selectedPic !== 'all') {
        const matchesPic = c.pic.toLowerCase().includes(selectedPic.toLowerCase());
        if (!matchesPic) return false;
      }
      // Filter Status
      if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.nama.toLowerCase().includes(q);
        const matchesBrand = c.brand_nama.toLowerCase().includes(q);
        const matchesPic = c.pic.toLowerCase().includes(q);
        if (!matchesName && !matchesBrand && !matchesPic) return false;
      }
      return true;
    });
  }, [data.campaigns, selectedPic, statusFilter, searchQuery]);

  // Aggregate stats based on current filter
  const currentOverall = useMemo(() => {
    let tCreator = 0;
    let cCreator = 0;
    let tVideo = 0;
    let cVideo = 0;
    let tGMV = 0;
    let cGMV = 0;

    for (const c of filteredCampaigns) {
      tCreator += c.target_creator;
      cCreator += c.current_creator;
      tVideo += c.target_video;
      cVideo += c.current_video;
      tGMV += c.target_gmv;
      cGMV += c.current_gmv;
    }

    const creatorPct = tCreator > 0 ? Math.min(100, Math.round((cCreator / tCreator) * 1000) / 10) : 0;
    const videoPct = tVideo > 0 ? Math.min(100, Math.round((cVideo / tVideo) * 1000) / 10) : 0;
    const gmvPct = tGMV > 0 ? Math.min(100, Math.round((cGMV / tGMV) * 1000) / 10) : 0;

    return {
      tCreator,
      cCreator,
      creatorPct,
      tVideo,
      cVideo,
      videoPct,
      tGMV,
      cGMV,
      gmvPct,
      totalCampaigns: filteredCampaigns.length
    };
  }, [filteredCampaigns]);

  // Toggle accordion campaign
  const toggleCampaignExpand = (campaignId: number) => {
    setExpandedCampaigns(prev => ({
      ...prev,
      [campaignId]: !prev[campaignId]
    }));
  };

  // Expand all / Collapse all
  const toggleAll = (expand: boolean) => {
    const next: Record<number, boolean> = {};
    for (const c of filteredCampaigns) {
      next[c.id] = expand;
    }
    setExpandedCampaigns(next);
  };

  // Buka modal edit milestone
  const openEditModal = (m: MilestoneItem) => {
    setSelectedMilestone(m);
    setEditStatus(m.status);
    setEditKendala(m.kendala || '');
    setEditProblemSolving(m.problem_solving || '');
    setEditActionPlan(m.action_plan || '');
    setEditHowToAchieve(m.how_to_achieve || '');
    setSaveSuccessMsg('');
    setIsEditModalOpen(true);
  };

  // Simpan perubahan catatan
  const handleSaveMilestone = () => {
    if (!selectedMilestone) return;

    startTransition(async () => {
      try {
        await updateWeeklyMilestone({
          id: selectedMilestone.id,
          status: editStatus,
          kendala: editKendala,
          problem_solving: editProblemSolving,
          action_plan: editActionPlan,
          how_to_achieve: editHowToAchieve,
        });

        // Update local state agar instan
        setData(prev => {
          const nextCampaigns = prev.campaigns.map(c => {
            if (c.id === selectedMilestone.campaign_id) {
              const nextM = c.milestones.map(m => {
                if (m.id === selectedMilestone.id) {
                  return {
                    ...m,
                    status: editStatus,
                    kendala: editKendala,
                    problem_solving: editProblemSolving,
                    action_plan: editActionPlan,
                    how_to_achieve: editHowToAchieve,
                  };
                }
                return m;
              });
              return { ...c, milestones: nextM };
            }
            return c;
          });
          return { ...prev, campaigns: nextCampaigns };
        });

        setSaveSuccessMsg('Catatan report berhasil disimpan!');
        setTimeout(() => {
          setIsEditModalOpen(false);
          setSaveSuccessMsg('');
        }, 800);
      } catch (err) {
        console.error('Failed to update milestone', err);
        alert('Gagal menyimpan perubahan.');
      }
    });
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* HEADER UTAMA */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-sky-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
              <Target className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                Controlling Progress PIC
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/30">
                  Blueprint Campaign
                </span>
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Monitoring realtime target vs pencapaian aktual sistem, roadmap mingguan, dan evaluasi kendala & solusi Report Hari Senin.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
            title="Refresh Data Aktual"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{isRefreshing ? 'Memperbarui...' : 'Segarkan Data'}</span>
          </button>
          <div className="px-3 py-2 text-xs font-medium text-slate-400 bg-slate-900 border border-slate-800 rounded-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Realtime Partner Center & Ads</span>
          </div>
        </div>
      </div>

      {/* OVERALL EXECUTIVE STAT CARDS (Target Total) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: TOTAL GMV */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-slate-950 border border-emerald-500/30 p-5 shadow-xl shadow-emerald-950/20">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Target Total GMV
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30">
              {currentOverall.gmvPct}%
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white tracking-tight">
              {formatAbbreviated(currentOverall.cGMV, true)}
            </div>
            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <span>Target:</span>
              <span className="font-semibold text-slate-200">
                {currentOverall.tGMV > 0 ? formatAbbreviated(currentOverall.tGMV, true) : 'Tidak ada target nominal'}
              </span>
            </div>
          </div>
          {/* Progress Bar Emerald */}
          <div className="mt-4">
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden p-0.5">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-sm shadow-emerald-500/50"
                style={{ width: `${Math.min(100, Math.max(0, currentOverall.gmvPct))}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Card 2: TOTAL VIDEO (VT) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-slate-950 border border-sky-500/30 p-5 shadow-xl shadow-sky-950/20">
          <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
              <Video className="w-4 h-4 text-sky-400" />
              Target Total Video (VT)
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 font-bold border border-sky-500/30">
              {currentOverall.videoPct}%
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white tracking-tight">
              {currentOverall.cVideo.toLocaleString('id-ID')} <span className="text-sm font-semibold text-slate-400">VT</span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <span>Target:</span>
              <span className="font-semibold text-slate-200">
                {currentOverall.tVideo.toLocaleString('id-ID')} VT
              </span>
            </div>
          </div>
          {/* Progress Bar Sky Blue */}
          <div className="mt-4">
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden p-0.5">
              <div 
                className="bg-gradient-to-r from-sky-500 to-sky-400 h-full rounded-full transition-all duration-500 shadow-sm shadow-sky-500/50"
                style={{ width: `${Math.min(100, Math.max(0, currentOverall.videoPct))}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Card 3: TOTAL CREATOR */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-slate-950 border border-amber-500/30 p-5 shadow-xl shadow-amber-950/20">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-400" />
              Target Total Creator
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30">
              {currentOverall.creatorPct}%
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white tracking-tight">
              {currentOverall.cCreator.toLocaleString('id-ID')} <span className="text-sm font-semibold text-slate-400">Kreator</span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <span>Target:</span>
              <span className="font-semibold text-slate-200">
                {currentOverall.tCreator.toLocaleString('id-ID')} Kreator
              </span>
            </div>
          </div>
          {/* Progress Bar Amber */}
          <div className="mt-4">
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden p-0.5">
              <div 
                className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all duration-500 shadow-sm shadow-amber-500/50"
                style={{ width: `${Math.min(100, Math.max(0, currentOverall.creatorPct))}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Card 4: CAMPAIGN OVERVIEW & TIMELINE */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-slate-950 border border-slate-800 p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-slate-400" />
              Cakupan Campaign
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold border border-slate-700">
              {currentOverall.totalCampaigns} Campaign
            </span>
          </div>
          <div className="mt-3">
            <div className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>Timeline: Nov — Des 2026</span>
            </div>
            <div className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Sebagian besar campaign closing di <span className="text-emerald-300 font-semibold">30 November</span>, dengan campaign GMV/Live scale-up hingga <span className="text-sky-300 font-semibold">Desember 2026 / Januari 2027</span>.
            </div>
          </div>
          <div className="mt-3.5 flex items-center gap-2 text-[11px] text-slate-400 bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>Jadwal Evaluasi Rutin: <strong>Setiap Senin Pagi</strong></span>
          </div>
        </div>
      </div>

      {/* FILTER & TABS SECTION */}
      <div className="space-y-3">
        {/* PIC TABS (Matching Colorful PDF Aesthetic) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedPic('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
              selectedPic === 'all'
                ? 'bg-gradient-to-r from-emerald-500 to-sky-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900/90 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <span>Semua PIC</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">
              {data.campaigns.length}
            </span>
          </button>

          {data.pics.map(pic => {
            const count = data.campaigns.filter(c => c.pic.toLowerCase().includes(pic.toLowerCase())).length;
            const isSelected = selectedPic.toLowerCase() === pic.toLowerCase();
            return (
              <button
                key={pic}
                onClick={() => setSelectedPic(pic)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
                  isSelected
                    ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-md shadow-sky-500/20 border-transparent'
                    : 'bg-slate-900/90 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <span>PIC: {pic}</span>
                <span className="px-1.5 py-0.5 rounded-full bg-slate-800/80 text-[10px] text-slate-300">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* SEARCH & ACCORDION CONTROLS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2.5 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari campaign, brand, atau PIC..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Filter Status */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setStatusFilter('aktif')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === 'aktif' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                Aktif
              </button>
              <button
                onClick={() => setStatusFilter('selesai')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === 'selesai' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                Selesai
              </button>
            </div>

            {/* Expand / Collapse All */}
            <button
              onClick={() => toggleAll(true)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
            >
              Buka Semua
            </button>
            <button
              onClick={() => toggleAll(false)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
            >
              Tutup Semua
            </button>
          </div>
        </div>
      </div>

      {/* CAMPAIGN CARDS LIST */}
      {filteredCampaigns.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">Tidak Ada Campaign Ditemukan</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Coba ubah kata kunci pencarian atau ganti filter PIC di atas.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCampaigns.map(campaign => {
            const isExpanded = expandedCampaigns[campaign.id] ?? true; // default expanded
            const creatorPct = campaign.target_creator > 0 
              ? Math.min(100, Math.round((campaign.current_creator / campaign.target_creator) * 1000) / 10) 
              : 0;
            const videoPct = campaign.target_video > 0 
              ? Math.min(100, Math.round((campaign.current_video / campaign.target_video) * 1000) / 10) 
              : 0;
            const gmvPct = campaign.target_gmv > 0 
              ? Math.min(100, Math.round((campaign.current_gmv / campaign.target_gmv) * 1000) / 10) 
              : 0;

            return (
              <div 
                key={campaign.id} 
                className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-lg hover:border-slate-700 transition-all"
              >
                {/* CAMPAIGN HEADER BANNER */}
                <div 
                  onClick={() => toggleCampaignExpand(campaign.id)}
                  className="p-5 cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-850 hover:bg-slate-850 transition-colors select-none"
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-sm text-emerald-400 shrink-0">
                      {campaign.nama.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                          {campaign.nama}
                        </h2>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700">
                          {campaign.brand_nama}
                        </span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 font-semibold border border-sky-500/30">
                          PIC: {campaign.pic}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 uppercase text-[10px] font-bold">
                          {campaign.tipe_campaign}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>Deadline: <strong>{campaign.end_date ? formatDate(campaign.end_date) : '30 Nov 2026'}</strong></span>
                        </span>
                        <span>•</span>
                        <span>{campaign.milestones.length} Pekan Roadmap</span>
                      </div>
                    </div>
                  </div>

                  {/* METRIC PREVIEWS & EXPAND BUTTON */}
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:grid grid-cols-3 gap-3 text-right">
                      {/* Creator Metric */}
                      <div className="bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Creator</div>
                        <div className="text-xs font-bold text-white">
                          {campaign.current_creator} / {campaign.target_creator || '-'}
                          <span className="text-emerald-400 ml-1">({creatorPct}%)</span>
                        </div>
                      </div>
                      {/* Video Metric */}
                      <div className="bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Video (VT)</div>
                        <div className="text-xs font-bold text-white">
                          {campaign.current_video} / {campaign.target_video || '-'}
                          <span className="text-sky-400 ml-1">({videoPct}%)</span>
                        </div>
                      </div>
                      {/* GMV Metric */}
                      <div className="bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">GMV</div>
                        <div className="text-xs font-bold text-white">
                          {formatAbbreviated(campaign.current_gmv, true)}
                          {campaign.target_gmv > 0 && (
                            <span className="text-amber-400 ml-1">({gmvPct}%)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* PROGRESS METERS SECTION (Colorful PDF Style) */}
                <div className="px-5 py-3.5 bg-slate-950/40 border-b border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Creator Progress */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400 font-medium flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                        Creator Target
                      </span>
                      <span className="font-bold text-emerald-400">
                        {campaign.current_creator} / {campaign.target_creator || '-'} ({creatorPct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, creatorPct))}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Video Progress */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400 font-medium flex items-center gap-1">
                        <Video className="w-3.5 h-3.5 text-sky-400" />
                        Video VT Target
                      </span>
                      <span className="font-bold text-sky-400">
                        {campaign.current_video} / {campaign.target_video || '-'} ({videoPct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-sky-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, videoPct))}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* GMV Progress */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400 font-medium flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                        GMV Penjualan
                      </span>
                      <span className="font-bold text-amber-400">
                        {formatAbbreviated(campaign.current_gmv, true)}
                        {campaign.target_gmv > 0 && ` / ${formatAbbreviated(campaign.target_gmv, true)} (${gmvPct}%)`}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-amber-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, gmvPct))}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* WEEKLY ROADMAP ACCORDION CONTENT */}
                {isExpanded && (
                  <div className="p-5 space-y-4 bg-slate-900/40">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                        Roadmap Mingguan & Catatan Review Hari Senin
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        Klik tombol edit pada pekan terkait untuk memperbarui kendala/solusi
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {campaign.milestones.map((milestone) => {
                        // Badge status color
                        const statusColors = {
                          on_track: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                          need_attention: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
                          at_risk: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
                          completed: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
                        }[milestone.status] || 'bg-slate-800 text-slate-300 border-slate-700';

                        const statusLabels = {
                          on_track: 'On Track',
                          need_attention: 'Perlu Perhatian',
                          at_risk: 'Kritis / Terkendala',
                          completed: 'Selesai / Terpenuhi',
                        }[milestone.status] || 'On Track';

                        return (
                          <div 
                            key={milestone.id}
                            className="flex flex-col justify-between rounded-xl bg-slate-950/70 border border-slate-800 p-4 hover:border-slate-700 transition-all space-y-3"
                          >
                            <div>
                              {/* Header Pekan */}
                              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                                <div>
                                  <span className="text-sm font-black text-white">
                                    {milestone.week_label}
                                  </span>
                                  <div className="text-[10px] text-slate-400 font-medium">
                                    {milestone.month_label}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${statusColors}`}>
                                    {statusLabels}
                                  </span>
                                  <button
                                    onClick={() => openEditModal(milestone)}
                                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                    title="Edit Catatan Report Senin"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Target Mingguan */}
                              <div className="grid grid-cols-2 gap-2 mt-2.5 text-xs bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                                <div>
                                  <div className="text-[10px] text-slate-400">Target Creator:</div>
                                  <div className="font-bold text-emerald-400">
                                    {milestone.target_creator > 0 ? `${milestone.target_creator} Kreator` : '-'}
                                    {milestone.target_creator_delta > 0 && (
                                      <span className="text-[10px] text-slate-400 font-normal ml-1">
                                        (+{milestone.target_creator_delta})
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-slate-400">Target Video (VT):</div>
                                  <div className="font-bold text-sky-400">
                                    {milestone.target_video > 0 ? `${milestone.target_video} VT` : '-'}
                                    {milestone.target_video_delta > 0 && (
                                      <span className="text-[10px] text-slate-400 font-normal ml-1">
                                        (+{milestone.target_video_delta})
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {milestone.target_gmv > 0 && (
                                  <div className="col-span-2 pt-1 border-t border-slate-800/60 flex items-center justify-between">
                                    <span className="text-[10px] text-slate-400">Target GMV Pekan Ini:</span>
                                    <span className="font-bold text-amber-400">
                                      {formatRupiah(milestone.target_gmv)}
                                    </span>
                                  </div>
                                )}
                                {milestone.target_live_session > 0 && (
                                  <div className="col-span-2 flex items-center justify-between text-[11px]">
                                    <span className="text-slate-400">Target Live Session:</span>
                                    <span className="font-bold text-indigo-400">
                                      {milestone.target_live_session} Sesi Live
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* How to Achieve & Action Plan */}
                              <div className="mt-3 space-y-2">
                                {milestone.how_to_achieve && (
                                  <div className="text-xs">
                                    <span className="text-[11px] font-bold text-sky-400 flex items-center gap-1 mb-0.5">
                                      <Target className="w-3 h-3 text-sky-400" />
                                      How to Achieve:
                                    </span>
                                    <p className="text-slate-300 bg-sky-950/20 border border-sky-900/30 p-2 rounded-lg text-xs leading-relaxed">
                                      {milestone.how_to_achieve}
                                    </p>
                                  </div>
                                )}

                                {milestone.action_plan && (
                                  <div className="text-xs">
                                    <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 mb-0.5">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                      Action Plan:
                                    </span>
                                    <p className="text-slate-300 bg-emerald-950/20 border border-emerald-900/30 p-2 rounded-lg text-xs leading-relaxed">
                                      {milestone.action_plan}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* KENDALA & PROBLEM SOLVING (Report Senin Highlight) */}
                              <div className="mt-3 space-y-2 pt-2.5 border-t border-slate-800">
                                <div className="text-xs">
                                  <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1 mb-0.5">
                                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                                    Kendala Lapangan:
                                  </span>
                                  <p className="text-slate-300 bg-amber-950/20 border border-amber-900/30 p-2 rounded-lg text-xs leading-relaxed italic">
                                    {milestone.kendala || 'Belum ada kendala yang dicatat.'}
                                  </p>
                                </div>

                                <div className="text-xs">
                                  <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1 mb-0.5">
                                    <Lightbulb className="w-3 h-3 text-emerald-300" />
                                    Problem Solving & Solusi:
                                  </span>
                                  <p className="text-slate-300 bg-slate-900/80 border border-slate-800 p-2 rounded-lg text-xs leading-relaxed">
                                    {milestone.problem_solving || 'Belum ada solusi tindakan yang dicatat.'}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Footer Edit Button */}
                            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                              <span>Update: {milestone.updated_by || 'PIC'}</span>
                              <button
                                onClick={() => openEditModal(milestone)}
                                className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit Catatan Senin</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL EDIT CATATAN REPORT SENIN */}
      {isEditModalOpen && selectedMilestone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-5 text-white max-h-[90vh] overflow-y-auto">
            {/* Header Modal */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-emerald-400" />
                  Edit Catatan Review Mingguan (Report Senin)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedMilestone.week_label} • PIC: {selectedMilestone.pic_name}
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Selector */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-2">
                Status Pelaksanaan Pekan Ini
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'on_track', label: 'On Track', color: 'border-emerald-500 text-emerald-400 bg-emerald-500/10' },
                  { id: 'need_attention', label: 'Perlu Perhatian', color: 'border-amber-500 text-amber-300 bg-amber-500/10' },
                  { id: 'at_risk', label: 'Kritis / Blocked', color: 'border-rose-500 text-rose-400 bg-rose-500/10' },
                  { id: 'completed', label: 'Selesai', color: 'border-sky-500 text-sky-400 bg-sky-500/10' },
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setEditStatus(item.id as any)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                      editStatus === item.id 
                        ? `${item.color} ring-2 ring-emerald-500/30 shadow-md` 
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Kendala Lapangan */}
            <div>
              <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Kendala & Tantangan Lapangan (Report Senin)
              </label>
              <textarea
                rows={3}
                value={editKendala}
                onChange={e => setEditKendala(e.target.value)}
                placeholder="Contoh: Stok sample produk habis di warehouse, respons kreator lambat karena weekend, dsb..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            {/* Problem Solving & Solusi */}
            <div>
              <label className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mb-1.5">
                <Lightbulb className="w-4 h-4 text-emerald-400" />
                Problem Solving & Tindakan Mitigasi
              </label>
              <textarea
                rows={3}
                value={editProblemSolving}
                onChange={e => setEditProblemSolving(e.target.value)}
                placeholder="Contoh: Alihkan ke varian produk alternatif yang ready stock, blast reminder WhatsApp otomatis, dsb..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Action Plan */}
            <div>
              <label className="text-xs font-bold text-sky-400 flex items-center gap-1.5 mb-1.5">
                <CheckCircle2 className="w-4 h-4 text-sky-400" />
                Action Plan & Fokus Minggu Ini
              </label>
              <textarea
                rows={2}
                value={editActionPlan}
                onChange={e => setEditActionPlan(e.target.value)}
                placeholder="Rencana kerja mingguan..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>

            {/* How to Achieve */}
            <div>
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-1.5">
                <Target className="w-4 h-4 text-slate-400" />
                Target Milestone & How to Achieve
              </label>
              <input
                type="text"
                value={editHowToAchieve}
                onChange={e => setEditHowToAchieve(e.target.value)}
                placeholder="Target milestone..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-600 transition-colors"
              />
            </div>

            {/* Notifikasi Simpan */}
            {saveSuccessMsg && (
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-lg">
                <Check className="w-4 h-4" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveMilestone}
                disabled={isPending}
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-sky-400 hover:from-emerald-300 hover:to-sky-300 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan Perubahan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
