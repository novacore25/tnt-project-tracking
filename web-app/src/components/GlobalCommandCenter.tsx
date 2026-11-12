"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Loader2, ChevronDown, ChevronUp, ChevronRight, CheckSquare, Square, 
  CheckCircle, CheckCircle2, XCircle, Clock, ShieldAlert, FileText, 
  Send, Calendar, Image as ImageIcon, ExternalLink, AlertCircle, 
  User, CreditCard, Phone 
} from 'lucide-react';
import { 
  fetchCommandCenterBatches, 
  processBulkManagerItems,
  processBulkExecutive,
  bulkProcessFinanceReview,
  bulkMarkPaidFinance
} from '@/app/campaigns/actions/paymentActions';
import { getSenderAccounts } from '@/app/campaigns/actions/paymentActions';
import { formatDateTime, formatUserWithRole, getItemApprovalBadge } from '@/utils/formatters';

export function GlobalCommandCenter({ role, onSuccess }: { role: string, onSuccess?: () => void }) {
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleExpandItem = (itemId: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };
  
  // Generic Sub-Tabs for Roles: executive can access all 5 modes in funnel order, manager gets manager_review, finance gets review & transfer
  type CommandCenterSubTab = 'manager_review' | 'exec_review_1' | 'review' | 'exec_final' | 'transfer';
  const [subTab, setSubTab] = useState<CommandCenterSubTab>(
    role === 'manager' ? 'manager_review' : (role === 'finance' ? 'review' : 'manager_review')
  );

  // Bulk Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [buktiUrl, setBuktiUrl] = useState('');
  const [senderAccountId, setSenderAccountId] = useState(0);
  const [senderAccounts, setSenderAccounts] = useState<any[]>([]);

  // Real-time counts per sub-tab (5 tahapan funnel berurutan)
  const [tabCounts, setTabCounts] = useState<{
    manager_review: number;
    exec_review_1: number;
    review: number;
    exec_final: number;
    transfer: number;
  }>({
    manager_review: 0,
    exec_review_1: 0,
    review: 0,
    exec_final: 0,
    transfer: 0
  });

  // Kalkulasi total nominal rupiah untuk seluruh tagihan yang sedang dicentang/diseleksi
  const selectedTotalNominal = React.useMemo(() => {
    let total = 0;
    batches.forEach(b => {
      b.payment_items?.forEach((i: any) => {
        if (selectedItems.has(i.id)) {
          total += Number(i.nominal) || 0;
        }
      });
    });
    return total;
  }, [batches, selectedItems]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchCommandCenterBatches();
      
      const counts = {
        manager_review: 0,
        exec_review_1: 0,
        review: 0,
        exec_final: 0,
        transfer: 0
      };

      (data || []).forEach(b => {
        const items = b.payment_items || [];
        if (items.some((i: any) => i.final_status === 'pending')) {
          counts.manager_review++;
        }
        if (items.some((i: any) => i.final_status === 'manager_approved')) {
          counts.exec_review_1++;
        }
        if (items.some((i: any) => ['executive_1_approved', 'pending_finance_outstanding'].includes(i.final_status))) {
          counts.review++;
        }
        if (items.some((i: any) => i.final_status === 'finance_selected')) {
          counts.exec_final++;
        }
        if (items.some((i: any) => ['ready_to_pay', 'executive_approved'].includes(i.final_status) && i.final_status !== 'paid')) {
          counts.transfer++;
        }
      });
      setTabCounts(counts);

      let processedBatches = (data || []).map(b => {
        const items = b.payment_items || [];
        let validItems: any[] = [];

        if (subTab === 'manager_review') {
          validItems = items.filter((i: any) => i.final_status === 'pending');
        } else if (subTab === 'exec_review_1') {
          validItems = items.filter((i: any) => i.final_status === 'manager_approved');
        } else if (subTab === 'review') {
          validItems = items.filter((i: any) => ['executive_1_approved', 'pending_finance_outstanding'].includes(i.final_status));
        } else if (subTab === 'exec_final') {
          validItems = items.filter((i: any) => i.final_status === 'finance_selected');
        } else if (subTab === 'transfer') {
          validItems = items.filter((i: any) => ['ready_to_pay', 'executive_approved'].includes(i.final_status) && i.final_status !== 'paid');
        }

        if (validItems.length === 0) return null;
        return { ...b, payment_items: validItems };
      }).filter((b): b is any => b !== null);

      // Partisi item presisi: Jika 1 batch memiliki item dengan status funnel berbeda,
      // batch akan dipecah otomatis ke meja tugas masing-masing sesuai final_status item.
      // Tidak akan ada item finance_selected yang bocor ke Siap Transfer.

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
    if (!confirm(`Anda yakin ingin menyetujui ${selectedItems.size} tagihan ini (Total: Rp ${selectedTotalNominal.toLocaleString('id-ID')})?`)) return;

    setIsSubmitting(true);
    try {
      const ids = Array.from(selectedItems);
      if (subTab === 'manager_review' || (role === 'manager' && subTab !== 'exec_review_1' && subTab !== 'exec_final')) {
        await processBulkManagerItems(ids);
      } else if (['exec_review_1', 'exec_final'].includes(subTab) || role === 'executive') {
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
    if (!confirm(`Anda yakin ingin ${msg} ${selectedItems.size} tagihan ini (Total: Rp ${selectedTotalNominal.toLocaleString('id-ID')})?`)) return;

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
      await bulkMarkPaidFinance(Array.from(selectedItems), {
        actualPaymentDate: transferDate,
        buktiTransferUrl: buktiUrl,
        senderAccountId: senderAccountId
      });
      alert("Berhasil menandai lunas!\n\nCatatan: Sisa tagihan yang belum dicairkan otomatis dipindahkan ke batch Termin baru dan kembali ke antrean 'Review Finance' sesuai SOP.");
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

  const renderItemStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="text-[11px] font-semibold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded whitespace-nowrap">1. Menunggu Manager</span>;
      case 'manager_approved':
        return <span className="text-[11px] font-semibold px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded whitespace-nowrap">2. Menunggu Exec 1</span>;
      case 'executive_1_approved':
        return <span className="text-[11px] font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded whitespace-nowrap">3. Menunggu Finance</span>;
      case 'pending_finance_outstanding':
        return <span className="text-[11px] font-semibold px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-300 rounded whitespace-nowrap">Ditunda Finance</span>;
      case 'finance_selected':
        return <span className="text-[11px] font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded whitespace-nowrap">4. Menunggu Exec Final</span>;
      case 'ready_to_pay':
      case 'executive_approved':
        return <span className="text-[11px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded whitespace-nowrap">5. Siap Transfer</span>;
      case 'paid':
        return <span className="text-[11px] font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded whitespace-nowrap">Lunas</span>;
      case 'rejected':
        return <span className="text-[11px] font-semibold px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded whitespace-nowrap">Ditolak</span>;
      default:
        return <span className="text-[11px] font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded whitespace-nowrap">{status}</span>;
    }
  };

  const renderEmptyState = () => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
      <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
      <h3 className="text-lg font-bold text-slate-800">Semua Beres di Meja Ini!</h3>
      <p className="text-slate-500 max-w-md mx-auto mt-1">
        Tidak ada tagihan yang menunggu persetujuan pada sub-tab ini.
      </p>
      {(tabCounts.manager_review > 0 || tabCounts.exec_review_1 > 0 || tabCounts.review > 0 || tabCounts.exec_final > 0 || tabCounts.transfer > 0) && (
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap justify-center gap-2 text-xs">
          <span className="text-slate-400 self-center">Antrean di meja lain:</span>
          {tabCounts.manager_review > 0 && (role === 'executive' || role === 'manager') && subTab !== 'manager_review' && (
            <button onClick={() => setSubTab('manager_review')} className="px-3 py-1 bg-amber-50 text-amber-800 rounded-full font-semibold border border-amber-200 hover:bg-amber-100 transition-colors">
              {role === 'executive' ? '1. ' : ''}Review Manager ({tabCounts.manager_review})
            </button>
          )}
          {tabCounts.exec_review_1 > 0 && role === 'executive' && subTab !== 'exec_review_1' && (
            <button onClick={() => setSubTab('exec_review_1')} className="px-3 py-1 bg-purple-50 text-purple-800 rounded-full font-semibold border border-purple-200 hover:bg-purple-100 transition-colors">
              2. Executive Review 1 ({tabCounts.exec_review_1})
            </button>
          )}
          {tabCounts.review > 0 && (role === 'executive' || role === 'finance') && subTab !== 'review' && (
            <button onClick={() => setSubTab('review')} className="px-3 py-1 bg-amber-50 text-amber-800 rounded-full font-semibold border border-amber-200 hover:bg-amber-100 transition-colors">
              {role === 'executive' ? '3. ' : ''}Review Finance ({tabCounts.review})
            </button>
          )}
          {tabCounts.exec_final > 0 && role === 'executive' && subTab !== 'exec_final' && (
            <button onClick={() => setSubTab('exec_final')} className="px-3 py-1 bg-blue-50 text-blue-800 rounded-full font-semibold border border-blue-200 hover:bg-blue-100 transition-colors">
              4. Executive Final Approval ({tabCounts.exec_final})
            </button>
          )}
          {tabCounts.transfer > 0 && (role === 'executive' || role === 'finance') && subTab !== 'transfer' && (
            <button onClick={() => setSubTab('transfer')} className="px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full font-semibold border border-emerald-200 hover:bg-emerald-100 transition-colors">
              {role === 'executive' ? '5. ' : ''}Siap Bayar ({tabCounts.transfer})
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
          {/* Tahap 1: Review Manager */}
          {(role === 'executive' || role === 'manager') && (
            <button 
              className={`px-5 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${subTab === 'manager_review' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setSubTab('manager_review')}
            >
              {role === 'executive' && <span className="text-[11px] font-bold text-slate-400">1.</span>}
              Review Manager
              {tabCounts.manager_review > 0 && (
                <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-bold">
                  {tabCounts.manager_review}
                </span>
              )}
            </button>
          )}

          {/* Tahap 2: Executive Review 1 */}
          {role === 'executive' && (
            <button 
              className={`px-5 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${subTab === 'exec_review_1' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setSubTab('exec_review_1')}
            >
              <span className="text-[11px] font-bold text-slate-400">2.</span>
              Executive Review 1
              {tabCounts.exec_review_1 > 0 && (
                <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-bold">
                  {tabCounts.exec_review_1}
                </span>
              )}
            </button>
          )}

          {/* Tahap 3: Review Finance */}
          {(role === 'executive' || role === 'finance') && (
            <button 
              className={`px-5 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${subTab === 'review' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setSubTab('review')}
            >
              {role === 'executive' && <span className="text-[11px] font-bold text-slate-400">3.</span>}
              Review Finance
              {tabCounts.review > 0 && (
                <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-bold">
                  {tabCounts.review}
                </span>
              )}
            </button>
          )}

          {/* Tahap 4: Executive Final Approval */}
          {role === 'executive' && (
            <button 
              className={`px-5 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${subTab === 'exec_final' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setSubTab('exec_final')}
            >
              <span className="text-[11px] font-bold text-slate-400">4.</span>
              Executive Final Approval
              {tabCounts.exec_final > 0 && (
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold">
                  {tabCounts.exec_final}
                </span>
              )}
            </button>
          )}

          {/* Tahap 5: Siap Bayar (Transfer) */}
          {(role === 'executive' || role === 'finance') && (
            <button 
              className={`px-5 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${subTab === 'transfer' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setSubTab('transfer')}
            >
              {role === 'executive' && <span className="text-[11px] font-bold text-slate-400">5.</span>}
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
              subTab === 'manager_review' ? (role === 'executive' ? '(Tahap 1: Review Manager)' : '(Review Manager)') :
              subTab === 'exec_review_1' ? '(Tahap 2: Executive Review 1)' :
              subTab === 'review' ? (role === 'executive' ? '(Tahap 3: Review Finance)' : '(Review Finance)') :
              subTab === 'exec_final' ? '(Tahap 4: Executive Final Approval)' :
              subTab === 'transfer' ? (role === 'executive' ? '(Tahap 5: Siap Bayar / Transfer)' : '(Siap Bayar / Transfer)') : ''
            }
          </h2>
          <p className="text-sm text-slate-500">
            {subTab === 'manager_review' && 'Tahap 1: Pengajuan baru masuk dari PIC. Menunggu pemeriksaan rincian tagihan oleh Manager.'}
            {subTab === 'exec_review_1' && 'Tahap 2: Pengajuan telah disetujui Manager. Menunggu persetujuan awal (Review 1) dari Executive sebelum diteruskan ke Finance.'}
            {subTab === 'review' && 'Tahap 3: Tagihan lolos Executive 1. Menunggu Finance memvalidasi rekening & menjadwalkan pembayaran.'}
            {subTab === 'exec_final' && 'Tahap 4: Tagihan telah diverifikasi Finance. Menunggu Approval Final dari Executive sebelum siap ditransfer.'}
            {subTab === 'transfer' && 'Tahap 5: Tagihan telah disetujui penuh (ACC Final). Siap ditransfer ke kreator / operasional.'}
          </p>
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
                        {subTab === 'manager_review' && <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">1. Review Manager</span>}
                        {subTab === 'exec_review_1' && <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold uppercase tracking-wider">2. Executive Review 1</span>}
                        {subTab === 'review' && <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">3. Finance Review</span>}
                        {subTab === 'exec_final' && <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider">4. Exec Final Approval</span>}
                        {subTab === 'transfer' && <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">5. Siap Transfer</span>}
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
                          <th className="py-2 pl-4 w-16"></th>
                          <th className="py-2">Kreator / Deskripsi</th>
                          <th className="py-2">Tgl Pengajuan</th>
                          <th className="py-2">Pembayaran ke</th>
                          <th className="py-2 text-right">Nominal</th>
                          <th className="py-2 text-center pr-4 min-w-[240px]">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {batch.payment_items?.map((item: any) => {
                          const isSelected = selectedItems.has(item.id);
                          const isItemExpanded = expandedItems.has(item.id);
                          return (
                            <React.Fragment key={item.id}>
                              <tr className={`transition-colors hover:bg-blue-50/30 ${isSelected ? 'bg-blue-50/50' : ''} ${isItemExpanded ? 'bg-slate-50/50' : ''}`}>
                                <td className="py-3 pl-4">
                                  <div className="flex items-center gap-1.5">
                                    <div className="cursor-pointer p-1 -m-1" onClick={() => toggleSelectItem(item.id)}>
                                      {isSelected ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-slate-300 hover:text-slate-400" />}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandItem(item.id)}
                                      title={isItemExpanded ? "Tutup detail" : "Buka detail item & funnel"}
                                      className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 transition-colors"
                                    >
                                      {isItemExpanded ? <ChevronDown className="w-4 h-4 text-blue-600" /> : <ChevronRight className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </td>
                                <td className="py-3">
                                  <div className="font-mono text-[10px] text-slate-400 mb-0.5">{item.transaction_id || '-'}</div>
                                  {item.campaign_creators ? (
                                    <div>
                                      <div 
                                        className="font-semibold text-slate-800 hover:text-blue-600 cursor-pointer inline-flex items-center gap-1 group"
                                        onClick={() => toggleExpandItem(item.id)}
                                        title="Klik untuk membuka detail item & funnel"
                                      >
                                        <span>@{item.campaign_creators?.creators?.username}</span>
                                        <span className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity font-normal underline">detail</span>
                                      </div>
                                      {item.payment_type === '50_awal' ? (
                                        <div className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 inline-block mt-0.5">
                                          Termin 1 (DP 50%): Rp {Number(item.nominal).toLocaleString()} • Kurang: Rp {(Number(item.ratecard_awal || (Number(item.nominal) * 2)) - Number(item.nominal)).toLocaleString()} (Termin 2)
                                        </div>
                                      ) : item.payment_type === '50_akhir' ? (
                                        <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 inline-block mt-0.5">
                                          Termin 2 (Pelunasan 50%): Rp {Number(item.nominal).toLocaleString()}
                                        </div>
                                      ) : item.payment_type === '100_awal' ? (
                                        <div className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 inline-block mt-0.5">Pembayaran Penuh 100% (Awal)</div>
                                      ) : item.payment_type === '100_akhir' ? (
                                        <div className="text-[11px] text-slate-600 font-medium">Pembayaran Penuh 100% (Akhir)</div>
                                      ) : (
                                        <div className="text-xs text-slate-500 uppercase">{item.payment_type}</div>
                                      )}
                                    </div>
                                  ) : (
                                    <div>
                                      <div 
                                        className="font-semibold text-slate-800 hover:text-blue-600 cursor-pointer"
                                        onClick={() => toggleExpandItem(item.id)}
                                      >
                                        {item.nama_penerima || 'Operasional'}
                                      </div>
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
                                <td className="py-3 text-center pr-4 whitespace-nowrap">
                                  <div className="flex flex-col items-center justify-center gap-1.5">
                                    {renderItemStatusBadge(item.final_status)}
                                    {/* Badge Jejak Approval Riil: ACC : [Role] Nama [dd/mm/yyyy, hh:mm] */}
                                    {(() => {
                                      const badge = getItemApprovalBadge(item);
                                      if (!badge) return null;
                                      return (
                                        <div 
                                          className={`text-[9.5px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap shadow-2xs ${badge.className}`}
                                          title={badge.tooltip || badge.text}
                                        >
                                          {badge.text}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </td>
                              </tr>

                              {/* Accordion Detail Item Lengkap */}
                              {isItemExpanded && (
                                <tr className="bg-slate-50/80 border-b border-slate-200">
                                  <td colSpan={6} className="p-4 sm:p-5">
                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4 animate-in fade-in-50 duration-200">
                                      {/* 1. Header Detail */}
                                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                                            {item.campaign_creators?.creators?.username ? item.campaign_creators.creators.username.substring(0, 2).toUpperCase() : 'CC'}
                                          </div>
                                          <div>
                                            <div className="flex items-center gap-2">
                                              <span className="font-bold text-slate-900 text-base">
                                                @{item.campaign_creators?.creators?.username || item.nama_penerima || 'Kreator'}
                                              </span>
                                              <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                                                {item.transaction_id || `ID: ${item.id}`}
                                              </span>
                                              {item.campaign_creators?.tier && (
                                                <span className="text-[11px] font-semibold px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded">
                                                  Tier {item.campaign_creators.tier}
                                                </span>
                                              )}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-0.5">
                                              Campaign: <span className="font-medium text-slate-700">{batch.campaigns?.nama || '-'}</span> • Batch: <span className="font-medium text-slate-700">{batch.batch_label || `Batch #${batch.id}`}</span>
                                            </div>
                                          </div>
                                        </div>
                                        <button 
                                          type="button" 
                                          onClick={() => toggleExpandItem(item.id)}
                                          className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 font-medium px-2.5 py-1 rounded-md hover:bg-slate-100 transition-colors"
                                        >
                                          <ChevronUp className="w-4 h-4" /> Tutup Detail
                                        </button>
                                      </div>

                                      {/* 2. Funnel Progress Stepper (Alur 6 Tahap) */}
                                      <div>
                                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
                                          <Clock className="w-3.5 h-3.5 text-blue-600" />
                                          <span>Alur Funnel Persetujuan Item</span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                                          {/* Step 1: Submit */}
                                          <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200/80">
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="text-[11px] font-bold text-slate-700">1. Pengajuan</span>
                                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                            </div>
                                            <div className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 inline-block mb-1">
                                              Diajukan
                                            </div>
                                            <div className="text-[10px] text-slate-600 truncate" title={batch.submitter?.nama || 'Anggota'}>
                                              Oleh: {batch.submitter?.nama || 'Anggota'}
                                            </div>
                                            <div className="text-[9.5px] text-slate-400 mt-0.5">
                                              {formatDateTime(item.created_at, false)}
                                            </div>
                                          </div>

                                          {/* Step 2: Manager */}
                                          <div className={`rounded-lg p-2.5 border ${
                                            item.manager_status === 'approved' 
                                              ? 'bg-purple-50/50 border-purple-200' 
                                              : item.manager_status === 'rejected'
                                              ? 'bg-rose-50/50 border-rose-200'
                                              : 'bg-slate-50 border-slate-200/80'
                                          }`}>
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="text-[11px] font-bold text-slate-700">2. Review Manager</span>
                                              {item.manager_status === 'approved' ? (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                                              ) : item.manager_status === 'rejected' ? (
                                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                              ) : (
                                                <Clock className="w-3.5 h-3.5 text-amber-500" />
                                              )}
                                            </div>
                                            <div className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border inline-block mb-1 ${
                                              item.manager_status === 'approved' 
                                                ? 'text-purple-700 bg-purple-50 border-purple-200' 
                                                : item.manager_status === 'rejected'
                                                ? 'text-rose-700 bg-rose-50 border-rose-200'
                                                : 'text-amber-700 bg-amber-50 border-amber-200'
                                            }`}>
                                              {item.manager_status === 'approved' ? 'Disetujui' : item.manager_status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                                            </div>
                                            <div className="text-[10px] text-slate-600 truncate" title={item.manager_actor?.nama || '-'}>
                                              ACC: {item.manager_actor?.nama || '-'}
                                            </div>
                                            <div className="text-[9.5px] text-slate-400 mt-0.5">
                                              {item.manager_acted_at ? formatDateTime(item.manager_acted_at, false) : '-'}
                                            </div>
                                            {item.manager_note && (
                                              <div className="text-[9.5px] text-rose-600 font-medium mt-1 truncate" title={item.manager_note}>
                                                Note: {item.manager_note}
                                              </div>
                                            )}
                                          </div>

                                          {/* Step 3: Exec 1 */}
                                          <div className={`rounded-lg p-2.5 border ${
                                            item.executive_1_status === 'approved' 
                                              ? 'bg-indigo-50/50 border-indigo-200' 
                                              : item.executive_1_status === 'rejected'
                                              ? 'bg-rose-50/50 border-rose-200'
                                              : 'bg-slate-50 border-slate-200/80'
                                          }`}>
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="text-[11px] font-bold text-slate-700">3. Review Exec 1</span>
                                              {item.executive_1_status === 'approved' ? (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                                              ) : item.executive_1_status === 'rejected' ? (
                                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                              ) : (
                                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                              )}
                                            </div>
                                            <div className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border inline-block mb-1 ${
                                              item.executive_1_status === 'approved' 
                                                ? 'text-indigo-700 bg-indigo-50 border-indigo-200' 
                                                : item.executive_1_status === 'rejected'
                                                ? 'text-rose-700 bg-rose-50 border-rose-200'
                                                : 'text-slate-600 bg-slate-100 border-slate-200'
                                            }`}>
                                              {item.executive_1_status === 'approved' ? 'Disetujui' : item.executive_1_status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                                            </div>
                                            <div className="text-[10px] text-slate-600 truncate" title={item.executive_1_actor?.nama || '-'}>
                                              ACC: {item.executive_1_actor?.nama || '-'}
                                            </div>
                                            <div className="text-[9.5px] text-slate-400 mt-0.5">
                                              {item.executive_1_acted_at ? formatDateTime(item.executive_1_acted_at, false) : '-'}
                                            </div>
                                            {item.executive_1_note && (
                                              <div className="text-[9.5px] text-rose-600 font-medium mt-1 truncate" title={item.executive_1_note}>
                                                Note: {item.executive_1_note}
                                              </div>
                                            )}
                                          </div>

                                          {/* Step 4: Finance Review */}
                                          <div className={`rounded-lg p-2.5 border ${
                                            item.finance_selected 
                                              ? 'bg-blue-50/50 border-blue-200' 
                                              : item.final_status === 'pending_finance_outstanding'
                                              ? 'bg-amber-50/50 border-amber-200'
                                              : 'bg-slate-50 border-slate-200/80'
                                          }`}>
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="text-[11px] font-bold text-slate-700">4. Review Finance</span>
                                              {item.finance_selected ? (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                                              ) : item.final_status === 'pending_finance_outstanding' ? (
                                                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                                              ) : (
                                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                              )}
                                            </div>
                                            <div className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border inline-block mb-1 ${
                                              item.finance_selected 
                                                ? 'text-blue-700 bg-blue-50 border-blue-200' 
                                                : item.final_status === 'pending_finance_outstanding'
                                                ? 'text-amber-800 bg-amber-50 border-amber-300'
                                                : 'text-slate-600 bg-slate-100 border-slate-200'
                                            }`}>
                                              {item.finance_selected ? 'Dipilih Finance' : item.final_status === 'pending_finance_outstanding' ? 'Ditunda Finance' : 'Menunggu'}
                                            </div>
                                            <div className="text-[10px] text-slate-600 truncate" title={item.finance_actor?.nama || (batch.finance_actor?.nama || '-')}>
                                              ACC: {item.finance_actor?.nama || (batch.finance_actor?.nama || '-')}
                                            </div>
                                            <div className="text-[9.5px] text-slate-400 mt-0.5">
                                              {item.finance_acted_at ? formatDateTime(item.finance_acted_at, false) : (batch.finance_reviewed_at ? formatDateTime(batch.finance_reviewed_at, false) : '-')}
                                            </div>
                                          </div>

                                          {/* Step 5: Exec Final */}
                                          <div className={`rounded-lg p-2.5 border ${
                                            ['ready_to_pay', 'executive_approved', 'paid'].includes(item.final_status)
                                              ? 'bg-emerald-50/50 border-emerald-200'
                                              : item.executive_status === 'rejected'
                                              ? 'bg-rose-50/50 border-rose-200'
                                              : 'bg-slate-50 border-slate-200/80'
                                          }`}>
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="text-[11px] font-bold text-slate-700">5. Exec Final</span>
                                              {['ready_to_pay', 'executive_approved', 'paid'].includes(item.final_status) ? (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                              ) : item.executive_status === 'rejected' ? (
                                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                              ) : (
                                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                              )}
                                            </div>
                                            <div className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border inline-block mb-1 ${
                                              ['ready_to_pay', 'executive_approved', 'paid'].includes(item.final_status)
                                                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                                : item.executive_status === 'rejected'
                                                ? 'text-rose-700 bg-rose-50 border-rose-200'
                                                : 'text-slate-600 bg-slate-100 border-slate-200'
                                            }`}>
                                              {['ready_to_pay', 'executive_approved', 'paid'].includes(item.final_status) ? 'Siap Bayar' : item.executive_status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                                            </div>
                                            <div className="text-[10px] text-slate-600 truncate" title={item.executive_actor?.nama || '-'}>
                                              ACC: {item.executive_actor?.nama || '-'}
                                            </div>
                                            <div className="text-[9.5px] text-slate-400 mt-0.5">
                                              {item.executive_acted_at ? formatDateTime(item.executive_acted_at, false) : '-'}
                                            </div>
                                            {item.executive_note && (
                                              <div className="text-[9.5px] text-rose-600 font-medium mt-1 truncate" title={item.executive_note}>
                                                Note: {item.executive_note}
                                              </div>
                                            )}
                                          </div>

                                          {/* Step 6: Transfer Lunas */}
                                          <div className={`rounded-lg p-2.5 border ${
                                            item.final_status === 'paid'
                                              ? 'bg-green-50/50 border-green-200'
                                              : 'bg-slate-50 border-slate-200/80'
                                          }`}>
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="text-[11px] font-bold text-slate-700">6. Transfer Lunas</span>
                                              {item.final_status === 'paid' ? (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                              ) : (
                                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                              )}
                                            </div>
                                            <div className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border inline-block mb-1 ${
                                              item.final_status === 'paid'
                                                ? 'text-green-800 bg-green-100 border-green-300'
                                                : 'text-slate-600 bg-slate-100 border-slate-200'
                                            }`}>
                                              {item.final_status === 'paid' ? 'Lunas Ditransfer' : 'Belum Ditransfer'}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-800">
                                              Rp {Number(item.actual_transfer || item.nominal || 0).toLocaleString()}
                                            </div>
                                            <div className="text-[9.5px] text-slate-400 mt-0.5">
                                              {batch.transfer_date ? formatDateTime(batch.transfer_date, false) : (item.final_status === 'paid' ? 'Selesai' : '-')}
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* 3. Data Grid: Detail Kreator, Rekening & Kontak */}
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Card 1: Data Kreator */}
                                        <div className="bg-slate-50/80 rounded-lg p-3.5 border border-slate-200/70 space-y-2">
                                          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                                            <User className="w-3.5 h-3.5 text-blue-600" />
                                            <span>Data Kreator & Deliverable</span>
                                          </div>
                                          <div className="space-y-1.5 text-xs">
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Username:</span>
                                              <span className="font-semibold text-slate-800">@{item.campaign_creators?.creators?.username || '-'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Nama Lengkap (KTP):</span>
                                              <span className="font-medium text-slate-800">{item.campaign_creators?.creators?.nama_asli || item.nama_penerima || '-'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Tier / Target:</span>
                                              <span className="font-medium text-slate-800">
                                                Tier {item.campaign_creators?.tier || '-'} • {item.campaign_creators?.qty_vt ? `${item.campaign_creators.qty_vt} VT` : '-'}
                                              </span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Tipe Pembayaran:</span>
                                              <span className="font-medium text-slate-800">
                                                {item.payment_type === '50_awal' ? 'Termin 1 (DP 50%)' :
                                                 item.payment_type === '50_akhir' ? 'Termin 2 (Pelunasan 50%)' :
                                                 item.payment_type === '100_awal' ? '100% Pembayaran di Awal' :
                                                 item.payment_type === '100_akhir' ? '100% Pelunasan di Akhir' :
                                                 item.payment_type || '-'}
                                              </span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Ratecard Awal:</span>
                                              <span className="font-semibold text-slate-800">Rp {Number(item.ratecard_awal || 0).toLocaleString()}</span>
                                            </div>
                                            {item.payment_type === '50_awal' && (
                                              <div className="flex justify-between text-indigo-700 bg-indigo-50/70 p-1.5 rounded text-[11px] font-semibold border border-indigo-100">
                                                <span>Sisa Termin 2:</span>
                                                <span>Rp {(Number(item.ratecard_awal || (Number(item.nominal) * 2)) - Number(item.nominal)).toLocaleString()}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* Card 2: Rekening & Finansial */}
                                        <div className="bg-slate-50/80 rounded-lg p-3.5 border border-slate-200/70 space-y-2">
                                          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                                            <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>Detail Rekening & Transfer</span>
                                          </div>
                                          <div className="space-y-1.5 text-xs">
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Bank / Provider:</span>
                                              <span className="font-semibold text-slate-800">{item.metode_pembayaran || item.creator_bank_accounts?.bank_name || '-'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Nomor Rekening:</span>
                                              <span className="font-mono font-bold text-slate-800 select-all">{item.nomor_rekening || item.creator_bank_accounts?.account_number || '-'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Atas Nama:</span>
                                              <span className="font-semibold text-slate-800">{item.nama_penerima || item.creator_bank_accounts?.account_holder || '-'}</span>
                                            </div>
                                            <div className="flex justify-between pt-1 border-t border-slate-200/60">
                                              <span className="text-slate-500">Nominal Tagihan:</span>
                                              <span className="font-semibold text-slate-800">Rp {Number(item.nominal).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Biaya Transfer:</span>
                                              <span className="font-medium text-slate-600">Rp {Number(item.biaya_transfer || 0).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-emerald-800 bg-emerald-50/70 p-1.5 rounded text-[11px] font-bold border border-emerald-100">
                                              <span>Total Ditransfer:</span>
                                              <span>Rp {(Number(item.nominal || 0) + Number(item.biaya_transfer || 0)).toLocaleString()}</span>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Card 3: Kontak & Legalitas */}
                                        <div className="bg-slate-50/80 rounded-lg p-3.5 border border-slate-200/70 space-y-2">
                                          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                                            <Phone className="w-3.5 h-3.5 text-amber-600" />
                                            <span>Kontak PIC & Legalitas</span>
                                          </div>
                                          <div className="space-y-1.5 text-xs">
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">PIC WA:</span>
                                              <span className="font-medium text-slate-800">{item.nama_wa_pic || '-'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">No. WA Dealing:</span>
                                              <span className="font-medium text-slate-800 select-all">{item.nomor_wa_dealing || '-'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">NIK:</span>
                                              <span className="font-mono text-slate-700">{item.nik || '-'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Alamat KTP:</span>
                                              <span className="font-medium text-slate-700 truncate max-w-[170px]" title={item.alamat_ktp || '-'}>
                                                {item.alamat_ktp || '-'}
                                              </span>
                                            </div>
                                            <div className="flex justify-between pt-1 border-t border-slate-200/60">
                                              <span className="text-slate-500">Dokumen KTP:</span>
                                              {item.link_ktp ? (
                                                <a href={item.link_ktp} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold">
                                                  <ExternalLink className="w-3 h-3" /> Lihat KTP
                                                </a>
                                              ) : (
                                                <span className="text-slate-400">Tidak ada</span>
                                              )}
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-slate-500">Dokumen Kontrak:</span>
                                              {item.link_kontrak ? (
                                                <a href={item.link_kontrak} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold">
                                                  <ExternalLink className="w-3 h-3" /> Lihat Kontrak
                                                </a>
                                              ) : (
                                                <span className="text-slate-400">Tidak ada</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* 4. Catatan & Notes */}
                                      {(item.notes || item.manager_note || item.executive_note || item.executive_1_note) && (
                                        <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200/80 space-y-1.5">
                                          <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                                            <FileText className="w-3.5 h-3.5 text-amber-700" />
                                            <span>Catatan Khusus (Notes)</span>
                                          </div>
                                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                            {item.notes && (
                                              <div className="bg-white p-2 rounded border border-amber-100">
                                                <span className="font-bold text-slate-700 block text-[11px]">Catatan Pengajuan:</span>
                                                <span className="text-slate-600">{item.notes}</span>
                                              </div>
                                            )}
                                            {item.manager_note && (
                                              <div className="bg-white p-2 rounded border border-amber-100">
                                                <span className="font-bold text-purple-700 block text-[11px]">Catatan Manager:</span>
                                                <span className="text-slate-600">{item.manager_note}</span>
                                              </div>
                                            )}
                                            {(item.executive_note || item.executive_1_note) && (
                                              <div className="bg-white p-2 rounded border border-amber-100">
                                                <span className="font-bold text-indigo-700 block text-[11px]">Catatan Executive:</span>
                                                <span className="text-slate-600">{item.executive_note || item.executive_1_note}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
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
          <div className="font-semibold text-slate-800 text-center sm:text-left flex items-center gap-4 divide-x divide-slate-200">
            <div>
              <div className="text-xs text-slate-500 font-medium">Terpilih</div>
              <div className="text-base font-bold text-slate-800">{selectedItems.size} Tagihan</div>
            </div>
            <div className="pl-4">
              <div className="text-xs text-slate-500 font-medium">Total Nominal</div>
              <div className="text-base font-bold text-emerald-600">Rp {selectedTotalNominal.toLocaleString('id-ID')}</div>
            </div>
          </div>
          
          <div className="flex flex-wrap justify-center gap-3">
            {(subTab === 'exec_review_1' || subTab === 'exec_final' || subTab === 'manager_review' || role === 'manager') ? (
              <button
                onClick={handleBulkApproveExecMgr}
                disabled={isSubmitting}
                className="btn btn-primary px-8 py-2.5 text-base shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                Approve {selectedItems.size} Tagihan (Rp {selectedTotalNominal.toLocaleString('id-ID')}) {
                  subTab === 'manager_review' ? '(Sebagai Manager)' : 
                  subTab === 'exec_review_1' ? '(Tahap 2: Review 1 Exec)' : 
                  subTab === 'exec_final' ? '(Tahap 4: Final Exec)' : ''
                }
              </button>
            ) : subTab === 'review' ? (
              <>
                <button
                  onClick={() => handleFinanceReview('approve')}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" /> Approve ({selectedItems.size} • Rp {selectedTotalNominal.toLocaleString('id-ID')})
                </button>
                <button
                  onClick={() => handleFinanceReview('pending')}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2"
                >
                  <Calendar className="w-5 h-5" /> Tunda ({selectedItems.size})
                </button>
                <button
                  onClick={() => handleFinanceReview('reject')}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-bold shadow-lg shadow-rose-500/20 transition-all flex items-center gap-2"
                >
                  <ShieldAlert className="w-5 h-5" /> Reject ({selectedItems.size})
                </button>
              </>
            ) : subTab === 'transfer' ? (
              <button
                onClick={() => setShowTransferModal(true)}
                disabled={isSubmitting}
                className="btn btn-primary px-8 py-2.5 text-base shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                <Send className="w-5 h-5" /> Tandai Lunas ({selectedItems.size} Tagihan • Rp {selectedTotalNominal.toLocaleString('id-ID')})
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
              <div>
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <Send className="w-5 h-5 text-blue-600" />
                  Tandai Lunas {selectedItems.size} Tagihan
                </h3>
                <div className="text-xs font-semibold text-emerald-600 mt-1">
                  Total Nominal: Rp {selectedTotalNominal.toLocaleString('id-ID')}
                </div>
              </div>
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
                <p className="text-xs text-slate-500 mt-1.5">Satu bukti transfer ini akan terpasang ke {selectedItems.size} tagihan sekaligus senilai total Rp {selectedTotalNominal.toLocaleString('id-ID')}.</p>
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
