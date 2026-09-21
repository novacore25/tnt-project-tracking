"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Upload, Download, Loader2, ArrowRight, FileSpreadsheet, FolderKanban, AlertCircle, CheckCircle } from "lucide-react";
import { UsernameAutocomplete } from "@/components/ui/UsernameAutocomplete";
import { findClosestMatch } from "@/utils/stringSimilarity";
import { downloadCampaignSyncTemplate, parseCampaignSyncFile, parseFileHeaders, ParsedCampaignCreatorRow, CampaignColumnMapping } from "@/utils/importCampaignSync";
import { fetchCampaignSyncListingDbAction, executeFullCampaignSyncAction } from "@/app/actions/databaseActions";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { exportErrorLogToExcel, ErrorLogItem } from "@/utils/exportErrorLog";

export function CampaignSyncModal({ campaignId: initialCampaignId, onComplete }: { campaignId?: number; onComplete?: () => void }) {
  const { campaigns, fetchData, creators } = useDatabaseStore();
  const creatorUsernames = creators.map(c => c.username);
  const [campaignId, setCampaignId] = useState(initialCampaignId || 0);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1|2|3|4>(1);
  const [file, setFile] = useState<File | null>(null);
  
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<CampaignColumnMapping>({
    tier: '',
    username: '',
    followers: '',
    no_whatsapp: '',
    ratecard: '',
    qty_vt: '',
    qty_live: '',
    content_type: '',
    level: '',
    audience_age: '',
    gmv_30d: '',
    approval: '',
    sample_progress: '',
    notes_manager: '',
    notes_pic: ''
  });

  const [preview, setPreview] = useState<ParsedCampaignCreatorRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [errorLog, setErrorLog] = useState<ErrorLogItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitProgress, setCommitProgress] = useState(0);
  const [commitStatus, setCommitStatus] = useState('');
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);

  type SyncMode = 'excel_acuan' | 'db_acuan' | 'update_tambah';
  const [syncMode, setSyncMode] = useState<SyncMode>('update_tambah');
  const [existingDbCreators, setExistingDbCreators] = useState<any[]>([]);
  const [summaryStats, setSummaryStats] = useState({ baru: 0, update: 0, abaikan: 0, hapus: 0 });

  useEffect(() => {
    if (preview.length === 0) return;
    
    const dbUsernames = new Set(existingDbCreators.map(cc => cc.creators?.username?.toLowerCase()).filter(Boolean));
    const excelUsernames = new Set(preview.map(p => p.username.toLowerCase()));
    
    let baru = 0;
    let update = 0;
    let abaikan = 0;
    let hapus = 0;

    preview.forEach(p => {
      const u = p.username.toLowerCase();
      if (dbUsernames.has(u)) {
        update++;
      } else {
        if (syncMode === 'db_acuan') abaikan++;
        else baru++;
      }
    });

    if (syncMode === 'excel_acuan') {
      existingDbCreators.forEach(cc => {
        const u = cc.creators?.username?.toLowerCase();
        if (u && !excelUsernames.has(u)) {
          hapus++;
        }
      });
    }

    setSummaryStats({ baru, update, abaikan, hapus });
  }, [preview, existingDbCreators, syncMode]);

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
        if (lh === 'approval' || lh === 'status approval') guessMapping.approval = h;
        if (lh === 'notes manager' || lh === 'manager notes') guessMapping.notes_manager = h;
        if (lh === 'notes pic' || lh === 'pic notes') guessMapping.notes_pic = h;
        if (lh === 'sample progress' || lh === 'progress sample') guessMapping.sample_progress = h;
        if (lh === 'tipe konten' || lh === 'content type' || lh === 'tipe') guessMapping.content_type = h;
        if (lh === 'qty video' || lh === 'qty vt' || lh === 'video') guessMapping.qty_vt = h;
        if (lh === 'qty live' || lh === 'live') guessMapping.qty_live = h;
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
      const res = await parseCampaignSyncFile(file, mapping);
      setPreview(res.validData);
      setErrors(res.errors);
      
      const dbRes = await fetchCampaignSyncListingDbAction(campaignId);
      if (dbRes.success) {
        setExistingDbCreators(dbRes.data);
      }

      setStep(3);
    } catch (err: any) {
      setErrors([err.message || "Gagal memproses file"]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommit = async () => {
    if (preview.length === 0 || campaignId === 0) return;
    setIsCommitting(true);
    setCommitProgress(0);
    setCommitStatus('Menjalankan sinkronisasi listing campaign via server action...');
    try {
      const syncResult = await executeFullCampaignSyncAction({
        campaignId,
        syncMode,
        previewRows: preview
      });

      if (!syncResult.success) {
        throw new Error(syncResult.error);
      }

      setCommitStatus('Memperbarui tampilan...');
      await fetchData();
      if (onComplete) onComplete();
      setErrorLog(syncResult.errorLog || []);
      setStep(4);
    } catch (err: any) {
      setErrors([err.message || "Terjadi kesalahan saat commit ke database."]);
    } finally {
      setIsCommitting(false);
      setCommitStatus('');
    }
  };

  const resetState = () => {
    setStep(1);
    setFile(null);
    setCsvHeaders([]);
    setPreview([]);
    setErrors([]);
    setErrorLog([]);
    if (!initialCampaignId) setCampaignId(0);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Upload className="w-4 h-4" /> Sync Listing (Excel/CSV)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sync Campaign Listing (Excel/CSV)</DialogTitle>
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
                    <FolderKanban className="w-4 h-4 text-blue-600" /> Pilih Campaign Tujuan
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

              <div className="flex items-center gap-4 p-4 bg-blue-50 text-blue-800 rounded-xl border border-blue-100">
                <FileSpreadsheet className="w-8 h-8 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium mb-1">Penting:</p>
                  <ul className="text-xs text-slate-600 list-disc list-inside space-y-1">
                    <li>Pilih file berformat <strong>.xlsx</strong>, <strong>.xls</strong>, atau <strong>.csv</strong>.</li>
                    <li>Sistem akan mendeteksi dari sheet paling pertama.</li>
                  </ul>
                  <button onClick={downloadCampaignSyncTemplate} className="text-blue-600 hover:underline text-xs mt-2 block font-semibold">Unduh Template CSV</button>
                </div>
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
                <div className="grid grid-cols-2 gap-4">
                  {(Object.keys(mapping) as Array<keyof CampaignColumnMapping>).map(key => (
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
                <p className="text-sm font-medium">Pilih Mode Import</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(2)}>Ubah Mapping</Button>
                  <Button onClick={handleCommit} disabled={isCommitting} className="gap-2">
                    {isCommitting ? <><Loader2 className="w-4 h-4 animate-spin" /> {commitStatus || 'Memproses...'} {commitProgress > 0 ? `(${Math.round((commitProgress / preview.length) * 100)}%)` : ''}</> : <><Upload className="w-4 h-4" /> Mulai Sinkronisasi</>}
                  </Button>
                </div>
              </div>

              {/* Mode Selection UI */}
              <div className="space-y-3 bg-slate-50 border border-slate-200 p-4 rounded-xl">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="radio" name="syncMode" value="update_tambah" checked={syncMode === 'update_tambah'} onChange={() => setSyncMode('update_tambah')} className="mt-1" />
                  <div>
                    <p className="text-sm font-bold text-slate-800">Update & Tambah Data (Standar)</p>
                    <p className="text-xs text-slate-500">Kreator baru ditambahkan, kreator lama di-update sesuai Excel. Tidak ada yang dihapus dari Database.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="radio" name="syncMode" value="excel_acuan" checked={syncMode === 'excel_acuan'} onChange={() => setSyncMode('excel_acuan')} className="mt-1" />
                  <div>
                    <p className="text-sm font-bold text-slate-800">Excel Sebagai Acuan Utama (Mirroring)</p>
                    <p className="text-xs text-slate-500">Database akan disamakan PERSIS dengan Excel. Kreator yang ada di DB tapi tidak ada di Excel akan <span className="font-bold text-red-500">DIHAPUS</span> dari Campaign.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="radio" name="syncMode" value="db_acuan" checked={syncMode === 'db_acuan'} onChange={() => setSyncMode('db_acuan')} className="mt-1" />
                  <div>
                    <p className="text-sm font-bold text-slate-800">Database Sebagai Acuan Utama (Update Only)</p>
                    <p className="text-xs text-slate-500">Hanya mengupdate kreator yang SUDAH ADA di Database. Kreator baru yang ada di Excel akan diabaikan.</p>
                  </div>
                </label>
              </div>

              {/* Summary Stats Box */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-center">
                  <p className="text-xs font-semibold text-blue-600 uppercase">Akan Dibuat Baru</p>
                  <p className="text-xl font-bold text-blue-700">{summaryStats.baru}</p>
                </div>
                <div className="bg-green-50 border border-green-100 p-3 rounded-lg text-center">
                  <p className="text-xs font-semibold text-green-600 uppercase">Akan Di-Update</p>
                  <p className="text-xl font-bold text-green-700">{summaryStats.update}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center">
                  <p className="text-xs font-semibold text-slate-600 uppercase">Akan Diabaikan</p>
                  <p className="text-xl font-bold text-slate-700">{summaryStats.abaikan}</p>
                </div>
                <div className="bg-red-50 border border-red-100 p-3 rounded-lg text-center">
                  <p className="text-xs font-semibold text-red-600 uppercase">Akan Dihapus</p>
                  <p className="text-xl font-bold text-red-700">{summaryStats.hapus}</p>
                </div>
              </div>
              
              <p className="text-sm font-medium mt-4 border-t pt-4">Preview Breakdown Approval dari Excel ({preview.length} baris)</p>
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="bg-green-50 border border-green-100 p-3 rounded-lg text-center">
                  <p className="text-xs font-semibold text-green-600 uppercase">Approved</p>
                  <p className="text-xl font-bold text-green-700">{preview.filter(r => r.approval === 'approved').length}</p>
                </div>
                <div className="bg-red-50 border border-red-100 p-3 rounded-lg text-center">
                  <p className="text-xs font-semibold text-red-600 uppercase">Not Approved</p>
                  <p className="text-xl font-bold text-red-700">{preview.filter(r => r.approval === 'not_approved').length}</p>
                </div>
                <div className="bg-purple-50 border border-purple-100 p-3 rounded-lg text-center">
                  <p className="text-xs font-semibold text-purple-600 uppercase">Alternate</p>
                  <p className="text-xl font-bold text-purple-700">{preview.filter(r => r.approval === 'alternate').length}</p>
                </div>
                <div className="bg-yellow-50 border border-yellow-100 p-3 rounded-lg text-center">
                  <p className="text-xs font-semibold text-yellow-600 uppercase">Pending</p>
                  <p className="text-xl font-bold text-yellow-700">{preview.filter(r => r.approval === 'pending').length}</p>
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
                        <th className="p-2 font-medium">Status Approval</th>
                        <th className="p-2 font-medium">Tipe Konten</th>
                        <th className="p-2 font-medium">Qty Video</th>
                        <th className="p-2 font-medium">Qty Live</th>
                        <th className="p-2 font-medium">Sample Progress</th>
                        <th className="p-2 font-medium">Notes Manager</th>
                        <th className="p-2 font-medium">Notes PIC</th>
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
                                      <span className="text-[10px] font-bold text-amber-600">⚠ Tidak Ditemukan</span>
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
                                      <span className="text-[9px] text-slate-400">Biarkan jika ingin mendaftarkan sebagai kreator baru.</span>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </td>
                          <td className="p-2 align-top">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              row.approval === 'approved' ? 'bg-green-100 text-green-700' :
                              row.approval === 'not_approved' ? 'bg-red-100 text-red-700' :
                              row.approval === 'alternate' ? 'bg-purple-100 text-purple-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {row.approval}
                            </span>
                          </td>
                          <td className="p-2 align-top">{row.content_type || '-'}</td>
                          <td className="p-2 align-top">{row.qty_vt !== undefined ? row.qty_vt : '-'}</td>
                          <td className="p-2 align-top">{row.qty_live !== undefined ? row.qty_live : '-'}</td>
                          <td className="p-2 align-top max-w-[150px] truncate">{row.sample_progress || '-'}</td>
                          <td className="p-2 align-top max-w-[200px] truncate">{row.notes_manager || '-'}</td>
                          <td className="p-2 align-top max-w-[200px] truncate">{row.notes_pic || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                Proses sinkronisasi telah dijalankan untuk {preview.length} data.
              </p>
              
              {errors.length > 0 && (
                <div className="w-full bg-red-50 text-red-600 p-3 rounded text-xs space-y-1 max-h-40 overflow-y-auto text-left border border-red-100">
                  <p className="font-semibold mb-1">Peringatan / Data yang dilewati (Sistem):</p>
                  {errors.map((e, i) => <p key={i}>- {e}</p>)}
                </div>
              )}

              {errorLog.length > 0 && (
                <div className="w-full bg-red-50 p-4 rounded-xl text-sm space-y-3 max-h-40 overflow-y-auto text-left border border-red-100">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-red-700">Peringatan: Ada batch yang gagal diproses</p>
                    <Button size="sm" variant="outline" className="text-red-700 border-red-200 hover:bg-red-100" onClick={() => exportErrorLogToExcel(errorLog, 'ErrorLog_CampaignSync')}>
                      <Download className="w-4 h-4 mr-2" /> Download Error Log
                    </Button>
                  </div>
                  <ul className="list-disc list-inside text-red-600 text-xs">
                    {errorLog.slice(0, 3).map((e, i) => (
                      <li key={i}>{(e.username && e.username !== 'BATCH_INSERT' && e.username !== 'BATCH_UPDATE') ? `@${e.username}` : e.username}: {e.pesan_error}</li>
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
