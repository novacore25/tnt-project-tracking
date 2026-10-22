"use client";

import { useDatabaseStore } from "@/store/useDatabaseStore";
import { getCreatorType } from "@/utils/computed";
import { formatAbbreviated } from "@/utils/formatters";
import { useRouter } from "next/navigation";
import { Search, Loader2, Download, Users } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { fetchCreatorsPaginated, fetchStaffProfiles } from "@/app/actions/creatorActions";
import { addScrapeTargetsAction, clearScrapeTargetsAction } from "@/app/actions/creatorTargetActions";
import { exportToCSV } from "@/utils/exportCsv";
import { CreatorSyncModal } from "@/components/CreatorSyncModal";
import { Check, CheckSquare, Square, Target, Video, Radio, MapPin, Sparkles, Trash2 } from "lucide-react";

const PAGE_SIZE = 48;

export default function CreatorPoolPage() {
  const router = useRouter();
  const { niches, campaigns } = useDatabaseStore();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterNiche, setFilterNiche] = useState<string>("");
  const [filterCampaign, setFilterCampaign] = useState<string>("");
  const [filterTier, setFilterTier] = useState<string>("");
  const [filterLevel, setFilterLevel] = useState<string>("");
  const [filterAddedBy, setFilterAddedBy] = useState<string>("");
  const [filterLastUpdatedBy, setFilterLastUpdatedBy] = useState<string>("");

  const [staffProfiles, setStaffProfiles] = useState<{id: string, nama: string}[]>([]);
  useEffect(() => {
    fetchStaffProfiles().then(data => {
      if (data) setStaffProfiles(data);
    });
  }, []);
  
  // Debounce search to avoid spamming on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  // Server-Side Data State
  const [data, setData] = useState<any[]>([]);
  const [profileMap, setProfileMap] = useState<Map<string, string>>(new Map());
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // State Seleksi Checkbox & Antrean Update
  const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);
  const [isPreparingQueue, setIsPreparingQueue] = useState(false);
  const [isClearingQueue, setIsClearingQueue] = useState(false);
  const [queueSuccessMsg, setQueueSuccessMsg] = useState("");

  const toggleSelectOne = (username: string) => {
    const clean = String(username).trim().toLowerCase().replace(/^@/, '');
    setSelectedUsernames(prev => 
      prev.includes(clean) ? prev.filter(u => u !== clean) : [...prev, clean]
    );
  };

  const allPageUsernames = data.map(c => String(c.username || '').trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
  const isAllPageSelected = allPageUsernames.length > 0 && allPageUsernames.every(u => selectedUsernames.includes(u));

  const toggleSelectAll = () => {
    if (isAllPageSelected) {
      setSelectedUsernames(prev => prev.filter(u => !allPageUsernames.includes(u)));
    } else {
      setSelectedUsernames(prev => Array.from(new Set([...prev, ...allPageUsernames])));
    }
  };

  const handlePrepareTargetQueue = async () => {
    if (selectedUsernames.length === 0) return;
    setIsPreparingQueue(true);
    setQueueSuccessMsg("");
    try {
      const selectedCampaignObj = campaigns.find(c => String(c.id) === String(filterCampaign));
      const res = await addScrapeTargetsAction({
        usernames: selectedUsernames,
        campaignId: filterCampaign ? Number(filterCampaign) : null,
        campaignName: selectedCampaignObj?.nama || null,
      });
      if (res.success) {
        setQueueSuccessMsg(`🎯 Berhasil menyiapkan ${res.count} kreator! Buka TikTok Partner Center lalu klik "Tarik Antrean Target" di ekstensi.`);
        setTimeout(() => setQueueSuccessMsg(""), 10000);
      }
    } catch (err: any) {
      alert("Gagal menyiapkan antrean: " + (err?.message || err));
    } finally {
      setIsPreparingQueue(false);
    }
  };

  const handleClearTargetQueue = async () => {
    if (!window.confirm("Kosongkan semua antrean target yang tersimpan di sistem? Tindakan ini akan mereset antrean agar Anda bisa beralih ke campaign lain.")) return;
    setIsClearingQueue(true);
    try {
      await clearScrapeTargetsAction();
      setQueueSuccessMsg("🗑️ Seluruh antrean target berhasil dikosongkan.");
      setTimeout(() => setQueueSuccessMsg(""), 6000);
    } catch (err: any) {
      alert("Gagal mengosongkan antrean: " + (err?.message || err));
    } finally {
      setIsClearingQueue(false);
    }
  };

  const fetchCreators = useCallback(async (pageNum: number, isReset: boolean = false) => {
    setIsLoading(true);
    try {
      const res = await fetchCreatorsPaginated({
        pageNum,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
        filterCampaign,
        filterNiche,
        filterTier,
        filterLevel,
        filterAddedBy,
        filterLastUpdatedBy,
      });

      const profiles = await fetchStaffProfiles();
      setProfileMap(new Map((profiles || []).map((p: any) => [p.id, p.nama])));

      let filteredRes = res.data || [];
      if (filterType) {
        filteredRes = filteredRes.filter((c: any) => {
          const snaps = c.creator_snapshots || [];
          const latest = snaps.length > 0 ? snaps[0] : null;
          const type = getCreatorType(latest?.audience_age || null);
          return type === filterType;
        });
      }

      if (isReset) {
        setData(filteredRes);
      } else {
        setData(prev => [...prev, ...filteredRes]);
      }

      setHasMore(res.hasMore);
    } catch (err: any) {
      console.error("Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, filterCampaign, filterNiche, filterTier, filterLevel, filterAddedBy, filterLastUpdatedBy, filterType]);

  // Trigger fetch when filters change
  useEffect(() => {
    setPage(0);
    fetchCreators(0, true);
  }, [debouncedSearch, filterType, filterNiche, filterCampaign, filterTier, filterLevel, filterAddedBy, filterLastUpdatedBy, fetchCreators]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchCreators(nextPage, false);
  };

  const handleExport = () => {
    const exportData = data.map(c => {
      const snaps = c.creator_snapshots || [];
      const sortedSnaps = [...snaps].sort((a:any, b:any) => {
        const tDiff = new Date(b.tanggal_update || 0).getTime() - new Date(a.tanggal_update || 0).getTime();
        if (tDiff !== 0) return tDiff;
        return b.id - a.id;
      });
      const snapshot = sortedSnaps.reduce((acc, curr) => ({
        ...acc,
        audience_age: acc.audience_age ?? curr.audience_age,
        level: acc.level ?? curr.level,
        gmv_30d: acc.gmv_30d ?? curr.gmv_30d,
      }), {} as any);
      
      return {
        'Username': c.username,
        'Nama Asli': c.nama_asli || '',
        'Audience Age': snapshot.audience_age || '',
        'Level': snapshot.level || '',
        'GMV 30D': snapshot.gmv_30d || 0
      };
    });
    exportToCSV(exportData, 'creator_pool_export');
  };

  return (
    <div className="space-y-[32px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight mb-[4px]">Creator Pool</h1>
          <p className="text-[14px] text-text-soft">Database aset creator lintas campaign.</p>
        </div>
        <div className="flex items-center gap-[10px]">
          <CreatorSyncModal onComplete={() => fetchCreators(0, true)} />
          <button className="btn btn-outline" onClick={handleExport}>
            <Download className="ico" /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => router.push('/creator-pool/import')}>
            + Tambah Kreator Baru
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-[10px] items-center bg-white p-[18px] rounded-lg border border-line shadow-sm">
        <div className="relative flex-1 md:flex-none min-w-[250px]">
          <Search className="absolute left-[14px] top-1/2 -translate-y-1/2 w-4 h-4 text-text-mute" />
          <input 
            type="text" 
            placeholder="Cari username atau nama asli..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input !pl-[40px] !mb-0 w-full md:w-auto"
          />
        </div>
        <select 
          value={filterType} 
          onChange={e => setFilterType(e.target.value)}
          className="select w-auto !mb-0 min-w-[150px] md:w-auto"
        >
          <option value="">Semua Tipe</option>
          <option value="Nano">Nano</option>
          <option value="Micro">Micro</option>
          <option value="Macro">Macro</option>
          <option value="Mega">Mega</option>
        </select>
        <select 
          value={filterNiche} 
          onChange={e => setFilterNiche(e.target.value)}
          className="select w-auto !mb-0 min-w-[150px] md:w-auto"
        >
          <option value="">Semua Niche</option>
          {niches.map(n => <option key={n.id} value={n.id}>{n.nama}</option>)}
        </select>
        <select 
          value={filterCampaign} 
          onChange={e => setFilterCampaign(e.target.value)}
          className="select w-auto !mb-0 min-w-[200px] md:w-auto"
        >
          <option value="">Semua Campaign</option>
          {campaigns.map(c => (
            <option key={c.id} value={c.id}>{c.nama}</option>
          ))}
        </select>
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Multi-dimensional Filter</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)} className="select !mb-0 min-w-[120px] md:w-auto flex-1 text-sm py-1.5">
            <option value="">Semua Tier</option>
            <option value="Nano">Nano</option>
            <option value="Micro">Micro</option>
            <option value="Macro">Macro</option>
            <option value="Mega">Mega</option>
          </select>
          <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="select !mb-0 min-w-[120px] md:w-auto flex-1 text-sm py-1.5">
            <option value="">Semua Level</option>
            <option value="1">Level 1</option>
            <option value="2">Level 2</option>
            <option value="3">Level 3</option>
            <option value="4">Level 4</option>
            <option value="5">Level 5</option>
          </select>
          <select value={filterAddedBy} onChange={(e) => setFilterAddedBy(e.target.value)} className="select !mb-0 min-w-[140px] md:w-auto flex-1 text-sm py-1.5">
            <option value="">Ditambahkan Oleh</option>
            {staffProfiles.map(p => (
              <option key={p.id} value={p.id}>{p.nama}</option>
            ))}
          </select>
          <select value={filterLastUpdatedBy} onChange={(e) => setFilterLastUpdatedBy(e.target.value)} className="select !mb-0 min-w-[150px] md:w-auto flex-1 text-sm py-1.5">
            <option value="">Diedit Terakhir Oleh</option>
            {staffProfiles.map(p => (
              <option key={p.id} value={p.id}>{p.nama}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Toolbar Seleksi & Siapkan Antrean Update */}
      <div className="bg-slate-900 text-white p-3 px-4 rounded-xl flex items-center justify-between flex-wrap gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={toggleSelectAll} 
            className="flex items-center gap-2 text-xs font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            {isAllPageSelected ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4 text-slate-400" />}
            <span>{isAllPageSelected ? 'Batal Pilih Semua' : 'Pilih Semua di Halaman Ini'}</span>
          </button>
          <span className="text-xs text-slate-300">
            Terpilih: <strong className="text-emerald-400 font-extrabold">{selectedUsernames.length}</strong> dari {data.length} kreator
          </span>
        </div>

        <div className="flex items-center gap-2">
          {selectedUsernames.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedUsernames([])}
              className="text-xs text-slate-400 hover:text-white px-2 py-1"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            disabled={selectedUsernames.length === 0 || isPreparingQueue}
            onClick={handlePrepareTargetQueue}
            className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-lg shadow transition cursor-pointer ${
              selectedUsernames.length > 0 
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isPreparingQueue ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
            <span>🎯 Siapkan Antrean Update ({selectedUsernames.length})</span>
          </button>

          <button
            type="button"
            disabled={isClearingQueue}
            onClick={handleClearTargetQueue}
            title="Kosongkan seluruh antrean target di sistem agar bisa beralih ke campaign lain"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 transition cursor-pointer disabled:opacity-50"
          >
            {isClearingQueue ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 text-rose-400" />}
            <span>Kosongkan Antrean</span>
          </button>
        </div>
      </div>

      {queueSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm animate-fade-in">
          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{queueSuccessMsg}</span>
        </div>
      )}

      <div className="grid gap-[16px] md:grid-cols-2 lg:grid-cols-3">
        {data.map(creator => {
          const cleanUser = String(creator.username || '').trim().toLowerCase().replace(/^@/, '');
          const isSelected = selectedUsernames.includes(cleanUser);

          // Extract nested data safely
          const snaps = creator.creator_snapshots || [];
          const sortedSnaps = [...snaps].sort((a:any, b:any) => {
            const tDiff = new Date(b.tanggal_update || 0).getTime() - new Date(a.tanggal_update || 0).getTime();
            if (tDiff !== 0) return tDiff;
            return b.id - a.id;
          });
          const snapshot = sortedSnaps.reduce((acc, curr) => ({
            ...acc,
            followers: acc.followers ?? curr.followers,
            tier: acc.tier ?? curr.tier,
            level: acc.level ?? curr.level,
            gmv_30d: acc.gmv_30d ?? curr.gmv_30d,
            gmv_status: acc.gmv_status ?? curr.gmv_status,
            gmv_30d_live: acc.gmv_30d_live ?? curr.gmv_30d_live,
            gmv_30d_video: acc.gmv_30d_video ?? curr.gmv_30d_video,
            gmv_30d_showcase: acc.gmv_30d_showcase ?? curr.gmv_30d_showcase,
            pct_live: acc.pct_live ?? curr.pct_live,
            pct_video: acc.pct_video ?? curr.pct_video,
            pct_showcase: acc.pct_showcase ?? curr.pct_showcase,
            items_sold_30d: acc.items_sold_30d ?? curr.items_sold_30d,
            gpm_30d: acc.gpm_30d ?? curr.gpm_30d,
            avg_commission_rate: acc.avg_commission_rate ?? curr.avg_commission_rate,
            video_gpm: acc.video_gpm ?? curr.video_gpm,
            videos_count_30d: acc.videos_count_30d ?? curr.videos_count_30d,
            avg_video_views: acc.avg_video_views ?? curr.avg_video_views,
            avg_video_engagement_rate: acc.avg_video_engagement_rate ?? curr.avg_video_engagement_rate,
            live_gpm: acc.live_gpm ?? curr.live_gpm,
            live_streams_count_30d: acc.live_streams_count_30d ?? curr.live_streams_count_30d,
            avg_live_views: acc.avg_live_views ?? curr.avg_live_views,
            audience_age: acc.audience_age ?? curr.audience_age,
            audience_female_pct: acc.audience_female_pct ?? curr.audience_female_pct,
            audience_male_pct: acc.audience_male_pct ?? curr.audience_male_pct,
            top_locations: acc.top_locations ?? curr.top_locations,
            ratecard: acc.ratecard ?? curr.ratecard,
            tanggal_update: acc.tanggal_update ?? curr.tanggal_update,
          }), {} as any);
          const tier = snapshot?.tier || 'Unknown';
          let tierClass = 'tier-c';
          if(tier.includes('A')) tierClass = 'tier-a';
          else if(tier.includes('B')) tierClass = 'tier-b';
          else if(tier.toLowerCase() === 'nano' || tier.toLowerCase() === 'unknown') tierClass = 'tier-nano';

          const cNiches = (creator.creator_niches || []).map((cn:any) => niches.find(n => n.id === cn.niche_id)?.nama).filter(Boolean);
          const topLocs: Array<{ loc: string; pct: number }> = Array.isArray(snapshot?.top_locations)
            ? snapshot.top_locations
            : typeof snapshot?.top_locations === 'string'
            ? (() => {
                try {
                  return JSON.parse(snapshot.top_locations);
                } catch {
                  return [];
                }
              })()
            : [];

          return (
            <Link key={creator.id} href={`/creator-pool/${creator.id}`} className="block h-full group">
              <div className={`ccard h-full flex flex-col group-hover:shadow-md transition-all duration-150 ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-400/30 bg-indigo-50/10' : 'group-hover:border-p300'}`}>
                {/* Header Card dengan Checkbox Seleksi */}
                <div className="ctop items-start gap-2.5">
                  <div 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleSelectOne(creator.username);
                    }}
                    className="shrink-0 flex items-center justify-center p-1 rounded hover:bg-slate-100 cursor-pointer mt-0.5"
                    title={isSelected ? "Batal pilih" : "Pilih kreator ini"}
                  >
                    <input 
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    {creator.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={creator.avatar_url}
                        alt={creator.username}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center shrink-0">
                        {String(creator.username || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="cname truncate">@{creator.username}</div>
                      {creator.display_name && (
                        <div className="text-[12px] text-slate-600 font-medium truncate max-w-[170px]">
                          {creator.display_name}
                        </div>
                      )}
                      {creator.nama_asli && (
                        <div className="text-[11px] text-text-soft truncate max-w-[170px] mt-[1px]">
                          KTP: {creator.nama_asli}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={`tier ${tierClass} shrink-0`}>{tier}</span>
                </div>
                
                {/* Niches & MCN */}
                <div className="flex gap-[6px] my-[10px] flex-wrap">
                  {cNiches.map((niche: string, idx: number) => (
                    <span key={idx} className="tag">{niche}</span>
                  ))}
                  {creator.mcn && (
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-[10px] font-medium">
                      🏢 {creator.mcn}
                    </span>
                  )}
                </div>

                {/* Grid 1: Followers & GMV 30D Lengkap */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50/90 border border-slate-100 rounded-lg p-2.5 mb-2 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Followers</div>
                    <div className="font-bold text-slate-800">{formatAbbreviated(Number(snapshot?.followers || 0), false)}</div>
                    <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
                      {snapshot?.level ? `Level ${snapshot.level}` : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                      <span>GMV 30D</span>
                      {snapshot?.gmv_status && (
                        <span className={`px-1 py-0 text-[9px] font-bold rounded ${snapshot.gmv_status === 'ESTIMASI' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                          {snapshot.gmv_status}
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-emerald-700">
                      {Number(snapshot?.gmv_30d || 0) > 0 ? formatAbbreviated(Number(snapshot.gmv_30d), true) : '-'}
                    </div>
                    {(snapshot?.pct_live > 0 || snapshot?.pct_video > 0) && (
                      <div className="text-[9.5px] text-slate-500 truncate mt-0.5">
                        L: {snapshot?.pct_live ?? 0}% • V: {snapshot?.pct_video ?? 0}%
                      </div>
                    )}
                  </div>
                </div>

                {/* Grid 2: Items Sold, GPM & Avg Komisi */}
                {(snapshot?.items_sold_30d > 0 || snapshot?.gpm_30d > 0) && (
                  <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-2 mb-2 text-[11px] grid grid-cols-2 gap-2 text-slate-700">
                    <div>
                      Items Sold: <strong className="text-slate-900">{Number(snapshot?.items_sold_30d || 0).toLocaleString('id-ID')}</strong>
                    </div>
                    <div>
                      GPM: <strong className="text-slate-900">{formatAbbreviated(Number(snapshot?.gpm_30d || 0), true)}</strong>
                    </div>
                  </div>
                )}

                {/* Grid 3: Box Video & Box LIVE */}
                <div className="grid grid-cols-2 gap-2 mb-2 text-[10.5px]">
                  <div className="bg-blue-50/70 border border-blue-100 rounded-lg p-2">
                    <div className="font-bold text-blue-800 flex items-center gap-1">
                      <Video className="w-3 h-3 shrink-0" />
                      <span>Video ({snapshot?.videos_count_30d || 0} VT)</span>
                    </div>
                    <div className="text-slate-600 mt-0.5">
                      Avg: <strong>{formatAbbreviated(Number(snapshot?.avg_video_views || 0), false)}</strong>
                    </div>
                    <div className="text-slate-500 text-[9.5px]">
                      ER: {snapshot?.avg_video_engagement_rate ?? 0}%
                    </div>
                  </div>

                  <div className="bg-rose-50/70 border border-rose-100 rounded-lg p-2">
                    <div className="font-bold text-rose-800 flex items-center gap-1">
                      <Radio className="w-3 h-3 shrink-0" />
                      <span>LIVE ({snapshot?.live_streams_count_30d || 0} Sesi)</span>
                    </div>
                    <div className="text-slate-600 mt-0.5">
                      Avg: <strong>{formatAbbreviated(Number(snapshot?.avg_live_views || 0), false)}</strong>
                    </div>
                    <div className="text-slate-500 text-[9.5px]">
                      GPM: {formatAbbreviated(Number(snapshot?.live_gpm || 0), true)}
                    </div>
                  </div>
                </div>

                {/* Demografi: Gender & Usia */}
                <div className="cstats mt-auto mb-1">
                  <div>
                    <div className="lbl">Audience & Gender</div>
                    <div className="vl text-p400 text-[12px] flex items-center gap-1 flex-wrap">
                      <span>{snapshot?.audience_age || '-'}</span>
                      {snapshot?.audience_female_pct != null && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-pink-50 text-pink-700 rounded font-semibold">
                          👩 {snapshot.audience_female_pct}%
                        </span>
                      )}
                      {snapshot?.audience_male_pct != null && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded font-semibold">
                          👨 {snapshot.audience_male_pct}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Top Lokasi */}
                {topLocs.length > 0 && (
                  <div className="mt-1 pt-1.5 border-t border-slate-100 flex flex-wrap gap-1">
                    {topLocs.slice(0, 4).map((loc, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[9px] font-semibold">
                        {loc.loc} {loc.pct}%
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Footer Card */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10.5px] text-text-mute flex justify-between font-medium">
                  <span className="text-slate-500">
                    🕒 {snapshot?.tanggal_update ? new Date(snapshot.tanggal_update).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Belum di-scrape'}
                  </span>
                  <span>PIC: {creator.added_by ? profileMap.get(creator.added_by) || creator.added_by : 'System'}</span>
                </div>
              </div>
            </Link>
          );
        })}
        {data.length === 0 && !isLoading && (
          <div className="col-span-full">
            <div className="empty">
              <div className="eicon"><Users className="w-6 h-6 text-text-mute" /></div>
              <h4>Tidak ada kreator</h4>
              <p>Tidak ada kreator yang cocok dengan filter pencarian Anda saat ini.</p>
            </div>
          </div>
        )}
      </div>

      {hasMore && data.length > 0 && (
        <div className="flex justify-center mt-[32px]">
          <button className="btn btn-soft w-[240px] justify-center" onClick={handleLoadMore} disabled={isLoading}>
            {isLoading ? <Loader2 className="ico animate-spin" /> : null}
            {isLoading ? "Memuat..." : "Muat Lebih Banyak"}
          </button>
        </div>
      )}
      
      {isLoading && data.length === 0 && (
         <div className="flex justify-center py-[48px]">
            <Loader2 className="w-8 h-8 text-p300 animate-spin" />
         </div>
      )}
    </div>
  );
}
