"use client";

import { useState, useEffect } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { fetchInvoiceDataAction, fetchInvoiceRincianAction, approveInvoiceAction, rejectInvoiceAction } from "@/app/actions/invoiceActions";

export default function InvoicePage() {
  const { campaigns } = useDatabaseStore();
  
  const [payout_requests, setPayoutRequests] = useState<any[]>([]);
  const [payout_creator, setPayoutCreator] = useState<any[]>([]);

  const fetchInvoiceData = async () => {
    try {
      const data = await fetchInvoiceDataAction();
      if (data.payout_requests) setPayoutRequests(data.payout_requests);
      if (data.payout_creator) setPayoutCreator(data.payout_creator);
    } catch (err) {
      console.error("Error fetching invoice data:", err);
    }
  };

  useEffect(() => {
    fetchInvoiceData();
  }, []);

  const pendingRequests = payout_requests.filter(r => r.status === 'pending');
  const historyRequests = payout_requests.filter(r => r.status !== 'pending').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Modal State
  const [approvalModal, setApprovalModal] = useState<{ reqId: number; type: 'creator' | 'ads'; rincian?: any[] } | null>(null);
  const [buktiUrl, setBuktiUrl] = useState('');
  const [statusBayar, setStatusBayar] = useState<Record<number, 'sebagian' | 'lunas'>>({});

  const openApproval = async (req: any) => {
    let rincian: any[] = [];
    if (req.jenis_topup === 'creator') {
      rincian = await fetchInvoiceRincianAction(req.id);
      
      // Set default status to lunas
      const defaultStatus: any = {};
      rincian.forEach(r => defaultStatus[r.id] = 'lunas');
      setStatusBayar(defaultStatus);
    }
    setApprovalModal({ reqId: req.id, type: req.jenis_topup, rincian });
    setBuktiUrl('');
  };

  const handleApprove = async () => {
    if (!approvalModal) return;
    setProcessingId(approvalModal.reqId);
    
    try {
      await approveInvoiceAction(
        approvalModal.reqId,
        approvalModal.type,
        approvalModal.rincian || [],
        statusBayar,
        buktiUrl
      );

      setApprovalModal(null);
      fetchInvoiceData(); // Refresh data
    } catch (err: any) {
      alert("Error approving: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (reqId: number) => {
    if (confirm("Yakin ingin menolak request ini?")) {
      setProcessingId(reqId);
      try {
        await rejectInvoiceAction(reqId);
        fetchInvoiceData();
      } catch (err: any) {
        alert("Error rejecting: " + err.message);
      } finally {
        setProcessingId(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Invoice & Payout</h1>
        <p className="text-slate-500">Laman persetujuan pencairan dana oleh tim Finance.</p>
      </div>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <button onClick={() => setActiveTab('pending')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'pending' ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            Menunggu Persetujuan ({pendingRequests.length})
          </button>
          <button onClick={() => setActiveTab('history')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'history' ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            Riwayat Pencairan
          </button>
        </nav>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead>Status</TableHead>
                {activeTab === 'pending' && <TableHead className="text-right">Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(activeTab === 'pending' ? pendingRequests : historyRequests).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    Tidak ada data.
                  </TableCell>
                </TableRow>
              ) : (
                (activeTab === 'pending' ? pendingRequests : historyRequests).map(req => {
                  const camp = campaigns.find(c => c.id === req.campaign_id);
                  return (
                    <TableRow key={req.id}>
                      <TableCell>{new Date(req.created_at).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell className="font-medium">{camp?.nama}</TableCell>
                      <TableCell>
                        <Badge variant={req.jenis_topup === 'ads' ? 'warning' : 'outline'} className="uppercase">
                          {req.jenis_topup}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold">Rp {req.nominal.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'destructive' : 'secondary'}>
                          {req.status}
                        </Badge>
                      </TableCell>
                      {activeTab === 'pending' && (
                        <TableCell className="text-right space-x-2">
                          <Button size="sm" variant="outline" onClick={() => handleReject(req.id)} disabled={processingId === req.id} className="text-red-500 hover:text-red-600">Tolak</Button>
                          <Button size="sm" onClick={() => openApproval(req)} disabled={processingId === req.id}>Proses Bayar</Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Approval */}
      {approvalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold">Proses Pencairan Dana</h3>
              <p className="text-sm text-slate-500">Konfirmasi transfer dan upload bukti pembayaran.</p>
            </div>
            
            {approvalModal.type === 'creator' && approvalModal.rincian && (
              <div className="space-y-3 bg-slate-50 p-4 rounded-lg">
                <p className="text-sm font-semibold mb-2">Rincian Kreator:</p>
                {approvalModal.rincian.map(r => (
                  <div key={r.id} className="flex justify-between items-center text-sm bg-white p-2 border rounded">
                    <span>@{r.creator_username}</span>
                    <span className="font-bold">Rp {r.nominal.toLocaleString()}</span>
                    <select 
                      className="p-1 border border-slate-200 rounded text-xs"
                      value={statusBayar[r.id]}
                      onChange={(e) => setStatusBayar({...statusBayar, [r.id]: e.target.value as any})}
                    >
                      <option value="sebagian">Sebagian</option>
                      <option value="lunas">Lunas</option>
                    </select>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Link Bukti Transfer</label>
              <input 
                type="text" 
                placeholder="https://drive.google.com/..." 
                className="w-full p-2 border border-slate-300 rounded-lg" 
                value={buktiUrl} 
                onChange={e => setBuktiUrl(e.target.value)} 
              />
              <p className="text-xs text-slate-400">Tempelkan link Google Drive / Dropbox yang berisi foto bukti transfer.</p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="ghost" onClick={() => setApprovalModal(null)}>Batal</Button>
              <Button onClick={handleApprove} disabled={processingId !== null}>
                {processingId ? "Memproses..." : "Selesai & Lunas"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
