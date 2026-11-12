"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Download, RefreshCcw, Search, Link, Loader2, ChevronLeft, ChevronRight, 
  X, CheckSquare, Square, FileSpreadsheet, Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { fetchMutationsPaginated, fetchMutationsExport, updateItemBuktiTransfer } from '../app/campaigns/actions/paymentActions';
import { useAuth } from '@/providers/AuthProvider';
import { formatDateTime } from '@/utils/formatters';

export function MutationTable() {
  const { profile } = useAuth();
  const userRole = profile?.role || '';
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  const [mutations, setMutations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [paymentType, setPaymentType] = useState<string>('all');
  
  // Selection state (Map: id -> item data object)
  const [selectedItems, setSelectedItems] = useState<Map<number, any>>(new Map());

  // Edit Bukti
  const [editingBuktiId, setEditingBuktiId] = useState<number | null>(null);
  const [editBuktiValue, setEditBuktiValue] = useState<string>('');
  const [isSavingBukti, setIsSavingBukti] = useState<boolean>(false);
  
  // Pagination
  const [page, setPage] = useState<number>(1);
  const limit = 20;
  const [totalCount, setTotalCount] = useState<number>(0);

  // Available months (Generating last 12 months for dropdown)
  const availableMonths = useMemo(() => {
    const months = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push(monthStr);
      d.setMonth(d.getMonth() - 1);
    }
    return months;
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchMutationsPaginated(page, limit, selectedMonth, searchTerm, paymentType);
      setMutations(result.data || []);
      setTotalCount(result.count || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, selectedMonth, searchTerm, paymentType]);

  useEffect(() => {
    setPage(1);
  }, [selectedMonth, searchTerm, paymentType]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadData]);

  const totalPages = Math.ceil(totalCount / limit);

  // Selection helpers
  const isAllCurrentPageSelected = useMemo(() => {
    if (mutations.length === 0) return false;
    return mutations.every(m => selectedItems.has(m.id));
  }, [mutations, selectedItems]);

  const toggleSelectAllCurrentPage = () => {
    const next = new Map(selectedItems);
    if (isAllCurrentPageSelected) {
      mutations.forEach(m => next.delete(m.id));
    } else {
      mutations.forEach(m => next.set(m.id, m));
    }
    setSelectedItems(next);
  };

  const toggleSelectItem = (item: any) => {
    const next = new Map(selectedItems);
    if (next.has(item.id)) {
      next.delete(item.id);
    } else {
      next.set(item.id, item);
    }
    setSelectedItems(next);
  };

  const clearSelection = () => {
    setSelectedItems(new Map());
  };

  const selectedTotalNominal = useMemo(() => {
    let total = 0;
    selectedItems.forEach(item => {
      const base = item.actual_transfer != null ? Number(item.actual_transfer) : Number(item.nominal || 0);
      total += base + Number(item.biaya_transfer || 0);
    });
    return total;
  }, [selectedItems]);

  // Format data for export
  const buildExportRows = (items: any[]) => {
    return items.map((m, idx) => {
      const d = formatDateTime(m.paid_at);
      const baseNominal = m.actual_transfer != null ? Number(m.actual_transfer) : Number(m.nominal || 0);
      const fee = Number(m.biaya_transfer || 0);
      const total = baseNominal + fee;
      const bank = m.bank_name || m.metode_pembayaran || '-';

      return {
        "No": idx + 1,
        "Tanggal Bayar": d,
        "Campaign": m.campaign_nama || '-',
        "Batch": m.batch_label || '-',
        "Username": m.username ? `@${m.username}` : '-',
        "Nama Penerima": m.nama_penerima || '-',
        "Bank / Metode": bank,
        "Nomor Rekening": m.nomor_rekening ? `'${m.nomor_rekening}` : '-',
        "Tipe Pembayaran": m.payment_type || '-',
        "Nominal": baseNominal,
        "Biaya Transfer": fee,
        "Total Ditransfer": total,
        "Catatan": m.notes || '-',
        "Bukti Transfer": m.bukti_transfer || '-'
      };
    });
  };

  // Export to Excel (.xlsx)
  const exportToExcel = async (selectedOnly: boolean = false) => {
    setIsExporting(true);
    try {
      let rawData: any[] = [];
      if (selectedOnly) {
        rawData = Array.from(selectedItems.values());
      } else {
        rawData = await fetchMutationsExport(selectedMonth, searchTerm, paymentType);
      }

      if (rawData.length === 0) {
        alert("Tidak ada data untuk diekspor.");
        return;
      }

      const formattedData = buildExportRows(rawData);
      const ws = XLSX.utils.json_to_sheet(formattedData);
      
      // Auto column width
      const colWidths = [
        { wch: 6 },  // No
        { wch: 20 }, // Tanggal
        { wch: 25 }, // Campaign
        { wch: 25 }, // Batch
        { wch: 20 }, // Username
        { wch: 25 }, // Nama Penerima
        { wch: 16 }, // Bank
        { wch: 20 }, // No Rek
        { wch: 16 }, // Tipe
        { wch: 14 }, // Nominal
        { wch: 14 }, // Biaya
        { wch: 16 }, // Total
        { wch: 30 }, // Catatan
        { wch: 35 }  // Bukti
      ];
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Mutasi Pembayaran");

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = selectedOnly
        ? `Mutasi_Pembayaran_Terpilih_${rawData.length}_Item_${dateStr}.xlsx`
        : `Mutasi_Pembayaran_${selectedMonth === 'all' ? 'All' : selectedMonth}_${dateStr}.xlsx`;

      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error(err);
      alert('Gagal mengekspor data ke Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  // Export to CSV
  const exportToCSV = async (selectedOnly: boolean = false) => {
    setIsExporting(true);
    try {
      let rawData: any[] = [];
      if (selectedOnly) {
        rawData = Array.from(selectedItems.values());
      } else {
        rawData = await fetchMutationsExport(selectedMonth, searchTerm, paymentType);
      }

      if (rawData.length === 0) {
        alert("Tidak ada data untuk diekspor.");
        return;
      }

      const headers = ['No', 'Tanggal', 'Campaign', 'Batch', 'Penerima', 'Username', 'Bank', 'Rekening', 'Tipe Pembayaran', 'Nominal', 'Biaya Transfer', 'Total', 'Catatan', 'Bukti Transfer'];
      const rows = rawData.map((m, idx) => {
        const d = formatDateTime(m.paid_at);
        const baseNominal = m.actual_transfer != null ? Number(m.actual_transfer) : Number(m.nominal || 0);
        const fee = Number(m.biaya_transfer || 0);
        const total = baseNominal + fee;

        return [
          idx + 1,
          d,
          m.campaign_nama || '-',
          m.batch_label || '-',
          m.nama_penerima || '-',
          m.username ? `@${m.username}` : '-',
          m.bank_name || m.metode_pembayaran || '-',
          m.nomor_rekening ? `'${m.nomor_rekening}` : '-',
          m.payment_type || '-',
          baseNominal,
          fee,
          total,
          m.notes || '-',
          m.bukti_transfer || '-'
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
      });
      
      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', selectedOnly ? `Mutasi_Pembayaran_Terpilih_${dateStr}.csv` : `Mutasi_Pembayaran_${selectedMonth === 'all' ? 'All' : selectedMonth}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      alert('Gagal mengekspor data ke CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Filters & Export Bar */}
      <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <select 
            className="p-2 border border-slate-300 rounded-lg text-sm bg-white min-w-[140px] outline-none focus:border-blue-500"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
          >
            <option value="all">Semua Bulan</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('id-ID', {month: 'long', year: 'numeric'})}</option>
            ))}
          </select>
          <select
            className="p-2 border border-slate-300 rounded-lg text-sm bg-white min-w-[130px] outline-none focus:border-blue-500"
            value={paymentType}
            onChange={e => setPaymentType(e.target.value)}
          >
            <option value="all">Semua Tipe</option>
            <option value="kreator">Kreator Saja</option>
            <option value="ads">Ads Saja</option>
          </select>
          <button 
            onClick={() => { setSelectedMonth('all'); setSearchTerm(''); setPaymentType('all'); clearSelection(); }}
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1.5 text-sm border border-transparent"
            title="Reset Filter"
          >
            <RefreshCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
          <div className="relative w-full md:w-56">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari penerima / username..." 
              className="w-full pl-9 p-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Export Action Buttons */}
          {selectedItems.size > 0 ? (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => exportToExcel(true)}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-50"
                title="Export tagihan yang dicentang ke file Excel"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} 
                Export Excel Terpilih ({selectedItems.size})
              </button>
              <button 
                onClick={() => exportToCSV(true)}
                disabled={isExporting}
                className="flex items-center gap-1 px-2.5 py-2 border border-slate-300 text-slate-700 bg-white rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                title="Export tagihan yang dicentang ke CSV"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => exportToExcel(false)}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-50"
                title="Export seluruh mutasi sesuai filter ke file Excel"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} 
                Export Excel
              </button>
              <button 
                onClick={() => exportToCSV(false)}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-2.5 py-2 border border-slate-300 text-slate-700 bg-white rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                title="Export seluruh data mutasi ke CSV"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Selection Summary Alert Banner */}
      {selectedItems.size > 0 && (
        <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex flex-wrap items-center justify-between gap-3 text-xs text-blue-900">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>{selectedItems.size} tagihan terpilih</strong>
              <span className="text-blue-700 ml-1.5 font-medium">
                (Total Transfer: <strong>Rp {selectedTotalNominal.toLocaleString('id-ID')}</strong>)
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleSelectAllCurrentPage} 
              className="text-blue-700 hover:text-blue-900 font-semibold underline cursor-pointer"
            >
              {isAllCurrentPageSelected ? "Batal Pilih Halaman Ini" : "Pilih Semua di Halaman Ini"}
            </button>
            <span className="text-blue-300">|</span>
            <button 
              onClick={clearSelection} 
              className="text-slate-500 hover:text-slate-700 font-medium underline cursor-pointer flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Batal Semua Seleksi
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-100 text-slate-600 font-medium whitespace-nowrap">
            <tr>
              {/* Checkbox Header */}
              <th className="px-3 py-4 text-center w-10">
                <input 
                  type="checkbox" 
                  checked={isAllCurrentPageSelected}
                  onChange={toggleSelectAllCurrentPage}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  title="Pilih semua baris di halaman ini"
                />
              </th>
              <th className="px-4 py-4">Tanggal</th>
              <th className="px-4 py-4">Penerima & Rekening</th>
              <th className="px-4 py-4">Konteks Pembayaran</th>
              <th className="px-4 py-4">Tipe & Catatan</th>
              <th className="px-4 py-4 text-right">Nominal Transfer</th>
              <th className="px-4 py-4 text-center">Bukti</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="mt-2 text-slate-500 text-sm">Memuat data mutasi...</p>
                  </div>
                </td>
              </tr>
            ) : mutations.length === 0 ? (
              <tr>
                <td colSpan={7} className="h-32 text-center text-slate-500">
                  Tidak ada data mutasi pembayaran yang sesuai.
                </td>
              </tr>
            ) : (
              mutations.map((m) => {
                const total = (m.nominal || 0) + (m.biaya_transfer || 0);
                const bankName = m.bank_name || m.metode_pembayaran || 'Bank';
                const datePaid = formatDateTime(m.paid_at);
                const isSelected = selectedItems.has(m.id);
                
                return (
                  <tr 
                    key={m.id} 
                    className={`transition-colors ${isSelected ? 'bg-blue-50/60 hover:bg-blue-50' : 'hover:bg-slate-50'}`}
                  >
                    {/* Checkbox Row */}
                    <td className="px-3 py-3 text-center">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => toggleSelectItem(m)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        title={`Pilih tagihan @${m.username || m.nama_penerima}`}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-xs">
                      {datePaid}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{m.nama_penerima || '-'}</div>
                      <div className="text-xs text-blue-600 mb-0.5">@{m.username}</div>
                      <div className="text-[11px] bg-slate-100 px-2 py-0.5 rounded inline-block text-slate-600 font-mono">
                        {bankName} - {m.nomor_rekening}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-700">{m.campaign_nama}</div>
                      <div className="text-xs text-slate-500">{m.batch_label}</div>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded-full border border-emerald-200 mb-1">
                        {m.payment_type}
                      </span>
                      {m.notes && <div className="text-[11px] text-slate-500 truncate" title={m.notes}>{m.notes}</div>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-bold text-slate-800">Rp {total.toLocaleString('id-ID')}</div>
                      {m.biaya_transfer > 0 && <div className="text-[10px] text-slate-400">Termasuk fee Rp {m.biaya_transfer.toLocaleString()}</div>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {editingBuktiId === m.id ? (
                          <div className="flex items-center gap-1">
                            <input 
                              type="text" 
                              value={editBuktiValue} 
                              onChange={e => setEditBuktiValue(e.target.value)}
                              className="w-32 p-1 border border-slate-300 rounded text-[10px] outline-none"
                              placeholder="Link GDrive"
                              autoFocus
                              onKeyDown={async (e) => {
                                if (e.key === 'Escape') setEditingBuktiId(null);
                                if (e.key === 'Enter') {
                                  setIsSavingBukti(true);
                                  try {
                                    await updateItemBuktiTransfer(m.id, editBuktiValue);
                                    setMutations(prev => prev.map(mu => mu.id === m.id ? { ...mu, bukti_transfer: editBuktiValue } : mu));
                                    setEditingBuktiId(null);
                                  } catch (err) {
                                    alert('Gagal update');
                                  } finally {
                                    setIsSavingBukti(false);
                                  }
                                }
                              }}
                            />
                            {isSavingBukti ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                              <button onClick={() => setEditingBuktiId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>
                            )}
                          </div>
                        ) : (
                          <>
                            {m.bukti_transfer ? (
                              <a href={m.bukti_transfer} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors" title="Lihat Bukti Transfer">
                                <Link className="w-4 h-4" />
                              </a>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                            {(userRole === 'finance' || userRole === 'executive') && (
                              <button 
                                onClick={() => { setEditingBuktiId(m.id); setEditBuktiValue(m.bukti_transfer || ''); }}
                                className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
                                title="Edit Link Bukti"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Footer */}
      {!isLoading && totalPages > 1 && (
        <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-white text-sm">
          <div className="text-slate-500 text-xs">
            Menampilkan <span className="font-semibold text-slate-700">{(page - 1) * limit + 1}</span> - <span className="font-semibold text-slate-700">{Math.min(page * limit, totalCount)}</span> dari <span className="font-semibold text-slate-700">{totalCount}</span> data
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white text-slate-600"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-4 py-2 text-slate-700 font-medium text-xs">
              Hal {page} dari {totalPages}
            </div>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white text-slate-600"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
