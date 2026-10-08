"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { UploadCloud, CheckCircle2, AlertTriangle, FileSpreadsheet, Lock } from 'lucide-react';
import * as xlsx from 'xlsx';

import OrganicImport from './OrganicImport';
import TikTokStagingReview from './TikTokStagingReview';
import { useAuth } from '@/providers/AuthProvider';
import { LiveSyncModal } from '@/components/LiveSyncModal';
import { TikTokSyncControlCard } from '@/components/TikTokSyncControlCard';

export default function InputPenjualanPage() {
  const [activeTab, setActiveTab] = useState<'organik_sales' | 'awareness_video' | 'awareness_live' | 'live' | 'review_sync'>('organik_sales');
  const { profile } = useAuth();
  
  const isManager = profile?.role === 'manager' || profile?.role === 'executive';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Input Penjualan & Performa</h1>
        <p className="text-slate-500 mt-1">Sinkronisasi otomatis OpenAPI TikTok Shop atau upload file Excel</p>
      </div>

      {/* Auto-Sync TikTok Shop OpenAPI Card */}
      <TikTokSyncControlCard />

      <div className="flex border-b border-slate-200 overflow-x-auto whitespace-nowrap">
        <button
          className={`pb-4 px-4 font-medium text-sm transition-colors relative ${activeTab === 'organik_sales' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('organik_sales')}
        >
          Organik Sales
          {activeTab === 'organik_sales' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full" />
          )}
        </button>
        <button
          className={`pb-4 px-4 font-medium text-sm transition-colors relative flex items-center gap-1.5 ${activeTab === 'review_sync' ? 'text-indigo-600 font-semibold' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('review_sync')}
        >
          <span>Review Auto-Sync API</span>
          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold rounded-full">
            Staging
          </span>
          {activeTab === 'review_sync' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full" />
          )}
        </button>
        <button
          className={`pb-4 px-4 font-medium text-sm transition-colors relative ${activeTab === 'awareness_video' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('awareness_video')}
        >
          Awareness Video
          {activeTab === 'awareness_video' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full" />
          )}
        </button>
        <button
          className={`pb-4 px-4 font-medium text-sm transition-colors relative ${activeTab === 'awareness_live' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('awareness_live')}
        >
          Awareness Live
          {activeTab === 'awareness_live' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full" />
          )}
        </button>
        <button
          className={`pb-4 px-4 font-medium text-sm transition-colors relative ${activeTab === 'live' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('live')}
        >
          Data Live Organik
          {activeTab === 'live' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full" />
          )}
        </button>
      </div>

      {activeTab === 'organik_sales' && (
        <OrganicImport mode="sales" />
      )}

      {activeTab === 'review_sync' && (
        <TikTokStagingReview />
      )}

      {activeTab === 'awareness_video' && (
        <OrganicImport mode="video" />
      )}

      {activeTab === 'awareness_live' && (
        <OrganicImport mode="live" />
      )}

      {activeTab === 'live' && (
        <div className="py-8">
          <LiveSyncModal />
        </div>
      )}
    </div>
  );
}
