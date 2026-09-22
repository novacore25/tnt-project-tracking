"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Trash2,
  RefreshCw,
  ExternalLink,
  Plus,
  Loader2,
  Database,
  Sparkles,
  Info,
  Filter,
  Check,
  Film,
  Tag
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import {
  bulkVerifyVideoLinksAction,
  commitBulkImportVideosAction
} from "@/app/actions/campaignPageActions";

export interface StagingVideoItem {
  id: string;
  originalUrl: string;
  expandedUrl: string;
  username: string;
  videoId: string;
  skuId: number | null;
  status: 'ready_existing' | 'ready_global' | 'ready_new' | 'duplicate_db' | 'duplicate_batch' | 'error';
  statusText: string;
  creatorName?: string;
  ccId?: number;
  creatorId?: number;
  canImport: boolean;
  addedAt: string;
}

interface ImportVideoClientProps {
  campaignId: number;
  campaignName: string;
  skus: Array<{ id: number; nama_produk: string; kode_sku?: string }>;
}

const isShortLink = (url: string) => {
  return /vt\.tiktok\.com|vm\.tiktok\.com|t\.tiktok\.com/i.test(url);
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function ImportVideoClient({
  campaignId,
  campaignName,
  skus
}: ImportVideoClientProps) {
  const router = useRouter();
  const { profile, canEditCampaign } = useAuth();
  const hasAccess = canEditCampaign(campaignId);

  const storageKey = `tnt_video_import_staging_${campaignId}`;

  // Staging items state
  const [stagedItems, setStagedItems] = useState<StagingVideoItem[]>([]);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  // Input state
  const [rawInput, setRawInput] = useState("");
  const [defaultSkuId, setDefaultSkuId] = useState<number | null>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState({ current: 0, total: 0, currentUrl: "" });

  // Verification & Commit state
  const [isReverifying, setIsReverifying] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    open: boolean;
    success: boolean;
    message: string;
    insertedCount?: number;
    skippedCount?: number;
  } | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Load staging items from LocalStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setStagedItems(parsed);
        }
      }
    } catch (e) {
      console.error("Gagal membaca staging dari localStorage:", e);
    } finally {
      setIsStorageLoaded(true);
    }
  }, [storageKey]);

  // Persist staging items to LocalStorage on change
  useEffect(() => {
    if (!isStorageLoaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(stagedItems));
    } catch (e) {
      console.error("Gagal menyimpan staging ke localStorage:", e);
    }
  }, [stagedItems, isStorageLoaded, storageKey]);

  // Compute metrics
  const metrics = useMemo(() => {
    const total = stagedItems.length;
    const readyExisting = stagedItems.filter(i => i.status === 'ready_existing').length;
    const readyGlobal = stagedItems.filter(i => i.status === 'ready_global').length;
    const readyNew = stagedItems.filter(i => i.status === 'ready_new').length;
    const duplicate = stagedItems.filter(i => i.status === 'duplicate_db' || i.status === 'duplicate_batch').length;
    const error = stagedItems.filter(i => i.status === 'error').length;
    const readyToImport = readyExisting + readyGlobal + readyNew;

    return { total, readyExisting, readyGlobal, readyNew, duplicate, error, readyToImport };
  }, [stagedItems]);

  // Filtered rows for the staging table
  const filteredItems = useMemo(() => {
    return stagedItems.filter(item => {
      // Filter status
      if (statusFilter === "ready" && !item.canImport) return false;
      if (statusFilter === "ready_existing" && item.status !== 'ready_existing') return false;
      if (statusFilter === "ready_global" && item.status !== 'ready_global') return false;
      if (statusFilter === "ready_new" && item.status !== 'ready_new') return false;
      if (statusFilter === "duplicate" && item.status !== 'duplicate_db' && item.status !== 'duplicate_batch') return false;
      if (statusFilter === "error" && item.status !== 'error') return false;

      // Filter search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchUser = item.username?.toLowerCase().includes(q);
        const matchVid = item.videoId?.toLowerCase().includes(q);
        const matchUrl = item.originalUrl?.toLowerCase().includes(q);
        if (!matchUser && !matchVid && !matchUrl) return false;
      }

      return true;
    });
  }, [stagedItems, statusFilter, searchQuery]);

  // Handle parsing & processing batch links
  const handleProcessLinks = async () => {
    if (!rawInput.trim() || isProcessing) return;

    // Parse distinct lines from textarea
    const rawLines = rawInput
      .split("\n")
      .map(l => l.trim())
      .filter(l => l.length > 0 && l.startsWith("http"));

    if (rawLines.length === 0) {
      alert("Harap masukkan setidaknya 1 link TikTok yang valid (dimulai dengan http:// atau https://).");
      return;
    }

    // Filter out lines that are already staged by originalUrl
    const existingOriginalUrls = new Set(stagedItems.map(i => i.originalUrl));
    const existingVideoIds = new Set(stagedItems.map(i => i.videoId).filter(Boolean));
    const newLines = Array.from(new Set(rawLines.filter(l => !existingOriginalUrls.has(l))));

    if (newLines.length === 0) {
      alert("Semua link yang dimasukkan sudah ada di tabel antrean (staging).");
      return;
    }

    setIsProcessing(true);
    setProcessProgress({ current: 0, total: newLines.length, currentUrl: "Memulai resolusi link..." });

    const resolvedBatchItems: Array<{
      id: string;
      originalUrl: string;
      expandedUrl: string;
      username: string;
      videoId: string;
      skuId: number | null;
      status: any;
      statusText: string;
      canImport: boolean;
      addedAt: string;
    }> = [];

    const BATCH_SIZE = 3; // 3 link per request chunk to prevent rate limits

    for (let i = 0; i < newLines.length; i += BATCH_SIZE) {
      const chunk = newLines.slice(i, i + BATCH_SIZE);

      const chunkPromises = chunk.map(async (link) => {
        let finalLink = link;
        let isShort = isShortLink(link);

        if (isShort) {
          try {
            const res = await fetch('/api/expand-tiktok', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ shortUrl: link })
            });
            const data = await res.json();
            if (res.ok && data.expandedUrl) {
              finalLink = data.expandedUrl;
            }
          } catch (err) {
            console.error("Gagal expand link:", link, err);
          }
        }

        const usernameMatch = finalLink.match(/@([a-zA-Z0-9_.-]+)/);
        const videoIdMatch = finalLink.match(/video\/(\d+)/);
        const username = usernameMatch ? usernameMatch[1].toLowerCase() : "";
        const videoId = videoIdMatch ? videoIdMatch[1] : "";

        const tempId = `stg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        return {
          id: tempId,
          originalUrl: link,
          expandedUrl: finalLink,
          username,
          videoId,
          skuId: defaultSkuId,
          status: 'ready_new' as const,
          statusText: 'Sedang diverifikasi...',
          canImport: false,
          addedAt: new Date().toISOString()
        };
      });

      const processedChunk = await Promise.all(chunkPromises);
      resolvedBatchItems.push(...processedChunk);

      setProcessProgress({
        current: Math.min(i + BATCH_SIZE, newLines.length),
        total: newLines.length,
        currentUrl: chunk[0] || ""
      });

      // 1-second pause between chunks for TikTok rate limit safety
      if (i + BATCH_SIZE < newLines.length) {
        await delay(1000);
      }
    }

    // Now run server verification against DB for all resolved items
    try {
      setProcessProgress(prev => ({ ...prev, currentUrl: "Memverifikasi data ke database..." }));
      const verifyRes = await bulkVerifyVideoLinksAction(campaignId, resolvedBatchItems);

      if (verifyRes.success && verifyRes.results) {
        const resultMap = new Map(verifyRes.results.map(r => [r.id, r]));

        const verifiedItems: StagingVideoItem[] = resolvedBatchItems.map(item => {
          const res = resultMap.get(item.id);
          if (res) {
            return {
              ...item,
              status: res.status as any,
              statusText: res.statusText,
              creatorName: (res as any).creatorName,
              ccId: (res as any).ccId,
              creatorId: (res as any).creatorId,
              canImport: res.canImport
            };
          }
          return item;
        });

        // Append to staging items
        setStagedItems(prev => [...prev, ...verifiedItems]);
        setRawInput(""); // Clear textarea for next paste batch!
      } else {
        alert("Gagal memverifikasi batch ke server: " + (verifyRes.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Terjadi kesalahan saat verifikasi: " + err.message);
    } finally {
      setIsProcessing(false);
      setProcessProgress({ current: 0, total: 0, currentUrl: "" });
    }
  };

  // Re-verify all staged items against current DB
  const handleReverifyAll = async () => {
    if (stagedItems.length === 0 || isReverifying) return;
    setIsReverifying(true);

    try {
      const verifyRes = await bulkVerifyVideoLinksAction(campaignId, stagedItems);
      if (verifyRes.success && verifyRes.results) {
        const resultMap = new Map(verifyRes.results.map(r => [r.id, r]));

        setStagedItems(prev => prev.map(item => {
          const res = resultMap.get(item.id);
          if (res) {
            return {
              ...item,
              status: res.status as any,
              statusText: res.statusText,
              creatorName: (res as any).creatorName,
              ccId: (res as any).ccId,
              creatorId: (res as any).creatorId,
              canImport: res.canImport
            };
          }
          return item;
        }));
      }
    } catch (err: any) {
      alert("Gagal verifikasi ulang: " + err.message);
    } finally {
      setIsReverifying(false);
    }
  };

  // Remove single item
  const handleRemoveItem = (id: string) => {
    setStagedItems(prev => prev.filter(i => i.id !== id));
  };

  // Remove all duplicate & error items
  const handleRemoveInvalid = () => {
    setStagedItems(prev => prev.filter(i => i.canImport));
  };

  // Clear all staged items
  const handleClearAll = () => {
    if (confirm("Apakah Anda yakin ingin mengosongkan seluruh antrean import ini?")) {
      setStagedItems([]);
      localStorage.removeItem(storageKey);
    }
  };

  // Update SKU for a single item
  const handleUpdateItemSku = (id: string, skuId: number | null) => {
    setStagedItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, skuId };
      }
      return item;
    }));
  };

  // Batch apply SKU to all filtered items
  const handleBatchApplySku = (skuId: number | null) => {
    if (filteredItems.length === 0) return;
    const targetIds = new Set(filteredItems.map(i => i.id));
    setStagedItems(prev => prev.map(item => {
      if (targetIds.has(item.id)) {
        return { ...item, skuId };
      }
      return item;
    }));
  };

  // Final Commit to Database
  const handleCommitImport = async () => {
    const validItems = stagedItems.filter(i => i.canImport);
    if (validItems.length === 0) {
      alert("Tidak ada video yang valid dan siap untuk diimport.");
      return;
    }

    if (!confirm(`Konfirmasi import ${validItems.length} video ke database campaign "${campaignName}"?`)) {
      return;
    }

    setIsImporting(true);

    try {
      const payload = validItems.map(item => ({
        originalUrl: item.originalUrl,
        expandedUrl: item.expandedUrl,
        username: item.username,
        videoId: item.videoId,
        skuId: item.skuId
      }));

      const res = await commitBulkImportVideosAction(
        campaignId,
        payload,
        profile?.id,
        profile?.nama || 'Bulk Import'
      );

      if (res.success) {
        // Remove successfully committed items from staging
        const committedVidIds = new Set(validItems.map(i => i.videoId));
        setStagedItems(prev => prev.filter(i => !committedVidIds.has(i.videoId)));

        setImportResult({
          open: true,
          success: true,
          message: res.message || `Berhasil mengimport ${res.insertedCount} video!`,
          insertedCount: res.insertedCount,
          skippedCount: res.skippedCount
        });
      } else {
        alert("Gagal mengimport video: " + (res.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Terjadi kesalahan saat import: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href={`/campaigns/${campaignId}/video`}
                className="p-2 -ml-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                title="Kembali ke Halaman Video"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                    Bulk Import Link Video
                  </h1>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Staging Workspace
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Campaign: <span className="font-semibold text-slate-700">{campaignName}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={handleReverifyAll}
                disabled={stagedItems.length === 0 || isReverifying}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReverifying ? 'animate-spin text-indigo-600' : ''}`} />
                <span>{isReverifying ? 'Memeriksa...' : 'Cek Ulang Status'}</span>
              </button>
              
              <Link
                href={`/campaigns/${campaignId}/video`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Ke Halaman Video
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Info Box */}
        <div className="bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-xl p-4 text-xs text-blue-900 flex items-start gap-3 shadow-xs">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-blue-950">
              Sinkronisasi Video Realtime (H-0) & Bebas Tabrakan dengan File TikTok Awareness (H-2)
            </p>
            <p className="text-blue-800/90 leading-relaxed">
              Anda dapat memasukkan link bertahap (misal 10 link dulu, verifikasi, lalu tambah lagi). Semua data tersimpan aman di <b>Cache Browser</b>.
              Ketika file laporan TikTok diunggah nanti, sistem akan otomatis mencocokkan metrik Views & GMV berdasarkan <b>Video ID (content_uid)</b> tanpa duplikasi baris database.
            </p>
          </div>
        </div>

        {/* Input & Batch Processing Section */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                Input Link Video TikTok
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Paste link TikTok satu per baris (mendukung link pendek <code>vt.tiktok.com</code> maupun link lengkap).
              </p>
            </div>

            {/* Default SKU Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600 whitespace-nowrap">Default SKU:</span>
              <select
                value={defaultSkuId || ""}
                onChange={(e) => setDefaultSkuId(e.target.value ? Number(e.target.value) : null)}
                className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium"
              >
                <option value="">-- Pilih SKU (Opsional) --</option>
                {skus.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nama_produk} {s.kode_sku ? `(${s.kode_sku})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              disabled={isProcessing}
              placeholder={`Contoh:\nhttps://vt.tiktok.com/ZSxxxxxx/\nhttps://www.tiktok.com/@namakreator/video/7382910293819201928`}
              className="w-full h-32 p-3 text-xs font-mono bg-slate-50/50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-400"
            />

            {/* Processing Progress Bar */}
            {isProcessing && (
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-indigo-900 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                    Memproses & Memverifikasi Link: {processProgress.current} dari {processProgress.total}
                  </span>
                  <span className="font-mono text-indigo-700 font-bold">
                    {Math.round((processProgress.current / Math.max(processProgress.total, 1)) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-indigo-200/50 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(processProgress.current / Math.max(processProgress.total, 1)) * 100}%` }}
                  />
                </div>
                <p className="text-[11px] text-indigo-600 truncate font-mono">
                  {processProgress.currentUrl}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-xs text-slate-500">
                {rawInput.trim() ? (
                  <span>
                    Terdeteksi: <b>{rawInput.split("\n").filter(l => l.trim()).length}</b> link
                  </span>
                ) : (
                  <span>Belum ada link yang dimasukkan</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {rawInput.trim() && (
                  <button
                    onClick={() => setRawInput("")}
                    disabled={isProcessing}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Bersihkan Teks
                  </button>
                )}
                <button
                  onClick={handleProcessLinks}
                  disabled={!rawInput.trim() || isProcessing}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Proses & Cek Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Staging Summary & Filters */}
        <div className="space-y-4">
          {/* Status Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <button
              onClick={() => setStatusFilter("all")}
              className={`p-3 rounded-xl border text-left transition-all ${
                statusFilter === "all"
                  ? "bg-white border-slate-400 ring-2 ring-slate-400/20 shadow-xs"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="text-xs text-slate-500 font-medium">Total Antrean</div>
              <div className="text-xl font-bold text-slate-900 mt-0.5">{metrics.total}</div>
            </button>

            <button
              onClick={() => setStatusFilter("ready_existing")}
              className={`p-3 rounded-xl border text-left transition-all ${
                statusFilter === "ready_existing"
                  ? "bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Kreator Campaign
              </div>
              <div className="text-xl font-bold text-emerald-700 mt-0.5">{metrics.readyExisting}</div>
            </button>

            <button
              onClick={() => setStatusFilter("ready_global")}
              className={`p-3 rounded-xl border text-left transition-all ${
                statusFilter === "ready_global"
                  ? "bg-blue-50/50 border-blue-500 ring-2 ring-blue-500/20 shadow-xs"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="text-xs text-blue-700 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                Kreator Master
              </div>
              <div className="text-xl font-bold text-blue-700 mt-0.5">{metrics.readyGlobal}</div>
            </button>

            <button
              onClick={() => setStatusFilter("ready_new")}
              className={`p-3 rounded-xl border text-left transition-all ${
                statusFilter === "ready_new"
                  ? "bg-purple-50/50 border-purple-500 ring-2 ring-purple-500/20 shadow-xs"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="text-xs text-purple-700 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                Kreator Baru
              </div>
              <div className="text-xl font-bold text-purple-700 mt-0.5">{metrics.readyNew}</div>
            </button>

            <button
              onClick={() => setStatusFilter("duplicate")}
              className={`p-3 rounded-xl border text-left transition-all ${
                statusFilter === "duplicate"
                  ? "bg-amber-50/50 border-amber-500 ring-2 ring-amber-500/20 shadow-xs"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="text-xs text-amber-700 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Duplikat
              </div>
              <div className="text-xl font-bold text-amber-700 mt-0.5">{metrics.duplicate}</div>
            </button>

            <button
              onClick={() => setStatusFilter("error")}
              className={`p-3 rounded-xl border text-left transition-all ${
                statusFilter === "error"
                  ? "bg-rose-50/50 border-rose-500 ring-2 ring-rose-500/20 shadow-xs"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="text-xs text-rose-700 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                Error / Invalid
              </div>
              <div className="text-xl font-bold text-rose-700 mt-0.5">{metrics.error}</div>
            </button>
          </div>

          {/* Staging Table Card */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            {/* Table Action Bar */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari username / Video ID..."
                    className="w-52 sm:w-64 pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>

                {/* Batch SKU Apply for current filtered view */}
                {skus.length > 0 && filteredItems.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-slate-500" />
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleBatchApplySku(Number(e.target.value));
                          e.target.value = "";
                        }
                      }}
                      defaultValue=""
                      className="text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-700"
                    >
                      <option value="" disabled>Set SKU untuk {filteredItems.length} Baris...</option>
                      {skus.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.nama_produk} {s.kode_sku ? `(${s.kode_sku})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {(metrics.duplicate > 0 || metrics.error > 0) && (
                  <button
                    onClick={handleRemoveInvalid}
                    className="px-2.5 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                  >
                    Hapus Duplikat & Error ({metrics.duplicate + metrics.error})
                  </button>
                )}

                {stagedItems.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Kosongkan Antrean
                  </button>
                )}
              </div>
            </div>

            {/* Table Component */}
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100/80 sticky top-0 z-10 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">Video URL & TikTok Link</th>
                    <th className="p-3">Kreator</th>
                    <th className="p-3">Video ID</th>
                    <th className="p-3">SKU Produk</th>
                    <th className="p-3">Status Verifikasi</th>
                    <th className="p-3 text-center w-16">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        {stagedItems.length === 0
                          ? "Belum ada link di antrean staging. Paste link TikTok pada box di atas untuk memulai."
                          : "Tidak ada data yang cocok dengan filter yang dipilih."}
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, idx) => {
                      const isReady = item.canImport;
                      const isDup = item.status === 'duplicate_db' || item.status === 'duplicate_batch';
                      const isErr = item.status === 'error';

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isReady ? 'bg-emerald-50/15' : isDup ? 'bg-amber-50/20' : 'bg-rose-50/20'
                          }`}
                        >
                          <td className="p-3 text-center font-mono text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="p-3 max-w-[280px]">
                            <div className="flex items-center gap-1.5 group">
                              <a
                                href={item.expandedUrl || item.originalUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-[11px] text-slate-800 hover:text-indigo-600 truncate block max-w-[240px]"
                                title={item.expandedUrl || item.originalUrl}
                              >
                                {item.originalUrl}
                              </a>
                              <a
                                href={item.expandedUrl || item.originalUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-400 hover:text-indigo-600 shrink-0"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            {item.expandedUrl && item.expandedUrl !== item.originalUrl && (
                              <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5" title={item.expandedUrl}>
                                → {item.expandedUrl}
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            {item.username ? (
                              <div className="flex flex-col">
                                <a
                                  href={`https://www.tiktok.com/@${item.username}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-semibold text-slate-800 hover:text-indigo-600 flex items-center gap-1"
                                >
                                  @{item.username}
                                </a>
                                {item.creatorName && (
                                  <span className="text-[10px] text-slate-500 truncate max-w-[140px]">
                                    {item.creatorName}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            {item.videoId ? (
                              <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                                {item.videoId}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            <select
                              value={item.skuId || ""}
                              onChange={(e) => handleUpdateItemSku(item.id, e.target.value ? Number(e.target.value) : null)}
                              className="text-[11px] bg-white border border-slate-200 rounded-md px-2 py-1 focus:ring-1 focus:ring-indigo-500 w-full max-w-[160px]"
                            >
                              <option value="">Tanpa SKU</option>
                              {skus.map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.nama_produk} {s.kode_sku ? `(${s.kode_sku})` : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3">
                            {item.status === 'ready_existing' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                {item.statusText}
                              </span>
                            )}
                            {item.status === 'ready_global' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                <CheckCircle2 className="w-3 h-3 text-blue-600" />
                                {item.statusText}
                              </span>
                            )}
                            {item.status === 'ready_new' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-100 text-purple-800 border border-purple-200">
                                <Sparkles className="w-3 h-3 text-purple-600" />
                                {item.statusText}
                              </span>
                            )}
                            {isDup && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-200" title={item.statusText}>
                                <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                <span className="truncate max-w-[180px]">{item.statusText}</span>
                              </span>
                            )}
                            {isErr && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-100 text-rose-800 border border-rose-200" title={item.statusText}>
                                <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
                                <span className="truncate max-w-[180px]">{item.statusText}</span>
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                              title="Hapus baris ini dari staging"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Commit Bar */}
      {stagedItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg py-3 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                <Film className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  {metrics.readyToImport} Video Siap Diimport ke Campaign
                </div>
                <div className="text-[11px] text-slate-500">
                  {metrics.duplicate > 0 && `${metrics.duplicate} duplikat akan dilewati otomatis. `}
                  Semua link akan terkoneksi langsung dengan video listing & performa realtime.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <Link
                href={`/campaigns/${campaignId}/video`}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-center"
              >
                Batal
              </Link>

              <button
                onClick={handleCommitImport}
                disabled={metrics.readyToImport === 0 || isImporting}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-sm transition-all"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Database...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    <span>Simpan & Import {metrics.readyToImport} Video</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {importResult?.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Bulk Import Berhasil!
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {importResult.message}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-700">
                <span>Video berhasil masuk:</span>
                <span className="font-bold text-emerald-600">{importResult.insertedCount || 0}</span>
              </div>
              {Number(importResult.skippedCount) > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>Duplikat dilewati:</span>
                  <span className="font-bold text-amber-600">{importResult.skippedCount}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setImportResult(null)}
                className="flex-1 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Tetap di Halaman Ini
              </button>
              <Link
                href={`/campaigns/${campaignId}/video`}
                className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors text-center"
              >
                Lihat di Halaman Video
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
