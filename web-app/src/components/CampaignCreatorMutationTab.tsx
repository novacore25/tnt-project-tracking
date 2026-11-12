import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Loader2, Link as LinkIcon, Search, Download, FileSpreadsheet, 
  CheckSquare, Square, X, Check 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { fetchCampaignCreatorMutations } from '../app/campaigns/actions/paymentActions';
import { formatDateTime } from '@/utils/formatters';

export function CampaignCreatorMutationTab({ campaignId }: { campaignId: number }) {
  const [mutations, setMutations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Selection state (Map: id -> item data object)
  const [selectedItems, setSelectedItems] = useState<Map<number, any>>(new Map());

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchCampaignCreatorMutations(campaignId);
      setMutations(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredMutations = useMemo(() => {
    return mutations.filter(m => {
      const searchStr = searchTerm.toLowerCase();
      const username = m.campaign_creators?.creators?.username?.toLowerCase() || '';
      const name = m.nama_penerima?.toLowerCase() || '';
      const notes = m.notes?.toLowerCase() || '';
      const rekening = m.nomor_rekening?.toLowerCase() || '';
      const batch = m.payment_batches?.batch_label?.toLowerCase() || '';
      return username.includes(searchStr) || name.includes(searchStr) || notes.includes(searchStr) || rekening.includes(searchStr) || batch.includes(searchStr);
    });
  }, [mutations, searchTerm]);

  const getPaymentTypeLabel = (type: string) => {
    switch (type) {
      case '100_awal': return '100% Awal (Upfront)';
      case '100_akhir': return 'Full Payment (Akhir)';
      case '50_awal': return 'DP 50%';
      case '50_akhir': return 'Pelunasan 50%';
      default: return type?.replace('_', ' ') || '-';
    }
  };

  const totalPaid = useMemo(() => {
    return filteredMutations.reduce((sum, item) => {
      const base = item.actual_transfer != null ? Number(item.actual_transfer) : Number(item.nominal || 0);
      return sum + base + Number(item.biaya_transfer || 0);
    }, 0);
  }, [filteredMutations]);

  // Selection helpers
  const isAllFilteredSelected = useMemo(() => {
    if (filteredMutations.length === 0) return false;
    return filteredMutations.every(m => selectedItems.has(m.id));
  }, [filteredMutations, selectedItems]);

  const toggleSelectAllFiltered = () => {
    const next = new Map(selectedItems);
    if (isAllFilteredSelected) {
      filteredMutations.forEach(m => next.delete(m.id));
    } else {
      filteredMutations.forEach(m => next.set(m.id, m));
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
      const d = formatDateTime(m.payment_batches?.paid_at || m.paid_at);
      const baseNominal = m.actual_transfer != null ? Number(m.actual_transfer) : Number(m.nominal || 0);
      const fee = Number(m.biaya_transfer || 0);
      const total = baseNominal + fee;
      const bankName = m.creator_bank_accounts?.bank_name || m.metode_pembayaran || 'Bank';
      const username = m.campaign_creators?.creators?.username || '-';

      return {
        'No': idx + 1,
        'Tanggal Bayar': d,
        'Batch': m.payment_batches?.batch_label || '-',
        'Username': `@${username}`,
        'Nama Penerima': m.nama_penerima || '-',
        'Bank / E-Wallet': bankName,
        'Nomor Rekening': `'${m.nomor_rekening || '-'}`,
        'Tipe Pembayaran': getPaymentTypeLabel(m.payment_type),
        'Catatan': m.notes || '-',
        'Nominal Transfer (Rp)': baseNominal,
        'Biaya Transfer (Rp)': fee,
        'Total Dibayar (Rp)': total,
        'Status': m.final_status || 'paid',
        'Bukti Transfer': m.bukti_transfer || m.bukti_transfer_url || m.payment_batches?.bukti_transfer_url || '-'
      };
    });
  };

  const handleExport = (format: 'xlsx' | 'csv') => {
    try {
      setIsExporting(true);
      const isSelected = selectedItems.size > 0;
      const itemsToExport = isSelected 
        ? Array.from(selectedItems.values()) 
        : filteredMutations;

      if (itemsToExport.length === 0) {
        alert('Tidak ada data yang dapat diexport.');
        return;
      }

      const rows = buildExportRows(itemsToExport);
      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Auto-fit column widths
      worksheet['!cols'] = [
        { wch: 6 },  // No
        { wch: 18 }, // Tanggal Bayar
        { wch: 22 }, // Batch
        { wch: 20 }, // Username
        { wch: 24 }, // Nama Penerima
        { wch: 16 }, // Bank
        { wch: 20 }, // Nomor Rekening
        { wch: 20 }, // Tipe Pembayaran
        { wch: 26 }, // Catatan
        { wch: 18 }, // Nominal
        { wch: 16 }, // Biaya Transfer
        { wch: 18 }, // Total
        { wch: 12 }, // Status
        { wch: 35 }, // Bukti
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Mutasi Kreator');

      const prefix = isSelected ? `Terpilih_${selectedItems.size}_` : '';
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Mutasi_Kreator_Campaign_${campaignId}_${prefix}${dateStr}.${format}`;

      XLSX.writeFile(workbook, filename, { bookType: format });
    } catch (err: any) {
      console.error('Export error:', err);
      alert('Gagal mengekspor data: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Mutasi Pembayaran Kreator</h2>
          <p className="text-sm text-slate-500">Daftar pembayaran yang sudah sukses dicairkan ke kreator untuk campaign ini.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <div className="text-xs text-slate-500 font-medium">Total Nominal (Filtered)</div>
            <div className="text-xl font-bold text-emerald-600">Rp {totalPaid.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Floating / Sticky Selection Banner if items selected */}
      {selectedItems.size > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
            <div>
              <div className="text-sm font-bold text-emerald-900">
                {selectedItems.size} Tagihan Kreator Terpilih
              </div>
              <div className="text-xs text-emerald-700">
                Total Transfer Terpilih: <span className="font-bold">Rp {selectedTotalNominal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectAllFiltered}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100/60 rounded-lg transition-colors"
            >
              {isAllFilteredSelected ? 'Batalkan Filter Ini' : 'Pilih Semua Hasil Filter'}
            </button>
            <button
              onClick={clearSelection}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Batal Semua Seleksi
            </button>
          </div>
        </div>
      )}

      {/* Action / Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari username, nama penerima, rekening, batch..."
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 transition-colors bg-white"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Export Buttons */}
            <button
              onClick={() => handleExport('xlsx')}
              disabled={isExporting || filteredMutations.length === 0}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all ${
                selectedItems.size > 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={selectedItems.size > 0 ? `Export ${selectedItems.size} tagihan terpilih ke Excel` : 'Export seluruh hasil filter ke Excel'}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin text-current" />
              ) : (
                <FileSpreadsheet className={`w-4 h-4 ${selectedItems.size > 0 ? 'text-white' : 'text-emerald-600'}`} />
              )}
              <span>{selectedItems.size > 0 ? `Export Excel Terpilih (${selectedItems.size})` : 'Export Excel'}</span>
            </button>

            <button
              onClick={() => handleExport('csv')}
              disabled={isExporting || filteredMutations.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export format CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>CSV</span>
            </button>
          </div>
        </div>
        
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              <tr>
                <th className="px-3 py-3 w-10 text-center">
                  <button
                    onClick={toggleSelectAllFiltered}
                    disabled={filteredMutations.length === 0}
                    className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors disabled:opacity-40"
                    title={isAllFilteredSelected ? 'Batal pilih semua' : 'Pilih semua di halaman ini'}
                  >
                    {isAllFilteredSelected ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3">Tgl Bayar</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Kreator & Rekening</th>
                <th className="px-4 py-3 text-center">Tipe</th>
                <th className="px-4 py-3 max-w-[150px]">Catatan</th>
                <th className="px-4 py-3 text-right">Nominal + TF</th>
                <th className="px-4 py-3 text-center">Bukti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Memuat data mutasi...</p>
                  </td>
                </tr>
              ) : filteredMutations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    {searchTerm ? 'Tidak ada data mutasi yang cocok dengan pencarian.' : 'Belum ada data pembayaran kreator di campaign ini.'}
                  </td>
                </tr>
              ) : (
                filteredMutations.map(item => {
                  const isSelected = selectedItems.has(item.id);
                  const nominal = Number(item.actual_transfer || item.nominal || 0);
                  const biayaTf = Number(item.biaya_transfer || 0);
                  const total = nominal + biayaTf;
                  const bankName = item.creator_bank_accounts?.bank_name || item.metode_pembayaran || 'Bank';
                  const datePaid = formatDateTime(item.payment_batches?.paid_at || item.paid_at);
                  const username = item.campaign_creators?.creators?.username || '-';

                  return (
                    <tr 
                      key={item.id} 
                      className={`transition-colors ${isSelected ? 'bg-emerald-50/60 hover:bg-emerald-50' : 'hover:bg-slate-50/80'}`}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelectItem(item)}
                          className="p-1 hover:bg-slate-200/80 rounded transition-colors text-slate-600"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                          )}
                        </button>
                      </td>

                      <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{datePaid}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono">{item.payment_batches?.batch_label || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">@{username}</div>
                        <div className="text-xs text-slate-600">{item.nama_penerima}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{bankName} - {item.nomor_rekening}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-[10px] font-bold uppercase whitespace-nowrap">
                          {getPaymentTypeLabel(item.payment_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[150px]">
                        <div className="text-[11px] text-slate-600 truncate" title={item.notes}>{item.notes || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-bold text-slate-800">Rp {total.toLocaleString()}</div>
                        {biayaTf > 0 && <div className="text-[10px] text-slate-400">+TF Rp {biayaTf.toLocaleString()}</div>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.bukti_transfer || item.bukti_transfer_url || item.payment_batches?.bukti_transfer_url ? (
                          <a 
                            href={item.bukti_transfer || item.bukti_transfer_url || item.payment_batches?.bukti_transfer_url} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="inline-flex items-center justify-center p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors shadow-xs" 
                            title="Lihat Bukti Transfer"
                          >
                            <LinkIcon className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
