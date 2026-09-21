"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Save, Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { bulkAutoDetectAddressCreatorsAction, importSpreadsheetAddressesAction } from "@/app/actions/addressActions";

type SpreadsheetRow = {
  id: string;
  username: string;
  whatsapp: string;
  nama_penerima: string;
  nama_jalan: string;
  provinsi: string;
  kabupaten_kota: string;
  kecamatan: string;
  kelurahan: string;
  kode_pos: string;
  tanggal_kirim: string;
  resi: string;
  ekspedisi: string;
  notes: string;
  proses: string;
  
  status?: 'baru' | 'update' | 'error';
  errorMsg?: string;
  ccId?: number; // campaign_creator_id
  creatorId?: number; // creator_id
};

type DragFillState = {
  active: boolean;
  startRowIdx: number;
  currentRowIdx: number;
  colName: keyof SpreadsheetRow;
  value: string;
};

const getEmptyRow = (): SpreadsheetRow => ({
  id: Math.random().toString(36).substring(2, 9),
  username: '',
  whatsapp: '',
  nama_penerima: '',
  nama_jalan: '',
  provinsi: '',
  kabupaten_kota: '',
  kecamatan: '',
  kelurahan: '',
  kode_pos: '',
  tanggal_kirim: '',
  resi: '',
  ekspedisi: '',
  notes: '',
  proses: '',
});

