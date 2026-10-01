"use client";

import React, { useState, useEffect } from "react";
import { 
  managerApproveItem, managerRejectItem, managerFinalizeReview, 
  executiveApproveItem1, executiveRejectItem1, executiveFinalizeReview1,
  financeToggleItem, financeSubmitToExecutive, financeMarkPaid, 
  executiveApproveItem, executiveRejectItem, executiveFinalizeReview,
  deletePaymentItem, deletePaymentBatch, updatePaymentItem, submitBatchToManager, revertBatchStatus, financeBulkMarkPaidItems
} from "../../actions/paymentActions";
import { getLogicalStatus } from "@/utils/statusHelper";
import { sumNum } from "@/utils/computed";
import { useAuth } from "@/providers/AuthProvider";
import { Check, X, Loader2, ArrowLeft, Send, Trash2, Pencil, Save, ChevronDown, ChevronRight, Download, Upload, Clock, UserCheck, ShieldCheck, History, ExternalLink, Link as LinkIcon } from "lucide-react";
import { formatDateTime, formatUserWithRole } from "@/utils/formatters";
import * as XLSX from "xlsx";

export function BatchDetail({ batch, creatorHistory, onBack, onRefresh, onRefreshList }: { batch: any, creatorHistory: Record<number, any[]>, onBack: () => void, onRefresh: () => void, onRefreshList?: () => void }) {
  const { profile } = useAuth();
  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<number | null>(null);

  // Edit Form State (Modal)
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  // Finance Inline Edit State
  const [financeEdits, setFinanceEdits] = useState<Record<number, { actual_transfer: string, biaya_transfer: string }>>({});


  const [savingFinanceId, setSavingFinanceId] = useState<number | null>(null);

  // Mark Paid form state
  const [showPaidForm, setShowPaidForm] = useState(false);
  const [payDate, setPayDate] = useState("");
  const [buktiUrl, setBuktiUrl] = useState("");

  // Accordion state
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Excel bulk import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedIds, setImportedIds] = useState<number[]>([]);
  const toggleRow = (id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAction = async (id: number | string, action: () => Promise<void>) => {
    setLoadingIds(prev => ({ ...prev, [id]: true }));
    try {
      await action();
      await onRefresh();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoadingIds(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleFinanceSave = async (id: number) => {
    const edits = financeEdits[id];
    if (!edits) return;
    setSavingFinanceId(id);
    try {
      const { financeUpdateAmounts } = await import('../../actions/paymentActions');
      const cleanActual = edits.actual_transfer ? edits.actual_transfer.replace(/[^0-9]/g, '') : '';
      const actualTransfer = cleanActual !== '' ? Number(cleanActual) : null;
      const cleanBiaya = edits.biaya_transfer ? edits.biaya_transfer.replace(/[^0-9]/g, '') : '0';
      const biayaTransfer = Number(cleanBiaya) || 0;
      await financeUpdateAmounts(id, actualTransfer, biayaTransfer);
      await onRefresh();
      
      // Clear edit state for this item
      setFinanceEdits(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err: any) {
      alert("Gagal menyimpan: " + err.message);
    } finally {
      setSavingFinanceId(null);
    }
  };

  const handleFinalize = async (action: () => Promise<void>) => {
    if (!confirm("Yakin ingin menyelesaikan review dan submit ke tahap selanjutnya?")) return;
    setIsFinalizing(true);
    try {
      await action();
      await onRefresh();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleFinanceRequestApproval = async () => {
    if (!confirm("Yakin ingin menyelesaikan review dan submit ke tahap selanjutnya?")) return;
    
    setIsFinalizing(true);
    try {
      const pendingEditsCount = Object.keys(financeEdits).length;
      if (pendingEditsCount > 0) {
        const { financeUpdateAmounts } = await import('../../actions/paymentActions');
        for (const idStr of Object.keys(financeEdits)) {
          const id = Number(idStr);
          const edits = financeEdits[id];
          const cleanActual = edits.actual_transfer ? edits.actual_transfer.replace(/[^0-9]/g, '') : '';
          const actualTransfer = cleanActual !== '' ? Number(cleanActual) : null;
          const cleanBiaya = edits.biaya_transfer ? edits.biaya_transfer.replace(/[^0-9]/g, '') : '0';
          const biayaTransfer = Number(cleanBiaya) || 0;
          await financeUpdateAmounts(id, actualTransfer, biayaTransfer);
        }
        setFinanceEdits({});
      }
      await financeSubmitToExecutive(batch.id);
      await onRefresh();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleSubmitDraft = async () => {
    if (!confirm("Ajukan batch ini ke Manager untuk di-review?")) return;
    handleAction('submit_draft', async () => {
      await submitBatchToManager(batch.id);
    });
  };

  const handleRejectSubmit = async () => {
    if (!rejectingId || !rejectReason) return;
    const action = batch.status === 'pending_manager' 
      ? () => managerRejectItem(rejectingId, rejectReason)
      : () => executiveRejectItem(rejectingId, rejectReason);
    
    await handleAction(rejectingId, action);
    setRejectingId(null);
    setRejectReason("");
  };

  const handleRevertStatus = async () => {
    let confirmMsg = "";
    if (batch.status === 'pending_finance') confirmMsg = "Kembalikan batch ini ke tahap Manager Review?";
    else if (batch.status === 'pending_executive') confirmMsg = "Kembalikan batch ini ke tahap Finance Review?";
    else if (batch.status === 'ready_to_pay') confirmMsg = "Kembalikan batch ini ke tahap Executive Approval?";
    
    if (!confirm(confirmMsg)) return;
    
    setIsFinalizing(true);
    try {
      await revertBatchStatus(batch.id);
      await onRefresh();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!payDate || !buktiUrl) return alert("Lengkapi data pembayaran");
    setIsFinalizing(true);
    try {
      await financeMarkPaid(batch.id, {
        actualPaymentDate: payDate,
        buktiTransferUrl: buktiUrl,
        senderAccountId: 1
      });
      await onRefresh();
      setShowPaidForm(false);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleBulkMarkPaid = async () => {
    if (!payDate || !buktiUrl) return alert("Lengkapi data pembayaran");
    setIsFinalizing(true);
    try {
      await financeBulkMarkPaidItems(batch.id, importedIds, {
        actualPaymentDate: payDate,
        buktiTransferUrl: buktiUrl,
        senderAccountId: 1
      });
      await onRefresh();
      setShowImportModal(false);
      setImportedIds([]);
      setPayDate("");
      setBuktiUrl("");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleExportExcel = () => {
    const data = (batch.payment_items || []).map((item: any) => {
      const bank = item.creator_bank_accounts;
      const bankName = bank?.bank_name || item.metode_pembayaran || '';
      const accNumber = bank?.account_number || item.nomor_rekening || '';
      const accHolder = bank?.account_holder || item.nama_penerima || '';
      const totalTrx = Number(item.nominal || 0) + Number(item.biaya_transfer || 0);
      
      return {
        "ID Sistem": item.id,
        "Kreator": item.payment_type === 'ads' ? 'TOP UP ADS' : item.campaign_creators?.creators?.username,
        "Tipe Pembayaran": item.payment_type === 'ads' ? 'TOP UP ADS' : (item.payment_type?.replace('_', ' ') || '-'),
        "Nominal": Number(item.nominal || 0),
        "Biaya Transfer": Number(item.biaya_transfer || 0),
        "Total Ditransfer": totalTrx,
        "Bank / Metode": bankName,
        "Nomor Rekening": accNumber,
        "Atas Nama": accHolder,
        "Status Pembayaran": item.final_status
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Pembayaran");
    XLSX.writeFile(wb, `Batch_${batch.batch_label}_Export.xlsx`);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      const idsToPay: number[] = [];
      data.forEach((row: any) => {
        const id = row["ID Sistem"];
        const status = String(row["Status Pembayaran"] || "").toUpperCase();
        if (id && (status === 'PAID' || status === 'DIBAYAR' || status === 'SUDAH DIBAYAR')) {
          const existingItem = batch.payment_items?.find((i: any) => i.id === id);
          if (existingItem && existingItem.final_status !== 'paid') {
            idsToPay.push(id);
          }
        }
      });

      if (idsToPay.length > 0) {
        setImportedIds(idsToPay);
        setShowImportModal(true);
      } else {
        alert("Tidak ditemukan baris dengan status 'PAID' yang baru (atau ID tidak valid).");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleDeleteBatch = async () => {
    if (batch.status === 'paid' && profile?.role !== 'executive' && profile?.role !== 'admin') {
      alert("Akses Ditolak: Batch yang sudah berstatus PAID hanya dapat dihapus oleh Executive atau Admin.");
      return;
    }
    if (!confirm("YAKIN INGIN MENGHAPUS BATCH INI BESERTA SELURUH ITEM DI DALAMNYA? Data yang dihapus tidak bisa dikembalikan.")) return;
    setIsFinalizing(true);
    try {
      await deletePaymentBatch(batch.id);
      if (onRefreshList) onRefreshList();
      onBack();
    } catch (err: any) {
      alert("Gagal menghapus batch: " + err.message);
      setIsFinalizing(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!confirm("Yakin ingin menghapus kreator ini dari batch?")) return;
    handleAction(itemId, async () => {
      await deletePaymentItem(itemId);
    });
  };

  const handleOpenEdit = (item: any) => {
    const cr = item.campaign_creators?.creators;
    setEditingItemId(item.id);
    setEditForm({
      payment_type: item.payment_type || '100_akhir',
      nominal: item.nominal || 0,
      biaya_transfer: item.biaya_transfer || 0,
      metode_pembayaran: item.metode_pembayaran || item.creator_bank_accounts?.bank_name || '',
      nomor_rekening: item.nomor_rekening || item.creator_bank_accounts?.account_number || '',
      nama_penerima: item.nama_penerima || item.creator_bank_accounts?.account_holder || '',
      nama_wa_pic: item.nama_wa_pic || cr?.nama_wa_pic || '',
      nomor_wa_dealing: item.nomor_wa_dealing || cr?.nomor_wa_dealing || '',
      alamat_ktp: item.alamat_ktp || cr?.alamat_ktp || '',
      nik: item.nik || cr?.nik || '',
      link_ktp: item.link_ktp || cr?.link_ktp || '',
      link_kontrak: item.link_kontrak || cr?.link_kontrak || '',
      bank_account_id: item.bank_account_id || '' // If they edit bank details we'll nullify this to force manual update
    });
  };

  const handleSaveEditItem = async () => {
    if (!editingItemId) return;
    
    // If user edited the bank details manually, we clear bank_account_id so backend processes it as manual entry
    let finalBankId = editForm.bank_account_id;
    const originalItem = batch.payment_items.find((i: any) => i.id === editingItemId);
    const originalBankName = originalItem?.metode_pembayaran || originalItem?.creator_bank_accounts?.bank_name || '';
    const originalRekening = originalItem?.nomor_rekening || originalItem?.creator_bank_accounts?.account_number || '';
    
    if (editForm.metode_pembayaran !== originalBankName || editForm.nomor_rekening !== originalRekening) {
      finalBankId = null;
    }

    const payload = {
      ...editForm,
      bank_account_id: finalBankId
    };

    handleAction(editingItemId, async () => {
      await updatePaymentItem(editingItemId, payload);
      setEditingItemId(null);
    });
  };

  const canEditOrDelete = batch.status === 'draft' || batch.status === 'cancelled';


  const groupedItems = {
    pending_manager: [] as any[],
    pending_executive_1: [] as any[],
    pending_finance: [] as any[],
    pending_executive: [] as any[],
    ready_to_pay: [] as any[],
    paid: [] as any[],
    rejected: [] as any[]
  };

  (batch.payment_items || []).forEach((item: any) => {
    const status = getLogicalStatus(item);
    if (status === 'draft') {
        groupedItems.pending_manager.push(item);
    } else if (status === 'manager_approved') {
        groupedItems.pending_executive_1.push(item);
    } else if (status === 'executive_1_approved') {
        groupedItems.pending_finance.push(item);
    } else if (status === 'finance_selected') {
        groupedItems.pending_executive.push(item);
    } else if (status === 'executive_approved') {
        groupedItems.ready_to_pay.push(item);
    } else if (status === 'paid') {
        groupedItems.paid.push(item);
    } else if (status === 'rejected' || status === 'cancelled') {
        groupedItems.rejected.push(item);
    } else if (status === 'pending_finance_outstanding') {
        if (!groupedItems.pending_finance_outstanding) groupedItems.pending_finance_outstanding = [];
        groupedItems.pending_finance_outstanding.push(item);
    } else {
        groupedItems.pending_manager.push(item);
    }
  });

  const getGroupTitle = (key: string, count: number) => {
    const titles: Record<string, string> = {
      pending_manager: 'Menunggu Manager',
      pending_executive_1: 'Menunggu Executive 1',
      pending_finance: 'Menunggu Finance',
      pending_executive: 'Menunggu Executive Final',
      ready_to_pay: 'Siap Transfer',
      paid: 'Selesai Dibayar',
      rejected: 'Ditolak / Dibatalkan',
      pending_finance_outstanding: 'Ditunda Finance (Outstanding)'
    };
    return `${titles[key] || key} (${count} Kreator)`;
  };

  return (
    <div className="space-y-6 relative">
      <button onClick={onBack} className="btn btn-outline flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Kembali
      </button>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-8">
        <div className="flex justify-between items-start border-b border-slate-100 pb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
              {batch.batch_label}
              {!(batch.status === 'paid' && profile?.role !== 'executive' && profile?.role !== 'admin') && (
                <button 
                  onClick={handleDeleteBatch} 
                  disabled={isFinalizing}
                  className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                  title="Hapus Batch"
                >
                  {isFinalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              )}
            </h2>
            <p className="text-sm text-slate-500 mt-1">Campaign: {batch.campaigns?.nama}</p>
          </div>
          <div className="text-right flex flex-col items-end gap-2">
            <p className="text-sm font-semibold text-slate-700">Total Nominal: Rp {(batch.payment_items || []).reduce((acc: number, item: any) => {
              const base = item.actual_transfer != null ? Number(item.actual_transfer) : Number(item.nominal || 0);
              return acc + base + Number(item.biaya_transfer || 0);
            }, 0).toLocaleString()}</p>
            <div className="flex gap-2 justify-end text-xs items-center flex-wrap">
              <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded font-semibold">Diajukan: {(batch.payment_items || []).length}</span>
              {(batch.payment_items || []).filter((i: any) => i.final_status === 'paid').length > 0 && (
                <span className="bg-green-100 text-green-700 px-2 py-1 rounded font-semibold">Dibayar: {(batch.payment_items || []).filter((i: any) => i.final_status === 'paid').length}</span>
              )}
              {(batch.payment_items || []).filter((i: any) => i.final_status === 'rejected' || i.final_status === 'cancelled').length > 0 && (
                <span className="bg-red-100 text-red-700 px-2 py-1 rounded font-semibold">Ditolak: {(batch.payment_items || []).filter((i: any) => i.final_status === 'rejected' || i.final_status === 'cancelled').length}</span>
              )}
              {batch.bukti_transfer_url && (
                <a
                  href={batch.bukti_transfer_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded font-semibold transition-colors"
                  title="Buka Link Google Drive Bukti Transfer"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Bukti Transfer (GDrive)
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Audit Trail Timeline */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <History className="w-4 h-4 text-blue-600" />
            Riwayat & Jejak Persetujuan (Audit Trail)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            {/* 1. Pengajuan */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 mb-1">1. Pengajuan Awal</div>
              <div className="font-bold text-slate-800 truncate" title={batch.submitter?.nama}>
                {batch.submitter?.nama ? formatUserWithRole(batch.submitter.nama, batch.submitter.role) : '-'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                {batch.submitted_at || batch.created_at ? formatDateTime(batch.submitted_at || batch.created_at) : '-'}
              </div>
            </div>

            {/* 2. Manager Review */}
            <div className={`p-3 rounded-lg border shadow-sm ${batch.manager_reviewed_at ? 'bg-white border-slate-200' : 'bg-slate-50/70 border-dashed border-slate-200 text-slate-400'}`}>
              <div className="text-[11px] font-semibold text-slate-500 mb-1">2. Review Manager</div>
              <div className="font-bold text-slate-800 truncate" title={batch.manager?.nama}>
                {batch.manager?.nama ? formatUserWithRole(batch.manager.nama, batch.manager.role) : (batch.manager_reviewed_at ? 'Disetujui' : 'Menunggu')}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                {batch.manager_reviewed_at ? formatDateTime(batch.manager_reviewed_at) : '-'}
              </div>
            </div>

            {/* 3. Finance Review */}
            <div className={`p-3 rounded-lg border shadow-sm ${batch.finance_reviewed_at ? 'bg-white border-slate-200' : 'bg-slate-50/70 border-dashed border-slate-200 text-slate-400'}`}>
              <div className="text-[11px] font-semibold text-slate-500 mb-1">3. Review Finance</div>
              <div className="font-bold text-slate-800 truncate" title={batch.finance?.nama}>
                {batch.finance?.nama ? formatUserWithRole(batch.finance.nama, batch.finance.role) : (batch.finance_reviewed_at ? 'Direview' : 'Menunggu')}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                {batch.finance_reviewed_at ? formatDateTime(batch.finance_reviewed_at) : '-'}
              </div>
            </div>

            {/* 4. Executive Final Approval */}
            <div className={`p-3 rounded-lg border shadow-sm ${batch.executive_reviewed_at ? 'bg-white border-slate-200' : 'bg-slate-50/70 border-dashed border-slate-200 text-slate-400'}`}>
              <div className="text-[11px] font-semibold text-slate-500 mb-1">4. Executive Approval</div>
              <div className="font-bold text-slate-800 truncate" title={batch.executive?.nama}>
                {batch.executive?.nama ? formatUserWithRole(batch.executive.nama, batch.executive.role) : (batch.executive_reviewed_at ? 'Disetujui' : 'Menunggu')}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                {batch.executive_reviewed_at ? formatDateTime(batch.executive_reviewed_at) : '-'}
              </div>
            </div>

            {/* 5. Pencairan / Lunas */}
            <div className={`p-3 rounded-lg border shadow-sm flex flex-col justify-between ${batch.paid_at || batch.status === 'paid' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50/70 border-dashed border-slate-200 text-slate-400'}`}>
              <div>
                <div className="text-[11px] font-semibold text-slate-500 mb-1">5. Pencairan (Paid)</div>
                <div className="font-bold text-slate-800 truncate">
                  {batch.paid_at || batch.status === 'paid' ? 'Selesai Dibayar' : 'Belum Ditransfer'}
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  {batch.paid_at ? formatDateTime(batch.paid_at) : '-'}
                </div>
              </div>
              {batch.bukti_transfer_url && (
                <div className="mt-2 pt-1.5 border-t border-emerald-200">
                  <a 
                    href={batch.bukti_transfer_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" /> Bukti Transfer (GDrive)
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        
        {/* Render Grouped Items */}
        <div className="space-y-8">
          {Object.entries(groupedItems).map(([groupKey, items]) => {
            if (items.length === 0) return null;
            
            let badgeColor = 'bg-slate-100 text-slate-700';
            if (groupKey === 'paid') badgeColor = 'bg-green-100 text-green-700';
            else if (groupKey === 'rejected' || groupKey === 'cancelled') badgeColor = 'bg-red-100 text-red-700';
            else if (groupKey.includes('finance')) badgeColor = 'bg-amber-100 text-amber-700';
            else if (groupKey === 'ready_to_pay') badgeColor = 'bg-emerald-100 text-emerald-700';
            else badgeColor = 'bg-blue-100 text-blue-700';
            
            return (
              <div key={groupKey} className="overflow-hidden border border-slate-200 rounded-lg shadow-sm">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    {getGroupTitle(groupKey, items.length)}
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${badgeColor}`}>
                    {groupKey.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white text-slate-500 font-medium border-b border-slate-100">
                      <tr>
                        <th className="px-3 py-3 w-10"></th>
                        <th className="px-4 py-3">Kreator</th>
                        <th className="px-4 py-3">Tipe Pemb.</th>
                        <th className="px-4 py-3 text-right">Ratecard / Final</th>
                        <th className="px-4 py-3 text-right">Biaya TF</th>
                        <th className="px-4 py-3 text-right">Total Transaksi</th>
                        <th className="px-4 py-3">PIC</th>
                        <th className="px-4 py-3">Rekening</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {items.map((item: any) => {

                const baseNominal = item.actual_transfer != null ? Number(item.actual_transfer) : Number(item.nominal || 0);
                const totalTrx = baseNominal + Number(item.biaya_transfer || 0);
                const bank = item.creator_bank_accounts;
                const isExpanded = expandedRows.has(item.id);
                
                const isFinanceReview = groupKey === 'pending_finance' && (profile?.role === 'finance' || profile?.role === 'executive');
                const currentFinanceEdit = financeEdits[item.id] || { 
                  actual_transfer: item.actual_transfer != null ? String(item.actual_transfer) : String(item.nominal || 0), 
                  biaya_transfer: String(item.biaya_transfer || 0) 
                };
                const hasFinanceChanges = financeEdits[item.id] !== undefined;

                return (
                  <React.Fragment key={item.id}>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-3 cursor-pointer text-slate-400 hover:text-slate-700" onClick={() => toggleRow(item.id)}>
                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      @{item.campaign_creators?.creators?.username}
                      {(() => {
                        if (!item.campaign_creator_id || item.payment_type === 'ads') return null;
                        const pastHistory = creatorHistory[item.campaign_creator_id] || [];
                        const types = [...pastHistory.map(h => h.payment_type), item.payment_type];
                        const isFullyPaid = types.includes('100_akhir') || (types.includes('50_awal') && types.includes('50_akhir'));
                        if (isFullyPaid) {
                          return <span className="text-[10px] font-semibold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded ml-2">Ratecard Lunas</span>;
                        }
                        return null;
                      })()}
                      <div className="text-xs text-slate-400 font-normal mt-0.5">{item.nama_penerima || bank?.account_holder}</div>
                      {item.notes && (
                        <div className="text-[10px] font-normal text-slate-500 mt-2 normal-case leading-tight max-w-[200px] bg-slate-50 p-1.5 rounded border border-slate-100">
                          <span className="font-semibold text-slate-600 block mb-0.5">Catatan PIC:</span> 
                          {item.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="uppercase font-bold text-slate-700">
                        {item.payment_type?.replace('_', ' ') || '-'}
                      </div>
                      {item.payment_type === '50_awal' && (
                        <div className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded mt-1 inline-block">
                          Termin 1 (DP 50%) • Kurang Rp {(Number(item.ratecard_awal || (baseNominal * 2)) - baseNominal).toLocaleString()} (Termin 2)
                        </div>
                      )}
                      {item.payment_type === '50_akhir' && (
                        <div className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded mt-1 inline-block">
                          Termin 2 (Pelunasan 50%)
                        </div>
                      )}
                      {item.payment_type === '100_akhir' && (
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                          Pelunasan Penuh 100%
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.ratecard_awal && <div className="text-xs text-slate-400 line-through">Rp {Number(item.ratecard_awal).toLocaleString()}</div>}
                      
                      {isFinanceReview ? (
                        <div className="mt-1">
                          <label className="text-[9px] text-slate-500 font-bold uppercase mb-0.5 block">Actual Transfer</label>
                          <input 
                            type="number" 
                            className="w-24 text-right border border-slate-300 rounded px-2 py-1 text-xs font-semibold focus:ring-1 focus:ring-blue-500 outline-none"
                            value={currentFinanceEdit.actual_transfer}
                            onChange={(e) => setFinanceEdits(prev => ({ ...prev, [item.id]: { ...currentFinanceEdit, actual_transfer: e.target.value } }))}
                            onBlur={() => hasFinanceChanges && handleFinanceSave(item.id)}
                          />
                        </div>
                      ) : (
                        <div className="font-semibold text-slate-700">Rp {baseNominal.toLocaleString()}</div>
                      )}

                      {creatorHistory && item.campaign_creator_id && creatorHistory[item.campaign_creator_id] && (() => {
                        const pastItems = creatorHistory[item.campaign_creator_id].filter((h: any) => h.id !== item.id && new Date(h.date) <= new Date(batch.created_at));
                        if (pastItems.length === 0) return null;
                        const total = sumNum(pastItems, (h: any) => h.nominal);
                        return (
                          <div className="text-[9px] text-blue-600 mt-1 leading-tight text-right flex flex-col items-end">
                            <span className="font-medium bg-blue-50 px-1 rounded border border-blue-100">Total Sblmnya: Rp {total.toLocaleString()}</span>
                            {pastItems.slice(-2).map((h: any, idx: number) => (
                              <span key={idx} className="text-slate-400 block truncate max-w-[150px]" title={`Dibayar Rp ${h.nominal.toLocaleString()} pd batch ${h.batch_label}`}>({h.payment_type}) {h.batch_label}</span>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {isFinanceReview ? (
                        <div className="mt-1">
                          <label className="text-[9px] text-slate-500 font-bold uppercase mb-0.5 block">Biaya TF</label>
                          <input 
                            type="number" 
                            className="w-20 text-right border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                            value={currentFinanceEdit.biaya_transfer}
                            onChange={(e) => setFinanceEdits(prev => ({ ...prev, [item.id]: { ...currentFinanceEdit, biaya_transfer: e.target.value } }))}
                            onBlur={() => hasFinanceChanges && handleFinanceSave(item.id)}
                          />
                        </div>
                      ) : (
                        `Rp ${Number(item.biaya_transfer || 0).toLocaleString()}`
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700">
                      {isFinanceReview ? (
                        <div className="flex flex-col items-end">
                           <span>Rp {(Number(currentFinanceEdit.actual_transfer) + Number(currentFinanceEdit.biaya_transfer)).toLocaleString()}</span>
                        </div>
                      ) : (
                        `Rp ${totalTrx.toLocaleString()}`
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 font-medium">
                      {item.campaign_creators?.profiles?.nama 
                        ? formatUserWithRole(item.campaign_creators.profiles.nama, item.campaign_creators.profiles.role) 
                        : (item.nama_wa_pic || item.campaign_creators?.creators?.nama_wa_pic 
                            ? (item.nama_wa_pic || item.campaign_creators?.creators?.nama_wa_pic)
                            : (batch.submitter?.nama 
                                ? formatUserWithRole(batch.submitter.nama, batch.submitter.role) 
                                : '-'))}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">
                      {bank ? (
                        <>
                          <span className="font-semibold">{bank.bank_name}</span><br/>
                          {bank.account_number}
                        </>
                      ) : (
                        <>
                          <span className="font-semibold">{item.metode_pembayaran}</span><br/>
                          {item.nomor_rekening}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        item.final_status === 'paid' ? 'bg-green-100 text-green-700' :
                        item.final_status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {item.final_status?.replace('_', ' ') || 'pending'}
                      </span>
                      {item.manager_note || item.executive_note ? (
                        <div className="text-[10px] text-red-500 mt-1 max-w-[150px] truncate" title={item.manager_note || item.executive_note}>
                          Note: {item.manager_note || item.executive_note}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-2">
                        {/* MANAGER ACTIONS */}
                        {(profile?.role === 'manager' || profile?.role === 'executive') && item.final_status === 'pending' && (
                          <div className="flex justify-center gap-2">
                            <button onClick={() => handleAction(item.id, () => managerApproveItem(item.id))} disabled={loadingIds[item.id]} className="p-1.5 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200">
                              {loadingIds[item.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button onClick={() => setRejectingId(item.id)} disabled={loadingIds[item.id]} className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {/* EXECUTIVE 1 ACTIONS */}
                        {profile?.role === 'executive' && item.final_status === 'manager_approved' && (
                          <div className="flex justify-center gap-2">
                            <button onClick={() => handleAction(item.id, () => executiveApproveItem1(item.id))} disabled={loadingIds[item.id]} className="p-1.5 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200">
                              {loadingIds[item.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button onClick={() => setRejectingId(item.id)} disabled={loadingIds[item.id]} className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {/* FINANCE ACTIONS */}
                        {(profile?.role === 'finance' || profile?.role === 'executive') && item.final_status === 'executive_1_approved' && (
                          <label className="flex items-center justify-center cursor-pointer">
                            <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                              onChange={(e) => handleAction(item.id, () => financeToggleItem(item.id, e.target.checked))} 
                              disabled={loadingIds[item.id]}
                            />
                          </label>
                        )}
                        {(profile?.role === 'finance' || profile?.role === 'executive') && getLogicalStatus(item) === 'finance_selected' && (
                          <label className="flex items-center justify-center cursor-pointer">
                            <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                              checked={true}
                              onChange={(e) => handleAction(item.id, () => financeToggleItem(item.id, e.target.checked))} 
                              disabled={loadingIds[item.id]}
                            />
                          </label>
                        )}

                        {/* EXECUTIVE ACTIONS */}
                        {profile?.role === 'executive' && getLogicalStatus(item) === 'finance_selected' && (
                          <div className="flex justify-center gap-2">
                            <button onClick={() => handleAction(item.id, () => executiveApproveItem(item.id))} disabled={loadingIds[item.id]} className="p-1.5 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200">
                              {loadingIds[item.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button onClick={() => setRejectingId(item.id)} disabled={loadingIds[item.id]} className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {/* GENERAL EDIT & DELETE ACTIONS (For draft / testing) */}
                        {canEditOrDelete && (
                          <div className="flex justify-center gap-2 mt-1">
                            <button onClick={() => handleOpenEdit(item)} disabled={loadingIds[item.id]} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="Edit Data Lengkap">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteItem(item.id)} disabled={loadingIds[item.id]} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Hapus Kreator dari Batch">
                              {loadingIds[item.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                  
                  {isExpanded && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={9} className="p-0 border-b border-slate-200">
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                          <div className="space-y-3">
                            <p className="font-semibold text-slate-700 border-b pb-1">Detail Administrasi</p>
                            <div className="grid grid-cols-3 gap-2">
                              {(() => {
                                const cr = item.campaign_creators?.creators;
                                const nik = item.nik || cr?.nik || '-';
                                const alamat = item.alamat_ktp || cr?.alamat_ktp || '-';
                                const picWa = item.nama_wa_pic || cr?.nama_wa_pic || '-';
                                const nomorWa = item.nomor_wa_dealing || cr?.nomor_wa_dealing || '-';
                                const linkKtp = item.link_ktp || cr?.link_ktp;
                                const linkKontrak = item.link_kontrak || cr?.link_kontrak;
                                const notes = item.notes || '-';

                                return (
                                  <>
                                    <span className="text-slate-500">NIK:</span>
                                    <span className="col-span-2 font-medium">{nik}</span>
                                    <span className="text-slate-500">Alamat KTP:</span>
                                    <span className="col-span-2 font-medium">{alamat}</span>
                                    <span className="text-slate-500">PIC WA:</span>
                                    <span className="col-span-2 font-medium">{picWa} ({nomorWa})</span>
                                    <span className="text-slate-500">Link KTP:</span>
                                    <span className="col-span-2 font-medium">{linkKtp ? <a href={linkKtp} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Lihat KTP</a> : '-'}</span>
                                    <span className="text-slate-500">Link Kontrak:</span>
                                    <span className="col-span-2 font-medium">{linkKontrak ? <a href={linkKontrak} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Lihat Kontrak</a> : '-'}</span>
                                    <span className="text-slate-500">Waktu Diajukan:</span>
                                    <span className="col-span-2 font-medium font-mono">{formatDateTime(item.created_at)}</span>
                                    {(item.paid_at || batch.paid_at) && (
                                      <>
                                        <span className="text-slate-500">Waktu Dibayar:</span>
                                        <span className="col-span-2 font-medium font-mono text-emerald-700">{formatDateTime(item.paid_at || batch.paid_at)}</span>
                                      </>
                                    )}
                                    {((item.final_status === 'paid' || batch.status === 'paid') && (item.bukti_transfer_url || batch.bukti_transfer_url)) && (
                                      <>
                                        <span className="text-slate-500 font-semibold text-blue-700">Bukti Transfer:</span>
                                        <span className="col-span-2 font-medium">
                                          <a 
                                            href={item.bukti_transfer_url || batch.bukti_transfer_url} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-semibold hover:bg-blue-100 hover:underline transition-colors"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5" /> Lihat Bukti Transfer
                                          </a>
                                        </span>
                                      </>
                                    )}
                                    <span className="text-slate-500">Catatan PIC:</span>
                                    <span className="col-span-2 font-medium text-orange-700 bg-orange-50 px-2 py-1 rounded">{notes}</span>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <p className="font-semibold text-slate-700 border-b pb-1">Detail Bank Lengkap</p>
                            <div className="grid grid-cols-3 gap-2">
                              <span className="text-slate-500">Nama Bank:</span>
                              <span className="col-span-2 font-medium">{bank ? bank.bank_name : (item.metode_pembayaran || '-')}</span>
                              <span className="text-slate-500">No. Rekening:</span>
                              <span className="col-span-2 font-medium">{bank ? bank.account_number : (item.nomor_rekening || '-')}</span>
                              <span className="text-slate-500">Atas Nama:</span>
                              <span className="col-span-2 font-medium">{bank ? bank.account_holder : (item.nama_penerima || '-')}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                )
              
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>


        {/* Action Bar */}
        <div className="flex justify-between items-center pt-6 border-t border-slate-100 flex-wrap gap-4">
          <div className="flex gap-2 items-center flex-wrap">
            {['pending_finance', 'pending_executive', 'ready_to_pay'].includes(batch.status) && (profile?.role === 'executive' || profile?.role === 'manager' || profile?.role === 'finance') && (
              <button onClick={handleRevertStatus} disabled={isFinalizing} className="btn btn-outline text-slate-600 hover:bg-slate-100 flex items-center gap-2 text-xs">
                {isFinalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeft className="w-4 h-4" />} Kembalikan
              </button>
            )}
            {batch.status === 'ready_to_pay' && (profile?.role === 'executive' || profile?.role === 'finance') && (
              <>
                <button onClick={handleExportExcel} className="btn btn-outline text-emerald-700 hover:bg-emerald-50 border-emerald-200 flex items-center gap-2 text-xs">
                  <Download className="w-4 h-4" /> Export Excel
                </button>
                <label className="btn btn-outline text-blue-700 hover:bg-blue-50 border-blue-200 flex items-center gap-2 text-xs cursor-pointer">
                  <Upload className="w-4 h-4" /> Import Update
                  <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleImportExcel} />
                </label>
              </>
            )}
          </div>
          <div className="flex gap-4">
            {batch.status === 'draft' && (
              <button onClick={handleSubmitDraft} disabled={loadingIds['submit_draft']} className="btn btn-primary flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
                {loadingIds['submit_draft'] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Ajukan ke Manager
              </button>
            )}
            {batch.status === 'pending_manager' && (profile?.role === 'manager' || profile?.role === 'executive') && (
              <button onClick={() => handleFinalize(() => managerFinalizeReview(batch.id))} disabled={isFinalizing} className="btn btn-primary flex items-center gap-2">
                {isFinalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Finalize Review & Submit ke Executive 1
              </button>
            )}
            {batch.status === 'pending_executive_1' && profile?.role === 'executive' && (
              <button onClick={() => handleFinalize(() => executiveFinalizeReview1(batch.id))} disabled={isFinalizing} className="btn btn-primary flex items-center gap-2">
                {isFinalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Finalize Review & Submit ke Finance
              </button>
            )}
            {batch.status === 'pending_finance' && (profile?.role === 'finance' || profile?.role === 'executive') && (
              <button onClick={handleFinanceRequestApproval} disabled={isFinalizing} className="btn btn-primary flex items-center gap-2">
                {isFinalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Request Approval Executive
              </button>
            )}
            {batch.status === 'pending_executive' && profile?.role === 'executive' && (
              <button onClick={() => handleFinalize(() => executiveFinalizeReview(batch.id))} disabled={isFinalizing} className="btn btn-primary flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700">
                {isFinalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Finalize & Tandai Siap Bayar
              </button>
            )}
            {batch.status === 'ready_to_pay' && (profile?.role === 'finance' || profile?.role === 'executive') && !showPaidForm && (
              <button onClick={() => setShowPaidForm(true)} className="btn btn-primary flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
                <Check className="w-4 h-4" /> Tandai Sudah Dibayar
              </button>
            )}
          </div>
        </div>

        {/* Paid Form */}
        {showPaidForm && (
          <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mt-4">
            <h3 className="font-bold text-slate-800 mb-4">Konfirmasi Pembayaran</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Aktual Transfer</label>
                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Link Bukti Transfer (GDrive)</label>
                <input type="url" placeholder="https://drive.google.com/..." value={buktiUrl} onChange={e => setBuktiUrl(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowPaidForm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-md">Batal</button>
              <button onClick={handleMarkPaid} disabled={isFinalizing} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center">
                {isFinalizing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />} Simpan Pembayaran
              </button>
            </div>
          </div>
        )}

      </div>

        {/* Import Confirm Form Modal */}
        {showImportModal && (
          <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-200 mt-4 shadow-inner">
            <h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
              <Upload className="w-5 h-5" /> Konfirmasi Import Pembayaran
            </h3>
            <p className="text-sm text-indigo-700 mb-4">Ditemukan <strong>{importedIds.length} item</strong> yang ditandai DIBAYAR di file Excel. Masukkan bukti transfer untuk menandai mereka selesai secara bersamaan.</p>
            
            {/* Rincian item yang akan diimport */}
            <div className="mb-4 bg-white border border-indigo-100 rounded-md overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-indigo-50 border-b border-indigo-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 font-medium text-indigo-900">Kreator</th>
                    <th className="px-3 py-2 font-medium text-indigo-900">Bank</th>
                    <th className="px-3 py-2 font-medium text-indigo-900">No. Rekening</th>
                    <th className="px-3 py-2 font-medium text-indigo-900">Atas Nama</th>
                    <th className="px-3 py-2 text-right font-medium text-indigo-900">Total Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {importedIds.map(id => {
                    const it = batch.payment_items?.find((i: any) => i.id === id);
                    if (!it) return null;
                    const b = it.creator_bank_accounts;
                    const bName = b?.bank_name || it.metode_pembayaran || '-';
                    const accNum = b?.account_number || it.nomor_rekening || '-';
                    const accHolder = b?.account_holder || it.nama_penerima || '-';
                    const totNominal = Number(it.nominal || 0) + Number(it.biaya_transfer || 0);
                    return (
                      <tr key={id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-700">@{it.campaign_creators?.creators?.username || '-'}</td>
                        <td className="px-3 py-2 text-slate-600">{bName}</td>
                        <td className="px-3 py-2 text-slate-600 font-mono">{accNum}</td>
                        <td className="px-3 py-2 text-slate-600">{accHolder}</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-700">Rp {totNominal.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Aktual Transfer</label>
                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Link Bukti Transfer (GDrive)</label>
                <input type="url" placeholder="https://drive.google.com/..." value={buktiUrl} onChange={e => setBuktiUrl(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => {setShowImportModal(false); setImportedIds([]);}} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-md">Batal</button>
              <button onClick={handleBulkMarkPaid} disabled={isFinalizing} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center">
                {isFinalizing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />} Simpan Pembayaran
              </button>
            </div>
          </div>
        )}

      {/* Edit Full Modal */}
      {editingItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-xl">
              <h3 className="text-xl font-bold text-slate-800">Edit Data Detail Kreator</h3>
              <button onClick={() => setEditingItemId(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-slate-700 border-b pb-2">Informasi Pembayaran</h4>
                  
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Tipe Pembayaran</label>
                    <select className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                      value={editForm.payment_type} onChange={e => setEditForm({...editForm, payment_type: e.target.value})}>
                      <option value="100_akhir">100% Akhir</option>
                      <option value="50_awal">50% Awal</option>
                      <option value="50_akhir">50% Akhir</option>
                      <option value="ads">Ads / Ekstra</option>
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Nominal (Rp)</label>
                      <input type="number" className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                        value={editForm.nominal} onChange={e => setEditForm({...editForm, nominal: Number(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Biaya Transfer (Rp)</label>
                      <input type="number" className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                        value={editForm.biaya_transfer} onChange={e => setEditForm({...editForm, biaya_transfer: Number(e.target.value)})} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Bank / E-Wallet</label>
                    <input type="text" className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                      placeholder="BCA / Mandiri / GoPay"
                      value={editForm.metode_pembayaran} onChange={e => setEditForm({...editForm, metode_pembayaran: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Nomor Rekening</label>
                    <input type="text" className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                      value={editForm.nomor_rekening} onChange={e => setEditForm({...editForm, nomor_rekening: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Penerima</label>
                    <input type="text" className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                      value={editForm.nama_penerima} onChange={e => setEditForm({...editForm, nama_penerima: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="font-semibold text-slate-700">Informasi Administrasi & Kontak</h4>
                    <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Sync Master</span>
                  </div>
                  
                  {/* Kontak WA PIC */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">Kontak WA PIC</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Nomor WA Dealing</label>
                        <input type="text" placeholder="08xxxxxxxxxx" className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                          value={editForm.nomor_wa_dealing} onChange={e => setEditForm({...editForm, nomor_wa_dealing: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Kontak WA PIC</label>
                        <input type="text" placeholder="Nama PIC Admin" className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                          value={editForm.nama_wa_pic} onChange={e => setEditForm({...editForm, nama_wa_pic: e.target.value})} />
                      </div>
                    </div>
                  </div>

                  {/* Identitas KTP */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">NIK (KTP)</label>
                      <input type="text" placeholder="16 digit NIK" className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                        value={editForm.nik} onChange={e => setEditForm({...editForm, nik: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Link KTP (GDrive)</label>
                      <input type="text" placeholder="https://drive.google.com/..." className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                        value={editForm.link_ktp} onChange={e => setEditForm({...editForm, link_ktp: e.target.value})} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Alamat Sesuai KTP</label>
                      <textarea placeholder="Alamat lengkap sesuai KTP" className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" rows={2}
                        value={editForm.alamat_ktp} onChange={e => setEditForm({...editForm, alamat_ktp: e.target.value})} />
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-100">
                      <label className="block text-xs font-bold text-indigo-900 mb-1">Link Kontrak (GDrive) *</label>
                      <input type="text" placeholder="https://drive.google.com/file/d/..." className="w-full p-2 border border-indigo-200 bg-indigo-50/30 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium" 
                        value={editForm.link_kontrak} onChange={e => setEditForm({...editForm, link_kontrak: e.target.value})} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
              <button onClick={() => setEditingItemId(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-md">Batal</button>
              <button onClick={handleSaveEditItem} disabled={loadingIds[editingItemId]} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2">
                {loadingIds[editingItemId] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
