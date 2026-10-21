'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Database,
  Search,
  RefreshCw,
  CheckCircle2,
  ArrowUpRight,
  Trash2,
  Sparkles,
  BookOpen,
  Video,
  Radio,
  MapPin,
  Users,
  ShieldCheck,
  Calculator,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import {
  fetchStagingCreatorsAction,
  fetchKnownCreatorUsernamesAction,
  upsertStagingCreatorsBatchAction,
  promoteStagingToCreatorPoolAction,
  deleteStagingCreatorsAction,
  type StagingCreatorRecord,
} from '@/app/actions/creatorStagingActions';
import { toNum } from '@/utils/computed';

function formatIdr(val: number | string | null | undefined): string {
  const num = Math.round(toNum(val));
  if (!num) return 'Rp 0';
  return 'Rp ' + num.toLocaleString('id-ID');
}

function formatCompact(val: number | string | null | undefined): string {
  const num = toNum(val);
  if (!num) return '0';
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'JT';
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'rb';
  return num.toLocaleString('id-ID');
}

export default function StagingCreatorPage() {
  const [rows, setRows] = useState<StagingCreatorRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [importingBatch, setImportingBatch] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [stats, setStats] = useState({
    total_all: 0,
    total_staged: 0,
    total_promoted: 0,
    total_riil: 0,
    total_estimasi: 0,
  });
  const [distinctNiches, setDistinctNiches] = useState<string[]>([]);
  const [knownBook, setKnownBook] = useState<{
    stagingCount: number;
    totalKnown: number;
    usernames: string[];
  }>({
    stagingCount: 0,
    totalKnown: 0,
    usernames: [],
  });

  // Filters & Pagination
  const [pageNum, setPageNum] = useState(0);
  const pageSize = 50;
  const [search, setSearch] = useState('');
  const [filterNiche, setFilterNiche] = useState('');
  const [filterGmvStatus, setFilterGmvStatus] = useState('');
  const [filterStatusStaging, setFilterStatusStaging] = useState('all');
  const [sortBy, setSortBy] = useState('scraped_at_desc');

  // Selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const syncKnownBook = useCallback(async () => {
    try {
      const res = await fetchKnownCreatorUsernamesAction();
      setKnownBook(res);
      try {
        localStorage.setItem('tnt_known_usernames', JSON.stringify(res.usernames));
        localStorage.setItem('tnt_known_usernames_updated_at', new Date().toISOString());
      } catch {
        // Ignore storage quota errors
      }
    } catch (err) {
      console.error('Gagal sinkronisasi Buku Catatan:', err);
    }
  }, []);

  const loadStagingData = useCallback(async () => {
    try {
      const res = await fetchStagingCreatorsAction({
        pageNum,
        pageSize,
        search,
        filterNiche,
        filterGmvStatus,
        filterStatusStaging,
        sortBy,
      });
      setRows(res.data || []);
      setTotal(res.total || 0);
      if (res.stats) setStats(res.stats);
      if (res.distinctNiches) setDistinctNiches(res.distinctNiches);
    } catch (err: unknown) {
      console.error('Gagal memuat data Staging Creator:', err);
      setBannerMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memuat data Staging Creator.',
      });
    } finally {
      setLoading(false);
    }
  }, [pageNum, pageSize, search, filterNiche, filterGmvStatus, filterStatusStaging, sortBy]);

  const checkAndConsumeIncomingExtensionBatch = useCallback(async () => {
    try {
      const rawBatch = localStorage.getItem('tnt_staging_incoming_batch');
      if (!rawBatch) return;
      const parsed = JSON.parse(rawBatch) as StagingCreatorRecord[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        localStorage.removeItem('tnt_staging_incoming_batch');
        return;
      }

      setImportingBatch(true);
      const res = await upsertStagingCreatorsBatchAction(parsed);
      if (res?.success) {
        // Hanya hapus batch dari localStorage setelah server action BERHASIL
        localStorage.removeItem('tnt_staging_incoming_batch');
        setBannerMessage({
          type: 'success',
          text: `Berhasil menambahkan ${res.upsertedCount} kreator dari ekstensi TNT Scrapping Creator ke Staging!`,
        });
        await Promise.all([loadStagingData(), syncKnownBook()]);
      }
    } catch (err: unknown) {
      console.error('Gagal memproses batch dari ekstensi:', err);
      const errMsg = err instanceof Error ? err.message : String(err);

      // Jika error 'Server Action was not found on the server' (karena aplikasi baru di-deploy ke VPS):
      // Refresh halaman otomatis agar browser memuat bundle JS terbaru dengan action ID baru!
      if (errMsg.includes('was not found on the server') || errMsg.includes('Server Action')) {
        window.location.reload();
        return;
      }

      setBannerMessage({
        type: 'error',
        text: errMsg || 'Gagal memproses kiriman data dari ekstensi.',
      });
    } finally {
      setImportingBatch(false);
    }
  }, [loadStagingData, syncKnownBook]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) loadStagingData();
    });
    return () => {
      active = false;
    };
  }, [loadStagingData]);

  useEffect(() => {
    Promise.resolve().then(() => {
      syncKnownBook();
      checkAndConsumeIncomingExtensionBatch();
    });

    const handleCustomPush = () => {
      checkAndConsumeIncomingExtensionBatch();
    };
    window.addEventListener('TNT_PUSH_TO_STAGING', handleCustomPush);
    return () => {
      window.removeEventListener('TNT_PUSH_TO_STAGING', handleCustomPush);
    };
  }, [syncKnownBook, checkAndConsumeIncomingExtensionBatch]);

  const toggleSelectAll = () => {
    if (selectedIds.length === rows.length && rows.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(rows.map((r) => Number(r.id)));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handlePromoteSelected = async () => {
    if (selectedIds.length === 0) return;
    setPromoting(true);
    setBannerMessage(null);
    try {
      const res = await promoteStagingToCreatorPoolAction(selectedIds);
      if (res.success) {
        setBannerMessage({
          type: 'success',
          text: `Berhasil memindahkan ${res.promotedCount} kreator ke Creator Pool utama beserta seluruh snapshot analitiknya!`,
        });
        setSelectedIds([]);
        await Promise.all([loadStagingData(), syncKnownBook()]);
      } else {
        setBannerMessage({ type: 'error', text: res.error || 'Gagal memindahkan ke Creator Pool.' });
      }
    } catch (err: unknown) {
      setBannerMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Terjadi kesalahan saat promosi.',
      });
    } finally {
      setPromoting(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Hapus ${selectedIds.length} kreator terpilih dari daftar Staging?`)) return;
    setDeleting(true);
    setBannerMessage(null);
    try {
      const res = await deleteStagingCreatorsAction(selectedIds);
      if (res.success) {
        setBannerMessage({
          type: 'success',
          text: `${selectedIds.length} baris berhasil dihapus dari Staging.`,
        });
        setSelectedIds([]);
        await Promise.all([loadStagingData(), syncKnownBook()]);
      }
    } catch (err: unknown) {
      setBannerMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menghapus data.',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full mx-auto pb-16 space-y-6">
      {/* Hidden JSON Bridge untuk Buku Catatan Ekstensi TNT Scrapping Creator */}
      <script
        id="tnt-known-usernames-json"
        type="application/json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            updatedAt: new Date().toISOString(),
            totalKnown: knownBook.totalKnown,
            usernames: knownBook.usernames,
          }),
        }}
      />

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-lg border border-indigo-500/20 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 px-3 py-1 rounded-full text-xs font-semibold text-indigo-200 mb-2">
            <Database className="w-3.5 h-3.5" />
            <span>TNT Scrapping Creator • Buku Catatan & Staging Area</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Staging Creator (TikTok Partner Center)</h1>
          <p className="text-slate-300 text-sm mt-1 max-w-3xl">
            Penampungan hasil auto-scrape dari ekstensi <strong>TNT Scrapping Creator</strong>. Dilengkapi Buku Catatan anti-duplikat otomatis, kalkulasi GMV <strong>RIIL vs ESTIMASI</strong>, pecahan channel LIVE/Video, serta demografi & Top 5 Lokasi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              loadStagingData();
              syncKnownBook();
            }}
            disabled={loading || importingBatch}
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition border border-white/15 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading || importingBatch ? 'animate-spin' : ''}`} />
            <span>Refresh & Sync Buku Catatan</span>
          </button>
          <Link
            href="/creator-pool"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow"
          >
            <Users className="w-4 h-4" />
            <span>Lihat Creator Pool</span>
          </Link>
        </div>
      </div>

      {/* Banner Notification */}
      {bannerMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm font-medium ${
            bannerMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{bannerMessage.text}</span>
          </div>
          <button
            onClick={() => setBannerMessage(null)}
            className="text-xs underline ml-4 opacity-75 hover:opacity-100"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Buku Catatan (Khusus Staging)</span>
            <BookOpen className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {knownBook.totalKnown.toLocaleString('id-ID')} <span className="text-sm font-normal text-slate-500">username</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Hanya kreator di <strong>Staging</strong> yang di-skip saat scrape
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Menunggu di Staging</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {toNum(stats.total_staged).toLocaleString('id-ID')} <span className="text-sm font-normal text-slate-500">kreator</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Total di tabel Staging: <strong>{toNum(stats.total_all).toLocaleString('id-ID')}</strong>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>GMV RIIL vs ESTIMASI</span>
            <Calculator className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-xl font-bold text-emerald-700">
              {toNum(stats.total_riil).toLocaleString('id-ID')} RIIL
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xl font-bold text-amber-600">
              {toNum(stats.total_estimasi).toLocaleString('id-ID')} ESTIMASI
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            ESTIMASI = nilai tengah GMV/customer × Items sold
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Sudah Masuk Creator Pool</span>
            <ShieldCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {toNum(stats.total_promoted).toLocaleString('id-ID')} <span className="text-sm font-normal text-slate-500">dipromosikan</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Tersimpan lengkap di <code>creators</code> & <code>creator_snapshots</code>
          </div>
        </div>
      </div>

      {/* Filter & Bulk Action Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPageNum(0);
              }}
              placeholder="Cari @username, display name, atau MCN..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={filterStatusStaging}
            onChange={(e) => {
              setFilterStatusStaging(e.target.value);
              setPageNum(0);
            }}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
          >
            <option value="all">Semua Status ({stats.total_all})</option>
            <option value="staged">Belum Dipromosikan ({stats.total_staged})</option>
            <option value="promoted">Sudah di Creator Pool ({stats.total_promoted})</option>
          </select>

          <select
            value={filterNiche}
            onChange={(e) => {
              setFilterNiche(e.target.value);
              setPageNum(0);
            }}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
          >
            <option value="">Semua Niche Utama</option>
            {distinctNiches.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <select
            value={filterGmvStatus}
            onChange={(e) => {
              setFilterGmvStatus(e.target.value);
              setPageNum(0);
            }}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
          >
            <option value="">Semua Tipe GMV</option>
            <option value="RIIL">GMV RIIL</option>
            <option value="ESTIMASI">GMV ESTIMASI</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPageNum(0);
            }}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white font-medium"
          >
            <option value="scraped_at_desc">Urut: Terbaru Di-scrape</option>
            <option value="gmv_desc">Urut: GMV 30D Tertinggi</option>
            <option value="followers_desc">Urut: Followers Tertinggi</option>
            <option value="video_views_desc">Urut: Avg. Video Views Tertinggi</option>
            <option value="live_views_desc">Urut: Avg. LIVE Views Tertinggi</option>
          </select>
        </div>

        {/* Bulk Action Toolbar */}
        {selectedIds.length > 0 && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-indigo-50/70 px-4 py-2.5 rounded-lg">
            <div className="text-sm font-semibold text-indigo-950">
              {selectedIds.length} kreator dipilih
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={handlePromoteSelected}
                disabled={promoting}
                className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>{promoting ? 'Memindahkan...' : `Pindahkan ke Creator Pool (${selectedIds.length})`}</span>
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? 'Menghapus...' : 'Hapus'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selectedIds.length === rows.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="p-3 min-w-[260px]">Profil Kreator, MCN & Kontak</th>
                <th className="p-3 min-w-[220px]">Total GMV 30D & Sales Channel</th>
                <th className="p-3 min-w-[190px]">Metrik Sales & Kolaborasi</th>
                <th className="p-3 min-w-[200px]">Performa Video & LIVE</th>
                <th className="p-3 min-w-[240px]">Demografi & Top 5 Lokasi</th>
                <th className="p-3 min-w-[120px] text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    Memuat data Staging Creator...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    Belum ada data di Staging Creator. Buka TikTok Partner Center (Find Creators) lalu jalankan ekstensi <strong>TNT Scrapping Creator</strong>.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const id = Number(r.id);
                  const isSelected = selectedIds.includes(id);
                  const topLocations: Array<{ loc: string; pct: number }> = Array.isArray(r.top_locations)
                    ? r.top_locations
                    : typeof r.top_locations === 'string'
                    ? (() => {
                        try {
                          return JSON.parse(r.top_locations) as Array<{ loc: string; pct: number }>;
                        } catch {
                          return [];
                        }
                      })()
                    : [];

                  return (
                    <tr
                      key={id}
                      className={`hover:bg-slate-50/80 transition align-top ${
                        isSelected ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(id)}
                          className="rounded border-slate-300 mt-1"
                        />
                      </td>

                      {/* Kolom 1: Profil, Display Name, Level, MCN, Niche */}
                      <td className="p-3">
                        <div className="flex items-start gap-2.5">
                          {r.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={r.avatar_url}
                              alt={r.username}
                              className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0">
                              {String(r.username || '?').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <a
                                href={`https://www.tiktok.com/@${r.username}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-bold text-slate-900 hover:text-indigo-600 inline-flex items-center gap-1 text-[13px]"
                              >
                                @{r.username}
                                <ExternalLink className="w-3 h-3 opacity-60" />
                              </a>
                              {r.level && (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">
                                  LVL {r.level}
                                </span>
                              )}
                            </div>

                            {r.display_name && (
                              <div className="text-slate-600 font-medium truncate" title="Display Name TikTok (Bukan Nama KTP)">
                                {r.display_name}
                              </div>
                            )}

                            <div className="text-[11px] font-semibold text-slate-700">
                              Followers: <span className="text-indigo-700">{formatCompact(r.followers)}</span>
                              <span className="text-slate-400 font-normal"> ({toNum(r.followers).toLocaleString('id-ID')})</span>
                            </div>

                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {r.primary_niche && (
                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-[10px] font-semibold">
                                  {r.primary_niche}
                                </span>
                              )}
                              {r.mcn ? (
                                <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-[10px] font-medium">
                                  🏢 {r.mcn}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px]">
                                  Tanpa MCN
                                </span>
                              )}
                            </div>

                            {/* Kontak Resmi (WhatsApp & Email) */}
                            <div className="pt-2 mt-1 border-t border-slate-100 flex flex-col gap-1 text-[11px]">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {r.no_whatsapp ? (
                                  <a
                                    href={`https://wa.me/${r.no_whatsapp.replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 w-fit transition shadow-xs"
                                    title="Klik untuk membuka chat WhatsApp"
                                  >
                                    <span>📱</span> {r.no_whatsapp}
                                  </a>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                    <span>📱</span> WA: <span className="italic">Tidak ada</span>
                                  </span>
                                )}

                                {r.email ? (
                                  <a
                                    href={`mailto:${r.email}`}
                                    className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 truncate max-w-[210px] w-fit transition shadow-xs"
                                    title={`Kirim email ke ${r.email}`}
                                  >
                                    <span>✉️</span> {r.email}
                                  </a>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                    <span>✉️</span> Email: <span className="italic">Tidak ada</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Kolom 2: Total GMV 30D + Status RIIL/ESTIMASI + Breakdown Channel */}
                      <td className="p-3 space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-extrabold text-slate-900">
                            {formatIdr(r.gmv_30d)}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase ${
                              r.gmv_status === 'ESTIMASI'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}
                          >
                            {r.gmv_status || 'RIIL'}
                          </span>
                        </div>

                        <div className="space-y-1 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <div className="flex items-center justify-between">
                            <span className="text-rose-600 font-semibold">🔴 LIVE ({toNum(r.pct_live)}%):</span>
                            <span className="font-bold text-slate-800">{formatIdr(r.gmv_30d_live)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-blue-600 font-semibold">🎬 Video ({toNum(r.pct_video)}%):</span>
                            <span className="font-bold text-slate-800">{formatIdr(r.gmv_30d_video)}</span>
                          </div>
                          {toNum(r.pct_showcase) > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-amber-700 font-semibold">🛍️ Cards ({toNum(r.pct_showcase)}%):</span>
                              <span className="font-bold text-slate-800">{formatIdr(r.gmv_30d_showcase)}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Kolom 3: Metrik Sales & Kolaborasi */}
                      <td className="p-3 space-y-1 text-[11px] text-slate-700">
                        <div>
                          Items Sold: <strong className="text-slate-900">{toNum(r.items_sold_30d).toLocaleString('id-ID')}</strong>
                        </div>
                        <div>
                          GPM: <strong className="text-slate-900">{formatIdr(r.gpm_30d)}</strong>
                        </div>
                        {(r.gmv_per_customer_min || r.gmv_per_customer_max) && (
                          <div>
                            GMV/Cust:{' '}
                            <strong className="text-slate-900">
                              {formatCompact(r.gmv_per_customer_min)} - {formatCompact(r.gmv_per_customer_max)}
                            </strong>
                          </div>
                        )}
                        <div>
                          Avg Komisi: <strong className="text-slate-900">{r.avg_commission_rate ?? 0}%</strong>
                        </div>
                        <div className="pt-1 border-t border-slate-100 flex items-center gap-2">
                          <span>Produk: <strong>{r.products_promoted_count || 0}</strong></span>
                          <span>•</span>
                          <span>Brand Collab: <strong>{r.brand_collaborations_count || 0}</strong></span>
                        </div>
                      </td>

                      {/* Kolom 4: Performa Video & LIVE */}
                      <td className="p-3 space-y-2 text-[11px]">
                        <div className="bg-blue-50/60 border border-blue-100 rounded-lg p-2 space-y-0.5">
                          <div className="font-bold text-blue-800 flex items-center gap-1">
                            <Video className="w-3 h-3" />
                            <span>Video ({r.videos_count_30d || 0} VT)</span>
                          </div>
                          <div className="text-slate-700">
                            Avg Views: <strong>{formatCompact(r.avg_video_views)}</strong> • ER: <strong>{r.avg_video_engagement_rate ?? 0}%</strong>
                          </div>
                          <div className="text-slate-600">
                            Video GPM: <strong>{formatIdr(r.video_gpm)}</strong>
                          </div>
                        </div>

                        <div className="bg-rose-50/60 border border-rose-100 rounded-lg p-2 space-y-0.5">
                          <div className="font-bold text-rose-800 flex items-center gap-1">
                            <Radio className="w-3 h-3" />
                            <span>LIVE ({r.live_streams_count_30d || 0} Sesi)</span>
                          </div>
                          <div className="text-slate-700">
                            Avg Views: <strong>{formatCompact(r.avg_live_views)}</strong> • ER: <strong>{r.avg_live_engagement_rate ?? 0}%</strong>
                          </div>
                          <div className="text-slate-600">
                            LIVE GPM: <strong>{formatIdr(r.live_gpm)}</strong>
                          </div>
                        </div>
                      </td>

                      {/* Kolom 5: Demografi & Top 5 Lokasi (JSONB Tags) */}
                      <td className="p-3 space-y-2 text-[11px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {r.audience_female_pct != null && (
                            <span className="px-2 py-0.5 bg-pink-50 text-pink-700 border border-pink-200 rounded font-semibold">
                              👩 Female {r.audience_female_pct}%
                            </span>
                          )}
                          {r.audience_male_pct != null && (
                            <span className="px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded font-semibold">
                              👨 Male {r.audience_male_pct}%
                            </span>
                          )}
                          {r.audience_age && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold">
                              🎂 Dominan {r.audience_age}
                            </span>
                          )}
                        </div>

                        {/* Top 5 Lokasi sebagai Pill Tags */}
                        <div className="space-y-1">
                          <div className="text-[10px] font-semibold text-slate-400 uppercase flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            <span>Top 5 Lokasi Audience</span>
                          </div>
                          {topLocations.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {topLocations.slice(0, 5).map((item, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-[10px] font-semibold"
                                >
                                  {item.loc} {item.pct}%
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[10px]">Data lokasi tidak tersedia</span>
                          )}
                        </div>
                      </td>

                      {/* Kolom 6: Status & Aksi Cepat */}
                      <td className="p-3 text-center space-y-1.5">
                        {r.status_staging === 'promoted' || r.exists_in_pool ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            Di Creator Pool
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold">
                            Staged
                          </span>
                        )}

                        <div className="text-[10px] text-slate-400 font-medium">
                          {r.scraped_at
                            ? new Date(r.scraped_at).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </div>

                        <div>
                          <button
                            onClick={async () => {
                              setPromoting(true);
                              try {
                                const res = await promoteStagingToCreatorPoolAction([id]);
                                if (res.success) {
                                  await Promise.all([loadStagingData(), syncKnownBook()]);
                                }
                              } finally {
                                setPromoting(false);
                              }
                            }}
                            disabled={promoting}
                            className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                          >
                            <span>{r.exists_in_pool ? 'Update ke Pool' : '+ Ke Pool'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div>
            Menampilkan <strong>{rows.length}</strong> dari <strong>{total}</strong> kreator di Staging
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPageNum((p) => Math.max(0, p - 1))}
              disabled={pageNum === 0 || loading}
              className="px-3 py-1.5 rounded border border-slate-300 bg-white disabled:opacity-40 inline-flex items-center gap-1 font-semibold"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Sebelumnya</span>
            </button>
            <span className="font-semibold px-2">Halaman {pageNum + 1}</span>
            <button
              onClick={() => setPageNum((p) => p + 1)}
              disabled={(pageNum + 1) * pageSize >= total || loading}
              className="px-3 py-1.5 rounded border border-slate-300 bg-white disabled:opacity-40 inline-flex items-center gap-1 font-semibold"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
