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
  triggerManualTikTokSyncAction, 
  getTikTokSyncHistoryAction 
} from '@/app/actions/tiktokShopActions';

export function TikTokSyncControlCard() {
  const [status, setStatus] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statusRes, historyRes] = await Promise.all([
        getTikTokAuthStatusAction(),
        getTikTokSyncHistoryAction(3)
      ]);
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
    try {
      const res = await triggerManualTikTokSyncAction();
      setSyncResult(res);
      await loadData();
    } catch (err: any) {
      setSyncResult({ success: false, message: err.message || 'Gagal sinkronisasi' });
    } finally {
      setIsSyncing(false);
    }
  };

  const isConnected = status?.isConnected;
  const authData = status?.data;

  return (
    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-indigo-500/20 mb-6">
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

          {authData?.lastSyncedAt && (
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
              isConnected
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-900/30'
                : 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Menarik Data TikTok...' : '⚡ Sync Sekarang (Tarik Data)'}
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

      {/* Sync Feedback Toast / Banner */}
      {syncResult && (
        <div className={`mt-4 p-3.5 rounded-xl text-xs font-medium flex items-center justify-between gap-3 border ${
          syncResult.success 
            ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200' 
            : 'bg-red-950/60 border-red-500/40 text-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {syncResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
            <span>{syncResult.message}</span>
          </div>
          <button onClick={() => setSyncResult(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}
    </div>
  );
}
