"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Upload, Download, Loader2, ArrowRight, CheckCircle } from "lucide-react";
import { UsernameAutocomplete } from "@/components/ui/UsernameAutocomplete";
import { findClosestMatch } from "@/utils/stringSimilarity";
import { downloadCreatorSyncTemplate, parseCreatorSyncFile, parseFileHeaders, ParsedCreatorRow, ColumnMapping } from "@/utils/importCreatorSync";
import { executeSpreadsheetImportAction } from "@/app/actions/creatorActions";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { exportErrorLogToExcel, ErrorLogItem } from "@/utils/exportErrorLog";
import { useAuth } from "@/providers/AuthProvider";

export function CreatorSyncModal({ onComplete }: { onComplete?: () => void }) {
  const { profile } = useAuth();
  const { creators } = useDatabaseStore();
  const creatorUsernames = creators.map(c => c.username);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1|2|3|4>(1);
  const [file, setFile] = useState<File | null>(null);
  
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    username: '',
    followers: '',
    tier: '',
    level: '',
    ratecard: '',
    audience_age: '',
    gmv: '',
    no_whatsapp: ''
  });

  const [preview, setPreview] = useState<ParsedCreatorRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [errorLog, setErrorLog] = useState<ErrorLogItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitProgress, setCommitProgress] = useState(0);
  const [commitStatus, setCommitStatus] = useState('');
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  const updatePreviewUsername = (index: number, newUsername: string) => {
    const newPreview = [...preview];
    newPreview[index].username = newUsername.replace(/\s+/g, '');
    setPreview(newPreview);
    setEditingRowIndex(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setIsProcessing(true);
    setErrors([]);
    try {
      const headers = await parseFileHeaders(f);
      setCsvHeaders(headers);
      
      // Auto-guess mapping
      const guessMapping = { ...mapping };
      const lowerHeaders = headers.map(h => h.toLowerCase().trim());
      
      headers.forEach((h, i) => {
        const lh = lowerHeaders[i];
        if (lh === 'username' || lh === 'username creator') guessMapping.username = h;
        if (lh === 'followers') guessMapping.followers = h;
        if (lh === 'tier') guessMapping.tier = h;
        if (lh === 'level') guessMapping.level = h;
        if (lh === 'ratecard' || lh === 'price') guessMapping.ratecard = h;
        if (lh === 'audience age' || lh === 'audiens age') guessMapping.audience_age = h;
        if (lh === 'gmv 30 days' || lh === 'gmv 30days' || lh === 'gmv') guessMapping.gmv = h;
        if (lh === 'no whatsapp' || lh === 'no. whatsapp' || lh === 'whatsapp' || lh === 'wa') guessMapping.no_whatsapp = h;
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
      const res = await parseCreatorSyncFile(file, mapping);
      setPreview(res.validData);
      setErrors(res.errors);
      setCurrentPage(1); // Reset page on new file
      setStep(3);
    } catch (err: any) {
      setErrors([err.message || "Gagal memproses file"]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommit = async () => {
    if (preview.length === 0) return;
    setIsCommitting(true);
    try {
      // Fetch existing creators to map IDs
      // Deduplikasi preview (ambil data terakhir jika ada username ganda di excel)
      const uniquePreview = Array.from(new Map(preview.map(item => [item.username.toLowerCase(), item])).values());
      setCommitStatus('Menyimpan data ke database...');
      setCommitProgress(50);

      const rowsToImport = uniquePreview.map(r => ({
        username: r.username,
        whatsapp: r.no_whatsapp,
        followers: r.followers,
        level: r.level,
        audience_age: r.audience_age,
        gmv_30d: r.gmv_30_days,
        ratecard: r.ratecard,
        niche: r.niche_1 || r.niche_2 || ''
      }));

      await executeSpreadsheetImportAction(rowsToImport);

      setCommitProgress(preview.length);
      setStep(4);
    } catch (err: any) {
      setErrors([err.message || "Terjadi kesalahan saat commit ke database."]);
    } finally {
      setIsCommitting(false);
    }
  };

  const resetState = () => {
    setStep(1);
    setFile(null);
    setCsvHeaders([]);
    setPreview([]);
    setErrors([]);
    setErrorLog([]);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Upload className="w-4 h-4" /> Sync Data (Excel/CSV)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sinkronisasi Profil Kreator (Excel/CSV)</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 mt-4">
          
          {/* Step Indicator */}
          <div className="flex items-center gap-2 text-sm">
            <div className={`px-3 py-1 rounded-full ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>1. Upload</div>
            <ArrowRight className="w-4 h-4 text-slate-300" />
            <div className={`px-3 py-1 rounded-full ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>2. Mapping Kolom</div>
            <ArrowRight className="w-4 h-4 text-slate-300" />
            <div className={`px-3 py-1 rounded-full ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>3. Preview & Sync</div>
          </div>

          {step === 1 && (
            <div className="space-y-4 py-4">
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold">Sistem Pelacakan Aktif</p>
                  <p>Seluruh kreator yang berhasil diimpor atau diupdate akan tercatat atas nama PIC: <strong>{profile?.nama || 'System'}</strong>.</p>
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border">
                <div>
                  <p className="text-sm font-medium mb-1">Penting:</p>
                  <ul className="text-xs text-slate-600 list-disc list-inside space-y-1">
                    <li>Pilih file berformat <strong>.xlsx</strong>, <strong>.xls</strong>, atau <strong>.csv</strong>.</li>
                    <li>Sistem akan otomatis membaca dari tab (sheet) yang paling pertama.</li>
                    <li>Sistem akan otomatis mendeteksi nama kolom (header).</li>
                  </ul>
                </div>
                <Button variant="outline" size="sm" onClick={downloadCreatorSyncTemplate} className="gap-2">
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
                <p className="text-sm font-medium text-amber-800 mb-2">Cocokkan Kolom (Mapping)</p>
                <p className="text-xs text-amber-700 mb-4">Pilih kolom dari file CSV Anda yang sesuai dengan data sistem kami. Jika data tidak ada di file Anda, biarkan "Abaikan (Kosong)".</p>
                
                <div className="grid grid-cols-2 gap-4">
                  {(Object.keys(mapping) as Array<keyof ColumnMapping>).map(key => (
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
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Preview Data ({preview.length} baris siap diproses)</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(2)}>Ubah Mapping</Button>
                  <Button onClick={handleCommit} disabled={isCommitting} className="gap-2">
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
                <>
                <div className="border rounded max-h-[500px] overflow-y-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b sticky top-0 z-10">
                      <tr>
                        <th className="p-2 font-medium">Username</th>
                        <th className="p-2 font-medium text-right">Followers</th>
                        <th className="p-2 font-medium">Tier</th>
                        <th className="p-2 font-medium">Level</th>
                        <th className="p-2 font-medium">Ratecard</th>
                        <th className="p-2 font-medium">No WA</th>
                        <th className="p-2 font-medium">GMV 30d</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((row, i) => {
                        const globalIndex = (currentPage - 1) * itemsPerPage + i;
                        return (
                        <tr key={globalIndex} className="hover:bg-slate-50">
                          <td className="p-2 align-top min-w-[250px]">
                            {editingRowIndex === globalIndex ? (
                              <UsernameAutocomplete
                                value={row.username}
                                options={creatorUsernames}
                                onChange={(val) => updatePreviewUsername(globalIndex, val)}
                                onCancel={() => setEditingRowIndex(null)}
                              />
                            ) : (
                              <div className="flex flex-col gap-1 items-start">
                                <span className="font-semibold text-slate-700">@{row.username}</span>
                                {(() => {
                                  const exactMatch = creatorUsernames.find(u => u.toLowerCase() === row.username.toLowerCase());
                                  if (exactMatch) {
                                    return <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full font-medium w-fit">Data Ada & Akan Diupdate</span>;
                                  }

                                  const match = findClosestMatch(row.username, creatorUsernames);
                                  return (
                                    <div className="flex flex-col gap-1 mt-1 bg-blue-50 border border-blue-100 p-1.5 rounded w-full">
                                      <span className="text-[10px] font-bold text-blue-600">✨ Kreator Baru</span>
                                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                         {match && (
                                           <button onClick={() => updatePreviewUsername(globalIndex, match.match)} className="text-[10px] px-2 py-1 bg-amber-500 text-white shadow-sm rounded hover:bg-amber-600 font-semibold transition-colors">
                                             Mirip ➡️ @{match.match}
                                           </button>
                                         )}
                                         <button onClick={() => setEditingRowIndex(globalIndex)} className="text-[10px] px-2 py-1 bg-white border border-slate-300 shadow-sm rounded hover:bg-slate-50 text-slate-600 font-medium">
                                           Ketik Manual
                                         </button>
                                      </div>
                                      <span className="text-[9px] text-slate-400">Biarkan jika ingin mendaftarkan sebagai kreator baru.</span>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </td>
                          <td className="p-2 align-top text-right font-medium">{row.followers ? new Intl.NumberFormat('id-ID').format(row.followers) : '-'}</td>
                          <td className="p-2 align-top">{row.tier || '-'}</td>
                          <td className="p-2 align-top">{row.level || '-'}</td>
                          <td className="p-2 align-top">{row.ratecard === 0 ? 'Barter' : row.ratecard ? `Rp ${row.ratecard.toLocaleString()}` : '-'}</td>
                          <td className="p-2 align-top">{row.no_whatsapp || '-'}</td>
                          <td className="p-2 align-top">{row.gmv_30_days ? `Rp ${row.gmv_30_days.toLocaleString()}` : '-'}</td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
                {preview.length > itemsPerPage && (
                  <div className="flex items-center justify-between mt-4 text-sm">
                    <p className="text-slate-500">
                      Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, preview.length)} dari {preview.length} data
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        Sebelumnya
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(preview.length / itemsPerPage), prev + 1))}
                        disabled={currentPage === Math.ceil(preview.length / itemsPerPage)}
                      >
                        Selanjutnya
                      </Button>
                    </div>
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
                Sebanyak {preview.length - errorLog.length} data kreator telah berhasil diproses ke dalam sistem.
              </p>

              {errors.length > 0 && (
                <div className="w-full bg-red-50 text-red-600 p-3 rounded text-xs space-y-1 max-h-40 overflow-y-auto text-left border border-red-100">
                  <p className="font-semibold mb-1">Peringatan / Data yang dilewati (System Error):</p>
                  {errors.map((e, i) => <p key={i}>- {e}</p>)}
                </div>
              )}

              {errorLog.length > 0 && (
                <div className="w-full bg-red-50 p-4 rounded-xl text-sm space-y-3 max-h-40 overflow-y-auto text-left border border-red-100">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-red-700">Peringatan: {errorLog.length} baris gagal diproses</p>
                    <Button size="sm" variant="outline" className="text-red-700 border-red-200 hover:bg-red-100" onClick={() => exportErrorLogToExcel(errorLog, 'ErrorLog_CreatorSync')}>
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
