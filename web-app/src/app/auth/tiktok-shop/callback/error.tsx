'use client';

import React, { useEffect } from 'react';
import { AlertCircle, RefreshCw, Trash2, Home } from 'lucide-react';
import Link from 'next/link';

export default function TikTokCallbackError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('TikTok Shop Callback Error Boundary caught:', error);
  }, [error]);

  const handleClearCacheAndReset = () => {
    try {
      localStorage.removeItem('tts_access_token');
      localStorage.removeItem('tts_refresh_token');
      localStorage.removeItem('tts_partner_cipher');
    } catch (e) {
      console.warn('Failed to clear storage:', e);
    }
    window.location.href = '/auth/tiktok-shop/callback';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6">
        <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-rose-50/50">
          <AlertCircle className="w-7 h-7" />
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-slate-900">
            Kendala Memuat Halaman Otorisasi
          </h2>
          <p className="text-xs text-slate-500">
            Terjadi kendala saat memproses halaman otorisasi TikTok Shop. Anda dapat mencoba memuat ulang atau mereset data cache token.
          </p>
        </div>

        {error?.message && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-left text-xs font-mono text-slate-700 break-words">
            {error.message}
          </div>
        )}

        <div className="flex flex-col gap-2.5 pt-2">
          <button
            onClick={() => reset()}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" /> Muat Ulang Halaman
          </button>

          <button
            onClick={handleClearCacheAndReset}
            className="w-full py-2.5 px-4 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-amber-600" /> Bersihkan Cache Token & Muat Ulang
          </button>

          <Link
            href="/"
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors text-center"
          >
            <Home className="w-4 h-4" /> Kembali ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
