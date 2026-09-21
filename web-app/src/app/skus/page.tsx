"use client";

import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import { useState } from "react";
import { Edit2, Trash2, ExternalLink, RefreshCcw, Loader2 } from "lucide-react";
import { syncOrphanedSalesAction } from "@/app/actions/importActions";

export default function SkuPage() {
  const { skus, campaigns, addSku, updateSku, deleteSku } = useDatabaseStore();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    campaign_id: '',
    product_id: '',
    nama_produk: '',
    commission: '',
    satuan_bundle: '',
    link_gmv_max: '',
    link_tap: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.campaign_id) {
      alert("Pilih Campaign terlebih dahulu!");
      return;
    }

    const payload = {
      campaign_id: Number(formData.campaign_id),
      product_id: formData.product_id,
      nama_produk: formData.nama_produk,
      commission: formData.commission ? Number(formData.commission) : null,
      satuan_bundle: formData.satuan_bundle || null,
      link_gmv_max: formData.link_gmv_max || null,
      link_tap: formData.link_tap || null
    };

    try {
      if (editingId) {
        await updateSku(editingId, payload);
      } else {
        await addSku(payload);
      }
      setIsOpen(false);
      resetForm();
    } catch (err: any) {
      alert("Gagal menyimpan SKU: " + err.message);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      campaign_id: '',
      product_id: '',
      nama_produk: '',
      commission: '',
      satuan_bundle: '',
      link_gmv_max: '',
      link_tap: ''
    });
  };

  const handleEdit = (sku: any) => {
    setFormData({
      campaign_id: String(sku.campaign_id),
      product_id: sku.product_id,
      nama_produk: sku.nama_produk,
      commission: sku.commission ? String(sku.commission) : '',
      satuan_bundle: sku.satuan_bundle || '',
      link_gmv_max: sku.link_gmv_max || '',
      link_tap: sku.link_tap || ''
    });
    setEditingId(sku.id);
    setIsOpen(true);
  };

  const handleDelete = async (sku: any) => {
    if (confirm(`PENTING: Menghapus SKU (${sku.product_id}) akan membuat data penjualan untuk SKU ini tidak terlacak ke depannya. Anda yakin ingin menghapus?`)) {
      try {
        await deleteSku(sku.id);
      } catch (err: any) {
        alert("Gagal menghapus: " + err.message);
      }
    }
  };

  const handleSyncData = async () => {
    if (!confirm("Fitur ini akan menyinkronkan data penjualan masa lalu yang masih berstatus 'Tertunda' (tanpa Campaign). Proses ini memakan waktu beberapa detik. Lanjutkan?")) return;
    
    setIsSyncing(true);
    try {
      const res = await syncOrphanedSalesAction();
      alert(`Sinkronisasi selesai! Berhasil memetakan ulang ${res.updatedCount} baris data penjualan.`);
    } catch (err: any) {
      alert("Terjadi kesalahan saat sinkronisasi: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const getCampaignName = (id: number) => {
    return campaigns.find(c => c.id === id)?.nama || 'Unknown';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Master Produk</h1>
          <p className="text-slate-500">Kelola data SKU (Product ID) dan komisi untuk tracking GMV.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSyncData} disabled={isSyncing} className="border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-800">
            {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
            {isSyncing ? 'Menyinkronkan...' : 'Sinkronisasi Data Masa Lalu'}
          </Button>
          <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) resetForm();
            setIsOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button>+ Tambah SKU</Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit SKU' : 'Tambah SKU Baru'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Campaign</label>
                <select 
                  required 
                  className="w-full p-2 border rounded" 
                  value={formData.campaign_id} 
                  onChange={e => setFormData({...formData, campaign_id: e.target.value})}
                >
                  <option value="">Pilih Campaign</option>
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.nama}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Product ID</label>
                  <input required type="text" className="w-full p-2 border rounded" value={formData.product_id} onChange={e => setFormData({...formData, product_id: e.target.value})} placeholder="Contoh: 1731683767804069499" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Komisi (Desimal)</label>
                  <input type="number" step="0.01" className="w-full p-2 border rounded" value={formData.commission} onChange={e => setFormData({...formData, commission: e.target.value})} placeholder="Contoh: 0.1 (Untuk 10%)" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Nama Produk</label>
                <textarea required rows={2} className="w-full p-2 border rounded" value={formData.nama_produk} onChange={e => setFormData({...formData, nama_produk: e.target.value})} placeholder="Nama produk di TikTok..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Satuan / Bundle</label>
                  <input type="text" className="w-full p-2 border rounded" value={formData.satuan_bundle} onChange={e => setFormData({...formData, satuan_bundle: e.target.value})} placeholder="Contoh: Satuan" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Link GMV MAX / VSA</label>
                <input type="text" className="w-full p-2 border rounded" value={formData.link_gmv_max} onChange={e => setFormData({...formData, link_gmv_max: e.target.value})} placeholder="https://..." />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Link TAP</label>
                <input type="url" className="w-full p-2 border rounded" value={formData.link_tap} onChange={e => setFormData({...formData, link_tap: e.target.value})} placeholder="https://affiliate-id.tokopedia.com/..." />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Batal</Button>
                <Button type="submit">Simpan SKU</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Campaign</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Product ID</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500 max-w-[300px]">Nama Produk</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Komisi</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-500">Tipe</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-500">Link TAP</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {skus.map((sku) => (
                  <tr key={sku.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {getCampaignName(sku.campaign_id)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{sku.product_id}</td>
                    <td className="px-4 py-3 max-w-[300px] truncate" title={sku.nama_produk}>{sku.nama_produk}</td>
                    <td className="px-4 py-3 text-right">
                      {sku.commission !== null ? `${(sku.commission * 100).toFixed(1)}%` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-slate-500">
                      {sku.satuan_bundle || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {sku.link_tap ? (
                        <a href={sku.link_tap} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 flex justify-center">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(sku)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(sku)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {skus.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      Belum ada data SKU.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
