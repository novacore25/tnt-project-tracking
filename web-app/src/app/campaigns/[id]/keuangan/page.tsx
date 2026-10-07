"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { 
  Loader2, Plus, ArrowRight, Wallet, Activity, CheckCircle2, 
  Search, X, Check, Trash2, Pencil, StickyNote, AlertTriangle, 
  Clock, TrendingUp, Layers, ChevronRight, ChevronDown, AlertCircle, ShieldAlert, ShieldCheck
} from "lucide-react";
import { useParams } from "next/navigation";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/providers/AuthProvider";
import { BatchForm } from "./BatchForm";
import { BatchDetail } from "./BatchDetail";
import { getPaymentBatches, getPaymentBatchDetail, fetchApprovedCreatorsForBatch } from "../../actions/paymentActions";
import { CampaignCreatorMutationTab } from "@/components/CampaignCreatorMutationTab";
import { UnpaidCreatorsTab } from "@/components/UnpaidCreatorsTab";
import { formatDateTime, formatUserWithRole, formatRupiah } from "@/utils/formatters";
import { toNum, sumNum } from "@/utils/computed";

type ViewState = 'list' | 'form' | 'detail' | 'mutasi_kreator' | 'unpaid_creators';

export default function CampaignKeuanganPage() {
  return (
    <ErrorBoundary>
      <CampaignKeuanganContent />
    </ErrorBoundary>
  );
}

