"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Loader2, Plus, ArrowRight, Wallet, Activity, CheckCircle2, Search, X, Check, Trash2, Pencil, StickyNote } from "lucide-react";
import { useParams } from "next/navigation";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/providers/AuthProvider";
import { BatchForm } from "./BatchForm";
import { BatchDetail } from "./BatchDetail";
import { getPaymentBatches, getPaymentBatchDetail, fetchApprovedCreatorsForBatch } from "../../actions/paymentActions";
import { CampaignCreatorMutationTab } from "@/components/CampaignCreatorMutationTab";
import { UnpaidCreatorsTab } from "@/components/UnpaidCreatorsTab";
import { formatDateTime, formatUserWithRole } from "@/utils/formatters";

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

  // Creators Data for Form
  const [creators, setCreators] = useState<any[]>([]);
  const [creatorHistory, setCreatorHistory] = useState<Record<number, any[]>>({});
  
  // KPI Data
  const [totalTerpakai, setTotalTerpakai] = useState(0);

  const fetchData = useCallback(async () => {
    setIsLoadingBatches(true);
    try {
      // Fetch batches
      const data = await getPaymentBatches(campaignId);
      setBatches(data || []);
      
      // Calculate Total Terpakai
      let terpakai = 0;
      data?.forEach(b => {
        b.payment_items?.forEach((item: any) => {
          if (item.final_status === 'paid' && item.payment_type !== 'ads') {
            const baseNominal = item.actual_transfer != null ? Number(item.actual_transfer) : Number(item.nominal || 0);
            terpakai += baseNominal + Number(item.biaya_transfer || 0);
          }
        });
      });
      setTotalTerpakai(terpakai);

      // Fetch approved creators for form (via server action to bypass RLS)
      const ccData = await fetchApprovedCreatorsForBatch(campaignId);

      const creatorHistory: Record<number, any[]> = {};
      data?.forEach(b => {
        b.payment_items?.forEach((item: any) => {
          if (item.final_status !== 'rejected' && item.campaign_creator_id) {
            if (!creatorHistory[item.campaign_creator_id]) {
              creatorHistory[item.campaign_creator_id] = [];
            }
            const baseNominal = item.actual_transfer != null ? Number(item.actual_transfer) : Number(item.nominal || 0);
            creatorHistory[item.campaign_creator_id].push({
              id: item.id,
              batch_id: b.id,
              batch_label: b.batch_label,
              batch_status: b.status,
              date: b.created_at,
              nominal: baseNominal + Number(item.biaya_transfer || 0),
              payment_type: item.payment_type,
              status: item.final_status
            });
          }
        });
      });

      const filteredCreators = (ccData || []).map(cc => {
        const history = creatorHistory[cc.id] || [];
        const types = history.map(h => h.payment_type);
        const isFullyPaid = types.includes('100_akhir') || (types.includes('50_awal') && types.includes('50_akhir'));
        const pendingItem = history.find(h => 
          h.status !== 'paid' && 
          h.status !== 'rejected' && 
          h.status !== 'cancelled' && 
          h.batch_status !== 'paid' && 
          h.batch_status !== 'cancelled'
        );
        
        // Cek ratecard dari campaign_creators.price, jika 0/kosong fallback ke snapshot terbaru
        let effectivePrice = Number(cc.price || 0);
        if (!effectivePrice && cc.creators?.creator_snapshots?.length > 0) {
          const validSnap = cc.creators.creator_snapshots.find((s: any) => Number(s.ratecard || 0) > 0);
          if (validSnap) {
            effectivePrice = Number(validSnap.ratecard || 0);
          }
        }

        return {
          ...cc,
          price: effectivePrice,
          isFullyPaid,
          hasPendingPayment: !!pendingItem,
          pendingBatchLabel: pendingItem?.batch_label || ''
        };
      });

      setCreators(filteredCreators);
      setCreatorHistory(creatorHistory);
    } catch (err) {
      console.error(err);
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
  }

  if (!campaign) return null;

  const budgetPlafon = Number(campaign.budget_creator_plafon || 0);
  const sisaBudget = budgetPlafon - totalTerpakai;
  const progressPercent = budgetPlafon > 0 ? Math.min((totalTerpakai / budgetPlafon) * 100, 100) : 0;

  // ===================== ADS CALCULATIONS =====================
  const adsBudgetPlafon = Number(campaign.budget_ads_plafon || 0);
  let adsTerpakai = 0;
  batches.forEach(b => {
    b.payment_items?.forEach((item: any) => {
      if (item.final_status === 'paid' && item.payment_type === 'ads') {
        const baseNominal = item.actual_transfer != null ? Number(item.actual_transfer) : Number(item.nominal || 0);
        adsTerpakai += baseNominal + Number(item.biaya_transfer || 0);
      }
    });
  });
  const adsSisa = adsBudgetPlafon - adsTerpakai;



  return (
    <div className="space-y-[24px] pb-[80px]">
      {viewState !== 'detail' && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[24px]">
            <div className="bg-slate-900 rounded-xl p-6 text-white shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-[13px] font-medium mb-[4px]">Budget Campaign</p>
                  <h3 className="text-[24px] font-bold">Rp {budgetPlafon.toLocaleString()}</h3>
                </div>
                <Wallet className="w-8 h-8 text-slate-700" />
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-500 text-[13px] font-medium mb-[4px]">Pengeluaran Campaign (Paid)</p>
                  <h3 className="text-[24px] font-bold text-slate-800">Rp {totalTerpakai.toLocaleString()}</h3>
                </div>
                <Activity className="w-8 h-8 text-slate-300" />
              </div>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-emerald-600 text-[13px] font-medium mb-[4px]">Sisa Budget Campaign</p>
                  <h3 className="text-[24px] font-bold text-emerald-700">Rp {sisaBudget.toLocaleString()}</h3>
                </div>
                <CheckCircle2 className="w-8 h-8 text-emerald-200" />
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-center">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-slate-500">Budget Campaign Terpakai</span>
                <span className="text-xs font-bold text-slate-700">{progressPercent.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-[24px]">
            <div className="bg-indigo-900 rounded-xl p-6 text-white shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-indigo-300 text-[13px] font-medium mb-[4px]">Budget ADS (Plafon)</p>
                  <h3 className="text-[24px] font-bold">Rp {adsBudgetPlafon.toLocaleString()}</h3>
                </div>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-500 text-[13px] font-medium mb-[4px]">ADS Terpakai (Paid)</p>
                  <h3 className="text-[24px] font-bold text-slate-800">Rp {adsTerpakai.toLocaleString()}</h3>
                </div>
              </div>
            </div>
            <div className={`rounded-xl p-6 shadow-sm border ${adsSisa < 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className={`text-[13px] font-medium mb-[4px] ${adsSisa < 0 ? 'text-red-600' : 'text-emerald-600'}`}>Sisa Budget ADS</p>
                  <h3 className={`text-[24px] font-bold ${adsSisa < 0 ? 'text-red-700' : 'text-emerald-700'}`}>Rp {adsSisa.toLocaleString()}</h3>
                </div>
              </div>
            </div>
          </div>

          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setViewState('list')}
              className={`px-[24px] py-[12px] text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-2 ${viewState === 'list' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              Daftar Batch Pembayaran
            </button>
            <button
              onClick={() => setViewState('mutasi_kreator')}
              className={`px-[24px] py-[12px] text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-2 ${viewState === 'mutasi_kreator' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              Mutasi Kreator
            </button>
            {hasAccess && (
              <button
                onClick={() => setViewState('unpaid_creators')}
                className={`px-[24px] py-[12px] text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-2 ${viewState === 'unpaid_creators' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                Kreator Belum Dibayar
              </button>
            )}
            {hasAccess && (
              <button
                onClick={() => setViewState('form')}
                className={`px-[24px] py-[12px] text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-2 ${viewState === 'form' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                Buat Pengajuan (Manual)
              </button>
            )}
          </div>

          {viewState === 'list' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
                        const totalItem = b.payment_items?.length || 0;
                        const totalDibayar = b.payment_items?.filter((i: any) => i.final_status === 'paid').length || 0;
                        const totalDitolak = b.payment_items?.filter((i: any) => i.final_status === 'rejected').length || 0;
                        const totalNominal = b.payment_items?.reduce((acc: number, cur: any) => {
                          const base = cur.actual_transfer != null ? Number(cur.actual_transfer) : Number(cur.nominal || 0);
                          return acc + base + Number(cur.biaya_transfer || 0);
                        }, 0) || 0;
                        const nominalDibayar = b.payment_items?.filter((i: any) => i.final_status === 'paid').reduce((acc: number, cur: any) => {
                          const base = cur.actual_transfer != null ? Number(cur.actual_transfer) : Number(cur.nominal || 0);
                          return acc + base + Number(cur.biaya_transfer || 0);
                        }, 0) || 0;
                        
                        return (
                          <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3 text-center text-slate-400">{idx + 1}</td>
                            <td className="px-4 py-3 font-semibold text-slate-700">{b.batch_label}
                              <div className="text-xs font-normal text-slate-400">{formatDateTime(b.submitted_at || b.created_at)}</div>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-600">{formatUserWithRole(b.submitter?.nama, b.submitter?.role)}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1 items-center text-[10px] w-24 mx-auto">
                                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold w-full text-center">Diajukan: {totalItem}</span>
                                {totalDibayar > 0 && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-semibold w-full text-center">Dibayar: {totalDibayar}</span>}
                                {totalDitolak > 0 && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-semibold w-full text-center">Ditolak: {totalDitolak}</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-700">Rp {totalNominal.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-bold text-green-600">Rp {nominalDibayar.toLocaleString()}</td>
                            <td className="px-4 py-3 text-center">{getBatchStatusBadge(b.status)}</td>
                            <td className="px-4 py-3 text-center">
                              <button onClick={() => handleViewDetail(b.id)} className="text-blue-600 hover:text-blue-800 font-semibold text-xs flex items-center justify-center gap-1 mx-auto bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors">
                                Lihat Detail <ArrowRight className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        )
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