export default function SpreadsheetImportAddressClient() {
  const router = useRouter();
  const { id } = useParams();
  const campaignId = Number(id);
  const { campaigns } = useDatabaseStore();
  
  const campaign = campaigns.find(c => c.id === campaignId);
  
  const [rows, setRows] = useState<SpreadsheetRow[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`tnt_import_alamat_${campaignId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (err) {}
      }
    }
    return Array(5).fill(null).map(getEmptyRow);
  });
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
  const [dragFill, setDragFill] = useState<DragFillState | null>(null);

  const runBulkAutoDetect = async (usernamesToDetect: string[]) => {
    const usernames = usernamesToDetect.map(u => u.replace('@', '').trim().toLowerCase()).filter(Boolean);
    if (usernames.length === 0 || !campaignId) return;
    
    setIsAutoDetecting(true);
    try {
      const matchedCCs = await bulkAutoDetectAddressCreatorsAction(campaignId, usernames);
        
      if (matchedCCs && matchedCCs.length > 0) {
        setRows(currentRows => {
          const newRows = [...currentRows];
          let updated = false;
          
          for (let i = 0; i < newRows.length; i++) {
            const row = newRows[i];
            const uname = row.username.replace('@', '').trim().toLowerCase();
            if (!uname) continue;
            
            const matched = matchedCCs.find((cc: any) => cc.username.toLowerCase() === uname);
            if (!matched) {
              if (row.status !== 'error') {
                newRows[i] = { ...row, status: 'error', errorMsg: 'Kreator tidak ditemukan di campaign ini' };
                updated = true;
              }
              continue;
            }

            if (row.ccId !== matched.cc_id) {
              newRows[i] = {
                ...row,
                ccId: matched.cc_id,
                creatorId: matched.creator_id,
                status: 'update',
                errorMsg: undefined
              };
              updated = true;
            }
          }
          return updated ? newRows : currentRows;
        });
      } else {
        setRows(currentRows => currentRows.map(row => {
          if (row.username.trim() && !row.ccId) return { ...row, status: 'error', errorMsg: 'Kreator tidak ditemukan di campaign ini' };
          return row;
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAutoDetecting(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`tnt_import_alamat_${campaignId}`, JSON.stringify(rows.map(r => ({ ...r, status: undefined, errorMsg: undefined }))));
    }
  }, [rows, campaignId]);

  const handlePaste = (e: React.ClipboardEvent, startRowIndex: number, startColName: keyof SpreadsheetRow) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('Text');
    if (!pastedData) return;

    const text = pastedData;
    if (!text.includes('\n') && !text.includes('\t')) return;
    
    // Robust TSV parser for Excel (handles newlines inside quotes)
    const parsedRows: string[][] = [];
    let currentRowData: string[] = [];
    let currentCell = '';
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];
      
      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          currentCell += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          currentCell += char;
        }
      } else {
        if (char === '"' && currentCell === '') {
          inQuotes = true;
        } else if (char === '\t') {
          currentRowData.push(currentCell);
          currentCell = '';
        } else if (char === '\r' && nextChar === '\n') {
          currentRowData.push(currentCell);
          parsedRows.push(currentRowData);
          currentRowData = [];
          currentCell = '';
          i++;
        } else if (char === '\n' || char === '\r') {
          currentRowData.push(currentCell);
          parsedRows.push(currentRowData);
          currentRowData = [];
          currentCell = '';
        } else {
          currentCell += char;
        }
      }
    }
    if (currentCell || currentRowData.length > 0) {
      currentRowData.push(currentCell);
      parsedRows.push(currentRowData);
    }

    const columns = ['username', 'whatsapp', 'nama_penerima', 'nama_jalan', 'provinsi', 'kabupaten_kota', 'kecamatan', 'kelurahan', 'kode_pos', 'tanggal_kirim', 'resi', 'ekspedisi', 'notes', 'proses'];
    const startColIndex = columns.indexOf(startColName as string);
    if (startColIndex === -1) return;

    const newRows = [...rows];
    const usernamesToDetect: string[] = [];

    parsedRows.forEach((cellValues, i) => {
      if (cellValues.length === 1 && !cellValues[0].trim()) return;

      const targetRowIndex = startRowIndex + i;
      while (targetRowIndex >= newRows.length) {
        newRows.push(getEmptyRow());
      }

      cellValues.forEach((val, j) => {
        const targetColName = columns[startColIndex + j] as keyof SpreadsheetRow;
        if (targetColName) {
          let cleanedVal = val.trim();
          if (targetColName === 'username') {
            cleanedVal = cleanedVal.replace(/^@/, '');
          } else if (targetColName === 'tanggal_kirim' && cleanedVal) {
            // Coba parsing tanggal ke YYYY-MM-DD
            const bulanMap: {[key:string]: string} = {
              'januari': '01', 'jan': '01',
              'februari': '02', 'feb': '02',
              'maret': '03', 'mar': '03',
              'april': '04', 'apr': '04',
              'mei': '05',
              'juni': '06', 'jun': '06',
              'juli': '07', 'jul': '07',
              'agustus': '08', 'agu': '08', 'agus': '08',
              'september': '09', 'sep': '09', 'sept': '09',
              'oktober': '10', 'okt': '10',
              'november': '11', 'nov': '11',
              'desember': '12', 'des': '12'
            };

            // Format 1: DD/MM/YYYY atau DD-MM-YYYY
            const regexNumeric = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
            // Format 2: DD NamaBulan YYYY
            const regexAlpha = /^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/;

            const matchNum = cleanedVal.match(regexNumeric);
            const matchAlpha = cleanedVal.match(regexAlpha);

            if (matchNum) {
              const d = matchNum[1].padStart(2, '0');
              const m = matchNum[2].padStart(2, '0');
              const y = matchNum[3];
              cleanedVal = `${y}-${m}-${d}`;
            } else if (matchAlpha) {
              const d = matchAlpha[1].padStart(2, '0');
              const mName = matchAlpha[2].toLowerCase();
              const m = bulanMap[mName] || '01';
              const y = matchAlpha[3];
              cleanedVal = `${y}-${m}-${d}`;
            } else {
              // Coba via Date parse native
              const d = new Date(cleanedVal);
              if (!isNaN(d.getTime())) {
                cleanedVal = d.toISOString().split('T')[0];
              }
            }
          } else if (targetColName === 'whatsapp' && cleanedVal) {
            cleanedVal = cleanedVal.replace(/\D/g, '');
            if (cleanedVal.startsWith('62')) {
              cleanedVal = '0' + cleanedVal.substring(2);
            } else if (cleanedVal.startsWith('8')) {
              cleanedVal = '0' + cleanedVal;
            }
          } else if (targetColName === 'proses' && cleanedVal) {
            const lowerVal = cleanedVal.toLowerCase();
            if (lowerVal.includes('belum') || lowerVal.includes('blum')) {
              cleanedVal = 'Belum diproses';
            } else if (lowerVal.includes('batal')) {
              cleanedVal = 'Batal';
            } else if (lowerVal.includes('kendala') || lowerVal.includes('fui')) {
              cleanedVal = 'Kendala [FUI]';
            } else if (lowerVal.includes('terima') || lowerVal.includes('sampai') || lowerVal.includes('done')) {
              cleanedVal = 'Diterima';
            } else if (lowerVal.includes('kirim')) {
              cleanedVal = 'Dikirim';
            } else if (lowerVal.includes('proses')) {
              cleanedVal = 'Diproses';
            } else {
              cleanedVal = 'Belum diproses';
            }
          }

          (newRows[targetRowIndex] as any)[targetColName] = cleanedVal;
          if (targetColName === 'username' && cleanedVal) {
            usernamesToDetect.push(cleanedVal);
          }
        }
      });
      newRows[targetRowIndex].status = undefined;
      newRows[targetRowIndex].errorMsg = undefined;
    });

    setRows(newRows);
    if (usernamesToDetect.length > 0) {
      runBulkAutoDetect(usernamesToDetect);
    }
  };

  const handleDragFillStart = (rowIdx: number, colName: keyof SpreadsheetRow, value: string) => {
    setDragFill({ active: true, startRowIdx: rowIdx, currentRowIdx: rowIdx, colName, value });
  };

  const handleDragFillEnter = (rowIdx: number) => {
    if (dragFill?.active) {
      setDragFill({ ...dragFill, currentRowIdx: rowIdx });
    }
  };

  const handleDragFillEnd = () => {
    if (!dragFill?.active) return;
    const { startRowIdx, currentRowIdx, colName, value } = dragFill;
    const min = Math.min(startRowIdx, currentRowIdx);
    const max = Math.max(startRowIdx, currentRowIdx);

    const newRows = [...rows];
    let hasUsernameChanges = false;
    const usernamesToDetect: string[] = [];
    
    for (let i = min; i <= max; i++) {
      if ((newRows[i] as any)[colName] !== value) {
        (newRows[i] as any)[colName] = value;
        newRows[i].status = undefined;
        newRows[i].errorMsg = undefined;
        if (colName === 'username' && value) {
          hasUsernameChanges = true;
          usernamesToDetect.push(value);
        }
      }
    }
    setRows(newRows);
    setDragFill(null);
    if (hasUsernameChanges) runBulkAutoDetect(usernamesToDetect);
  };

  useEffect(() => {
    const handleMouseUp = () => handleDragFillEnd();
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [dragFill]);

  const updateCell = (idx: number, field: keyof SpreadsheetRow, value: string) => {
    const newRows = [...rows];
    let cleaned = value;
    if (field === 'username') cleaned = cleaned.replace(/^@/, '');
    
    newRows[idx] = { ...newRows[idx], [field]: cleaned, status: undefined, errorMsg: undefined };
    setRows(newRows);
  };

  const handleUsernameBlur = (idx: number) => {
    const uname = rows[idx].username;
    if (uname) runBulkAutoDetect([uname]);
  };

  const addRows = (count = 1) => {
    const newRows = Array(count).fill(null).map(getEmptyRow);
    setRows([...rows, ...newRows]);
  };

  const removeRow = (id: string) => {
    setRows(rows.filter(r => r.id !== id));
  };

  const clearAll = () => {
    if (confirm("Kosongkan semua data?")) {
      setRows(Array(5).fill(null).map(getEmptyRow));
      localStorage.removeItem(`tnt_import_alamat_${campaignId}`);
    }
  };

  const getDragHighlightClass = (rowIdx: number, colName: keyof SpreadsheetRow) => {
    if (!dragFill?.active || dragFill.colName !== colName) return '';
    const min = Math.min(dragFill.startRowIdx, dragFill.currentRowIdx);
    const max = Math.max(dragFill.startRowIdx, dragFill.currentRowIdx);
    if (rowIdx >= min && rowIdx <= max) return 'bg-blue-100 ring-1 ring-blue-400';
    return '';
  };

  const verifyData = async () => {
    setIsVerifying(true);
    const toDetect = rows.map(r => r.username).filter(Boolean);
    await runBulkAutoDetect(toDetect);
    
    // validasi manual
    const validated = [...rows];
    let hasErrors = false;
    for (let i = 0; i < validated.length; i++) {
      const row = validated[i];
      if (!row.username.trim() && !row.nama_jalan.trim()) continue;
      
      if (!row.username.trim()) {
        row.status = 'error';
        row.errorMsg = 'Username wajib diisi';
        hasErrors = true;
      } else if (!row.ccId) {
        row.status = 'error';
        row.errorMsg = 'Kreator tidak ditemukan di campaign ini';
        hasErrors = true;
      } else {
        row.status = 'baru'; // siap insert
      }
    }
    setRows(validated);
    setIsVerifying(false);
  };

  const saveToDatabase = async () => {
    const validRows = rows.filter(r => r.username.trim() && r.status !== 'error' && r.ccId);
    if (validRows.length === 0) {
      alert("Tidak ada data valid yang bisa disimpan.");
      return;
    }

    setIsImporting(true);
    setSaveProgress({ current: 0, total: validRows.length });

    try {
      const result = await importSpreadsheetAddressesAction(campaignId, campaign?.nama || '', validRows);
      
      setSaveProgress({ current: validRows.length, total: validRows.length });
      setIsImporting(false);
      alert(`Import selesai!\nBerhasil: ${result.successCount}\nGagal: ${result.failCount}`);
      
      if (result.failCount === 0) {
        localStorage.removeItem(`tnt_import_alamat_${campaignId}`);
        router.back(); // kembali ke alamat
      }
    } catch (err: any) {
      console.error(err);
      setIsImporting(false);
      alert("Terjadi kesalahan saat menyimpan data: " + (err.message || "Unknown error"));
    }
  };

  const TableHeader = ({ title, width }: { title: string, width?: string }) => (
    <th className={`px-2 py-2 text-left font-semibold text-slate-600 border-b border-r border-slate-300 bg-slate-100 whitespace-nowrap text-xs shadow-sm sticky top-0 z-10 ${width || 'w-48'}`}>
      {title}
    </th>
  );

  const renderCell = (
    idx: number, 
    field: keyof SpreadsheetRow, 
    placeholder?: string,
    width?: string
  ) => {
    return (
      <td 
        key={field}
        className={`relative p-0 border-b border-r border-slate-300 group ${getDragHighlightClass(idx, field)}`}
        onMouseEnter={() => handleDragFillEnter(idx)}
      >
        <input 
          type="text"
          value={(rows[idx] as any)[field] || ''}
          onChange={(e) => updateCell(idx, field, e.target.value)}
          onPaste={(e) => handlePaste(e, idx, field)}
          onBlur={() => field === 'username' ? handleUsernameBlur(idx) : null}
          placeholder={placeholder || ''}
          className={`w-full h-full min-h-[36px] px-3 py-1 outline-none text-sm transition-colors
            ${rows[idx].status === 'error' ? 'bg-red-50 focus:bg-red-50 text-red-700' : 'focus:bg-blue-50'}
            ${width || 'w-48 min-w-[12rem]'}
          `}
        />
        <div 
          className="absolute right-0 bottom-0 w-2 h-2 bg-blue-500 cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onMouseDown={(e) => {
            e.preventDefault();
            handleDragFillStart(idx, field, (rows[idx] as any)[field]);
          }}
        />
      </td>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50">
      {/* Header Bar */}
      <div className="flex-none bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4 mr-1" /> Kembali
          </Button>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Import Alamat Massal</h1>
            <p className="text-xs text-slate-500">Paste data dari Excel ke tabel di bawah ini.</p>
            <div className="mt-2 flex flex-col gap-1.5">
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Peringatan: Pastikan format Tanggal Kirim adalah <b>DD/MM/YYYY</b> atau <b>DD Bulan YYYY</b> (contoh: 12 Juni 2026 atau 12/06/2026).</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Peringatan: Kolom <b>Status Dikirim</b> usahakan diisi sesuai dropdown: <b>Belum diproses, Diproses, Dikirim, Diterima, Batal, Kendala [FUI]</b>. Sistem akan mencoba mendeteksi isian lain secara otomatis (misal "udh dikirim" otomatis menjadi "Dikirim").</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={clearAll} className="text-slate-600 bg-white shadow-sm hover:bg-slate-50">
            Bersihkan
          </Button>
          <Button onClick={verifyData} disabled={isVerifying || isAutoDetecting} className="bg-slate-800 hover:bg-slate-900 text-white shadow-sm min-w-[120px]">
            {isVerifying ? 'Memeriksa...' : isAutoDetecting ? 'Mendeteksi...' : 'Cek Data'}
          </Button>
          <Button onClick={saveToDatabase} disabled={isImporting} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm min-w-[140px]">
            {isImporting ? `Menyimpan ${saveProgress.current}/${saveProgress.total}...` : (
              <><Save className="w-4 h-4 mr-2" /> Simpan Ke Database</>
            )}
          </Button>
        </div>
      </div>

      {/* Spreadsheet Area */}
      <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
        <Card className="shadow-xl bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col h-full">
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th className="w-12 px-2 py-2 bg-slate-100 border-b border-r border-slate-300 sticky top-0 z-10 text-center text-xs font-semibold text-slate-500">No</th>
                  <th className="w-10 px-2 py-2 bg-slate-100 border-b border-r border-slate-300 sticky top-0 z-10"></th>
                  <TableHeader title="Username *" width="w-48" />
                  <TableHeader title="No Whatsapp" width="w-40" />
                  <TableHeader title="Nama Penerima" width="w-48" />
                  <TableHeader title="Nama Jalan" width="w-64" />
                  <TableHeader title="Provinsi" width="w-40" />
                  <TableHeader title="Kab/Kota" width="w-40" />
                  <TableHeader title="Kecamatan" width="w-40" />
                  <TableHeader title="Kelurahan" width="w-40" />
                  <TableHeader title="Kode Pos" width="w-32" />
                  <TableHeader title="Tgl Kirim" width="w-32" />
                  <TableHeader title="Resi" width="w-40" />
                  <TableHeader title="Ekspedisi" width="w-40" />
                  <TableHeader title="Notes" width="w-48" />
                  <TableHeader title="Status Dikirim" width="w-40" />
                  <TableHeader title="Status" width="w-48" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id} className={`${row.status === 'error' ? 'bg-red-50/30' : 'hover:bg-slate-50/50'} transition-colors`}>
                    <td className="border-b border-r border-slate-300 bg-slate-50 text-center text-xs text-slate-500 select-none">
                      {idx + 1}
                    </td>
                    <td className="border-b border-r border-slate-300 text-center">
                      <button 
                        onClick={() => removeRow(row.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Hapus baris"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                    {renderCell(idx, 'username', '@username', 'w-48')}
                    {renderCell(idx, 'whatsapp', '08...', 'w-40')}
                    {renderCell(idx, 'nama_penerima', '', 'w-48')}
                    {renderCell(idx, 'nama_jalan', '', 'w-64')}
                    {renderCell(idx, 'provinsi', '', 'w-40')}
                    {renderCell(idx, 'kabupaten_kota', '', 'w-40')}
                    {renderCell(idx, 'kecamatan', '', 'w-40')}
                    {renderCell(idx, 'kelurahan', '', 'w-40')}
                    {renderCell(idx, 'kode_pos', '', 'w-32')}
                    {renderCell(idx, 'tanggal_kirim', 'DD/MM/YYYY', 'w-32')}
                    {renderCell(idx, 'resi', '', 'w-40')}
                    {renderCell(idx, 'ekspedisi', '', 'w-40')}
                    {renderCell(idx, 'notes', '', 'w-48')}
                    {renderCell(idx, 'proses', '', 'w-40')}
                    <td className={`p-3 border-b border-slate-300 text-xs w-48 truncate
                      ${row.status === 'error' ? 'text-red-600 font-medium' : ''}
                      ${row.status === 'update' ? 'text-blue-600' : ''}
                      ${row.status === 'baru' ? 'text-green-600' : ''}
                    `}>
                      {row.status === 'error' && <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {row.errorMsg}</span>}
                      {row.status === 'update' && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Siap diupdate</span>}
                      {row.status === 'baru' && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Siap ditambahkan</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="flex-none p-4 bg-white border-t border-slate-200 flex justify-between items-center shadow-sm z-20">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => addRows(1)} className="text-slate-600">
                <Plus className="w-4 h-4 mr-1" /> Tambah 1 Baris
              </Button>
              <Button variant="outline" size="sm" onClick={() => addRows(10)} className="text-slate-600">
                <Plus className="w-4 h-4 mr-1" /> Tambah 10 Baris
              </Button>
            </div>
            <div className="text-sm text-slate-500 font-medium">
              Total {rows.length} baris
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
