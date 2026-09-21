import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Download, RefreshCcw, Search, Link, Loader2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { fetchMutationsPaginated, fetchMutationsExport, updateItemBuktiTransfer } from '../app/campaigns/actions/paymentActions';
import { useAuth } from '@/providers/AuthProvider';
import { formatDateTime, formatDateTimeShort } from '@/utils/formatters';

export function MutationTable() {
  const { profile } = useAuth();
  const userRole = profile?.role || '';
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  const [mutations, setMutations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [paymentType, setPaymentType] = useState<string>('all');
  
  // Edit Bukti
  const [editingBuktiId, setEditingBuktiId] = useState<number | null>(null);
  const [editBuktiValue, setEditBuktiValue] = useState<string>('');
  const [isSavingBukti, setIsSavingBukti] = useState<boolean>(false);
  
  // Pagination
  const [page, setPage] = useState<number>(1);
  const limit = 20;
  const [totalCount, setTotalCount] = useState<number>(0);

  // Available months (ideally this should be fetched from DB grouped, but for now we'll mock a few or rely on what's available)
  // Generating last 12 months for the dropdown
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
    // Reset to page 1 when filters change
    setPage(1);
  }, [selectedMonth, searchTerm, paymentType]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 300); // debounce search
    return () => clearTimeout(timer);
  }, [loadData]);

  const totalPages = Math.ceil(totalCount / limit);

  const exportToCSV = async () => {
    setIsExporting(true);
    try {
      const allData = await fetchMutationsExport(selectedMonth, searchTerm, paymentType);
      
      const headers = ['Tanggal', 'Campaign', 'Batch', 'Penerima', 'Username', 'Rekening', 'Tipe Pembayaran', 'Nominal', 'Biaya Transfer', 'Total', 'Catatan', 'Bukti Transfer'];
      const rows = allData.map(m => {
        const d = formatDateTime(m.paid_at);
        return [
          d,
          m.campaign_nama || '-',
          m.batch_label || '-',
          m.nama_penerima || '-',
          m.username || '-',
          `${m.bank_name || m.metode_pembayaran || '-'} - ${m.nomor_rekening || '-'}`,
          m.payment_type || '-',
          m.nominal || 0,
          m.biaya_transfer || 0,
          (m.nominal || 0) + (m.biaya_transfer || 0),
          m.notes || '-',
          m.bukti_transfer || '-'
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
      });
      
      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Mutasi_Pembayaran_${selectedMonth === 'all' ? 'All' : selectedMonth}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      alert('Gagal mengekspor data.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select 
            className="p-2 border border-slate-300 rounded-lg text-sm bg-white min-w-[150px] outline-none focus:border-blue-500"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
          >
            <option value="all">Semua Bulan</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('id-ID', {month: 'long', year: 'numeric'})}</option>
            ))}
          </select>
          <select
            className="p-2 border border-slate-300 rounded-lg text-sm bg-white min-w-[150px] outline-none focus:border-blue-500"
            value={paymentType}
            onChange={e => setPaymentType(e.target.value)}
          >
            <option value="all">Semua Tipe</option>
            <option value="kreator">Kreator Saja</option>
            <option value="ads">Ads Saja</option>
          </select>
          <button 
            onClick={() => { setSelectedMonth('all'); setSearchTerm(''); }}
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2 text-sm border border-transparent"
            title="Reset ke Semua Waktu"
          >
            <RefreshCcw className="w-4 h-4" /> Reset
          </button>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari penerima / campaign..." 
              className="w-full pl-9 p-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={exportToCSV}
            disabled={isExporting}
            className="btn btn-outline flex items-center gap-2 py-2 disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} 
            Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-100 text-slate-600 font-medium whitespace-nowrap">
            <tr>
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
                <td colSpan={6} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="mt-2 text-slate-500 text-sm">Memuat data mutasi...</p>
                  </div>
                </td>
              </tr>
            ) : mutations.length === 0 ? (
              <tr>
                <td colSpan={6} className="h-32 text-center text-slate-500">
                  Tidak ada data mutasi pembayaran yang sesuai.
                </td>
              </tr>
            ) : (
              mutations.map((m) => {
                const total = (m.nominal || 0) + (m.biaya_transfer || 0);
                const bankName = m.bank_name || m.metode_pembayaran || 'Bank';
                const datePaid = formatDateTime(m.paid_at);
                
                return (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                      {datePaid}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{m.nama_penerima || '-'}</div>
                      <div className="text-xs text-blue-600 mb-1">@{m.username}</div>
                      <div className="text-[11px] bg-slate-100 px-2 py-1 rounded inline-block text-slate-600">
                        {bankName} - {m.nomor_rekening}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-700">{m.campaign_nama}</div>
                      <div className="text-xs text-slate-500">{m.batch_label}</div>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <span className="inline-block px-2 py-1 bg-green-50 text-green-700 text-[11px] font-semibold rounded-full border border-green-100 mb-1">
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
                              <a href={m.bukti_transfer} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center p-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors" title="Lihat Bukti Transfer">
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
          <div className="text-slate-500">
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
            <div className="px-4 py-2 text-slate-700 font-medium">
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
