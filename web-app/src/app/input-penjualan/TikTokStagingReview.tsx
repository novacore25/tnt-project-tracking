"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  ArrowRight, 
  Trash2, 
  Search, 
  Database, 
  ExternalLink,
  ShieldCheck,
  ShoppingBag
} from 'lucide-react';
import { formatRupiah } from '@/utils/formatters';
import { 
  getTikTokSyncStagingAction, 
  applyTikTokSyncStagingAction, 
  clearTikTokSyncStagingAction 
} from '@/app/actions/tiktokShopActions';

export default function TikTokStagingReview() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'applied'>('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 30;

  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    total_count: 0,
    total_gmv: 0,
    total_qty: 0,
    mapped_count: 0,
    unmapped_count: 0
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTikTokSyncStagingAction({
        status: statusFilter,
        limit,
        offset: (page - 1) * limit,
        search
      });

      if (res.success) {
        setItems(res.items || []);
        setSummary({
          total_count: Number(res.summary?.total_count || 0),
          total_gmv: Number(res.summary?.total_gmv || 0),
          total_qty: Number(res.summary?.total_qty || 0),
          mapped_count: Number(res.summary?.mapped_count || 0),
          unmapped_count: Number(res.summary?.unmapped_count || 0)
        });
      } else {
        setMessage({ type: 'error', text: res.error || 'Gagal mengambil data staging' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Terjadi kesalahan sistem' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApply = async () => {
    if (!confirm(`Terapkan ${summary.total_count} pesanan pending dari staging ke tabel Penjualan Utama (sales)?\n\nData akan digabungkan secara aman tanpa menduplikasi data yang sudah ada.`)) {
      return;
    }

    setActionLoading(true);
    setMessage(null);
    try {
      const res = await applyTikTokSyncStagingAction();
      if (res.success) {
        setMessage({ 
          type: 'success', 
          text: res.message || `Berhasil menerapkan ${res.count} order ke tabel sales utama.` 
        });
        fetchData();
      } else {
        setMessage({ type: 'error', text: res.error || 'Gagal menerapkan data staging' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Terjadi kesalahan' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm(`Peringatan: Anda akan menghapus SELURUH ${summary.total_count} pesanan berstatus '${statusFilter}' di tabel staging.\n\nTindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    setActionLoading(true);
    setMessage(null);
    try {
      const res = await clearTikTokSyncStagingAction(statusFilter);
      if (res.success) {
        setMessage({ type: 'success', text: `Tabel staging status '${statusFilter}' berhasil dibersihkan.` });
        fetchData();
      } else {
        setMessage({ type: 'error', text: res.error || 'Gagal membersihkan staging' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Terjadi kesalahan' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Informasi Keamanan */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-xl p-5 shadow-sm border border-indigo-700/40">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-500/20 rounded-lg text-indigo-300 mt-0.5">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-white">Staging Buffer Auto-Sync TikTok Shop</h3>
            <p className="text-slate-300 text-sm mt-1 leading-relaxed">
              Pesanan hasil penarikan otomatis dari OpenAPI TikTok Shop (TAP / Affiliate Orders) masuk ke dalam zona isolasi staging ini terlebih dahulu. 
              Data ini <strong>belum dimasukkan ke tabel sales utama</strong> dan <strong>tidak mempengaruhi metrik dashboard</strong> sebelum Anda mereview dan menekan tombol <span className="text-indigo-300 font-semibold">&quot;Terapkan ke Penjualan Utama&quot;</span>.
            </p>
          </div>
        </div>
      </div>

      {/* Alert Notifikasi */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center justify-between text-sm ${
          message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs font-semibold underline hover:opacity-80">
            Tutup
          </button>
        </div>
      )}

      {/* Kartu Ringkasan Metrik */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {statusFilter === 'pending' ? 'Pending Staging' : 'Applied Orders'}
            </p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-slate-900">{summary.total_count.toLocaleString('id-ID')}</span>
              <span className="text-xs text-slate-500">pesanan</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Total {summary.total_qty.toLocaleString('id-ID')} unit produk</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total GMV Staging</p>
            <div className="mt-2">
              <span className="text-2xl font-bold text-indigo-600">{formatRupiah(summary.total_gmv)}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Estimasi omset di buffer</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Terpetakan ke Campaign</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-emerald-600">{summary.mapped_count.toLocaleString('id-ID')}</span>
              <span className="text-xs text-slate-500">
                ({summary.total_count > 0 ? Math.round((summary.mapped_count / summary.total_count) * 100) : 0}%)
              </span>
            </div>
            <p className="text-xs text-emerald-700 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> SKU / Product ID cocok
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Belum Terpetakan</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-amber-600">{summary.unmapped_count.toLocaleString('id-ID')}</span>
              <span className="text-xs text-slate-500">
                ({summary.total_count > 0 ? Math.round((summary.unmapped_count / summary.total_count) * 100) : 0}%)
              </span>
            </div>
            <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Belum ada mapping SKU
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Kontrol Filter & Aksi */}
      <Card className="border-slate-200">
        <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => { setStatusFilter('pending'); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === 'pending'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pending ({statusFilter === 'pending' ? summary.total_count : '...'})
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter('applied'); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === 'applied'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sudah Diterapkan
              </button>
            </div>

            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Cari order, creator, produk..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            {statusFilter === 'pending' && summary.total_count > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                  disabled={actionLoading || loading}
                  className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Kosongkan Staging
                </Button>

                <Button
                  size="sm"
                  onClick={handleApply}
                  disabled={actionLoading || loading}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                >
                  <Database className="w-3.5 h-3.5 mr-1.5" />
                  {actionLoading ? 'Menerapkan...' : 'Terapkan ke Penjualan Utama'}
                </Button>
              </>
            )}

            {statusFilter === 'applied' && (
              <span className="text-xs text-slate-500">
                Data di tab ini sudah masuk ke tabel sales utama.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabel Data Staging */}
      <Card className="border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Order ID & Tanggal</th>
                <th className="px-4 py-3">Creator</th>
                <th className="px-4 py-3">Produk / Product ID</th>
                <th className="px-4 py-3">Campaign Terpetakan</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">GMV</th>
                <th className="px-4 py-3 text-center">Status Order</th>
                <th className="px-4 py-3 text-center">Staging</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                    Memuat data staging...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <ShoppingBag className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    Tidak ada pesanan staging yang ditemukan untuk status &apos;{statusFilter}&apos;.
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const dateStr = row.tanggal ? new Date(row.tanggal).toLocaleString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : '-';

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-mono font-medium text-slate-900">{row.order_id}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{dateStr}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {row.creator_username ? `@${row.creator_username}` : <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-slate-600 text-[11px] truncate max-w-[180px]">
                          {row.product_id || '-'}
                        </div>
                        {row.sku_id && (
                          <div className="text-[10px] text-slate-400 font-mono">SKU: {row.sku_id}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.campaign_nama ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {row.campaign_nama}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            Belum Terpetakan
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">
                        {row.quantity || 1}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatRupiah(row.gmv)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.is_refund ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                            REFUND
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                            {row.order_status || 'COMPLETED'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.sync_status === 'applied' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Applied
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Sederhana */}
        {summary.total_count > limit && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <div>
              Menampilkan {((page - 1) * limit) + 1} - {Math.min(page * limit, summary.total_count)} dari {summary.total_count} pesanan
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="text-xs"
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page * limit >= summary.total_count || loading}
                className="text-xs"
              >
                Selanjutnya
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