function CampaignKeuanganContent() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { campaigns } = useDatabaseStore();
  const campaign = campaigns.find(c => c.id === campaignId);
  const { canEditCampaign, profile } = useAuth();
  const hasAccess = canEditCampaign(campaignId);

  // View state for Tabs
  const [viewState, setViewState] = useState<ViewState>('list');
  
  // Batch Data
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [isLoadingBatches, setIsLoadingBatches] = useState(true);
  const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set());

  const toggleBatchAccordion = (batchId: number) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

  // Creators Data for Form & Financial Calculations
  const [creators, setCreators] = useState<any[]>([]);
  const [creatorHistory, setCreatorHistory] = useState<Record<number, any[]>>({});
  
  // KPI Data
  const [totalTerpakai, setTotalTerpakai] = useState(0);

  const fetchData = useCallback(async () => {
    setIsLoadingBatches(true);
    try {
      // 1. Fetch batches
      const data = await getPaymentBatches(campaignId);
      setBatches(data || []);
      
      // 2. Hitung Total Terpakai (Realisasi Kas Keluar Kreator Paid)
      let terpakai = 0;
      data?.forEach(b => {
        b.payment_items?.forEach((item: any) => {
          if (item.final_status === 'paid' && item.payment_type !== 'ads') {
            const baseNominal = item.actual_transfer != null ? toNum(item.actual_transfer) : toNum(item.nominal || 0);
            terpakai += baseNominal + toNum(item.biaya_transfer || 0);
          }
        });
      });
      setTotalTerpakai(terpakai);

      // 3. Fetch creators for campaign (bypass RLS)
      const ccData = await fetchApprovedCreatorsForBatch(campaignId);

      const historyMap: Record<number, any[]> = {};
      data?.forEach(b => {
        b.payment_items?.forEach((item: any) => {
          if (item.final_status !== 'rejected' && item.campaign_creator_id) {
            if (!historyMap[item.campaign_creator_id]) {
              historyMap[item.campaign_creator_id] = [];
            }
            const baseNominal = item.actual_transfer != null ? toNum(item.actual_transfer) : toNum(item.nominal || 0);
            historyMap[item.campaign_creator_id].push({
              id: item.id,
              batch_id: b.id,
              batch_label: b.batch_label,
              batch_status: b.status,
              date: b.created_at,
              nominal: baseNominal + toNum(item.biaya_transfer || 0),
              payment_type: item.payment_type,
              status: item.final_status
            });
          }
        });
      });

      const filteredCreators = (ccData || []).map(cc => {
        const history = historyMap[cc.id] || [];
        const types = history.map(h => h.payment_type);
        const isFullyPaid = types.includes('100_akhir') || (types.includes('50_awal') && types.includes('50_akhir'));
        const pendingItem = history.find(h => 
          h.status !== 'paid' && 
          h.status !== 'rejected' && 
          h.status !== 'cancelled' && 
          h.batch_status !== 'paid' && 
          h.batch_status !== 'cancelled'
        );
        
        // Ratecard untuk campaign ini SELALU murni dari campaign_creators.price (sesuai yang di-input di Listing)
        const effectivePrice = toNum(cc.price || 0);

        // Nominal yang sudah lunas dibayar (status 'paid')
        const paidNominal = sumNum(history.filter(h => h.status === 'paid'), h => h.nominal);

        // Nominal yang sedang diajukan dalam batch berjalan (pending)
        const pendingNominal = sumNum(history.filter(h => 
          h.status !== 'paid' && 
          h.status !== 'rejected' && 
          h.status !== 'cancelled' && 
          h.batch_status !== 'paid' && 
          h.batch_status !== 'cancelled'
        ), h => h.nominal);

        // Sisa komitmen ratecard yang belum dibayar
        let unpaidNominal = 0;
        if (!isFullyPaid && effectivePrice > 0) {
          if (paidNominal > 0) {
            unpaidNominal = Math.max(0, effectivePrice - paidNominal);
          } else {
            unpaidNominal = effectivePrice;
          }
        }

        return {
          ...cc,
          price: effectivePrice,
          isFullyPaid,
          paidNominal,
          pendingNominal,
          unpaidNominal,
          hasPendingPayment: !!pendingItem,
          pendingBatchLabel: pendingItem?.batch_label || ''
        };
      });

      setCreators(filteredCreators);
      setCreatorHistory(historyMap);
    } catch (err) {
      console.error("Gagal memuat data keuangan campaign:", err);
    } finally {
      setIsLoadingBatches(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (campaignId) {
      fetchData();
    }
  }, [campaignId, fetchData]);

  const handleViewDetail = async (batchId: number) => {
    try {
      const detail = await getPaymentBatchDetail(batchId);
      if (!detail) {
        alert("Batch tidak ditemukan. Kemungkinan sudah dihapus.");
        fetchData(); // Refresh list
        return;
      }
      setSelectedBatch(detail);
      setViewState('detail');
    } catch (err: any) {
      alert("Gagal memuat detail: " + err.message);
    }
  };

  const getBatchStatusBadge = (status: string) => {
    switch(status) {
      case 'draft': return <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold uppercase">Draft</span>;
      case 'pending_manager': return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-bold uppercase">Menunggu Manager</span>;
      case 'pending_finance': return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-bold uppercase">Menunggu Finance</span>;
      case 'pending_executive': return <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-bold uppercase">Menunggu Executive</span>;
      case 'ready_to_pay': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold uppercase">Siap Bayar</span>;
      case 'paid': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold uppercase">Paid Off</span>;
      case 'cancelled': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold uppercase">Dibatalkan</span>;
      default: return <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold uppercase">{status}</span>;
    }
  };

  if (!campaign) return null;

  // ===================== KREATOR / ENDORSEMENT CALCULATIONS =====================
  const budgetPlafon = toNum(campaign.budget_creator_plafon || 0);

  // Hanya hitung komitmen untuk kreator yang berstatus APPROVED di campaign ini
  const approvedCreators = creators.filter(c => (c.approval || '').toLowerCase() === 'approved');

  // Total Ratecard Belum Dibayar (akumulasi sisa ratecard dari semua kreator approved yang belum lunas)
  const totalRatecardBelumDibayar = sumNum(approvedCreators, c => c.unpaidNominal);

  // Berapa dari ratecard belum dibayar yang saat ini sedang dalam proses batch (pending)
  const totalPendingNominal = sumNum(approvedCreators, c => c.pendingNominal);

  // Ratecard yang belum diajukan sama sekali ke dalam batch apa pun (murni antrean)
  const totalBelumDiajukanNominal = Math.max(0, totalRatecardBelumDibayar - totalPendingNominal);

  // Total Komitmen Keseluruhan (Realisasi Kas Paid + Sisa Ratecard Belum Dibayar)
  const totalKomitmenKreator = totalTerpakai + totalRatecardBelumDibayar;

  // Cek apakah komitmen melebihi plafon budget
  const isOverBudget = budgetPlafon > 0 && totalKomitmenKreator > budgetPlafon;
  const selisihOverBudget = isOverBudget ? totalKomitmenKreator - budgetPlafon : 0;
  const sisaBudgetKomitmen = budgetPlafon - totalKomitmenKreator; // Sisa alokasi setelah seluruh komitmen terpenuhi
  const sisaBudgetRealisasi = budgetPlafon - totalTerpakai; // Sisa plafon terhadap kas keluar saat ini

  // Persentase Progress
  const progressRealisasiPercent = budgetPlafon > 0 ? (totalTerpakai / budgetPlafon) * 100 : 0;
  const progressKomitmenPercent = budgetPlafon > 0 ? (totalKomitmenKreator / budgetPlafon) * 100 : 0;
  const progressBelumDibayarPercent = budgetPlafon > 0 ? (totalRatecardBelumDibayar / budgetPlafon) * 100 : 0;

  // Creator Counts
  const unpaidCreatorsCount = approvedCreators.filter(c => toNum(c.unpaidNominal) > 0).length;
  const pendingCreatorsCount = approvedCreators.filter(c => toNum(c.pendingNominal) > 0).length;
  const unsubmittedCreatorsCount = approvedCreators.filter(c => toNum(c.unpaidNominal) > toNum(c.pendingNominal)).length;
  const fullyPaidCreatorsCount = approvedCreators.filter(c => c.isFullyPaid || (toNum(c.price) > 0 && toNum(c.unpaidNominal) === 0)).length;

  // ===================== ADS CALCULATIONS =====================
  const adsBudgetPlafon = toNum(campaign.budget_ads_plafon || 0);
  let adsTerpakai = 0;
  batches.forEach(b => {
    b.payment_items?.forEach((item: any) => {
      if (item.final_status === 'paid' && item.payment_type === 'ads') {
        const baseNominal = item.actual_transfer != null ? toNum(item.actual_transfer) : toNum(item.nominal || 0);
        adsTerpakai += baseNominal + toNum(item.biaya_transfer || 0);
      }
    });
  });
  const adsSisa = adsBudgetPlafon - adsTerpakai;
  const isAdsOverBudget = adsBudgetPlafon > 0 && adsTerpakai > adsBudgetPlafon;
  const adsProgressPercent = adsBudgetPlafon > 0 ? Math.min((adsTerpakai / adsBudgetPlafon) * 100, 100) : 0;

  return (
    <div className="space-y-6 pb-20">
      {viewState !== 'detail' && (
        <>
          {/* ===================== SECTION 1: KEUANGAN KREATOR ===================== */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <span>Anggaran Kreator &amp; Endorsement</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Ringkasan plafon budget, kas keluar riil, dan komitmen ratecard kreator approved
                </p>
              </div>

              {/* Status Indicator Badge */}
              <div className="shrink-0">
                {isOverBudget ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 shadow-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    Over Budget +{formatRupiah(selisihOverBudget)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Anggaran Terkendali (Sisa {formatRupiah(sisaBudgetKomitmen)})
                  </span>
                )}
              </div>
            </div>

            {/* 4 KPI Cards for Creator */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Plafon Budget Kreator */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Plafon Budget Kreator
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                      <Wallet className="w-4.5 h-4.5" />
                    </div>
                  </div>
                  <h3 className="text-[22px] sm:text-[24px] font-extrabold text-slate-900 tracking-tight mt-1">
                    Rp {budgetPlafon.toLocaleString('id-ID')}
                  </h3>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Alokasi maksimal</span>
                  <span className="font-semibold text-slate-700">{approvedCreators.length} kreator approved</span>
                </div>
              </div>

              {/* Card 2: Realisasi Terbayar (Paid) */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Realisasi Dibayar (Paid)
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4.5 h-4.5" />
                    </div>
                  </div>
                  <h3 className="text-[22px] sm:text-[24px] font-extrabold text-slate-900 tracking-tight mt-1">
                    Rp {totalTerpakai.toLocaleString('id-ID')}
                  </h3>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">
                    {progressRealisasiPercent.toFixed(1)}% dari plafon
                  </span>
                  <span className="text-slate-500">Kas keluar riil</span>
                </div>
              </div>

              {/* Card 3: Ratecard Belum Dibayar (Komitmen Berjalan & Rincian Pengajuan) */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                      Ratecard Belum Dibayar
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <Clock className="w-4.5 h-4.5" />
                    </div>
                  </div>
                  <h3 className="text-[22px] sm:text-[24px] font-extrabold text-amber-700 tracking-tight mt-1">
                    Rp {totalRatecardBelumDibayar.toLocaleString('id-ID')}
                  </h3>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    <span className="font-bold text-amber-800">{unpaidCreatorsCount}</span> kreator belum lunas
                  </div>
                </div>

                {/* Sub-Breakdown: Belum Diajukan vs Sudah Diajukan */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* 1. Belum Diajukan (Antrean) */}
                    <div className="bg-amber-50/70 border border-amber-100/90 rounded-lg p-2">
                      <div className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider flex items-center justify-between">
                        <span>Belum Diajukan</span>
                        <span className="text-amber-600 font-bold">{unsubmittedCreatorsCount}</span>
                      </div>
                      <div className="font-bold text-amber-900 text-xs sm:text-[13px] mt-0.5 truncate" title={`Rp ${totalBelumDiajukanNominal.toLocaleString('id-ID')}`}>
                        Rp {totalBelumDiajukanNominal.toLocaleString('id-ID')}
                      </div>
                    </div>

                    {/* 2. Sudah Diajukan (Dalam Batch) */}
                    <div className="bg-blue-50/70 border border-blue-100/90 rounded-lg p-2">
                      <div className="text-[10px] font-semibold text-blue-800 uppercase tracking-wider flex items-center justify-between">
                        <span>Sudah Diajukan</span>
                        <span className="text-blue-600 font-bold">{pendingCreatorsCount}</span>
                      </div>
                      <div className="font-bold text-blue-900 text-xs sm:text-[13px] mt-0.5 truncate" title={`Rp ${totalPendingNominal.toLocaleString('id-ID')}`}>
                        Rp {totalPendingNominal.toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>

                  {hasAccess && (
                    <div className="flex justify-between items-center text-[11px] pt-0.5">
                      <span className="text-[10px] text-slate-400">Dalam proses batch berjalan</span>
                      <button 
                        onClick={() => setViewState('unpaid_creators')}
                        className="font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5"
                      >
                        Buka Antrean <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 4: Total Komitmen & Status Plafon (Decision Card) */}
              <div className={`rounded-2xl p-5 shadow-xs border transition-all flex flex-col justify-between ${
                isOverBudget 
                  ? 'bg-rose-50/70 border-rose-200 text-rose-950' 
                  : 'bg-slate-900 border-slate-800 text-white'
              }`}>
                <div>
                  <div className="flex justify-between items-start">
                    <span className={`text-[11px] font-bold uppercase tracking-wider block ${
                      isOverBudget ? 'text-rose-700' : 'text-slate-400'
                    }`}>
                      Total Komitmen Kreator
                    </span>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isOverBudget ? 'bg-rose-100 text-rose-700' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {isOverBudget ? <AlertTriangle className="w-4.5 h-4.5" /> : <TrendingUp className="w-4.5 h-4.5" />}
                    </div>
                  </div>
                  <h3 className={`text-[22px] sm:text-[24px] font-extrabold tracking-tight mt-1 ${
                    isOverBudget ? 'text-rose-900' : 'text-white'
                  }`}>
                    Rp {totalKomitmenKreator.toLocaleString('id-ID')}
                  </h3>
                </div>

                {/* Progress Bar & Status Footer */}
                <div className="mt-3 pt-3 border-t border-slate-200/50">
                  <div className="flex justify-between items-center text-[11px] mb-1 font-medium">
                    <span className={isOverBudget ? 'text-rose-700' : 'text-slate-300'}>
                      {progressKomitmenPercent.toFixed(1)}% Komitmen
                    </span>
                    <span className={`font-bold ${
                      isOverBudget ? 'text-rose-700' : 'text-emerald-400'
                    }`}>
                      {isOverBudget ? `Over +${formatRupiah(selisihOverBudget)}` : `Sisa ${formatRupiah(sisaBudgetKomitmen)}`}
                    </span>
                  </div>
                  <div className={`w-full h-2 rounded-full overflow-hidden flex ${
                    isOverBudget ? 'bg-rose-200' : 'bg-slate-800'
                  }`}>
                    {/* Portion 1: Realisasi Kas Paid (Emerald) */}
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-500" 
                      style={{ width: `${Math.min(progressRealisasiPercent, 100)}%` }} 
                      title={`Realisasi Paid: ${progressRealisasiPercent.toFixed(1)}%`}
                    />
                    {/* Portion 2: Komitmen Ratecard Belum Dibayar (Amber / Rose) */}
                    <div 
                      className={`${isOverBudget ? 'bg-rose-600' : 'bg-amber-400'} h-full transition-all duration-500`} 
                      style={{ width: `${Math.min(progressBelumDibayarPercent, Math.max(0, 100 - progressRealisasiPercent))}%` }} 
                      title={`Belum Dibayar: ${progressBelumDibayarPercent.toFixed(1)}%`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Warning Banner if Over Budget */}
            {isOverBudget && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-xs">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-rose-900 flex items-center gap-2">
                    Perhatian: Total Komitmen Kreator Melebihi Plafon Budget!
                  </h4>
                  <p className="mt-1 text-xs text-rose-800 leading-relaxed">
                    Total estimasi komitmen saat ini mencapai <strong>{formatRupiah(totalKomitmenKreator)}</strong> (Realisasi Kas Paid: <strong>{formatRupiah(totalTerpakai)}</strong> + Komitmen Ratecard Belum Dibayar: <strong>{formatRupiah(totalRatecardBelumDibayar)}</strong>). 
                    Jumlah ini telah <strong className="text-rose-900 underline">melebihi Plafon Budget Kreator ({formatRupiah(budgetPlafon)})</strong> sebesar <strong className="text-rose-700 font-extrabold">{formatRupiah(selisihOverBudget)}</strong> ({progressKomitmenPercent.toFixed(1)}% dari plafon).
                  </p>
                  <div className="mt-2 text-[11px] text-rose-700 font-medium">
                    💡 Disarankan untuk mengkoordinasikan penyesuaian plafon anggaran dengan manajer/brand, atau meninjau kembali negosiasi ratecard kreator sebelum menyetujui batch pembayaran baru.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ===================== SECTION 2: BUDGET TIKTOK ADS ===================== */}
          <div className="space-y-3 pt-2">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <span>Anggaran TikTok Ads</span>
              </h2>
              <p className="text-xs text-slate-500">
                Plafon alokasi budget dan realisasi pengeluaran iklan TikTok Ads
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Plafon Budget ADS */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block">
                      Budget ADS (Plafon)
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Layers className="w-4.5 h-4.5" />
                    </div>
                  </div>
                  <h3 className="text-[22px] sm:text-[24px] font-extrabold text-slate-900 tracking-tight mt-1">
                    Rp {adsBudgetPlafon.toLocaleString('id-ID')}
                  </h3>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Alokasi kampanye iklan</span>
                  <span className="font-semibold text-indigo-600">TikTok Ads</span>
                </div>
              </div>

              {/* Card 2: ADS Terpakai (Paid) */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      ADS Terpakai (Paid)
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                      <Activity className="w-4.5 h-4.5" />
                    </div>
                  </div>
                  <h3 className="text-[22px] sm:text-[24px] font-extrabold text-slate-900 tracking-tight mt-1">
                    Rp {adsTerpakai.toLocaleString('id-ID')}
                  </h3>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-semibold bg-slate-100 px-2 py-0.5 rounded-md">
                    {adsProgressPercent.toFixed(1)}% terpakai
                  </span>
                  <span className="text-slate-500">Kas keluar iklan</span>
                </div>
              </div>

              {/* Card 3: Sisa Budget ADS */}
              <div className={`rounded-2xl p-5 shadow-xs border transition-all flex flex-col justify-between ${
                adsSisa < 0 ? 'bg-red-50/70 border-red-200' : 'bg-emerald-50/50 border-emerald-200'
              }`}>
                <div>
                  <div className="flex justify-between items-start">
                    <span className={`text-[11px] font-bold uppercase tracking-wider block ${
                      adsSisa < 0 ? 'text-red-700' : 'text-emerald-700'
                    }`}>
                      Sisa Budget ADS
                    </span>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      adsSisa < 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      <CheckCircle2 className="w-4.5 h-4.5" />
                    </div>
                  </div>
                  <h3 className={`text-[22px] sm:text-[24px] font-extrabold tracking-tight mt-1 ${
                    adsSisa < 0 ? 'text-red-700' : 'text-emerald-700'
                  }`}>
                    Rp {adsSisa.toLocaleString('id-ID')}
                  </h3>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200/50 flex items-center justify-between text-xs font-semibold">
                  <span className={adsSisa < 0 ? 'text-red-700' : 'text-emerald-700'}>
                    {adsSisa < 0 ? '⚠️ Melebihi Plafon ADS' : '✓ Sisa Anggaran ADS Aman'}
                  </span>
                  <span className="text-slate-500 font-normal">
                    {adsBudgetPlafon > 0 ? `${((adsSisa / adsBudgetPlafon) * 100).toFixed(1)}% tersisa` : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ===================== TABS NAVIGATION ===================== */}
          <div className="flex border-b border-slate-200 pt-2">
            <button
              onClick={() => setViewState('list')}
              className={`px-5 py-3 text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                viewState === 'list' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Daftar Batch Pembayaran
            </button>
            <button
              onClick={() => setViewState('mutasi_kreator')}
              className={`px-5 py-3 text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                viewState === 'mutasi_kreator' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Mutasi Kreator
            </button>
            {hasAccess && (
              <button
                onClick={() => setViewState('unpaid_creators')}
                className={`px-5 py-3 text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                  viewState === 'unpaid_creators' 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Kreator Belum Dibayar</span>
                {unpaidCreatorsCount > 0 && (
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-100 text-amber-800">
                    {unpaidCreatorsCount}
                  </span>
                )}
              </button>
            )}
            {hasAccess && (
              <button
                onClick={() => setViewState('form')}
                className={`px-5 py-3 text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                  viewState === 'form' 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Plus className="w-4 h-4" />
                Buat Pengajuan (Manual)
              </button>
            )}
          </div>

          {viewState === 'list' && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-600 font-medium">
                    <tr>
                      <th className="px-4 py-3 text-center w-12">No</th>
                      <th className="px-4 py-3">Batch Label</th>
                      <th className="px-4 py-3">PIC Submit</th>
                      <th className="px-4 py-3 text-center">Status Item</th>
                      <th className="px-4 py-3 text-right">Total Nominal Diajukan</th>
                      <th className="px-4 py-3 text-right">Total Nominal Dibayar</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {isLoadingBatches ? (
                      <tr><td colSpan={8} className="h-32 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></td></tr>
                    ) : batches.length === 0 ? (
                      <tr><td colSpan={8} className="h-32 text-center text-slate-500">Belum ada batch pembayaran yang diajukan.</td></tr>
                    ) : (
                      batches.map((b, idx) => {
                        const isExpanded = expandedBatches.has(b.id);
                        const totalItem = b.payment_items?.length || 0;
                        const totalDibayar = b.payment_items?.filter((i: any) => i.final_status === 'paid').length || 0;
                        const totalDitolak = b.payment_items?.filter((i: any) => i.final_status === 'rejected').length || 0;
                        const totalNominal = sumNum(b.payment_items || [], (cur: any) => {
                          const base = cur.actual_transfer != null ? toNum(cur.actual_transfer) : toNum(cur.nominal || 0);
                          return base + toNum(cur.biaya_transfer || 0);
                        });
                        const nominalDibayar = sumNum((b.payment_items || []).filter((i: any) => i.final_status === 'paid'), (cur: any) => {
                          const base = cur.actual_transfer != null ? toNum(cur.actual_transfer) : toNum(cur.nominal || 0);
                          return base + toNum(cur.biaya_transfer || 0);
                        });
                        
                        return (
                          <React.Fragment key={b.id}>
                            <tr className={`transition-colors ${isExpanded ? 'bg-blue-50/25 border-b border-blue-100/60' : 'hover:bg-slate-50/80'}`}>
                              <td className="px-3 py-3 text-center text-slate-400">
                                <button
                                  type="button"
                                  onClick={() => toggleBatchAccordion(b.id)}
                                  className="p-1 rounded-md hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 transition-colors inline-flex items-center gap-1 focus:outline-none"
                                  title={isExpanded ? "Tutup rincian item batch" : "Buka rincian item batch"}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-blue-600 transition-transform" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-400 hover:text-slate-600 transition-transform" />
                                  )}
                                  <span className="font-mono text-xs">{idx + 1}</span>
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <div 
                                  onClick={() => toggleBatchAccordion(b.id)}
                                  className="cursor-pointer group select-none"
                                >
                                  <div className="font-semibold text-slate-700 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                                    <span>{b.batch_label}</span>
                                    <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/80">
                                      {totalItem} item
                                    </span>
                                  </div>
                                  <div className="text-xs font-normal text-slate-400 mt-0.5">
                                    {formatDateTime(b.submitted_at || b.created_at)}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-600">
                                {formatUserWithRole(b.submitter?.nama, b.submitter?.role)}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-1 items-center text-[10px] w-24 mx-auto">
                                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold w-full text-center">Diajukan: {totalItem}</span>
                                  {totalDibayar > 0 && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-semibold w-full text-center">Dibayar: {totalDibayar}</span>}
                                  {totalDitolak > 0 && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-semibold w-full text-center">Ditolak: {totalDitolak}</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-slate-700">Rp {totalNominal.toLocaleString('id-ID')}</td>
                              <td className="px-4 py-3 text-right font-bold text-green-600">Rp {nominalDibayar.toLocaleString('id-ID')}</td>
                              <td className="px-4 py-3 text-center">{getBatchStatusBadge(b.status)}</td>
                              <td className="px-4 py-3 text-center">
                                <button onClick={() => handleViewDetail(b.id)} className="text-blue-600 hover:text-blue-800 font-semibold text-xs flex items-center justify-center gap-1 mx-auto bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors">
                                  Lihat Detail <ArrowRight className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>

                            {/* Accordion Sub-table */}
                            {isExpanded && (
                              <tr className="bg-slate-50/50">
                                <td colSpan={8} className="p-3 sm:p-4.5 border-t border-b border-slate-200">
                                  <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
                                    {/* Header bar accordion sub-table */}
                                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                        <span className="text-xs font-bold text-slate-700">
                                          Rincian Item Pembayaran ({b.batch_label})
                                        </span>
                                        <span className="text-xs text-slate-500">
                                          • {totalItem} Item diajukan
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => handleViewDetail(b.id)}
                                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline"
                                      >
                                        Lihat Detail Penuh & Audit Trail <ArrowRight className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    {/* Sub-table: 8 Kolom (Kreator, Tipe Pemb., Ratecard / Final, Biaya TF, Total Transaksi, PIC, Rekening, Status) */}
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                                          <tr>
                                            <th className="px-3.5 py-2.5">Kreator</th>
                                            <th className="px-3 py-2.5 text-center">Tipe Pemb.</th>
                                            <th className="px-3 py-2.5 text-right">Ratecard / Final</th>
                                            <th className="px-3 py-2.5 text-right">Biaya TF</th>
                                            <th className="px-3 py-2.5 text-right">Total Transaksi</th>
                                            <th className="px-3 py-2.5">PIC</th>
                                            <th className="px-3.5 py-2.5">Rekening</th>
                                            <th className="px-3 py-2.5 text-center">Status</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {(!b.payment_items || b.payment_items.length === 0) ? (
                                            <tr>
                                              <td colSpan={8} className="px-4 py-6 text-center text-slate-400 italic">
                                                Tidak ada rincian item dalam batch ini.
                                              </td>
                                            </tr>
                                          ) : (
                                            b.payment_items.map((item: any, itemIdx: number) => {
                                              const baseNominal = item.actual_transfer != null ? toNum(item.actual_transfer) : toNum(item.nominal || item.ratecard_awal || 0);
                                              const biayaTf = toNum(item.biaya_transfer || 0);
                                              const totalTrx = baseNominal + biayaTf;
                                              const cr = item.campaign_creators?.creators;
                                              const bank = item.creator_bank_accounts;
                                              const bankName = bank?.bank_name || item.metode_pembayaran;
                                              const accNum = bank?.account_number || item.nomor_rekening;
                                              const accHolder = bank?.account_holder || item.nama_penerima;
                                              const picName = item.nama_wa_pic || cr?.nama_wa_pic || b.submitter?.nama || '-';

                                              return (
                                                <tr key={item.id || itemIdx} className="hover:bg-slate-50/70 transition-colors">
                                                  {/* 1. Kreator */}
                                                  <td className="px-3.5 py-2.5">
                                                    {cr ? (
                                                      <div className="flex items-center gap-2">
                                                        {cr.avatar_url ? (
                                                          <img
                                                            src={cr.avatar_url}
                                                            alt={cr.username || ''}
                                                            className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200"
                                                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                                          />
                                                        ) : (
                                                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[11px] shrink-0 border border-slate-200">
                                                            {(cr.username || '?').charAt(0).toUpperCase()}
                                                          </div>
                                                        )}
                                                        <div className="min-w-0">
                                                          <a
                                                            href={`/creator-pool/${cr.id}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="font-bold text-slate-900 hover:text-blue-600 hover:underline block truncate max-w-[150px]"
                                                            title={`@${cr.username}`}
                                                          >
                                                            @{cr.username}
                                                          </a>
                                                          <div className="text-[10px] text-slate-500 truncate max-w-[150px]">
                                                            {cr.nama_asli || item.nama_penerima || '-'}
                                                          </div>
                                                        </div>
                                                      </div>
                                                    ) : (
                                                      <div className="min-w-0">
                                                        <div className="font-semibold text-slate-800 truncate max-w-[150px]">
                                                          {item.nama_penerima || 'Biaya Operasional'}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400">
                                                          {item.payment_type === 'ads' ? 'TikTok Ads' : 'Non-Kreator'}
                                                        </div>
                                                      </div>
                                                    )}
                                                  </td>

                                                  {/* 2. Tipe Pemb. */}
                                                  <td className="px-3 py-2.5 text-center">
                                                    {(() => {
                                                      switch (item.payment_type) {
                                                        case '50_awal':
                                                          return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">DP 50%</span>;
                                                        case '50_akhir':
                                                          return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Pelunasan 50%</span>;
                                                        case '100_akhir':
                                                          return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Full 100%</span>;
                                                        case 'ads':
                                                          return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">TikTok Ads</span>;
                                                        default:
                                                          return <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">{item.payment_type || '-'}</span>;
                                                      }
                                                    })()}
                                                  </td>

                                                  {/* 3. Ratecard / Final */}
                                                  <td className="px-3 py-2.5 text-right font-medium text-slate-800">
                                                    {item.ratecard_awal && toNum(item.ratecard_awal) !== baseNominal && (
                                                      <div className="text-[10px] text-slate-400 line-through">
                                                        Rp {toNum(item.ratecard_awal).toLocaleString('id-ID')}
                                                      </div>
                                                    )}
                                                    <div>Rp {baseNominal.toLocaleString('id-ID')}</div>
                                                  </td>

                                                  {/* 4. Biaya TF */}
                                                  <td className="px-3 py-2.5 text-right text-slate-600">
                                                    {biayaTf > 0 ? (
                                                      `Rp ${biayaTf.toLocaleString('id-ID')}`
                                                    ) : (
                                                      <span className="text-slate-400">-</span>
                                                    )}
                                                  </td>

                                                  {/* 5. Total Transaksi */}
                                                  <td className="px-3 py-2.5 text-right font-bold text-blue-700">
                                                    Rp {totalTrx.toLocaleString('id-ID')}
                                                  </td>

                                                  {/* 6. PIC */}
                                                  <td className="px-3 py-2.5 text-slate-600">
                                                    <span className="truncate max-w-[120px] block" title={picName}>
                                                      {picName}
                                                    </span>
                                                  </td>

                                                  {/* 7. Rekening */}
                                                  <td className="px-3.5 py-2.5">
                                                    {(!bankName && !accNum) ? (
                                                      <span className="text-slate-400 italic text-[11px]">-</span>
                                                    ) : (
                                                      <div className="leading-tight">
                                                        <div className="font-medium text-slate-800 truncate max-w-[160px]">
                                                          {bankName || '-'} <span className="font-mono text-slate-600">({accNum || '-'})</span>
                                                        </div>
                                                        {accHolder && (
                                                          <div className="text-[10px] text-slate-500 truncate max-w-[160px]" title={accHolder}>
                                                            a.n. {accHolder}
                                                          </div>
                                                        )}
                                                      </div>
                                                    )}
                                                  </td>

                                                  {/* 8. Status */}
                                                  <td className="px-3 py-2.5 text-center">
                                                    {(() => {
                                                      const status = item.final_status;
                                                      let badgeClass = "bg-slate-100 text-slate-700 border-slate-200";
                                                      let label = status?.replace(/_/g, ' ') || 'Pending';
                                                      
                                                      if (status === 'paid') {
                                                        badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
                                                        label = "Paid";
                                                      } else if (status === 'rejected') {
                                                        badgeClass = "bg-rose-100 text-rose-800 border-rose-200";
                                                        label = "Ditolak";
                                                      } else if (status === 'cancelled') {
                                                        badgeClass = "bg-slate-100 text-slate-600 border-slate-200";
                                                        label = "Dibatalkan";
                                                      } else if (status === 'ready_to_pay') {
                                                        badgeClass = "bg-blue-100 text-blue-800 border-blue-200";
                                                        label = "Siap Bayar";
                                                      } else if (status === 'pending' || status === 'pending_manager') {
                                                        badgeClass = "bg-yellow-100 text-yellow-800 border-yellow-200";
                                                        label = "Menunggu Mgr";
                                                      } else if (status === 'manager_approved' || status === 'pending_executive_1') {
                                                        badgeClass = "bg-purple-100 text-purple-800 border-purple-200";
                                                        label = "Menunggu Exec 1";
                                                      } else if (status === 'executive_1_approved' || status === 'pending_finance') {
                                                        badgeClass = "bg-orange-100 text-orange-800 border-orange-200";
                                                        label = "Menunggu Fin";
                                                      } else if (status === 'finance_selected' || status === 'pending_executive') {
                                                        badgeClass = "bg-indigo-100 text-indigo-800 border-indigo-200";
                                                        label = "Menunggu Exec";
                                                      }

                                                      return (
                                                        <div className="flex flex-col items-center">
                                                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${badgeClass}`}>
                                                            {label}
                                                          </span>
                                                          {(item.manager_note || item.executive_note) && (
                                                            <span className="text-[10px] text-rose-600 mt-0.5 truncate max-w-[110px]" title={item.manager_note || item.executive_note}>
                                                              Note: {item.manager_note || item.executive_note}
                                                            </span>
                                                          )}
                                                        </div>
                                                      );
                                                    })()}
                                                  </td>
                                                </tr>
                                              );
                                            })
                                          )}
                                        </tbody>
                                        {b.payment_items && b.payment_items.length > 0 && (
                                          <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold text-slate-700">
                                            <tr>
                                              <td colSpan={2} className="px-3.5 py-2.5 text-slate-600">
                                                Total ({totalItem} Item)
                                              </td>
                                              <td className="px-3 py-2.5 text-right font-bold text-slate-800">
                                                Rp {sumNum(b.payment_items, (i: any) => i.actual_transfer != null ? toNum(i.actual_transfer) : toNum(i.nominal || i.ratecard_awal || 0)).toLocaleString('id-ID')}
                                              </td>
                                              <td className="px-3 py-2.5 text-right text-slate-600">
                                                Rp {sumNum(b.payment_items, (i: any) => toNum(i.biaya_transfer || 0)).toLocaleString('id-ID')}
                                              </td>
                                              <td className="px-3 py-2.5 text-right font-extrabold text-blue-700">
                                                Rp {totalNominal.toLocaleString('id-ID')}
                                              </td>
                                              <td colSpan={3} className="px-3.5 py-2.5 text-right text-[11px] text-slate-500 font-normal">
                                                {totalDibayar > 0 && <span className="text-emerald-700 font-semibold mr-2.5">Dibayar: {totalDibayar}</span>}
                                                {totalDitolak > 0 && <span className="text-rose-700 font-semibold">Ditolak: {totalDitolak}</span>}
                                              </td>
                                            </tr>
                                          </tfoot>
                                        )}
                                      </table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {viewState === 'mutasi_kreator' && (
            <CampaignCreatorMutationTab campaignId={campaignId} />
          )}

          {viewState === 'unpaid_creators' && (
            <UnpaidCreatorsTab 
              campaignId={campaignId} 
              onSuccess={() => { setViewState('list'); fetchData(); }} 
            />
          )}

          {viewState === 'form' && (
            <BatchForm 
              campaignId={campaignId} 
              creators={creators} 
              creatorHistory={creatorHistory}
              isLoadingCreators={isLoadingBatches}
              onCancel={() => setViewState('list')} 
              onSuccess={() => { setViewState('list'); fetchData(); }} 
            />
          )}
        </>
      )}

      {viewState === 'detail' && selectedBatch && (
        <BatchDetail 
          batch={selectedBatch} 
          creatorHistory={creatorHistory}
          onBack={() => { setViewState('list'); setSelectedBatch(null); }} 
          onRefresh={async () => {
            const detail = await getPaymentBatchDetail(selectedBatch.id);
            setSelectedBatch(detail);
            fetchData();
          }} 
          onRefreshList={() => fetchData()}
        />
      )}
    </div>
  );
}
