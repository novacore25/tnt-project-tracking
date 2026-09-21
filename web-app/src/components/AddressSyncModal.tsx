"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Upload, Download, Loader2, CheckCircle, ArrowRight, AlertTriangle } from "lucide-react";
import { UsernameAutocomplete } from "@/components/ui/UsernameAutocomplete";
import { findClosestMatch } from "@/utils/stringSimilarity";
import { downloadAddressSyncTemplate, parseAddressSyncFile, AddressColumnMapping, ParsedAddressRow } from "@/utils/importAddressSync";
import { parseFileHeaders } from "@/utils/importCampaignSync";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { exportErrorLogToExcel, ErrorLogItem } from "@/utils/exportErrorLog";
import { verifySpreadsheetCreatorsAction } from "@/app/actions/creatorActions";
import { syncAddressBatchAction } from "@/app/actions/addressActions";

export function AddressSyncModal({ campaignId: initialCampaignId, onComplete }: { campaignId?: number; onComplete?: () => void }) {
  const { campaigns, fetchData, creators, skus } = useDatabaseStore();
  const creatorUsernames = creators.map(c => c.username);
  const [campaignId, setCampaignId] = useState(initialCampaignId || 0);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1|2|3|4>(1);
  const [file, setFile] = useState<File | null>(null);
  
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<AddressColumnMapping>({
    username: '',
    nama_penerima: '',
    nama_jalan: '',
    kecamatan: '',
    kelurahan: '',
    kabupaten_kota: '',
    provinsi: '',
    kode_pos: '',
    resi: '',
    ekspedisi: '',
    proses: '',
    produk: '',
    tanggal_kirim: '',
    notes: ''
  });

  const [preview, setPreview] = useState<ParsedAddressRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [errorLog, setErrorLog] = useState<ErrorLogItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitProgress, setCommitProgress] = useState(0);
  const [commitStatus, setCommitStatus] = useState('');
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  
  const [showConfirmNewCreators, setShowConfirmNewCreators] = useState(false);
  const [pendingNewUsernames, setPendingNewUsernames] = useState<string[]>([]);

  const updatePreviewUsername = (index: number, newUsername: string) => {
    const newPreview = [...preview];
    newPreview[index].username = newUsername.replace(/\s+/g, '');
    setPreview(newPreview);
    setEditingRowIndex(null);
  };

  const campaignName = campaigns.find(c => c.id === campaignId)?.nama || '...';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setIsProcessing(true);
    setErrors([]);
    try {
      const headers = await parseFileHeaders(f);
      setCsvHeaders(headers);
      
      const guessMapping = { ...mapping };
      const lowerHeaders = headers.map(h => h.toLowerCase().trim());
      
      headers.forEach((h, i) => {
        const lh = lowerHeaders[i];
        if (lh === 'username' || lh === 'username creator') guessMapping.username = h;
        if (lh === 'nama penerima' || lh === 'penerima' || lh === 'nama' || lh.includes('penerima')) guessMapping.nama_penerima = h;
        if (lh === 'alamat lengkap' || lh === 'alamat' || lh === 'jalan' || lh === 'nama jalan' || lh.includes('jalan')) guessMapping.nama_jalan = h;
        if (lh === 'kecamatan' || lh === 'kec') guessMapping.kecamatan = h;
        if (lh === 'kelurahan' || lh === 'kel' || lh === 'desa') guessMapping.kelurahan = h;
        if (lh === 'kota/kabupaten' || lh === 'kota' || lh === 'kabupaten' || lh === 'kabupaten/kota' || lh.includes('kabupaten')) guessMapping.kabupaten_kota = h;
        if (lh === 'provinsi' || lh === 'prov') guessMapping.provinsi = h;
        if (lh === 'kode pos' || lh === 'kodepos') guessMapping.kode_pos = h;
        if (lh === 'resi' || lh === 'no resi' || lh.includes('resi')) guessMapping.resi = h;
        if (lh === 'ekspedisi' || lh === 'kurir' || lh.includes('ekspedisi')) guessMapping.ekspedisi = h;
        if (lh === 'status' || lh === 'status pengiriman' || lh === 'proses') guessMapping.proses = h;
        if (lh === 'produk' || lh === 'produk dikirim' || lh === 'product' || lh.includes('produk')) guessMapping.produk = h;
        if (lh === 'tanggal kirim' || lh === 'tgl kirim' || lh.includes('tanggal')) guessMapping.tanggal_kirim = h;
        if (lh === 'notes' || lh === 'catatan' || lh === 'keterangan') guessMapping.notes = h;
      });
      
      setMapping(guessMapping);
      setStep(2);
    } catch (err: any) {
      setErrors([err.message || "Gagal memproses header file"]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProceedMapping = async () => {
    if (!file) return;
    setIsProcessing(true);
    setErrors([]);
    try {
      const res = await parseAddressSyncFile(file, mapping);
      setPreview(res.validData);
      setErrors(res.errors);
      setStep(3);
    } catch (err: any) {
      setErrors([err.message || "Gagal memproses file"]);
    } finally {
      setIsProcessing(false);
    }
  };

  const analyzeBeforeCommit = async () => {
    if (preview.length === 0 || campaignId === 0) return;
    setIsCommitting(true);
    try {
      const uniquePreview = Array.from(new Map(preview.map(item => [item.username.toLowerCase(), item])).values());
      const usernamesArray = uniquePreview.map(p => p.username);
      
      const verification = await verifySpreadsheetCreatorsAction(usernamesArray);
      const existingCreatorUsernames = new Set(verification.map(c => c.username.toLowerCase()));
      const newUsernames = usernamesArray.filter(u => !existingCreatorUsernames.has(u.toLowerCase()));
      
      if (newUsernames.length > 0) {
        setPendingNewUsernames(newUsernames);
        setShowConfirmNewCreators(true);
        setIsCommitting(false);
      } else {
        await executeCommit([]);
      }
    } catch (err: any) {
      setErrors([err.message || "Terjadi kesalahan saat memverifikasi kreator."]);
      setIsCommitting(false);
    }
  };

  const executeCommit = async (usernamesToSkip: string[]) => {
    setIsCommitting(true);
    setCommitProgress(50);
    setCommitStatus('Menyimpan data alamat ke database...');
    
    try {
      const uniquePreview = Array.from(new Map(preview.map(item => [item.username.toLowerCase(), item])).values());
      const res = await syncAddressBatchAction(campaignId, uniquePreview, usernamesToSkip);

      setErrorLog(res.errorLog || []);
      setCommitProgress(100);
      await fetchData();
      if (onComplete) onComplete();
      setStep(4);
    } catch (err: any) {
      setErrors([err.message || "Terjadi kesalahan saat commit ke database."]);
    } finally {
      setIsCommitting(false);
      setShowConfirmNewCreators(false);
    }
  };

  const handleConfirmNewCreators = async (addThem: boolean) => {
    setShowConfirmNewCreators(false);
    if (addThem) {
      await executeCommit([]); 
    } else {
      await executeCommit(pendingNewUsernames); 
    }
  };

  const resetState = () => {
    setStep(1);
    setFile(null);
    setCsvHeaders([]);
    setPreview([]);
    setErrors([]);
    setErrorLog([]);
    setShowConfirmNewCreators(false);
    if (!initialCampaignId) setCampaignId(0);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Upload className="w-4 h-4" /> Sync Alamat (Excel/CSV)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sync Alamat (Excel/CSV)</DialogTitle>
        </DialogHeader>

        <div className="flex justify-between items-center mb-6 px-4">
          {['Pilih Campaign & Upload', 'Mapping Kolom', 'Review & Sync'].map((s, i) => (
            <div key={s} className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === i + 1 ? 'bg-blue-600 text-white' : step > i + 1 ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={`text-xs ${step === i + 1 ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>{s}</span>
            </div>
          ))}
        </div>

        <div className="space-y-6 mt-4">
          {step === 1 && (
            <div className="space-y-6">
              {!initialCampaignId && (
                <div className="space-y-2 p-4 border rounded-xl bg-slate-50">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    Pilih Campaign Tujuan
                  </label>
                  <select 
                    className="w-full p-2 border rounded-md" 
                    value={campaignId} 
                    onChange={(e) => setCampaignId(Number(e.target.value))}
                  >
                    <option value={0}>-- Pilih Campaign --</option>
                    {campaigns.filter(c => c.status === 'aktif').map(c => (
                      <option key={c.id} value={c.id}>{c.nama}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border">
                <div>
                  <p className="text-sm font-medium mb-1">Penting:</p>
                  <ul className="text-xs text-slate-600 list-disc list-inside space-y-1">
                    <li>Kreator yang belum ada di Campaign ini akan otomatis ditambahkan dengan status <strong>Pending</strong>.</li>
                    <li>Kreator yang belum ada di database pusat akan ditanyakan konfirmasinya.</li>
                  </ul>
                </div>
                <Button variant="outline" size="sm" onClick={downloadAddressSyncTemplate} className="gap-2">
                  <Download className="w-4 h-4" /> Template CSV
                </Button>
              </div>

              <div className="space-y-2">
                <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={handleFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                {isProcessing && <p className="text-xs text-blue-600">Membaca file...</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                <p className="text-sm font-medium text-amber-800 mb-2">Cocokkan Kolom Alamat</p>
                <div className="grid grid-cols-2 gap-4">
                  {(Object.keys(mapping) as Array<keyof AddressColumnMapping>).map(key => (
                    <div key={key} className="flex flex-col gap-1">
                      <label className="text-xs font-semibold uppercase text-slate-600">{key.replace('_', ' ')} <span className={key === 'username' ? 'text-red-500' : 'hidden'}>*</span></label>
                      <select 
                        value={mapping[key]}
                        onChange={e => setMapping({...mapping, [key]: e.target.value})}
                        className="p-2 border rounded text-sm bg-white"
                      >
                        <option value="">-- Abaikan (Kosong) --</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Kembali</Button>
                <Button onClick={handleProceedMapping} disabled={!mapping.username || isProcessing}>
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lanjut Preview'}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {showConfirmNewCreators ? (
                <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl space-y-4">
                  <div className="flex gap-3">
                    <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                    <div>
                      <h3 className="font-bold text-amber-900 text-lg">Kreator Tidak Ditemukan</h3>
                      <p className="text-sm text-amber-800 mt-1">
                        Terdapat <strong>{pendingNewUsernames.length} username</strong> di file Excel Anda yang tidak ada di database pusat. 
                        Pastikan nama sudah sesuai (tanpa spasi/typo).
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded border text-xs max-h-32 overflow-y-auto font-mono text-slate-600">
                    {pendingNewUsernames.join(", ")}
                  </div>

                  <p className="text-sm font-medium text-amber-900">
                    Jika nama-nama di atas memang sudah benar, apakah Anda ingin otomatis mendaftarkan mereka ke database pusat?
                  </p>

                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" onClick={() => handleConfirmNewCreators(false)}>
                      Tidak, Lewati (Masuk Error Log)
                    </Button>
                    <Button onClick={() => handleConfirmNewCreators(true)}>
                      Ya, Daftarkan Mereka
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Preview Data Alamat ({preview.length} baris)</p>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setStep(2)}>Ubah Mapping</Button>
                      <Button onClick={analyzeBeforeCommit} disabled={isCommitting} className="gap-2">
                        {isCommitting ? <><Loader2 className="w-4 h-4 animate-spin" /> {Math.round((commitProgress / preview.length) * 100)}% ({commitProgress}/{preview.length})</> : <><Upload className="w-4 h-4" /> Mulai Sinkronisasi</>}
                      </Button>
                    </div>
                  </div>

                  {errors.length > 0 && (
                    <div className="bg-red-50 text-red-600 p-3 rounded text-xs space-y-1 max-h-32 overflow-y-auto">
                      <p className="font-semibold">Peringatan / Error:</p>
                      {errors.map((e, i) => <p key={i}>- {e}</p>)}
                    </div>
                  )}

                  {preview.length > 0 && (
                    <div className="border rounded max-h-96 overflow-y-auto">
                      <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-slate-50 border-b sticky top-0 z-10">
                          <tr>
                            <th className="p-2 font-medium">Username</th>
                            <th className="p-2 font-medium">Nama Penerima</th>
                            <th className="p-2 font-medium">Alamat</th>
                            <th className="p-2 font-medium">Tgl Kirim</th>
                            <th className="p-2 font-medium">Resi</th>
                            <th className="p-2 font-medium">Ekspedisi</th>
                            <th className="p-2 font-medium min-w-[150px]">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {preview.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="p-2 align-top min-w-[250px]">
                                {editingRowIndex === i ? (
                                  <UsernameAutocomplete
                                    value={row.username}
                                    options={creatorUsernames}
                                    onChange={(val) => updatePreviewUsername(i, val)}
                                    onCancel={() => setEditingRowIndex(null)}
                                  />
                                ) : (
                                  <div className="flex flex-col gap-1 items-start">
                                    <span className="font-semibold text-slate-700">@{row.username}</span>
                                    {(() => {
                                      const exactMatch = creatorUsernames.find(u => u.toLowerCase() === row.username.toLowerCase());
                                      if (exactMatch) {
                                        return <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full font-medium w-fit">Valid</span>;
                                      }

                                      const match = findClosestMatch(row.username, creatorUsernames);
                                      return (
                                        <div className="flex flex-col gap-1 mt-1 bg-amber-50 border border-amber-100 p-1.5 rounded w-full">
                                          <span className="text-[10px] font-bold text-amber-600">⚠ Kreator Tidak Ditemukan</span>
                                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                             {match && (
                                               <button onClick={() => updatePreviewUsername(i, match.match)} className="text-[10px] px-2 py-1 bg-blue-500 text-white shadow-sm rounded hover:bg-blue-600 font-semibold transition-colors">
                                                 Ganti ➡️ @{match.match}
                                               </button>
                                             )}
                                             <button onClick={() => setEditingRowIndex(i)} className="text-[10px] px-2 py-1 bg-white border border-slate-300 shadow-sm rounded hover:bg-slate-50 text-slate-600 font-medium">
                                               Ketik Manual
                                             </button>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                              </td>
                              <td className="p-2 align-top font-medium max-w-[150px] truncate">{row.nama_penerima || '-'}</td>
                              <td className="p-2 align-top text-xs max-w-[200px] truncate">{row.nama_jalan || '-'}</td>
                              <td className="p-2 align-top text-xs max-w-[150px] truncate">{row.tanggal_kirim || '-'}</td>
                              <td className="p-2 align-top text-xs max-w-[100px] truncate">{row.resi || '-'}</td>
                              <td className="p-2 align-top text-xs max-w-[100px] truncate">{row.ekspedisi || '-'}</td>
                              <td className="p-2 align-top text-xs max-w-[150px] truncate">{row.notes || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold">Sinkronisasi Selesai!</h3>
              <p className="text-sm text-slate-500 text-center">
                Sebanyak {preview.length - errorLog.length} baris telah berhasil disinkronisasi ke dalam sistem.
              </p>

              {errorLog.length > 0 && (
                <div className="w-full bg-red-50 p-4 rounded-xl text-sm space-y-3 max-h-40 overflow-y-auto text-left border border-red-100">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-red-700">Peringatan: {errorLog.length} baris gagal diproses</p>
                    <Button size="sm" variant="outline" className="text-red-700 border-red-200 hover:bg-red-100" onClick={() => exportErrorLogToExcel(errorLog, 'ErrorLog_AddressSync')}>
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

              <Button onClick={() => { setOpen(false); onComplete?.(); }} className="mt-4 px-8">
                Selesai & Tutup
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
