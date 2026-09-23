"use client";

import React, { useState, useEffect } from "react";
import { createPaymentBatch, addPaymentItem, submitBatchToManager, getCreatorBankAccounts } from "../../actions/paymentActions";
import { Loader2, Plus, Trash2, Save, Send, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { formatRupiah } from "@/utils/formatters";

export interface OperationalItem {
  id: string;
  payment_type: string;
  nominal: number | '';
  metode_pembayaran: string;
  nomor_rekening: string;
  nama_penerima: string;
  notes_dari_pic: string;
}

export function BatchForm({ 
  campaignId, 
  creators, 
  creatorHistory, 
  initialItems, 
  isLoadingCreators = false,
  onCancel, 
  onSuccess 
}: { 
  campaignId: number, 
  creators: any[], 
  creatorHistory: Record<number, any[]>, 
  initialItems?: any[], 
  isLoadingCreators?: boolean,
  onCancel: () => void, 
  onSuccess: () => void 
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchLabel, setBatchLabel] = useState(`Batch - ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`);
  
  const [selectedCreators, setSelectedCreators] = useState<any[]>([]);
  const [forms, setForms] = useState<Record<number, any>>({});
  const [bankAccounts, setBankAccounts] = useState<Record<number, any[]>>({});
  const [loadingBanks, setLoadingBanks] = useState<Record<number, boolean>>({});

  const [operationalItems, setOperationalItems] = useState<OperationalItem[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showBulkSelect, setShowBulkSelect] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkStatusWarnings, setBulkStatusWarnings] = useState<{
    notFound: string[];
    pending: string[];
    notApproved: string[];
    alternate: string[];
    alreadyPending: string[];
    addedCount: number;
  }>({
    notFound: [],
    pending: [],
    notApproved: [],
    alternate: [],
    alreadyPending: [],
    addedCount: 0
  });

  const [showWarning, setShowWarning] = useState(false);
  const [pendingSubmitType, setPendingSubmitType] = useState<boolean | null>(null);

  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      initialItems.forEach(item => {
        const cc = creators.find(c => c.id === item.campaign_creator_id);
        if (cc) {
          handleToggleCreator(cc, true, item);
        }
      });
    }
  }, [initialItems]);

  const handleToggleCreator = async (cc: any, isChecked: boolean, prefill?: any) => {
    if (!isChecked) {
      handleRemoveCreator(cc.id);
      return;
    }

    if (cc.hasPendingPayment && !prefill) {
      alert(`Peringatan: @${cc.creators?.username} saat ini sedang ada pengajuan aktif di "${cc.pendingBatchLabel || 'Batch Lain'}". Tidak dapat diajukan ganda untuk menghindari double payment.`);
      return;
    }
    
    setSelectedCreators(prev => {
      if (prev.find(s => s.id === cc.id)) return prev;
      return [...prev, cc];
    });

    const creatorId = cc.creator_id || cc.creators?.id;
    const initialBanks = cc.creators?.creator_bank_accounts || bankAccounts[creatorId] || [];
    const primaryBank = initialBanks.find((b: any) => b.is_primary) || initialBanks[0];
    
    const defaultBankId = prefill?.bank_account_id || (primaryBank ? String(primaryBank.id) : '');
    const defaultMetode = prefill?.metode_pembayaran || (primaryBank ? primaryBank.bank_name : '');
    const defaultNomor = prefill?.nomor_rekening || (primaryBank ? primaryBank.account_number : '');
    const defaultPenerima = prefill?.nama_penerima || (primaryBank ? primaryBank.account_holder : (cc.creators?.nama_asli || ''));
    
    setForms(prev => {
      if (prev[cc.id]) return prev;
      const history = creatorHistory[cc.id] || [];
      const types = history.map((h: any) => h.payment_type);
      let defaultType = '100_akhir';
      if (types.includes('50_awal')) defaultType = '50_akhir';

      return {
        ...prev,
        [cc.id]: {
          campaign_creator_id: cc.id,
          payment_type: prefill?.payment_type || defaultType,
          ratecard_awal: cc.price || 0,
          nominal: prefill?.nominal || (defaultType === '50_akhir' ? (cc.price || 0) / 2 : (cc.price || 0)),
          biaya_transfer: 0,
          bank_account_id: defaultBankId,
          metode_pembayaran: defaultMetode,
          nomor_rekening: defaultNomor,
          nama_penerima: defaultPenerima,
          nama_wa_pic: prefill?.nama_wa_pic || cc.creators?.nama_wa_pic || '',
          nomor_wa_dealing: prefill?.nomor_wa_dealing || cc.creators?.nomor_wa_dealing || '',
          alamat_ktp: prefill?.alamat_ktp || cc.creators?.alamat_ktp || '',
          nik: prefill?.nik || cc.creators?.nik || '',
          link_ktp: prefill?.link_ktp || cc.creators?.link_ktp || '',
          link_kontrak: prefill?.link_kontrak || cc.creators?.link_kontrak || '',
          notes_dari_pic: prefill?.notes_dari_pic || '',
        }
      };
    });

    // Fetch bank accounts for this creator if not yet loaded
    if (creatorId && (!bankAccounts[creatorId] || bankAccounts[creatorId].length === 0)) {
      setLoadingBanks(prev => ({ ...prev, [creatorId]: true }));
      try {
        const banks = await getCreatorBankAccounts(creatorId);
        setBankAccounts(prev => ({ ...prev, [creatorId]: banks }));

        if (banks && banks.length > 0) {
          const autoBank = banks.find((b: any) => b.is_primary) || banks[0];
          setForms(prev => {
            const currentForm = prev[cc.id];
            if (currentForm && !currentForm.bank_account_id) {
              return {
                ...prev,
                [cc.id]: {
                  ...currentForm,
                  bank_account_id: String(autoBank.id),
                  metode_pembayaran: autoBank.bank_name,
                  nomor_rekening: autoBank.account_number,
                  nama_penerima: autoBank.account_holder || currentForm.nama_penerima || cc.creators?.nama_asli || ''
                }
              };
            }
            return prev;
          });
        }
      } catch (err) {
        console.error('Failed to load bank accounts for creator', err);
      } finally {
        setLoadingBanks(prev => ({ ...prev, [creatorId]: false }));
      }
    }
  };

  const handleProcessBulk = () => {
    if (!bulkText.trim()) return;
    const rawList = bulkText.split(/[\n,]+/).map(s => s.trim().replace(/^@/, '').toLowerCase()).filter(s => s);
    const uniqueRawList = Array.from(new Set(rawList));
    
    const notFound: string[] = [];
    const pending: string[] = [];
    const notApproved: string[] = [];
    const alternate: string[] = [];
    const alreadyPending: string[] = [];
    const toAdd: any[] = [];
    
    uniqueRawList.forEach(username => {
      const cc = creators.find(c => c.creators?.username?.toLowerCase() === username);
      if (!cc) {
        notFound.push(username);
      } else if (cc.hasPendingPayment) {
        alreadyPending.push(`${username}${cc.pendingBatchLabel ? ` (${cc.pendingBatchLabel})` : ''}`);
      } else if (cc.approval === 'approved') {
        toAdd.push(cc);
      } else if (cc.approval === 'pending') {
        pending.push(username);
      } else if (cc.approval === 'not_approved') {
        notApproved.push(username);
      } else if (cc.approval === 'alternate') {
        alternate.push(username);
      } else {
        notFound.push(username);
      }
    });
    
    // Process additions
    toAdd.forEach(cc => {
      handleToggleCreator(cc, true);
    });

    setBulkStatusWarnings({
      notFound,
      pending,
      notApproved,
      alternate,
      alreadyPending,
      addedCount: toAdd.length
    });

    if (notFound.length === 0 && pending.length === 0 && notApproved.length === 0 && alternate.length === 0 && alreadyPending.length === 0) {
      setBulkText("");
      setShowBulkSelect(false);
    }
  };

  const cleanSearch = searchQuery.trim().replace(/^@/, '').toLowerCase();
  const filteredCreators = creators
    .filter(c => {
      if (c.approval !== 'approved') return false;
      if (!cleanSearch) return true;
      const u = (c.creators?.username || '').toLowerCase();
      const n = (c.creators?.nama_asli || c.creators?.nama_lengkap || '').toLowerCase();
      return u.includes(cleanSearch) || n.includes(cleanSearch);
    })
    .sort((a, b) => {
      const aSelected = selectedCreators.some(s => s.id === a.id);
      const bSelected = selectedCreators.some(s => s.id === b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return 0;
    });

  const handleRemoveCreator = (ccId: number) => {
    setSelectedCreators(prev => prev.filter(c => c.id !== ccId));
    const newForms = { ...forms };
    delete newForms[ccId];
    setForms(newForms);
  };

  const handleAddOperational = () => {
    setOperationalItems(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        payment_type: 'ads',
        nominal: '',
        metode_pembayaran: '',
        nomor_rekening: '',
        nama_penerima: '',
        notes_dari_pic: ''
      }
    ]);
  };

  const handleRemoveOperational = (id: string) => {
    setOperationalItems(prev => prev.filter(item => item.id !== id));
  };

  const handleOperationalChange = (id: string, field: keyof OperationalItem, value: any) => {
    setOperationalItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleChange = (ccId: number, field: string, value: any) => {
    setForms(prev => {
      const current = prev[ccId] || {};
      let updatedNominal = current.nominal;
      if (field === 'payment_type') {
        const ratecard = Number(current.ratecard_awal || 0);
        if (value === '50_awal' || value === '50_akhir') {
          updatedNominal = Math.round(ratecard / 2);
        } else if (value === '100_akhir') {
          updatedNominal = ratecard;
        }
      } else if (field === 'ratecard_awal') {
        const ratecard = Number(value || 0);
        if (current.payment_type === '50_awal' || current.payment_type === '50_akhir') {
          updatedNominal = Math.round(ratecard / 2);
        } else if (current.payment_type === '100_akhir') {
          updatedNominal = ratecard;
        }
      }

      return {
        ...prev,
        [ccId]: {
          ...current,
          [field]: value,
          ...(updatedNominal !== current.nominal ? { nominal: updatedNominal } : {})
        }
      };
    });
  };

  const validateForms = () => {
    if (selectedCreators.length === 0 && operationalItems.length === 0) return "Pilih minimal 1 kreator atau 1 item operasional";
    
    for (const cc of selectedCreators) {
      const f = forms[cc.id];
      if (!f.payment_type) return `Pilih tipe pembayaran untuk @${cc.creators?.username}`;
      if (!f.nominal || Number(f.nominal) <= 0) return `Nominal harus lebih dari 0 untuk @${cc.creators?.username}`;
      
      const history = creatorHistory[cc.id] || [];
      const paidTypes = history.filter((h: any) => h.status === 'paid').map((h: any) => h.payment_type);

      if (f.payment_type === '50_awal' && paidTypes.includes('50_awal')) {
        return `Kreator @${cc.creators?.username} sudah dibayar DP 50% Awal. Harap pilih Pelunasan 50% Akhir!`;
      }
      if (f.payment_type === '100_akhir' && paidTypes.includes('50_awal')) {
        return `Kreator @${cc.creators?.username} sudah menerima DP 50% Awal. Tidak dapat memilih 100% Akhir (pilih Pelunasan 50% Akhir)!`;
      }

      if (!f.bank_account_id) {
        if (!f.metode_pembayaran || !f.nomor_rekening) {
          return `Pilih rekening tersimpan atau isi rekening manual untuk @${cc.creators?.username}`;
        }
      }
      
      if (!f.nama_wa_pic || !f.nomor_wa_dealing || !f.alamat_ktp || !f.nik || !f.link_ktp || !f.link_kontrak) {
        return `Harap lengkapi semua data administrasi (WA, KTP, NIK, Link) untuk @${cc.creators?.username}`;
      }
    }

    for (const op of operationalItems) {
      if (!op.nominal || Number(op.nominal) <= 0) return "Nominal operasional harus diisi dan lebih dari 0";
    }

    return null;
  };

  const handlePreSubmit = (submitToManager: boolean) => {
    const errorMsg = validateForms();
    if (errorMsg) return alert(errorMsg);

    const hasHistory = selectedCreators.some(cc => creatorHistory[cc.id] && creatorHistory[cc.id].length > 0);
    if (hasHistory) {
      setPendingSubmitType(submitToManager);
      setShowWarning(true);
    } else {
      if (submitToManager) {
        if (!confirm("Apakah Anda yakin ingin mengajukan batch ini ke Manager?")) {
          return;
        }
      }
      handleSave(submitToManager);
    }
  };

  const handleSave = async (submitToManager: boolean) => {
    setIsSubmitting(true);
    setShowWarning(false);
    try {
      // 1. Create Batch
      const batchId = await createPaymentBatch(campaignId, batchLabel);
      
      // 2. Add Creator Items
      for (const cc of selectedCreators) {
        await addPaymentItem(batchId, forms[cc.id]);
      }

      // 3. Add Operational Items
      for (const op of operationalItems) {
        await addPaymentItem(batchId, {
          campaign_creator_id: null,
          payment_type: op.payment_type,
          nominal: op.nominal,
          metode_pembayaran: op.metode_pembayaran,
          nomor_rekening: op.nomor_rekening,
          nama_penerima: op.nama_penerima,
          notes_dari_pic: op.notes_dari_pic
        });
      }
      
      // 4. Submit if requested
      if (submitToManager) {
        await submitBatchToManager(batchId);
      }
      
      alert(submitToManager ? "Berhasil disubmit ke Manager!" : "Draft berhasil disimpan!");
      onSuccess();
    } catch (err: any) {
      alert("Terjadi kesalahan: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onCancel} className="btn btn-outline p-2"><ArrowLeft className="w-5 h-5" /></button>
        <h2 className="text-xl font-bold text-slate-800">Ajukan Pembayaran Baru</h2>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Batch Pembayaran</label>
          <input 
            type="text" 
            className="w-full md:w-1/2 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
            value={batchLabel}
            onChange={e => setBatchLabel(e.target.value)}
          />
        </div>

        <div className="border-t border-slate-100 pt-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Pilih Kreator</label>
              <input 
                type="text" 
                placeholder="Cari username..." 
                className="w-full md:w-1/2 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div>
              <button onClick={() => setShowBulkSelect(v => !v)} className="btn btn-outline flex items-center gap-2 text-sm whitespace-nowrap">
                <Plus className="w-4 h-4" /> {showBulkSelect ? 'Tutup Input Bulk' : 'Tempel List Kreator'}
              </button>
            </div>
          </div>

          {showBulkSelect && (
            <div className="mb-4 bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
              {bulkStatusWarnings.addedCount > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Berhasil menceklis & menambahkan <strong>{bulkStatusWarnings.addedCount}</strong> kreator ke batch.</span>
                </div>
              )}

              {bulkStatusWarnings.notFound.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Tidak ditemukan di listing campaign ({bulkStatusWarnings.notFound.length}):</span> {bulkStatusWarnings.notFound.map(u => `@${u}`).join(', ')}
                    <div className="text-red-500 text-[11px] mt-0.5">Silakan tambahkan kreator ini terlebih dahulu melalui menu Listing.</div>
                  </div>
                </div>
              )}

              {bulkStatusWarnings.pending.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Status Masih Pending / Belum Di-approve ({bulkStatusWarnings.pending.length}):</span> {bulkStatusWarnings.pending.map(u => `@${u}`).join(', ')}
                    <div className="text-amber-700 text-[11px] mt-0.5">Kreator harus di-approve terlebih dahulu di menu Listing sebelum dapat diajukan pembayarannya.</div>
                  </div>
                </div>
              )}

              {bulkStatusWarnings.notApproved.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Status Not Approved / Ditolak ({bulkStatusWarnings.notApproved.length}):</span> {bulkStatusWarnings.notApproved.map(u => `@${u}`).join(', ')}
                  </div>
                </div>
              )}

              {bulkStatusWarnings.alternate.length > 0 && (
                <div className="p-3 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg text-xs font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Status Alternate / Cadangan ({bulkStatusWarnings.alternate.length}):</span> {bulkStatusWarnings.alternate.map(u => `@${u}`).join(', ')}
                  </div>
                </div>
              )}

              {bulkStatusWarnings.alreadyPending && bulkStatusWarnings.alreadyPending.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Sedang Dalam Proses di Batch Lain ({bulkStatusWarnings.alreadyPending.length}):</span> {bulkStatusWarnings.alreadyPending.map(u => `@${u}`).join(', ')}
                    <div className="text-amber-800 text-[11px] mt-0.5">Kreator ini tidak dimasukkan ke batch baru untuk mencegah pembayaran ganda (double payment).</div>
                  </div>
                </div>
              )}

              <label className="block text-xs font-semibold text-slate-600">Paste list username (dipisah baris baru atau koma)</label>
              <textarea 
                className="w-full p-3 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500 text-sm h-32"
                placeholder="@sasyaaaasyz&#10;@saskiyyaulia&#10;@budi"
                value={bulkText}
                onChange={e => {
                  setBulkText(e.target.value);
                  if (bulkStatusWarnings.addedCount > 0 || bulkStatusWarnings.notFound.length > 0 || bulkStatusWarnings.pending.length > 0 || bulkStatusWarnings.alreadyPending.length > 0) {
                    setBulkStatusWarnings({ notFound: [], pending: [], notApproved: [], alternate: [], alreadyPending: [], addedCount: 0 });
                  }
                }}
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-[11px] text-slate-400">Contoh: @sasyaaaasyz, @saskiyyaulia</span>
                <button onClick={handleProcessBulk} className="btn btn-primary btn-sm flex items-center gap-2 px-3 py-1.5 text-xs">
                  <Plus className="w-3 h-3" /> Ceklis & Tambahkan ke Batch
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-64 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-600 font-medium sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2 text-center w-12">Pilih</th>
                  <th className="px-4 py-2">Username</th>
                  <th className="px-4 py-2 text-right">Ratecard (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingCreators ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                      Memuat daftar kreator...
                    </td>
                  </tr>
                ) : filteredCreators.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                      {searchQuery ? "Kreator tidak ditemukan" : "Belum ada kreator yang di-approve di campaign ini."}
                    </td>
                  </tr>
                ) : (
                  filteredCreators.map(c => {
                    const isSelected = !!selectedCreators.find(s => s.id === c.id);
                    const isDisabled = c.isFullyPaid || c.hasPendingPayment;
                    return (
                      <tr key={c.id} className={`hover:bg-slate-50 ${isSelected ? 'bg-blue-50/50' : ''} ${c.hasPendingPayment ? 'bg-amber-50/20' : ''}`}>
                        <td className="px-4 py-2 text-center">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                            checked={isSelected}
                            disabled={isDisabled}
                            onChange={(e) => handleToggleCreator(c, e.target.checked)}
                          />
                        </td>
                        <td className="px-4 py-2 font-medium">
                          @{c.creators?.username}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-slate-700 flex items-center justify-end gap-2 flex-wrap">
                          {c.hasPendingPayment && (
                            <span className="text-xs font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full" title={`Sedang diproses di ${c.pendingBatchLabel || 'Batch Lain'}`}>
                              Sedang Diproses ({c.pendingBatchLabel || 'Batch Lain'})
                            </span>
                          )}
                          {(() => {
                            const history = creatorHistory[c.id] || [];
                            const types = history.map((h: any) => h.payment_type);
                            const has50Awal = types.includes('50_awal');
                            const has50Akhir = types.includes('50_akhir');
                            const has100 = types.includes('100_akhir');
                            const totalPaid = history.filter((h: any) => h.status === 'paid').reduce((s: number, h: any) => s + Number(h.nominal || 0), 0);
                            const remaining = Math.max(0, Number(c.price || 0) - totalPaid);

                            if (c.isFullyPaid || has100 || (has50Awal && has50Akhir)) {
                              return <span className="text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">Ratecard Lunas</span>;
                            }
                            if (has50Awal && !has50Akhir) {
                              return (
                                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                  Termin 1 Terbayar: {formatRupiah(totalPaid)} • Kurang: {formatRupiah(remaining)} (Termin 2)
                                </span>
                              );
                            }
                            return null;
                          })()}
                          <span>{formatRupiah(c.price)}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedCreators.length > 0 && (
          <div className="space-y-6">
            {selectedCreators.map((cc, idx) => {
              const f = forms[cc.id];
              const banks = bankAccounts[cc.creator_id] || [];
              const isBankLoading = loadingBanks[cc.creator_id];

              return (
                <div key={cc.id} className="border border-blue-100 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex justify-between items-center">
                    <h3 className="font-bold text-blue-900 flex items-center gap-2">
                      <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">{idx + 1}</span>
                      @{cc.creators?.username}
                    </h3>
                    <button onClick={() => handleRemoveCreator(cc.id)} className="text-red-500 hover:text-red-700 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    {/* Pembayaran Info */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-slate-700 border-b pb-2">Informasi Pembayaran</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Tipe Pembayaran</label>
                          {(() => {
                            const history = creatorHistory[cc.id] || [];
                            const paidTypes = history.filter((h: any) => h.status === 'paid').map((h: any) => h.payment_type);
                            const hasPaid50Awal = paidTypes.includes('50_awal');
                            return (
                              <select 
                                className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" 
                                value={f.payment_type} 
                                onChange={e => handleChange(cc.id, 'payment_type', e.target.value)}
                              >
                                <option value="100_akhir" disabled={hasPaid50Awal}>
                                  {hasPaid50Awal ? "100% Akhir (Sudah ada DP 50%)" : "100% Akhir"}
                                </option>
                                <option value="50_awal" disabled={hasPaid50Awal}>
                                  {hasPaid50Awal ? "DP 50% Awal (Sudah Dibayar)" : "DP 50% Awal"}
                                </option>
                                <option value="50_akhir">Pelunasan 50% Akhir</option>
                                <option value="ads">Top Up ADS</option>
                                <option value="crm">Biaya CRM</option>
                                <option value="lion">Ongkir Lion Parcel</option>
                                <option value="reward_affiliate">Bonus Reward Affiliate</option>
                                <option value="boost_awareness">Boost Awareness</option>
                              </select>
                            );
                          })()}
                          {creatorHistory[cc.id]?.some((h: any) => h.payment_type === f.payment_type) && (
                            <p className="text-[10px] text-orange-700 mt-1 font-medium bg-orange-50 p-1 rounded border border-orange-100">⚠️ Sudah pernah diajukan sebelumnya.</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Ratecard Awal</label>
                          <input type="number" className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" value={f.ratecard_awal} onChange={e => handleChange(cc.id, 'ratecard_awal', e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Nominal Diajukan (Rp)</label>
                          <input type="number" className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" value={f.nominal} onChange={e => handleChange(cc.id, 'nominal', e.target.value)} />
                          {creatorHistory[cc.id] && creatorHistory[cc.id].length > 0 && (
                            <p className="text-[10px] text-blue-700 mt-1 font-medium bg-blue-50 p-1 rounded border border-blue-100">ℹ️ Total masa lalu: Rp {creatorHistory[cc.id].reduce((sum: number, h: any) => sum + h.nominal, 0).toLocaleString()}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Biaya Transfer (Opsional)</label>
                          <input type="number" className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" value={f.biaya_transfer} onChange={e => handleChange(cc.id, 'biaya_transfer', e.target.value)} />
                        </div>
                        {f.payment_type === '50_awal' && (
                          <div className="col-span-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 p-2.5 rounded-lg flex flex-col gap-0.5">
                            <span className="font-bold">ℹ️ Skema Pembayaran Termin 1 (DP 50%)</span>
                            <span>Nominal diajukan sekarang: <strong>{formatRupiah(f.nominal)}</strong>.</span>
                            <span>Kekurangan: <strong>{formatRupiah(Math.max(0, Number(f.ratecard_awal || cc.price || 0) - Number(f.nominal || 0)))}</strong> (Termin 2 / Pelunasan 50% Akhir) dapat diajukan kembali nanti setelah video/live tayang.</span>
                          </div>
                        )}
                        {f.payment_type === '50_akhir' && (
                          <div className="col-span-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg flex flex-col gap-0.5">
                            <span className="font-bold">ℹ️ Skema Pembayaran Pelunasan Termin 2 (50% Akhir)</span>
                            <span>Nominal pelunasan: <strong>{formatRupiah(f.nominal)}</strong>.</span>
                            {creatorHistory[cc.id]?.length > 0 && (
                              <span>Sebelumnya telah dibayar: <strong>{formatRupiah(creatorHistory[cc.id].filter((h: any) => h.status === 'paid').reduce((s: number, h: any) => s + Number(h.nominal || 0), 0))}</strong> pada Termin 1.</span>
                            )}
                          </div>
                        )}
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Catatan / Notes untuk Finance (Opsional)</label>
                          <textarea 
                            className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500 h-16 resize-none" 
                            placeholder="Contoh: Tolong segera diproses, ini kerjasama kedua..."
                            value={f.notes_dari_pic} 
                            onChange={e => handleChange(cc.id, 'notes_dari_pic', e.target.value)} 
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-b pb-2 pt-2">
                        <h4 className="font-semibold text-sm text-slate-700">Rekening Penerima</h4>
                        <span className="text-[11px] text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Otomatis Sync ke Master</span>
                      </div>
                      {isBankLoading ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Memuat rekening...</div>
                      ) : (
                        <div>
                          <select 
                            className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500 mb-3 font-medium text-slate-800" 
                            value={f.bank_account_id || ''} 
                            onChange={e => {
                              const selectedId = e.target.value;
                              if (selectedId) {
                                const selectedBank = banks.find((b: any) => String(b.id) === String(selectedId));
                                if (selectedBank) {
                                  setForms(prev => ({
                                    ...prev,
                                    [cc.id]: {
                                      ...prev[cc.id],
                                      bank_account_id: selectedId,
                                      metode_pembayaran: selectedBank.bank_name,
                                      nomor_rekening: selectedBank.account_number,
                                      nama_penerima: selectedBank.account_holder || prev[cc.id]?.nama_penerima || cc.creators?.nama_asli || ''
                                    }
                                  }));
                                }
                              } else {
                                setForms(prev => ({
                                  ...prev,
                                  [cc.id]: {
                                    ...prev[cc.id],
                                    bank_account_id: '',
                                    metode_pembayaran: '',
                                    nomor_rekening: '',
                                    nama_penerima: cc.creators?.nama_asli || ''
                                  }
                                }));
                              }
                            }}
                          >
                            <option value="">+ Tambah Rekening Baru (Ketik Manual)</option>
                            {banks.map((b: any) => (
                              <option key={b.id} value={String(b.id)}>
                                {b.bank_name} - {b.account_number} ({b.account_holder}) {b.is_primary ? '★ Utama' : ''}
                              </option>
                            ))}
                          </select>

                          {!f.bank_account_id && (
                            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                              <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-600 mb-1">Metode / Bank</label>
                                <input type="text" placeholder="BCA / Mandiri / BRI / DANA" className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" value={f.metode_pembayaran} onChange={e => handleChange(cc.id, 'metode_pembayaran', e.target.value)} />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Nomor Rekening</label>
                                <input type="text" placeholder="Contoh: 1234567890" className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" value={f.nomor_rekening} onChange={e => handleChange(cc.id, 'nomor_rekening', e.target.value)} />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Nama Penerima</label>
                                <input type="text" placeholder="Nama pemilik rekening" className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" value={f.nama_penerima} onChange={e => handleChange(cc.id, 'nama_penerima', e.target.value)} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Data Administrasi */}
                    <div className="space-y-4">
                      {/* Section: Kontak WA PIC */}
                      <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                            Kontak WA PIC
                          </span>
                          <span className="text-[10px] text-slate-400">Tersimpan ke Master Kreator</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">No WA Dealing</label>
                            <input 
                              type="text" 
                              placeholder="08xxxxxxxxxx"
                              className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" 
                              value={f.nomor_wa_dealing} 
                              onChange={e => handleChange(cc.id, 'nomor_wa_dealing', e.target.value)} 
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Nama Kontak WA PIC</label>
                            <input 
                              type="text" 
                              placeholder="Nama PIC / Admin Kreator"
                              className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" 
                              value={f.nama_wa_pic} 
                              onChange={e => handleChange(cc.id, 'nama_wa_pic', e.target.value)} 
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section: Identitas & Dokumen */}
                      <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                            Identitas KTP & Kontrak
                          </span>
                          <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                            Auto-sync Data Master
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">NIK (KTP)</label>
                            <input 
                              type="text" 
                              placeholder="16 digit NIK"
                              className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" 
                              value={f.nik} 
                              onChange={e => handleChange(cc.id, 'nik', e.target.value)} 
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Link KTP (GDrive)</label>
                            <input 
                              type="text" 
                              placeholder="https://drive.google.com/..." 
                              className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" 
                              value={f.link_ktp} 
                              onChange={e => handleChange(cc.id, 'link_ktp', e.target.value)} 
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Alamat Sesuai KTP</label>
                            <input 
                              type="text" 
                              placeholder="Alamat lengkap sesuai KTP"
                              className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" 
                              value={f.alamat_ktp} 
                              onChange={e => handleChange(cc.id, 'alamat_ktp', e.target.value)} 
                            />
                          </div>
                          <div className="col-span-2 pt-1 border-t border-slate-100">
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-xs font-bold text-indigo-900">Link Kontrak (GDrive) <span className="text-red-500">*</span></label>
                              <span className="text-[10px] text-indigo-600 font-medium">Wajib diisi per pengajuan</span>
                            </div>
                            <input 
                              type="text" 
                              placeholder="https://drive.google.com/file/d/..." 
                              className="w-full p-2 border border-indigo-200 bg-indigo-50/30 rounded text-sm outline-none focus:border-indigo-500 font-medium" 
                              value={f.link_kontrak} 
                              onChange={e => handleChange(cc.id, 'link_kontrak', e.target.value)} 
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* --- OPERATIONAL ITEMS SECTION --- */}
        <div className="border-t border-slate-100 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-lg">Item Operasional & Ads</h3>
            <button onClick={handleAddOperational} className="btn btn-outline flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> Tambah Operasional / Ads
            </button>
          </div>

          {operationalItems.length > 0 ? (
            <div className="space-y-6">
              {operationalItems.map((op, idx) => (
                <div key={op.id} className="border border-green-100 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-green-50 px-4 py-3 border-b border-green-100 flex justify-between items-center">
                    <h3 className="font-bold text-green-900 flex items-center gap-2">
                      <span className="bg-green-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">{idx + 1}</span>
                      Pengeluaran Operasional / Ads
                    </h3>
                    <button onClick={() => handleRemoveOperational(op.id)} className="text-red-500 hover:text-red-700 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Tipe Pembayaran</label>
                          <select className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-green-500" value={op.payment_type} onChange={e => handleOperationalChange(op.id, 'payment_type', e.target.value)}>
                            <option value="ads">Top Up ADS</option>
                            <option value="crm">Biaya CRM</option>
                            <option value="lion">Ongkir Lion Parcel</option>
                            <option value="reward_affiliate">Bonus Reward Affiliate</option>
                            <option value="boost_awareness">Boost Awareness</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Nominal (Rp) <span className="text-red-500">*</span></label>
                          <input type="number" className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-green-500" placeholder="Contoh: 10000000" value={op.nominal} onChange={e => handleOperationalChange(op.id, 'nominal', e.target.value)} />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Catatan / Detail (Wajib untuk Boost)</label>
                          <textarea 
                            className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-green-500 h-16 resize-none" 
                            placeholder="Contoh: Top up Tiktok ads periode 1-7 Agustus / Boost View video X"
                            value={op.notes_dari_pic} 
                            onChange={e => handleOperationalChange(op.id, 'notes_dari_pic', e.target.value)} 
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-slate-700 border-b pb-2">Tujuan Transfer</h4>
                      <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Bank / Metode (Opsional)</label>
                          <input type="text" placeholder="BCA / Mandiri / Kas Kasir" className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-green-500" value={op.metode_pembayaran} onChange={e => handleOperationalChange(op.id, 'metode_pembayaran', e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Nomor Rekening</label>
                          <input type="text" className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-green-500" value={op.nomor_rekening} onChange={e => handleOperationalChange(op.id, 'nomor_rekening', e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Atas Nama</label>
                          <input type="text" className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-green-500" value={op.nama_penerima} onChange={e => handleOperationalChange(op.id, 'nama_penerima', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-50 p-6 text-center rounded-lg border border-slate-200 text-slate-500 text-sm">
              Belum ada item pengeluaran operasional. Klik tombol di atas untuk menambahkan Top Up Ads, Lion Parcel, dll.
            </div>
          )}
        </div>

        <div className="flex gap-4 pt-6 border-t border-slate-200">
          <button onClick={() => handlePreSubmit(false)} disabled={isSubmitting} className="btn btn-outline flex-1 flex justify-center items-center gap-2 py-3">
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Simpan sbg Draft
          </button>
          <button onClick={() => handlePreSubmit(true)} disabled={isSubmitting} className="btn btn-primary flex-1 flex justify-center items-center gap-2 py-3">
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />} Ajukan ke Manager
          </button>
        </div>

        {showWarning && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
              <div className="bg-orange-50 px-6 py-4 border-b border-orange-100">
                <h3 className="font-bold text-orange-800 flex items-center gap-2">⚠️ Peringatan: Ada Riwayat Pembayaran</h3>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                <p className="text-sm text-slate-600 mb-4">Beberapa kreator yang Anda pilih sudah pernah diajukan pembayarannya sebelumnya. Pastikan Anda tidak salah input atau melakukan pembayaran ganda secara tidak sengaja.</p>
                <ul className="space-y-3">
                  {selectedCreators.map(cc => {
                    const history = creatorHistory[cc.id] || [];
                    if (history.length === 0) return null;
                    const total = history.reduce((sum, h) => sum + h.nominal, 0);
                    return (
                      <li key={cc.id} className="text-sm bg-slate-50 p-3 rounded border border-slate-200">
                        <strong>@{cc.creators?.username}</strong> - Total dibayar sebelumnya: <span className="font-bold text-blue-600">Rp {total.toLocaleString()}</span>
                        <div className="text-xs text-slate-500 mt-1">
                          {history.map((h, i) => (
                            <div key={i}>• {h.payment_type} (Rp {h.nominal.toLocaleString()}) - {h.batch_label}</div>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-3">
                <button onClick={() => setShowWarning(false)} className="btn btn-outline">Batal</button>
                <button onClick={() => handleSave(pendingSubmitType!)} className="btn btn-primary bg-orange-600 hover:bg-orange-700 border-none text-white">Ya, Tetap Lanjutkan</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
