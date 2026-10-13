import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Link as LinkIcon, Search } from 'lucide-react';
import { fetchCampaignCreatorMutations } from '../app/campaigns/actions/paymentActions';
import { formatDateTime } from '@/utils/formatters';

export function CampaignCreatorMutationTab({ campaignId }: { campaignId: number }) {
  const [mutations, setMutations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredMutations = mutations.filter(m => {
    const searchStr = searchTerm.toLowerCase();
    const username = m.campaign_creators?.creators?.username?.toLowerCase() || '';
    const name = m.nama_penerima?.toLowerCase() || '';
    const notes = m.notes?.toLowerCase() || '';
    return username.includes(searchStr) || name.includes(searchStr) || notes.includes(searchStr);
  });

  const getPaymentTypeLabel = (type: string) => {
    switch (type) {
      case '100_awal': return '100% Awal (Upfront)';
      case '100_akhir': return 'Full Payment (Akhir)';
      case '50_awal': return 'DP 50%';
      case '50_akhir': return 'Pelunasan 50%';
      default: return type?.replace('_', ' ') || '-';
    }
  };

  const totalPaid = filteredMutations.reduce((sum, item) => sum + (Number(item.actual_transfer || item.nominal || 0) + Number(item.biaya_transfer || 0)), 0);

  return (
    <div className="space-y-4 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Mutasi Pembayaran Kreator</h2>
          <p className="text-sm text-slate-500">Daftar pembayaran yang sudah sukses dicairkan ke kreator untuk campaign ini.</p>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-xs text-slate-500 font-medium">Total Nominal (Filtered)</div>
          <div className="text-xl font-bold text-emerald-600">Rp {totalPaid.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari username, nama penerima, atau catatan..."
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 transition-colors"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-600 font-medium">
              <tr>
                <th className="px-4 py-3">Tgl Bayar</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Kreator & Rekening</th>
                <th className="px-4 py-3 text-center">Tipe</th>
                <th className="px-4 py-3 max-w-[150px]">Catatan</th>
                <th className="px-4 py-3 text-right">Nominal + TF</th>
                <th className="px-4 py-3 text-center">Bukti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-slate-500">Memuat data mutasi...</p>
                  </td>
                </tr>
              ) : filteredMutations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    {searchTerm ? 'Tidak ada data mutasi yang cocok dengan pencarian.' : 'Belum ada data pembayaran kreator di campaign ini.'}
                  </td>
                </tr>
              ) : (
                filteredMutations.map(item => {
                  const nominal = Number(item.actual_transfer || item.nominal || 0);
                  const biayaTf = Number(item.biaya_transfer || 0);
                  const total = nominal + biayaTf;
                  const bankName = item.creator_bank_accounts?.bank_name || item.metode_pembayaran || 'Bank';
                  const datePaid = formatDateTime(item.payment_batches?.paid_at);
                  const username = item.campaign_creators?.creators?.username || '-';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{datePaid}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{item.payment_batches?.batch_label || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">@{username}</div>
                        <div className="text-xs text-slate-500">{item.nama_penerima}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{bankName} - {item.nomor_rekening}</div>
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
                          <a href={item.bukti_transfer || item.bukti_transfer_url || item.payment_batches?.bukti_transfer_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center p-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors" title="Lihat Bukti Transfer">
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
