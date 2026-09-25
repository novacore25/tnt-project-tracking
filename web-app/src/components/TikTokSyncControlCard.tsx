'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { 
  RefreshCw, CheckCircle2, AlertCircle, Clock, Zap, 
  ExternalLink, Database, ShieldCheck, ArrowRight, Activity 
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

  // Live Progress States
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [currentStage, setCurrentStage] = useState<string>('');
  const [liveSalesCount, setLiveSalesCount] = useState(0);
  const [liveVideosCount, setLiveVideosCount] = useState(0);

  const loadData = async () => {
    setIsLoading(true);
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

      const historyRes = await getTikTokSyncHistoryAction(3);
      setStatus(statusRes);
      setHistory(historyRes || []);
    } catch (err) {
      console.warn('Failed loading TikTok sync status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

      // Call streaming API route for live progress updates
      const response = await fetch('/api/sync/tiktok-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
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
                setProgressMessage('Sinkronisasi selesai!');
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

          {authData?.lastSyncedAt && !isSyncing && (
            <p className="text-xs text-emerald-400/90 font-medium pt-1">
              Terakhir sinkron: {new Date(authData.lastSyncedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} WIB
            </p>
          )}
        </div>

        {/* Right Action Column */}
        <div className="flex flex-col sm:flex-row lg:flex-col gap-3 w-full lg:w-auto shrink-0">
          <Button
            onClick={handleSyncNow}
            disabled={isSyncing || !isConnected}
            className={`w-full font-bold px-6 py-5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2.5 ${
              isConnected && !isSyncing
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-900/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sedang Menarik Data...' : '⚡ Sync Sekarang (Tarik Data)'}
          </Button>

          {!isConnected && (
            <a
              href="/auth/tiktok-shop/callback"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/30 text-xs font-semibold text-indigo-200 transition-colors"
            >
              <ShieldCheck className="w-4 h-4" /> Hubungkan Akun Partner Center <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* LIVE SYNC PROGRESS BAR & STATUS */}
      {isSyncing && (
        <div className="mt-6 pt-5 border-t border-indigo-500/20 space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2 text-indigo-300">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-400" />
              <span>{progressMessage || 'Sedang memproses sinkronisasi TikTok...'}</span>
            </div>
            <span className="text-teal-400 font-mono font-bold text-sm">{progressPercent}%</span>
          </div>

          {/* Progress Bar Track */}
          <div className="w-full bg-slate-800/90 rounded-full h-2.5 overflow-hidden border border-indigo-900/50 p-0.5">
            <div 
              className="bg-gradient-to-r from-teal-400 via-indigo-400 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-sm"
              style={{ width: `${Math.max(5, progressPercent)}%` }}
            />
          </div>

          {/* Live Counter Badges */}
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
    </div>
  );
}
