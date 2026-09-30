'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { 
  RefreshCw, CheckCircle2, AlertCircle, Clock, Zap, 
  ExternalLink, Database, ShieldCheck, ArrowRight, Activity,
  Calendar, SlidersHorizontal, ChevronRight
} from 'lucide-react';
import { 
  getTikTokAuthStatusAction, 
  saveTikTokAuthTokensAction,
  triggerManualTikTokSyncAction, 
  getTikTokSyncHistoryAction 
} from '@/app/actions/tiktokShopActions';

export function TikTokSyncControlCard() {
  const [status, setStatus] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  // Sync Range States
  const [syncRangeMode, setSyncRangeMode] = useState<'90d' | '180d' | '30d' | 'month' | 'custom'>('90d');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-05');
  const [customStartDate, setCustomStartDate] = useState<string>('2026-05-01');
  const [customEndDate, setCustomEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Live Progress States
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [currentStage, setCurrentStage] = useState<string>('');
  const [liveSalesCount, setLiveSalesCount] = useState(0);
  const [liveVideosCount, setLiveVideosCount] = useState(0);

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      let statusRes = await getTikTokAuthStatusAction();
      
      // Auto-heal: If database doesn't have token record yet, check browser localStorage
      if (!statusRes?.isConnected && typeof window !== 'undefined') {
        const localToken = localStorage.getItem('tts_access_token');
        const localRefresh = localStorage.getItem('tts_refresh_token') || '';
        const localCipher = localStorage.getItem('tts_partner_cipher') || 'ROW_fyGlKwAAAAB6jCmj_Z8Zc6uknZJUdZAi';
        if (localToken) {
          await saveTikTokAuthTokensAction({
            access_token: localToken,
            refresh_token: localRefresh,
            category_asset_cipher: localCipher,
            seller_name: 'TNT Media (Agency)'
          });
          statusRes = await getTikTokAuthStatusAction();
        }
      }

      const historyRes = await getTikTokSyncHistoryAction(5);
      setStatus(statusRes);
      setHistory(historyRes || []);
    } catch (err) {
      console.warn('Failed loading TikTok sync status:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const isBackgroundRunning = status?.data?.syncStatus === 'running';
    const intervalTime = isBackgroundRunning || isSyncing ? 3000 : 15000;
    const interval = setInterval(() => {
      loadData(true);
    }, intervalTime);
    return () => clearInterval(interval);
  }, [status?.data?.syncStatus, isSyncing]);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    setProgressPercent(5);
    setProgressMessage('Menyiapkan koneksi sinkronisasi...');
    setCurrentStage('auth');
    setLiveSalesCount(0);
    setLiveVideosCount(0);

    try {
      // Ensure token is saved in DB if available in localStorage
      if (!status?.isConnected && typeof window !== 'undefined') {
        const localToken = localStorage.getItem('tts_access_token');
        const localRefresh = localStorage.getItem('tts_refresh_token') || '';
        const localCipher = localStorage.getItem('tts_partner_cipher') || 'ROW_fyGlKwAAAAB6jCmj_Z8Zc6uknZJUdZAi';
        if (localToken) {
          await saveTikTokAuthTokensAction({
            access_token: localToken,
            refresh_token: localRefresh,
            category_asset_cipher: localCipher,
            seller_name: 'TNT Media (Agency)'
          });
        }
      }

      // Build payload based on selected range mode
      const payload: Record<string, any> = {};
      if (syncRangeMode === '180d') {
        payload.daysBack = 180;
      } else if (syncRangeMode === '30d') {
        payload.daysBack = 30;
      } else if (syncRangeMode === 'month') {
        payload.month = selectedMonth;
      } else if (syncRangeMode === 'custom') {
        payload.startDate = customStartDate;
        payload.endDate = customEndDate;
      } else {
        payload.daysBack = 90;
      }

      // Call streaming API route for live progress updates
      const response = await fetch('/api/sync/tiktok-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok && !response.body) {
        throw new Error(`HTTP error ${response.status}: Gagal memulai sinkronisasi`);
      }

      if (!response.body) {
        const json = await response.json();
        setSyncResult(json);
        await loadData();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const payload = JSON.parse(trimmed.replace(/^data:\s*/, ''));
              if (payload.type === 'progress') {
                setProgressPercent(payload.percent || 0);
                setProgressMessage(payload.message || '');
                if (payload.stage) setCurrentStage(payload.stage);
                if (payload.salesCount !== undefined) setLiveSalesCount(payload.salesCount);
                if (payload.videosCount !== undefined) setLiveVideosCount(payload.videosCount);
              } else if (payload.type === 'complete') {
                setSyncResult(payload.result);
                setProgressPercent(100);
                // Jangan bilang "selesai" kalau sebagian data gagal diambil.
                setProgressMessage(
                  payload.result?.partial
                    ? `Selesai SEBAGIAN - ${(payload.result?.errors || []).length} bagian gagal, data belum lengkap`
                    : 'Sinkronisasi selesai!'
                );
              } else if (payload.type === 'error') {
                setSyncResult({ success: false, message: payload.message || 'Terjadi kesalahan' });
              }
            } catch (jsonErr) {
              console.warn('SSE parse error:', jsonErr);
            }
          }
        }
      }

      await loadData();
    } catch (err: any) {
      setSyncResult({ success: false, message: err.message || 'Gagal sinkronisasi data' });
    } finally {
      setIsSyncing(false);
    }
  };

  const isConnected = status?.isConnected;
  const authData = status?.data;

  return (
    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-indigo-500/20 mb-6 transition-all">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        
        {/* Left Info Column */}
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 px-3 py-1 rounded-full">
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">TikTok Shop OpenAPI Auto-Sync</span>
            </div>

            {isConnected ? (
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 flex items-center gap-1.5 px-2.5 py-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Terhubung ({authData?.sellerName || 'TNT Agency'})
              </Badge>
            ) : (
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 flex items-center gap-1.5 px-2.5 py-0.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Belum Terhubung
              </Badge>
            )}
          </div>

          <h3 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Sinkronisasi Otomatis Data Penjualan, Video, & Live
          </h3>
          
          <p className="text-sm text-slate-300 leading-relaxed">
            Data Sales, Awareness Video, dan Sesi Live ditarik otomatis langsung dari TikTok Partner Center tanpa perlu upload Excel manual.
          </p>

          {/* Schedule Badges */}
          <div className="pt-2 flex items-center gap-2 flex-wrap text-xs text-slate-400">
            <span className="flex items-center gap-1 text-indigo-300 font-medium">
              <Clock className="w-3.5 h-3.5" /> Jadwal Otomatis:
            </span>
            <span className="bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded text-slate-200 font-mono">07:00 WIB</span>
            <span className="bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded text-slate-200 font-mono">12:00 WIB</span>
            <span className="bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded text-slate-200 font-mono">15:00 WIB</span>
            <span className="bg-slate-800/80 border border-slate-700 px-2 py-0.5 rounded text-slate-200 font-mono">18:00 WIB</span>
            <span className="text-slate-500">• Setiap Hari</span>
          </div>

          {/* Last Synced Report / Live Status Banner */}
          {authData?.lastSyncedAt && !isSyncing && authData?.syncStatus !== 'running' && (
            <div className="pt-2 flex items-center gap-2 flex-wrap text-xs">
              <span className="text-emerald-400 font-medium">
                Terakhir sinkron: {new Date(authData.lastSyncedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} WIB
              </span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                authData.syncTriggerType === 'cron' 
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' 
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}>
                {authData.syncTriggerType === 'cron' ? '🤖 Otomatis (Jadwal VPS)' : '👤 Manual'}
              </span>
              {history.length > 0 && (
                <span className="text-slate-400 text-[11px] bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50">
                  {history[0]?.sales_count || 0} orders • {history[0]?.videos_count || 0} konten ({((history[0]?.duration_ms || 0) / 1000).toFixed(1)}s)
                </span>
              )}
              {history[0]?.status === 'partial' && (
                <span
                  className="px-2 py-0.5 rounded text-[11px] font-semibold border bg-amber-500/20 text-amber-300 border-amber-500/40"
                  title={history[0]?.message || 'Sebagian data gagal diambil'}
                >
                  ⚠️ Sebagian Gagal - data belum lengkap
                </span>
              )}
            </div>
          )}

          {/* Rincian bagian yang gagal pada sinkronisasi terakhir */}
          {history[0]?.status === 'partial' && history[0]?.message && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
              <p className="font-semibold mb-1">Sinkronisasi terakhir tidak selesai penuh.</p>
              <p>{history[0].message}</p>
              <details className="mt-1">
                <summary className="cursor-pointer text-amber-300/80 hover:text-amber-200">
                  Lihat rincian {(history[0]?.details?.syncErrors || []).length} kegagalan
                </summary>
                <ul className="mt-1 space-y-0.5 list-disc list-inside text-amber-100/80">
                  {(history[0]?.details?.syncErrors || []).map((e: string, i: number) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </details>
            </div>
          )}

          {/* Real-time background sync badge if running in background */}
          {authData?.syncStatus === 'running' && !isSyncing && (
            <div className="pt-2 flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Auto-Sync sedang berjalan di background VPS ({authData.syncProgressPercent || 10}%)...
              </span>
            </div>
          )}
        </div>

        {/* Right Action Column */}
        <div className="flex flex-col gap-3 w-full lg:w-80 shrink-0">
          {/* Range Selector Controls */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-indigo-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Rentang Tarik Data:
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {syncRangeMode === '180d' ? '6 Bulan' : syncRangeMode === '90d' ? '3 Bulan' : syncRangeMode === '30d' ? '1 Bulan' : syncRangeMode === 'month' ? selectedMonth : 'Custom'}
              </span>
            </div>

            {/* Range Presets Tabs */}
            <div className="grid grid-cols-3 gap-1 text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setSyncRangeMode('90d')}
                className={`py-1.5 px-2 rounded-lg transition-all text-center ${
                  syncRangeMode === '90d'
                    ? 'bg-indigo-600 text-white font-bold shadow-sm'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                }`}
              >
                90 Hari
              </button>
              <button
                type="button"
                onClick={() => setSyncRangeMode('180d')}
                className={`py-1.5 px-2 rounded-lg transition-all text-center relative ${
                  syncRangeMode === '180d'
                    ? 'bg-indigo-600 text-white font-bold shadow-sm'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                }`}
              >
                180 Hari
              </button>
              <button
                type="button"
                onClick={() => setSyncRangeMode('30d')}
                className={`py-1.5 px-2 rounded-lg transition-all text-center ${
                  syncRangeMode === '30d'
                    ? 'bg-indigo-600 text-white font-bold shadow-sm'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                }`}
              >
                30 Hari
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1 text-[11px] font-medium pt-0.5">
              <button
                type="button"
                onClick={() => setSyncRangeMode('month')}
                className={`py-1 px-2 rounded-lg transition-all text-center ${
                  syncRangeMode === 'month'
                    ? 'bg-indigo-600 text-white font-bold shadow-sm'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                }`}
              >
                📅 Pilih Bulan
              </button>
              <button
                type="button"
                onClick={() => setSyncRangeMode('custom')}
                className={`py-1 px-2 rounded-lg transition-all text-center ${
                  syncRangeMode === 'custom'
                    ? 'bg-indigo-600 text-white font-bold shadow-sm'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                }`}
              >
                ⚙ Custom Range
              </button>
            </div>

            {/* Sub-controls: Month selector */}
            {syncRangeMode === 'month' && (
              <div className="pt-1 space-y-1 animate-in fade-in duration-200">
                <label className="text-[10px] text-slate-400 block font-medium">Pilih Bulan Target:</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full bg-slate-900 border border-indigo-500/40 rounded-lg px-2 py-1 text-xs text-indigo-100 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  <option value="2026-05">Mei 2026 (Historical Awal)</option>
                  <option value="2026-06">Juni 2026</option>
                  <option value="2026-07">Juli 2026</option>
                  <option value="2026-08">Agustus 2026</option>
                  <option value="2026-09">September 2026 (Bulan Ini)</option>
                </select>
              </div>
            )}

            {/* Sub-controls: Custom Date Range */}
            {syncRangeMode === 'custom' && (
              <div className="pt-1 space-y-1.5 animate-in fade-in duration-200 text-[11px]">
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[10px] text-slate-400 block">Dari:</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full bg-slate-900 border border-indigo-500/40 rounded-lg px-1.5 py-1 text-[11px] text-indigo-100 font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">Sampai:</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full bg-slate-900 border border-indigo-500/40 rounded-lg px-1.5 py-1 text-[11px] text-indigo-100 font-mono focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={handleSyncNow}
            disabled={isSyncing || !isConnected}
            className={`w-full font-bold px-4 py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm ${
              isConnected && !isSyncing
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-900/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing 
              ? 'Sedang Menarik Data...' 
              : syncRangeMode === '180d'
                ? '⚡ Sync 180 Hari (6 Bulan)'
                : syncRangeMode === 'month'
                  ? `⚡ Sync Bulan ${selectedMonth}`
                  : syncRangeMode === 'custom'
                    ? '⚡ Sync Rentang Tanggal'
                    : syncRangeMode === '30d'
                      ? '⚡ Sync 30 Hari'
                      : '⚡ Sync 90 Hari (Standar)'}
          </Button>

          {!isConnected && (
            <a
              href="/auth/tiktok-shop/callback"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/30 text-xs font-semibold text-indigo-200 transition-colors text-center"
            >
              <ShieldCheck className="w-4 h-4" /> Hubungkan Partner Center <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* LIVE SYNC PROGRESS BAR & STATUS (Manual or Background) */}
      {(isSyncing || authData?.syncStatus === 'running') && (
        <div className="mt-6 pt-5 border-t border-indigo-500/20 space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2 text-indigo-300">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-400" />
              <span>
                {isSyncing 
                  ? (progressMessage || 'Sedang memproses sinkronisasi TikTok...') 
                  : (authData?.syncProgressMessage || 'Auto-Sync sedang berjalan di background server VPS...')}
              </span>
            </div>
            <span className="text-teal-400 font-mono font-bold text-sm">
              {isSyncing ? progressPercent : (authData?.syncProgressPercent || 10)}%
            </span>
          </div>

          {/* Progress Bar Track */}
          <div className="w-full bg-slate-800/90 rounded-full h-2.5 overflow-hidden border border-indigo-900/50 p-0.5">
            <div 
              className="bg-gradient-to-r from-teal-400 via-indigo-400 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-sm"
              style={{ width: `${Math.max(5, isSyncing ? progressPercent : (authData?.syncProgressPercent || 10))}%` }}
            />
          </div>

          {/* Live Counter Badges (if manual sync) */}
          {isSyncing && (
            <div className="flex items-center gap-4 text-xs pt-1">
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/50">
                <span className="text-slate-400">Pesanan (Sales):</span>
                <span className="font-bold text-emerald-400 font-mono">{liveSalesCount}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/50">
                <span className="text-slate-400">Konten Video & Live:</span>
                <span className="font-bold text-teal-400 font-mono">{liveVideosCount}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sync Feedback Toast / Banner */}
      {syncResult && !isSyncing && (
        <div className={`mt-5 p-4 rounded-xl text-xs font-medium flex items-center justify-between gap-3 border animate-in fade-in duration-300 ${
          syncResult.success 
            ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200 shadow-lg shadow-emerald-950/50' 
            : 'bg-red-950/70 border-red-500/50 text-red-200 shadow-lg shadow-red-950/50'
        }`}>
          <div className="flex items-center gap-2.5">
            {syncResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span className="leading-relaxed">{syncResult.message}</span>
          </div>
          <button 
            onClick={() => setSyncResult(null)} 
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* DIAGNOSTIC LOG VIEWER ACCORDION */}
      {history.length > 0 && (
        <DiagnosticLogViewer history={history} latestResult={syncResult} />
      )}
    </div>
  );
}

/**
 * Diagnostic Log Viewer Sub-component
 */
function DiagnosticLogViewer({ history, latestResult }: { history: any[]; latestResult: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedLogIndex, setSelectedLogIndex] = useState(0);

  const activeLog = history[selectedLogIndex] || history[0];
  const details = latestResult?.details || activeLog?.details || {};

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(details, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-5 pt-4 border-t border-indigo-500/20">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-xs font-semibold text-indigo-300 hover:text-indigo-100 transition-colors py-1.5"
      >
        <span className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-indigo-400" />
          <span>🔍 Log Diagnostik & Analisis Respon TikTok OpenAPI {isOpen ? '(Tutup)' : '(Klik untuk Analisis Lengkap)'}</span>
        </span>
        <span className="text-[11px] bg-indigo-900/60 border border-indigo-700/50 px-2 py-0.5 rounded text-indigo-200">
          {isOpen ? 'Sembunyikan ▲' : 'Lihat Detail ▼'}
        </span>
      </button>

      {isOpen && (
        <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-indigo-500/30 text-xs space-y-4 animate-in fade-in duration-300">
          
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-800">
            <div>
              <p className="font-bold text-slate-200">Riwayat & Analisis Eksekusi Terakhir</p>
              <p className="text-[11px] text-slate-400">
                Waktu: {activeLog?.created_at ? new Date(activeLog.created_at).toLocaleString('id-ID') : 'Baru saja'} | Durasi: {activeLog?.duration_ms || 0}ms
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyJson}
                className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/30 rounded text-[11px] font-medium text-indigo-200 transition-colors"
              >
                {copied ? '✓ Tersalin' : '📋 Salin JSON Diagnostik'}
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Kampanye TAP</span>
              <span className="text-base font-bold text-indigo-300 font-mono">
                {details?.campaignsList?.length || activeLog?.campaigns_count || 0}
              </span>
            </div>
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Orders Direspons</span>
              <span className="text-base font-bold text-emerald-400 font-mono">
                {activeLog?.sales_count || 0}
              </span>
            </div>
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Konten Terdeteksi</span>
              <span className="text-base font-bold text-teal-400 font-mono">
                {activeLog?.videos_count || 0}
              </span>
            </div>
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Status API</span>
              <span className="text-base font-bold text-amber-300 font-mono">
                {activeLog?.status?.toUpperCase() || 'OK'}
              </span>
            </div>
          </div>

          {/* Section: Order API Call Details */}
          {details?.orderApiLogs && details.orderApiLogs.length > 0 && (
            <div className="space-y-2">
              <p className="font-semibold text-slate-300 text-[11px] flex items-center gap-1.5">
                <span>📡 Hasil Request Endpoint Pesanan (Orders Search):</span>
              </p>
              <div className="space-y-1.5">
                {details.orderApiLogs.map((log: any, idx: number) => (
                  <div key={idx} className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex flex-col sm:flex-row justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-indigo-300 font-medium">{log.endpoint}</span>
                        <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-300 font-mono">{log.label}</span>
                        <Badge className={`text-[10px] px-1.5 py-0 ${log.success ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                          HTTP {log.httpStatus} | Code {log.code}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-400">Pesan TikTok: "{log.message}"</p>
                    </div>
                    <div className="sm:text-right shrink-0">
                      <span className="text-[11px] font-mono font-bold text-slate-200">
                        {log.ordersCount} pesanan ditemukan
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: TAP Campaigns Found */}
          {details?.campaignsList && details.campaignsList.length > 0 && (
            <div className="space-y-2">
              <p className="font-semibold text-slate-300 text-[11px]">
                🎯 Daftar Kampanye TAP Ditemukan di Partner Center ({details.campaignsList.length}):
              </p>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1 bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                {details.campaignsList.map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1 px-2 hover:bg-slate-800/50 rounded text-[11px]">
                    <span className="text-slate-300 font-medium truncate max-w-xs">{i + 1}. {c.name || 'Tanpa Nama'}</span>
                    <span className="font-mono text-slate-400 text-[10px] shrink-0">ID: {c.id} ({c.status})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw JSON Accordion */}
          <details className="group">
            <summary className="cursor-pointer text-[11px] text-indigo-400 font-semibold hover:text-indigo-300">
              ▸ Lihat Respon Mentah (Raw JSON Details)
            </summary>
            <pre className="mt-2 p-3 bg-black/80 rounded-lg text-[10px] text-emerald-400 font-mono overflow-x-auto max-h-48">
              {JSON.stringify(details, null, 2)}
            </pre>
          </details>

        </div>
      )}
    </div>
  );
}

