"use client";

import { useDatabaseStore } from "@/store/useDatabaseStore";
import { getCreatorType } from "@/utils/computed";
import { useRouter } from "next/navigation";
import { Search, Loader2, Download, Users } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { fetchCreatorsPaginated, fetchStaffProfiles } from "@/app/actions/creatorActions";
import { exportToCSV } from "@/utils/exportCsv";
import { CreatorSyncModal } from "@/components/CreatorSyncModal";

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

      <div className="grid gap-[16px] md:grid-cols-2 lg:grid-cols-3">
        {data.map(creator => {
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
            audience_age: acc.audience_age ?? curr.audience_age,
            ratecard: acc.ratecard ?? curr.ratecard,
          }), {} as any);
          const tier = snapshot?.tier || 'Unknown';
          let tierClass = 'tier-c';
          if(tier.includes('A')) tierClass = 'tier-a';
          else if(tier.includes('B')) tierClass = 'tier-b';
          else if(tier.toLowerCase() === 'nano' || tier.toLowerCase() === 'unknown') tierClass = 'tier-nano';

          const cNiches = (creator.creator_niches || []).map((cn:any) => niches.find(n => n.id === cn.niche_id)?.nama).filter(Boolean);

          return (
            <Link key={creator.id} href={`/creator-pool/${creator.id}`} className="block h-full group">
              <div className="ccard h-full flex flex-col group-hover:border-p300 group-hover:shadow-md transition-all duration-150">
                <div className="ctop">
                  <div>
                    <div className="cname">@{creator.username}</div>
                    {creator.nama_asli && <div className="text-[13px] text-text-soft truncate max-w-[180px] mt-[2px]">{creator.nama_asli}</div>}
                  </div>
                  <span className={`tier ${tierClass}`}>{tier}</span>
                </div>
                
                <div className="flex gap-[6px] mb-[16px] flex-wrap">
                  {cNiches.map((niche: string, idx: number) => (
                    <span key={idx} className="tag">{niche}</span>
                  ))}
                </div>

                <div className="cstats mt-auto">
                  <div>
                    <div className="lbl">Audience Age</div>
                    <div className="vl text-p400">{snapshot?.audience_age || '-'}</div>
                  </div>
                  <div>
                    <div className="lbl">Level</div>
                    <div className="vl text-g400">{snapshot?.level ? `Level ${snapshot.level}` : '-'}</div>
                  </div>
                </div>
                
                <div className="mt-[16px] text-[11px] text-text-mute flex justify-between font-medium">
                  <span>Input: {creator.created_at ? new Date(creator.created_at).toLocaleDateString('id-ID') : '-'}</span>
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
