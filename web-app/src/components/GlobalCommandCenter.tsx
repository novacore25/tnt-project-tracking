"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, ChevronDown, ChevronUp, CheckSquare, Square, CheckCircle, ShieldAlert, FileText, Send, Calendar, Image as ImageIcon } from 'lucide-react';
import { 
  fetchCommandCenterBatches, 
  processBulkManagerItems,
  processBulkExecutive,
  bulkProcessFinanceReview,
  bulkMarkPaidFinance
} from '@/app/campaigns/actions/paymentActions';
import { getSenderAccounts } from '@/app/campaigns/actions/paymentActions';
import { formatDateTime, formatUserWithRole } from '@/utils/formatters';

export function GlobalCommandCenter({ role, onSuccess }: { role: string, onSuccess?: () => void }) {
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  
  // Generic Sub-Tabs for Roles: executive can access all 4 modes, manager gets manager_review, finance gets review & transfer
  const [subTab, setSubTab] = useState<'exec_approval' | 'manager_review' | 'review' | 'transfer'>(
    role === 'manager' ? 'manager_review' : (role === 'finance' ? 'review' : 'exec_approval')
  );

  // Bulk Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [buktiUrl, setBuktiUrl] = useState('');
  const [senderAccountId, setSenderAccountId] = useState(0);
  const [senderAccounts, setSenderAccounts] = useState<any[]>([]);

  // Real-time counts per sub-tab
  const [tabCounts, setTabCounts] = useState<{
    exec_approval: number;
    manager_review: number;
    review: number;
    transfer: number;
  }>({
    exec_approval: 0,
    manager_review: 0,
    review: 0,
    transfer: 0
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchCommandCenterBatches();
      
      const counts = {
        exec_approval: 0,
        manager_review: 0,
        review: 0,
        transfer: 0
      };

      (data || []).forEach(b => {
        const items = b.payment_items || [];
        if (items.some((i: any) => ['manager_approved', 'finance_selected'].includes(i.final_status))) counts.exec_approval++;
        if (items.some((i: any) => i.final_status === 'pending')) counts.manager_review++;
        if (items.some((i: any) => ['executive_1_approved', 'pending_finance_outstanding'].includes(i.final_status))) counts.review++;
        if (items.some((i: any) => ['finance_selected', 'ready_to_pay', 'executive_approved'].includes(i.final_status))) counts.transfer++;
      });
      setTabCounts(counts);

      let processedBatches = (data || []).map(b => {
        let validItems = b.payment_items || [];
        if (subTab === 'manager_review') {
          validItems = validItems.filter((i:any) => i.final_status === 'pending');
        } else if (subTab === 'review') {
          validItems = validItems.filter((i:any) => ['executive_1_approved', 'pending_finance_outstanding'].includes(i.final_status));
        } else if (subTab === 'transfer') {
          validItems = validItems.filter((i:any) => ['finance_selected', 'ready_to_pay', 'executive_approved'].includes(i.final_status));
        } else if (subTab === 'exec_approval') {
          validItems = validItems.filter((i:any) => ['manager_approved', 'finance_selected'].includes(i.final_status));
        }
        return { ...b, payment_items: validItems };
      }).filter(b => b.payment_items.length > 0);

      // In all tabs and roles, rely on item presence instead of strictly blocking by batch status.
      // This ensures mixed-status batches (e.g. some items approved while others are still pending)
      // never cause pending items to become hidden from Manager, Executive, or Finance.

      setBatches(processedBatches);
      setExpandedBatches(new Set(processedBatches.map(b => b.id)));
      
      if ((role === 'finance' || role === 'executive' || subTab === 'transfer') && senderAccounts.length === 0) {
        const accounts = await getSenderAccounts();
        setSenderAccounts(accounts);
        if (accounts.length > 0) setSenderAccountId(accounts[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [role, subTab, senderAccounts.length]);

  useEffect(() => {
    loadData();
    setSelectedItems(new Set()); // Reset selections on tab change
  }, [loadData, subTab]);

  const toggleExpand = (id: number) => {
    const next = new Set(expandedBatches);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedBatches(next);
  };

  const toggleSelectItem = (id: number) => {
    const next = new Set(selectedItems);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedItems(next);
  };

  const toggleSelectBatch = (batchId: number) => {
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return;
    
    const itemIds = batch.payment_items.map((i:any) => i.id);
    const allSelected = itemIds.every((id:any) => selectedItems.has(id));
    
    const next = new Set(selectedItems);
    if (allSelected) {
      itemIds.forEach((id:any) => next.delete(id));
    } else {
      itemIds.forEach((id:any) => next.add(id));
    }
    setSelectedItems(next);
  };

  const handleSelectAll = () => {
    const allItemIds = batches.flatMap(b => b.payment_items.map((i:any) => i.id));
    if (selectedItems.size === allItemIds.length && allItemIds.length > 0) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(allItemIds));
    }
  };

  const handleBulkApproveExecMgr = async () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`Anda yakin ingin menyetujui ${selectedItems.size} tagihan ini?`)) return;

    setIsSubmitting(true);
    try {
      const ids = Array.from(selectedItems);
      if (subTab === 'manager_review' || (role === 'manager' && subTab !== 'exec_approval')) {
        await processBulkManagerItems(ids);
      } else if (subTab === 'exec_approval' || role === 'executive') {
        await processBulkExecutive(ids);
      }
      
      alert("Berhasil memproses tagihan terpilih!");
      setSelectedItems(new Set());
      loadData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert("Gagal memproses bulk approve: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinanceReview = async (action: 'approve' | 'pending' | 'reject') => {
    if (selectedItems.size === 0) return;
    let msg = action === 'approve' ? 'menyetujui' : action === 'pending' ? 'menunda (outstanding)' : 'menolak (reject)';
    if (!confirm(`Anda yakin ingin ${msg} ${selectedItems.size} tagihan ini?`)) return;

    setIsSubmitting(true);
    try {
      const res = await bulkProcessFinanceReview(Array.from(selectedItems), action);
      if (res && !res.success) {
        throw new Error(res.error || "Unknown error from server");
      }
      alert("Berhasil memproses tagihan terpilih!");
      setSelectedItems(new Set());
      loadData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert("Gagal memproses: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinanceSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.size === 0) return;
    if (!buktiUrl) return alert("URL Bukti Transfer wajib diisi!");
    
    setIsSubmitting(true);
    try {
      const res = await bulkMarkPaidFinance(Array.from(selectedItems), {
        actualPaymentDate: transferDate,
        buktiTransferUrl: buktiUrl,
        senderAccountId: senderAccountId
      });
      if (res && !res.success) {
        throw new Error(res.error || "Unknown error from server");
      }
      alert("Berhasil menandai lunas!");
      setShowTransferModal(false);
      setSelectedItems(new Set());
      loadData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert("Gagal menandai lunas: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderEmptyState = () => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
      <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
      <h3 className="text-lg font-bold text-slate-800">Semua Beres di Meja Ini!</h3>
      <p className="text-slate-500 max-w-md mx-auto mt-1">
        Tidak ada tagihan yang menunggu persetujuan pada sub-tab ini.
      </p>
      {(tabCounts.manager_review > 0 || tabCounts.review > 0 || tabCounts.transfer > 0 || tabCounts.exec_approval > 0) && (
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap justify-center gap-2 text-xs">
          <span className="text-slate-400 self-center">Antrean di meja lain:</span>
          {tabCounts.manager_review > 0 && (
            <button onClick={() => setSubTab('manager_review')} className="px-3 py-1 bg-amber-50 text-amber-800 rounded-full font-semibold border border-amber-200 hover:bg-amber-100 transition-colors">
              Review Manager ({tabCounts.manager_review})
            </button>
          )}
          {tabCounts.review > 0 && (
            <button onClick={() => setSubTab('review')} className="px-3 py-1 bg-purple-50 text-purple-800 rounded-full font-semibold border border-purple-200 hover:bg-purple-100 transition-colors">
              Review Finance ({tabCounts.review})
            </button>
          )}
          {tabCounts.transfer > 0 && (
            <button onClick={() => setSubTab('transfer')} className="px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full font-semibold border border-emerald-200 hover:bg-emerald-100 transition-colors">
              Siap Bayar ({tabCounts.transfer})
            </button>
          )}
          {tabCounts.exec_approval > 0 && (
            <button onClick={() => setSubTab('exec_approval')} className="px-3 py-1 bg-blue-50 text-blue-800 rounded-full font-semibold border border-blue-200 hover:bg-blue-100 transition-colors">
              Approval Executive ({tabCounts.exec_approval})
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4 pb-24">
      
      {(role === 'finance' || role === 'executive' || role === 'manager') && (
        <div className="flex bg-slate-100 p-1 rounded-lg w-fit mb-4 flex-wrap gap-1">
          {role === 'executive' && (
            <button 
              className={`px-5 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${subTab === 'exec_approval' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setSubTab('exec_approval')}
            >
              Approval Executive
              {tabCounts.exec_approval > 0 && (
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold">
                  {tabCounts.exec_approval}
                </span>
              )}
            </button>
          )}
          {(role === 'executive' || role === 'manager') && (
            <button 
              className={`px-5 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${subTab === 'manager_review' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setSubTab('manager_review')}
            >
              Review Manager
              {tabCounts.manager_review > 0 && (
                <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-bold">
                  {tabCounts.manager_review}
                </span>
              )}
            </button>
          )}
          {(role === 'executive' || role === 'finance') && (
            <button 
              className={`px-5 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${subTab === 'review' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setSubTab('review')}
            >
              Review Finance
              {tabCounts.review > 0 && (
                <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-bold">
                  {tabCounts.review}
                </span>
              )}
            </button>
          )}
          {(role === 'executive' || role === 'finance') && (
            <button 
              className={`px-5 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${subTab === 'transfer' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setSubTab('transfer')}
            >
              Siap Bayar (Transfer)
              {tabCounts.transfer > 0 && (
                <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-bold">
                  {tabCounts.transfer}
                </span>
              )}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            Tumpukan Persetujuan {
              subTab === 'manager_review' ? '(Review Manager)' :
              subTab === 'exec_approval' ? '(Approval Executive)' :
              subTab === 'review' ? '(Review Finance)' :
              subTab === 'transfer' ? '(Siap Bayar / Transfer)' : ''
            }
          </h2>
          <p className="text-sm text-slate-500">Centang tagihan yang ingin diproses, lalu pilih aksi di bawah layar.</p>
        </div>
        <button
          onClick={handleSelectAll}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          {selectedItems.size > 0 ? 'Batal Pilih Semua' : 'Pilih Semua Tagihan'}
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
      ) : batches.length === 0 ? (
        renderEmptyState()
      ) : (
        <div className="space-y-4">
          {batches.map((batch) => {
            const isExpanded = expandedBatches.has(batch.id);
            const batchItemIds = batch.payment_items.map((i:any) => i.id);
            const allSelected = batchItemIds.every((id:any) => selectedItems.has(id));
            const someSelected = batchItemIds.some((id:any) => selectedItems.has(id)) && !allSelected;
            
            let totalNominal = 0;
            batch.payment_items?.forEach((i: any) => { totalNominal += Number(i.nominal) || 0; });

            return (
              <div key={batch.id} className="bg-white rounded-xl border border-slate-200 shadow-sm transition-all overflow-hidden">
                <div 
                  className={`p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 ${isExpanded ? 'border-b border-slate-100 bg-slate-50/50' : ''}`}
                  onClick={() => toggleExpand(batch.id)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div 
                      className="p-2 -m-2 cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); toggleSelectBatch(batch.id); }}
                    >
                      {allSelected ? <CheckSquare className="w-6 h-6 text-blue-600" /> : 
                       someSelected ? <CheckSquare className="w-6 h-6 text-blue-400 opacity-60" /> :
                       <Square className="w-6 h-6 text-slate-300 hover:text-slate-500" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800 text-base">{batch.batch_label}</h3>
                        {batch.status === 'pending_manager' && <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider">Manager Review</span>}
                        {batch.status === 'pending_executive_1' && <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold uppercase tracking-wider">Executive Review 1</span>}
                        {batch.status === 'pending_finance' && <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider">Finance Review</span>}
                        {batch.status === 'pending_executive' && <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">Executive Final Approval</span>}
                        {batch.status === 'ready_to_pay' && <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">Siap Transfer</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span>{batch.campaigns?.nama || 'Unknown Campaign'}</span>
                        <span>•</span>
                        <span>Oleh: {formatUserWithRole(batch.submitter?.nama, batch.submitter?.role)}</span>
                        <span>•</span>
                        <span>{formatDateTime(batch.submitted_at || batch.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-slate-500">Total {batch.payment_items.length} Tagihan</div>
                      <div className="font-bold text-slate-800">Rp {totalNominal.toLocaleString()}</div>
                    </div>
                    <button className="text-slate-400">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-0 bg-white overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-medium text-xs">
                        <tr>
                          <th className="py-2 pl-4 w-12"></th>
                          <th className="py-2">Kreator / Deskripsi</th>
                          <th className="py-2">Tgl Pengajuan</th>
                          <th className="py-2">Pembayaran ke</th>
                          <th className="py-2 text-right">Nominal</th>
                          <th className="py-2 text-center pr-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {batch.payment_items?.map((item: any) => {
                          const isSelected = selectedItems.has(item.id);
                          return (
                            <tr key={item.id} className={`transition-colors hover:bg-blue-50/30 ${isSelected ? 'bg-blue-50/50' : ''}`}>
                              <td className="py-3 pl-4">
                                <div className="cursor-pointer p-1 -m-1" onClick={() => toggleSelectItem(item.id)}>
                                  {isSelected ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-slate-300 hover:text-slate-400" />}
                                </div>
                              </td>
                              <td className="py-3">
                                <div className="font-mono text-[10px] text-slate-400 mb-0.5">{item.transaction_id || '-'}</div>
                                {item.campaign_creators ? (
                                  <div>
                                    <div className="font-semibold text-slate-800">@{item.campaign_creators?.creators?.username}</div>
                                    {item.payment_type === '50_awal' ? (
                                      <div className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 inline-block mt-0.5">
                                        Termin 1 (DP 50%): Rp {Number(item.nominal).toLocaleString()} • Kurang: Rp {(Number(item.ratecard_awal || (Number(item.nominal) * 2)) - Number(item.nominal)).toLocaleString()} (Termin 2)
                                      </div>
                                    ) : item.payment_type === '50_akhir' ? (
                                      <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 inline-block mt-0.5">
                                        Termin 2 (Pelunasan 50%): Rp {Number(item.nominal).toLocaleString()}
                                      </div>
                                    ) : item.payment_type === '100_akhir' ? (
                                      <div className="text-[11px] text-slate-600 font-medium">Pembayaran Penuh 100%</div>
                                    ) : (
                                      <div className="text-xs text-slate-500 uppercase">{item.payment_type}</div>
                                    )}
                                  </div>
                                ) : (
                                  <div>
                                    <div className="font-semibold text-slate-800">{item.nama_penerima || 'Operasional'}</div>
                                    <div className="text-xs text-slate-500 uppercase">{item.payment_type}</div>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 text-xs text-slate-600 whitespace-nowrap">
                                <div>{formatDateTime(item.created_at)}</div>
                              </td>
                              <td className="py-3 text-slate-600 text-xs">
                                <div className="font-medium text-slate-800">{item.nama_penerima}</div>
                                <div>{item.metode_pembayaran} • {item.nomor_rekening}</div>
                              </td>
                              <td className="py-3 text-right font-bold text-slate-800">
                                Rp {Number(item.nominal).toLocaleString()}
                              </td>
                              <td className="py-3 text-center pr-4">
                                <span className="text-[11px] font-medium px-2 py-1 bg-slate-100 text-slate-600 rounded whitespace-nowrap">
                                  {item.final_status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Action Bar */}
      {selectedItems.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] p-4 z-40 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 animate-in slide-in-from-bottom-10">
          <div className="font-semibold text-slate-800 text-center sm:text-left">
            <div className="text-sm text-slate-500">Terpilih</div>
            {selectedItems.size} Tagihan
          </div>
          
          <div className="flex flex-wrap justify-center gap-3">
            {(subTab === 'exec_approval' || subTab === 'manager_review' || role === 'manager') ? (
              <button
                onClick={handleBulkApproveExecMgr}
                disabled={isSubmitting}
                className="btn btn-primary px-8 py-2.5 text-base shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                Approve {selectedItems.size} Tagihan {subTab === 'manager_review' ? '(Sebagai Manager)' : ''}
              </button>
            ) : subTab === 'review' ? (
              <>
                <button
                  onClick={() => handleFinanceReview('approve')}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" /> Approve
                </button>
                <button
                  onClick={() => handleFinanceReview('pending')}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2"
                >
                  <Calendar className="w-5 h-5" /> Tunda (Outstanding)
                </button>
                <button
                  onClick={() => handleFinanceReview('reject')}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-bold shadow-lg shadow-rose-500/20 transition-all flex items-center gap-2"
                >
                  <ShieldAlert className="w-5 h-5" /> Reject Permanen
                </button>
              </>
            ) : subTab === 'transfer' ? (
              <button
                onClick={() => setShowTransferModal(true)}
                disabled={isSubmitting}
                className="btn btn-primary px-8 py-2.5 text-base shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                <Send className="w-5 h-5" /> Tandai Lunas ({selectedItems.size})
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Bulk Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={handleFinanceSubmitTransfer} className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-600" />
                Tandai Lunas {selectedItems.size} Tagihan
              </h3>
              <button type="button" onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Tanggal Transfer</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="date" required
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 transition-colors"
                    value={transferDate}
                    onChange={e => setTransferDate(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Rekening Pengirim</label>
                <select 
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 transition-colors bg-white"
                  value={senderAccountId}
                  onChange={e => setSenderAccountId(Number(e.target.value))}
                >
                  <option value={0} disabled>Pilih Rekening Asal</option>
                  {senderAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.nama} ({acc.bank_name})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Link Bukti Transfer (Google Drive)</label>
                <div className="relative">
                  <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="url" required
                    placeholder="https://drive.google.com/..."
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 transition-colors"
                    value={buktiUrl}
                    onChange={e => setBuktiUrl(e.target.value)}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1.5">Satu bukti transfer ini akan terpasang ke {selectedItems.size} tagihan sekaligus secara otomatis.</p>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button type="button" onClick={() => setShowTransferModal(false)} className="px-5 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors">Batal</button>
              <button type="submit" disabled={isSubmitting} className="btn btn-primary flex items-center gap-2 px-6">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Submit
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
