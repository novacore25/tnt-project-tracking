"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Upload, Loader2, ArrowRight, FileSpreadsheet, DollarSign, AlertCircle, CheckCircle } from "lucide-react";
import { parseBudgetFileHeaders, parseBudgetSyncFile, ParsedBudgetRow, BudgetColumnMapping } from "@/utils/importBudgetSync";
import { exportErrorLogToExcel, ErrorLogItem } from "@/utils/exportErrorLog";
import { Download } from "lucide-react";
import { fetchApprovedCreatorsForBatch, bulkSyncBudgetRows } from "@/app/campaigns/actions/paymentActions";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";

export function BudgetSyncModal({ campaignId: initialCampaignId, onComplete }: { campaignId?: number; onComplete?: () => void }) {
  const { campaigns } = useDatabaseStore();
  const [campaignId, setCampaignId] = useState(initialCampaignId || 0);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1|2|3|4>(1);
  const [file, setFile] = useState<File | null>(null);

  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<BudgetColumnMapping>({
    username: '',
    ratecard: '',
    pelunasan: '',
    status_bayar: '',
    tgl_pembayaran: ''
  });

  const [preview, setPreview] = useState<ParsedBudgetRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitProgress, setCommitProgress] = useState(0);
  const [commitStatus, setCommitStatus] = useState('');
  const [errorLog, setErrorLog] = useState<ErrorLogItem[]>([]);
  const [resultStats, setResultStats] = useState({ updated: 0, notFound: 0, errors: 0 });

  const resetState = () => {
    setStep(1);
    setFile(null);
    setCsvHeaders([]);
    setMapping({ username: '', ratecard: '', pelunasan: '', status_bayar: '', tgl_pembayaran: '' });
    setPreview([]);
    setErrors([]);
    setIsProcessing(false);
    setIsCommitting(false);
    setCommitProgress(0);
    setCommitStatus('');
    setErrorLog([]);
    setResultStats({ updated: 0, notFound: 0, errors: 0 });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    try {
      const headers = await parseBudgetFileHeaders(f);
      setCsvHeaders(headers);

      // Auto-guess mapping
      const guess: BudgetColumnMapping = { username: '', ratecard: '', pelunasan: '', status_bayar: '', tgl_pembayaran: '' };
      headers.forEach(h => {
        const lh = h.toLowerCase();
        if (lh.includes('username') || lh === 'user' || lh === 'id') guess.username = h;
        if (lh.includes('rate') || lh.includes('ratecard') || lh.includes('harga') || lh.includes('price')) guess.ratecard = h;
        if (lh.includes('pelunasan') || lh.includes('bayar') || lh.includes('paid') || lh.includes('payment')) guess.pelunasan = h;
        if (lh.includes('status')) guess.status_bayar = h;
        if (lh.includes('tgl') || lh.includes('tanggal') || lh.includes('date')) guess.tgl_pembayaran = h;
      });
      setMapping(guess);
    } catch (err) {
      setErrors(['Gagal membaca file. Pastikan format CSV atau Excel.']);
    }
  };

  const handleParse = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const result = await parseBudgetSyncFile(file, mapping);
      setPreview(result.validData);
      setErrors(result.errors);
      setStep(3);
    } catch (err) {
      setErrors(['Gagal memproses file.']);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommit = async () => {
    if (!campaignId) return;
    setIsCommitting(true);
    setCommitProgress(0);

    let updated = 0;
    let notFound = 0;
    let errorCount = 0;

    // Fetch existing campaign_creators for this campaign
    const existingCcs = await fetchApprovedCreatorsForBatch(campaignId);

    const ccMap = new Map<string, any>();
    (existingCcs || []).forEach(cc => {
      const u = (cc as any).creators?.username?.toLowerCase();
      if (u) ccMap.set(u, cc);
    });

    const localErrorLog: ErrorLogItem[] = [];

    // Deduplikasi preview (ambil data terakhir jika ada username ganda di excel)
    const uniquePreview = Array.from(new Map(preview.map(item => [item.username.toLowerCase(), item])).values());
    const validRowsToSync: any[] = [];

    for (const row of uniquePreview) {
      const cc = ccMap.get(row.username.toLowerCase());
      if (!cc) {
        notFound++;
        localErrorLog.push({ username: row.username, pesan_error: 'Tidak ditemukan di Campaign atau belum Approved', data_mentah: row });
      } else {
        validRowsToSync.push({
          id: cc.id,
          price: row.ratecard !== null ? row.ratecard : undefined,
          nominal_pelunasan: row.pelunasan !== null ? row.pelunasan : undefined,
          status_bayar: row.status_bayar || undefined,
          tgl_pembayaran: row.tgl_pembayaran || undefined,
        });
      }
    }

    if (validRowsToSync.length > 0) {
      setCommitStatus(`Menyimpan ${validRowsToSync.length} data ke database...`);
      setCommitProgress(50);
      try {
        await bulkSyncBudgetRows(validRowsToSync);
        updated = validRowsToSync.length;
        setCommitProgress(100);
      } catch (err: any) {
        errorCount = validRowsToSync.length;
        localErrorLog.push({ username: 'batch', pesan_error: `Error bulk update: ${err?.message}`, data_mentah: {} });
      }
    }

    setErrorLog(localErrorLog);
    setResultStats({ updated, notFound, errors: errorCount });
    setStep(4);
    setIsCommitting(false);
    if (onComplete) onComplete();
  };

  const getStatusLabel = (s: string) => {
    if (s === 'lunas') return 'Paid Off';
    if (s === 'sebagian') return 'Half Paid';
    if (s === 'no_payment') return 'No Payment';
    return 'Not Yet';
  };

  const getStatusColor = (s: string) => {
    if (s === 'lunas') return 'success';
    if (s === 'sebagian') return 'warning';
    if (s === 'no_payment') return 'default';
    return 'outline';
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetState(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Upload className="w-4 h-4" /> Upload Spreadsheet Budget
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" /> Migrasi Data Budget Creator
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <label className="text-sm font-medium">1. Pilih Campaign Tujuan</label>
              <select
                className="w-full p-3 border rounded-lg text-sm bg-white"
                value={campaignId}
                onChange={e => setCampaignId(Number(e.target.value))}
              >
                <option value={0}>-- Pilih Campaign --</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.nama}</option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">2. Upload File (CSV / Excel)</label>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="w-full text-sm"
                />
              </div>
              {file && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> {file.name} berhasil dimuat ({csvHeaders.length} kolom terdeteksi)
                </p>
              )}
            </div>

            <Button
              disabled={!campaignId || !file}
              onClick={() => setStep(2)}
              className="w-full gap-2"
            >
              Lanjut ke Mapping Kolom <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 py-4">
            <p className="text-sm text-slate-600">Cocokkan kolom di file Anda dengan data sistem:</p>
            
            {[
              { key: 'username', label: 'Username (Wajib)', required: true },
              { key: 'ratecard', label: 'Total Rate Card', required: false },
              { key: 'pelunasan', label: 'Pelunasan', required: false },
              { key: 'status_bayar', label: 'Status Bayar', required: false },
              { key: 'tgl_pembayaran', label: 'Tgl Pembayaran', required: false },
            ].map(field => (
              <div key={field.key} className="flex items-center gap-4">
                <span className={`text-sm w-40 ${field.required ? 'font-bold' : 'text-slate-600'}`}>
                  {field.label}
                </span>
                <select
                  className="flex-1 p-2 border rounded text-sm bg-white"
                  value={(mapping as any)[field.key]}
                  onChange={e => setMapping({ ...mapping, [field.key]: e.target.value })}
                >
                  <option value="">-- Tidak dimapping --</option>
                  {csvHeaders.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}

            {errors.length > 0 && (
              <div className="bg-red-50 p-3 rounded border border-red-200 text-sm text-red-700">
                {errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>Kembali</Button>
              <Button
                disabled={!mapping.username || isProcessing}
                onClick={handleParse}
                className="flex-1 gap-2"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isProcessing ? 'Memproses...' : 'Proses & Preview'}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Preview Data ({preview.length} baris)</h3>
              <Badge variant="outline">{campaigns.find(c => c.id === campaignId)?.nama}</Badge>
            </div>

            {errors.length > 0 && (
              <div className="bg-amber-50 p-3 rounded border border-amber-200 text-sm text-amber-700 max-h-24 overflow-y-auto">
                <p className="font-semibold mb-1"><AlertCircle className="w-4 h-4 inline mr-1" />{errors.length} peringatan:</p>
                {errors.slice(0, 5).map((e, i) => <p key={i}>{e}</p>)}
                {errors.length > 5 && <p className="italic">...dan {errors.length - 5} lainnya</p>}
              </div>
            )}

            <div className="max-h-[40vh] overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead className="text-right">Rate Card</TableHead>
                    <TableHead className="text-right">Pelunasan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tgl Bayar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-slate-400">{i + 1}</TableCell>
                      <TableCell className="font-medium">@{row.username}</TableCell>
                      <TableCell className="text-right">{row.ratecard !== null ? `Rp ${row.ratecard.toLocaleString()}` : '-'}</TableCell>
                      <TableCell className="text-right">{row.pelunasan !== null ? `Rp ${row.pelunasan.toLocaleString()}` : '-'}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(row.status_bayar) as any}>{getStatusLabel(row.status_bayar)}</Badge>
                      </TableCell>
                      <TableCell>{row.tgl_pembayaran || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)}>Kembali</Button>
              <Button
                onClick={handleCommit}
                disabled={isCommitting || preview.length === 0}
                className="flex-1 gap-2"
              >
                {isCommitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {isCommitting ? `${commitStatus} (${commitProgress}%)` : `Commit ${preview.length} Data ke Database`}
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="py-8 text-center space-y-6">
            <CheckCircle className="w-16 h-16 mx-auto text-green-500" />
            <h3 className="text-2xl font-bold text-green-700">Migrasi Budget Selesai!</h3>
            
            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="text-2xl font-bold text-green-700">{resultStats.updated}</p>
                <p className="text-xs text-green-600">Berhasil Diupdate</p>
              </div>
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <p className="text-2xl font-bold text-amber-700">{resultStats.notFound}</p>
                <p className="text-xs text-amber-600">Tidak Ditemukan</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <p className="text-2xl font-bold text-red-700">{resultStats.errors}</p>
                <p className="text-xs text-red-600">Gagal</p>
              </div>
            </div>

            <p className="text-sm text-slate-500">
              Kreator &quot;Tidak Ditemukan&quot; berarti username-nya belum terdaftar sebagai Approved di campaign ini.
            </p>

            {errorLog.length > 0 && (
              <div className="w-full bg-red-50 p-4 rounded-xl text-sm space-y-3 max-h-40 overflow-y-auto text-left border border-red-100 mt-4">
                <div className="flex justify-between items-center">
                  <p className="font-semibold text-red-700">Peringatan: {errorLog.length} baris gagal diproses</p>
                  <Button size="sm" variant="outline" className="text-red-700 border-red-200 hover:bg-red-100" onClick={() => exportErrorLogToExcel(errorLog, 'ErrorLog_BudgetSync')}>
                    <Download className="w-4 h-4 mr-2" /> Download Error Log
                  </Button>
                </div>
                <ul className="list-disc list-inside text-red-600 text-xs">
                  {errorLog.slice(0, 3).map((e, i) => (
                    <li key={i}>@{e.username}: {e.pesan_error}</li>
                  ))}
                  {errorLog.length > 3 && <li>...dan {errorLog.length - 3} lainnya</li>}
                </ul>
              </div>
            )}

            <Button onClick={() => { setOpen(false); resetState(); }} className="px-8">
              Tutup
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
