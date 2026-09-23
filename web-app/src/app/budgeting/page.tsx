"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, ArrowRight, Wallet, CheckCircle2, Clock, AlertCircle, Pencil, Check, X } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { getPaymentBatches, getBudgetSummary, updateCampaignBudget } from "../campaigns/actions/paymentActions";
import { useRouter } from "next/navigation";
import { MutationTable } from "@/components/MutationTable";
import { RekapAdsTab } from "@/components/RekapAdsTab";
import { GlobalCommandCenter } from "@/components/GlobalCommandCenter";
import { useAuth } from "@/providers/AuthProvider";
import { BatchDetail } from "../campaigns/[id]/keuangan/BatchDetail";
import { formatDateTime, formatUserWithRole } from "@/utils/formatters";

export default function GlobalBudgetingPage() {
  return (
    <ErrorBoundary>
      <GlobalBudgetingContent />
    </ErrorBoundary>
  );
}

function GlobalBudgetingContent() {
  const router = useRouter();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'tindakan' | 'semua' | 'ringkasan' | 'ads' | 'mutasi'>('tindakan');
  const [batches, setBatches] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);

  // Inline edit state
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingCell, setSavingCell] = useState<string | null>(null);

  const creatorHistory = useMemo(() => {
    const history: Record<number, any[]> = {};
    batches.forEach(b => {
      b.payment_items?.forEach((item: any) => {
        if (item.final_status !== 'rejected' && item.campaign_creator_id) {
          if (!history[item.campaign_creator_id]) {
            history[item.campaign_creator_id] = [];
          }
          const baseNominal = item.actual_transfer != null ? Number(item.actual_transfer) : Number(item.nominal || 0);
          history[item.campaign_creator_id].push({
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
    return history;
  }, [batches]);

  const fetchBatches = useCallback(async () => {
    setIsLoading(true);
    try {
      const [data, sumData] = await Promise.all([
        getPaymentBatches(),
        getBudgetSummary()
      ]);
      setBatches(data || []);
      setSummaries(sumData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const startEditing = (campaignId: number, field: string, currentValue: number) => {
    setEditingCell(`${campaignId}_${field}`);
    setEditValue(currentValue.toString());
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveEdit = async (campaignId: number, field: 'budget_creator_plafon' | 'budget_ads_plafon') => {
    const cellKey = `${campaignId}_${field}`;
    setSavingCell(cellKey);
    try {
      const newValue = Number(editValue.replace(/[^0-9]/g, '') || 0);
      await updateCampaignBudget(campaignId, field, newValue);

      // Update local summaries so sisa recalculates instantly
      setSummaries(prev => prev.map(s => {
        if (s.campaign_id !== campaignId) return s;
        if (field === 'budget_creator_plafon') {
          return { ...s, budget_creator: newValue, sisa_creator: newValue - s.terpakai_creator };
        } else {
          return { ...s, budget_ads: newValue, sisa_ads: newValue - s.terpakai_ads };
        }
      }));
      setEditingCell(null);
      setEditValue('');
    } catch (err: any) {
      alert('Gagal menyimpan: ' + err.message);
    } finally {
      setSavingCell(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, campaignId: number, field: 'budget_creator_plafon' | 'budget_ads_plafon') => {
    if (e.key === 'Enter') saveEdit(campaignId, field);
    if (e.key === 'Escape') cancelEditing();
  };

  const actionStatuses = ['pending_manager', 'pending_executive_1', 'pending_finance', 'pending_executive', 'ready_to_pay'];
  const totalActionNeeded = batches.filter(b => actionStatuses.includes(b.status)).length;
  const totalPaid = batches.filter(b => b.status === 'paid').length;
  const totalAll = batches.length;

  const EditableCell = ({ campaignId, field, value }: { campaignId: number, field: 'budget_creator_plafon' | 'budget_ads_plafon', value: number }) => {
    const cellKey = `${campaignId}_${field}`;
    const isEditing = editingCell === cellKey;
    const isSaving = savingCell === cellKey;

    if (isEditing) {
      return (
        <div className="flex items-center gap-1 justify-end">
          <span className="text-xs text-slate-400">Rp</span>
          <input
            type="text"
            autoFocus
            className="w-28 px-2 py-1 text-right text-sm border border-blue-400 rounded outline-none focus:ring-2 focus:ring-blue-200 bg-blue-50"
            value={Number(editValue.replace(/[^0-9]/g, '') || 0).toLocaleString()}
            onChange={e => setEditValue(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={e => handleKeyDown(e, campaignId, field)}
          />
          <button onClick={() => saveEdit(campaignId, field)} disabled={isSaving} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Simpan">
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </button>
          <button onClick={cancelEditing} className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors" title="Batal">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    return (
      <div className="group flex items-center gap-1.5 justify-end cursor-pointer" onClick={() => startEditing(campaignId, field, value)}>
        <span>Rp {value.toLocaleString()}</span>
        <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  };

  return (
    <div className="space-y-[24px] pb-[80px]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 text-slate-800">
          <Wallet className="w-8 h-8 text-blue-600" />
          Dashboard Pembayaran Global
        </h1>
        <p className="text-slate-500 mt-1">Pantau seluruh pengajuan pembayaran dari semua campaign di satu tempat.</p>
      </div>

      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('tindakan')}
          className={`px-[24px] py-[12px] text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'tindakan' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <AlertCircle className="w-4 h-4" /> Perlu Tindakan
          {totalActionNeeded > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{totalActionNeeded}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('semua')}
          className={`px-[24px] py-[12px] text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'semua' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <Wallet className="w-4 h-4" /> Semua Ajuan
        </button>
        <button
          onClick={() => setActiveTab('ads')}
          className={`px-[24px] py-[12px] text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'ads' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 21-7-4V7l7-4 7 4v10Z"/><path d="m12 22v-9"/><path d="m3 7 9 5.5"/><path d="m21 7-9 5.5"/><path d="M12 7v5.5"/></svg>
          Top Up Ads
        </button>
        <button
          onClick={() => setActiveTab('ringkasan')}
          className={`px-[24px] py-[12px] text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'ringkasan' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <Wallet className="w-4 h-4" /> Ringkasan Budget
        </button>
        <button
          onClick={() => setActiveTab('mutasi')}
          className={`px-[24px] py-[12px] text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'mutasi' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <Wallet className="w-4 h-4" /> Mutasi Pembayaran
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="col-span-1">
          {activeTab === 'tindakan' ? (
            profile?.role && ['manager', 'executive', 'finance'].includes(profile.role) ? (
              <GlobalCommandCenter role={profile.role} />
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-800">Khusus Persetujuan & Finance</h3>
                <p className="text-slate-500 max-w-md mx-auto mt-1 mb-6 text-sm">
                  Tab Perlu Tindakan dikhususkan bagi Manager, Executive, dan Finance untuk memproses verifikasi dan persetujuan pengajuan. Silakan pantau pengajuan melalui tab Semua Ajuan.
                </p>
                <button 
                  onClick={() => setActiveTab('semua')} 
                  className="btn btn-primary inline-flex items-center gap-2 text-sm"
                >
                  Buka Tab Semua Ajuan <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )
          ) : activeTab === 'mutasi' ? (
            <MutationTable />
          ) : activeTab === 'ads' ? (
            <RekapAdsTab />
          ) : activeTab === 'ringkasan' ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-600 font-medium">
                    <tr>
                      <th className="px-4 py-4 w-12 text-center">No</th>
                      <th className="px-4 py-4">Campaign</th>
                      <th className="px-4 py-4 text-right">Plafon Creator <Pencil className="w-3 h-3 inline ml-1 text-slate-300" /></th>
                      <th className="px-4 py-4 text-right">Terpakai Creator</th>
                      <th className="px-4 py-4 text-right">Sisa Creator</th>
                      <th className="px-4 py-4 text-right">Plafon Ads <Pencil className="w-3 h-3 inline ml-1 text-slate-300" /></th>
                      <th className="px-4 py-4 text-right">Terpakai Ads</th>
                      <th className="px-4 py-4 text-right">Sisa Ads</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {summaries.map((sum, idx) => (
                      <tr key={sum.campaign_id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-center text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{sum.campaign_nama}</td>
                        <td className="px-4 py-3 text-right">
                          <EditableCell campaignId={sum.campaign_id} field="budget_creator_plafon" value={sum.budget_creator} />
                        </td>
                        <td className="px-4 py-3 text-right text-red-600">Rp {sum.terpakai_creator.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">Rp {sum.sisa_creator.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          <EditableCell campaignId={sum.campaign_id} field="budget_ads_plafon" value={sum.budget_ads} />
                        </td>
                        <td className="px-4 py-3 text-right text-red-600">Rp {sum.terpakai_ads.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">Rp {sum.sisa_ads.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-600 font-medium">
                    <tr>
                      <th className="px-4 py-4 text-center w-12">No</th>
                      <th className="px-4 py-4">Campaign</th>
                      <th className="px-4 py-4">Batch Label</th>
                      <th className="px-4 py-4">Tgl Pengajuan</th>
                      <th className="px-4 py-4">PIC Submit</th>
                      <th className="px-4 py-4 text-center">Jml Item</th>
                      <th className="px-4 py-4 text-right">Total Nominal</th>
                      <th className="px-4 py-4 text-center">Status</th>
                      <th className="px-4 py-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {batches.map((b, idx) => {
                      const totalNominal = b.payment_items?.reduce((acc: number, cur: any) => acc + Number(cur.nominal) + Number(cur.biaya_transfer), 0) || 0;
                      return (
                        <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-center">{idx + 1}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{b.campaigns?.nama}</td>
                          <td className="px-4 py-3 font-medium text-slate-700">{b.batch_label}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(b.submitted_at || b.created_at)}</td>
                          <td className="px-4 py-3">{formatUserWithRole(b.submitter?.nama, b.submitter?.role)}</td>
                          <td className="px-4 py-3 text-center">{b.payment_items?.length}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800">Rp {totalNominal.toLocaleString()}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-semibold uppercase">{b.status}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => setSelectedBatchId(b.id)} className="text-blue-600 font-semibold hover:bg-blue-50 px-3 py-1 rounded-md transition-all text-xs">Detail</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL BATCH DETAIL */}
      {selectedBatchId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-hidden">
          <div className="bg-slate-50 w-full max-w-[95vw] sm:max-w-7xl max-h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex justify-between items-center z-10 sticky top-0">
              <div>
                <h2 className="font-extrabold text-xl text-slate-800">Detail Tagihan</h2>
                <p className="text-sm text-slate-500">Anda dapat memproses tagihan langsung dari jendela ini.</p>
              </div>
              <button 
                onClick={() => setSelectedBatchId(null)} 
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Konten Modal */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <BatchDetail 
                  batch={batches.find(b => b.id === selectedBatchId)} 
                  creatorHistory={creatorHistory} 
                  onBack={() => setSelectedBatchId(null)} 
                  onRefresh={fetchBatches} 
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
