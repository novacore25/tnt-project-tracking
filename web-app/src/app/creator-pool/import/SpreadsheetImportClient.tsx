"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { bulkAutoDetectCreatorsAction, verifySpreadsheetCreatorsAction, executeSpreadsheetImportAction } from "@/app/actions/creatorActions";
import { getAutoTier } from '@/utils/importCreatorSync';
import { ArrowLeft, Save, Play, Plus, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useDatabaseStore } from "@/store/useDatabaseStore";

import { useAuth } from "@/providers/AuthProvider";

type SpreadsheetRow = {
  id: string;
  username: string;
  followers: string;
  level: string;
  audience_age: string;
  gmv_30d: string;
  niche: string;
  mcn: string;
  ratecard: string;
  whatsapp: string;
  avatar_url?: string;
  
  status?: 'baru' | 'update' | 'error';
  errorMsg?: string;
  existingInfo?: string;
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
  followers: '',
  level: '',
  audience_age: '',
  gmv_30d: '',
  niche: '',
  mcn: '',
  ratecard: '',
  whatsapp: '',
});

export default function SpreadsheetImportClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { niches, fetchData } = useDatabaseStore();
  const { profile } = useAuth();
  
  const [rows, setRows] = useState<SpreadsheetRow[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`tnt_import_draft_global`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (err) {}
      }
    }
    return Array(5).fill(null).map(getEmptyRow);
  });
  
  const [step, setStep] = useState<1 | 2>(1);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [dragFill, setDragFill] = useState<DragFillState | null>(null);

  const runBulkAutoDetect = async (usernamesToDetect: string[]) => {
    const usernames = usernamesToDetect.map(u => u.trim().toLowerCase()).filter(Boolean);
    if (usernames.length === 0) return;
    
    setIsAutoDetecting(true);
    try {
      const matchedCreators = await bulkAutoDetectCreatorsAction(usernames);
        
      if (matchedCreators && matchedCreators.length > 0) {
        setRows(currentRows => {
          const newRows = [...currentRows];
          let updated = false;
          
          for (let i = 0; i < newRows.length; i++) {
            const row = newRows[i];
            const uname = row.username.trim().toLowerCase();
            if (!uname) continue;
            
            const matched = matchedCreators.find((c: any) => c.username.toLowerCase() === uname);
            if (!matched) continue;
            
            const snaps = (matched.creator_snapshots || []).sort((a: any, b: any) => b.id - a.id);
            const snap = snaps.reduce((acc: any, curr: any) => ({
              followers: acc.followers ?? curr.followers,
              level: acc.level ?? curr.level,
              audience_age: acc.audience_age ?? curr.audience_age,
              gmv_30d: acc.gmv_30d ?? curr.gmv_30d,
              ratecard: acc.ratecard ?? curr.ratecard,
            }), { followers: null, level: null, audience_age: null, gmv_30d: null, ratecard: null });
            
            const contact = (matched.creator_contacts || []).find((c: any) => c.status === 'aktif');
            const nicheObj = matched.creator_niches && matched.creator_niches.length > 0 ? matched.creator_niches[0].niches : null;
            const nicheData = nicheObj ? (Array.isArray(nicheObj) ? nicheObj[0]?.nama : (nicheObj as any)?.nama) : null;
            
            if (!row.whatsapp && contact && contact.nomor) { newRows[i].whatsapp = contact.nomor; updated = true; }
            if (!row.ratecard && snap.ratecard) { newRows[i].ratecard = snap.ratecard.toString(); updated = true; }
            if (!row.followers && snap.followers) { newRows[i].followers = snap.followers.toString(); updated = true; }
            if (!row.level && snap.level) { newRows[i].level = snap.level.toString(); updated = true; }
            if (!row.audience_age && snap.audience_age) { newRows[i].audience_age = snap.audience_age; updated = true; }
            if (!row.gmv_30d && snap.gmv_30d) { newRows[i].gmv_30d = snap.gmv_30d.toString(); updated = true; }
            if (!row.niche && nicheData) { newRows[i].niche = nicheData; updated = true; }
          }
          return updated ? newRows : currentRows;
        });
      }
    } catch (err) {
      console.error(e);
    }
    setIsAutoDetecting(false);
  };

  const updateRow = (id: string, field: keyof SpreadsheetRow, value: string) => {
    setRows(prev => prev.map(r => {
      if (r.id === id) {
        const updated = { ...r, [field]: value };
        if (field === 'username') updated.status = undefined;
        return updated;
      }
      return r;
    }));
  };

  useEffect(() => {
    if (rows.length > 0) {
      localStorage.setItem(`tnt_import_draft_global`, JSON.stringify(rows));
    } else {
      localStorage.removeItem(`tnt_import_draft_global`);
    }
  }, [rows]);

  const handleFillHandleMouseDown = (e: React.MouseEvent, rowIdx: number, colName: keyof SpreadsheetRow, value: string) => {
    e.preventDefault();
    setDragFill({
      active: true,
      startRowIdx: rowIdx,
      currentRowIdx: rowIdx,
      colName,
      value
    });
  };

  const handleCellMouseEnter = (rowIdx: number, colName: keyof SpreadsheetRow) => {
    if (dragFill && dragFill.active && dragFill.colName === colName) {
      setDragFill({ ...dragFill, currentRowIdx: rowIdx });
    }
  };

  useEffect(() => {
    const handleMouseUp = () => {
      if (dragFill && dragFill.active) {
        setRows(prevRows => {
          const newRows = [...prevRows];
          const minRow = Math.min(dragFill.startRowIdx, dragFill.currentRowIdx);
          const maxRow = Math.max(dragFill.startRowIdx, dragFill.currentRowIdx);
          
          for (let i = minRow; i <= maxRow; i++) {
            if (i !== dragFill.startRowIdx && i < newRows.length) {
              newRows[i] = { ...newRows[i], [dragFill.colName]: dragFill.value };
              if (dragFill.colName === 'username') {
                newRows[i].status = undefined;
              }
            }
          }
          
          if (dragFill.colName === 'username') {
            const namesToDetect: string[] = [];
            for (let i = minRow; i <= maxRow; i++) {
              if (i !== dragFill.startRowIdx && i < newRows.length && newRows[i].username) {
                namesToDetect.push(newRows[i].username);
              }
            }
            if (namesToDetect.length > 0) {
              setTimeout(() => runBulkAutoDetect(namesToDetect), 100);
            }
          }
          return newRows;
        });
        setDragFill(null);
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [dragFill]);

  useEffect(() => {
    const usernamesParam = searchParams.get('usernames');
    if (usernamesParam) {
      const names = usernamesParam.split(',').map(n => n.trim()).filter(n => n.length > 0);
      if (names.length > 0) {
        setRows(prevRows => {
          const existingUsernames = new Set(prevRows.map(r => r.username.toLowerCase()));
          const newNames = names.filter(n => !existingUsernames.has(n.toLowerCase()));
          if (newNames.length === 0) return prevRows;

          let nextRows = [...prevRows];
          for (const name of newNames) {
            const emptyIdx = nextRows.findIndex(r => r.username === '');
            if (emptyIdx !== -1) {
              nextRows[emptyIdx] = { ...nextRows[emptyIdx], username: name };
            } else {
              const newRow = getEmptyRow();
              newRow.username = name;
              nextRows.push(newRow);
            }
          }
          return nextRows;
        });
        runBulkAutoDetect(names);
      }
    }
  }, [searchParams]);

  const COLUMNS: (keyof SpreadsheetRow)[] = [
    'username',
    'whatsapp',
    'followers',
    'level',
    'audience_age',
    'gmv_30d',
    'niche',
    'mcn',
    'ratecard'
  ];

  const handleGlobalPaste = (e: React.ClipboardEvent<HTMLInputElement>, startRowIdx: number, startColName: keyof SpreadsheetRow) => {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\n') && !text.includes('\t')) return;

    e.preventDefault();
    
    // Robust TSV parser
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
    
    if (parsedRows.length === 0) return;

    setRows(prevRows => {
      const newRows = [...prevRows];
      const startColIdx = COLUMNS.indexOf(startColName);
      if (startColIdx === -1) return prevRows;

      const pastedUsernames: string[] = [];

      parsedRows.forEach((rawCols, lineIdx) => {
        let cols = rawCols;
        
        const tierRawIndex = 3 - startColIdx;
        if (tierRawIndex >= 0 && tierRawIndex < rawCols.length) {
          if (rawCols.length >= 10 - startColIdx || /nano|micro|macro|mega|auto/i.test(rawCols[tierRawIndex] || '')) {
            cols = [...rawCols.slice(0, tierRawIndex), ...rawCols.slice(tierRawIndex + 1)];
          }
        }

        const targetRowIdx = startRowIdx + lineIdx;
        let rowDataToUpdate: Partial<SpreadsheetRow> = {};
        
        cols.forEach((colVal, colOffset) => {
          const targetColIdx = startColIdx + colOffset;
          if (targetColIdx < COLUMNS.length) {
            const field = COLUMNS[targetColIdx];
            let cleanVal = colVal;
            
            if (field === 'username') cleanVal = cleanVal.replace('@', '').trim().toLowerCase();
            else if (['followers', 'level', 'gmv_30d', 'ratecard'].includes(field)) cleanVal = cleanVal.replace(/[^0-9]/g, '');
            else cleanVal = cleanVal.trim();

            rowDataToUpdate[field] = cleanVal as any;
            
            if (field === 'username' && cleanVal) {
              pastedUsernames.push(cleanVal);
            }
          }
        });

        if (targetRowIdx < newRows.length) {
          Object.assign(newRows[targetRowIdx], rowDataToUpdate);
        } else {
          newRows.push({
            ...getEmptyRow(),
            ...rowDataToUpdate
          } as SpreadsheetRow);
        }
      });

      if (pastedUsernames.length > 0) {
        setTimeout(() => runBulkAutoDetect(pastedUsernames), 100);
      }

      return newRows;
    });
  };

  const handleVerify = async () => {
    let filledRows = [...rows].filter(r => r.username.trim() !== '');
    if (filledRows.length === 0) {
      alert("Tidak ada data username yang diisi!");
      return;
    }

    setIsVerifying(true);
    
    let hasError = false;
    filledRows = filledRows.map(r => {
      // Auto-clean username
      const cleanUsername = r.username.replace('@', '').trim().toLowerCase();
      
      let err = '';
      if (!r.niche.trim()) err = "Niche wajib diisi!";
      if (!r.whatsapp.trim()) err = "No. Whatsapp wajib diisi!";
      if (cleanUsername.includes(' ')) err = "Username tidak boleh ada spasi";
      if (err) hasError = true;
      return { ...r, username: cleanUsername, status: err ? 'error' : undefined, errorMsg: err };
    });

    if (hasError) {
      setRows(rows.map(r => {
        const f = filledRows.find(fr => fr.id === r.id);
        return f ? f : r;
      }));
      setIsVerifying(false);
      alert("Ada data yang masih error (merah). Silakan perbaiki terlebih dahulu.");
      return;
    }

    const usernames = filledRows.map(r => r.username);
    const dbCreators = await verifySpreadsheetCreatorsAction(usernames);
    const creatorMap = new Map((dbCreators || []).map((c: any) => [c.username.toLowerCase(), c]));

    filledRows = filledRows.map(r => {
      const c = creatorMap.get(r.username.toLowerCase());
      if (!c) {
        return { ...r, status: 'baru', existingInfo: 'Belum terdaftar di database' };
      }
      
      const updaterName = c.updater_name;
      const adderName = c.adder_name;

      const lastUpdate = updaterName ? `diupdate oleh ${updaterName}` : (adderName ? `diinput oleh ${adderName}` : 'Sistem');
      const lastDate = c.last_updated_at || c.created_at;
      const dateStr = lastDate ? new Date(lastDate).toLocaleDateString() : '';

      return { 
        ...r, 
        status: 'update', 
        existingInfo: `Data Kreator ${lastUpdate} ${dateStr}`
      };
    });

    setRows(rows.map(r => {
      const f = filledRows.find(fr => fr.id === r.id);
      return f ? f : r;
    }));
    
    setIsVerifying(false);
    setStep(2);
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const filledRows = rows.filter(r => r.username.trim() !== '' && r.status !== 'error').map(r => ({
        ...r,
        username: r.username.replace('@', '').trim().toLowerCase()
      }));
      
      await executeSpreadsheetImportAction(filledRows);
      
      await fetchData();
      localStorage.removeItem(`tnt_import_draft_global`);
      alert("Berhasil menyimpan data kreator!");
      
      const remainingRows = rows.filter(r => r.username.trim() === '' || r.status === 'error');
      if (remainingRows.length < 5) {
        const needed = 5 - remainingRows.length;
        for (let i = 0; i < needed; i++) {
          remainingRows.push(getEmptyRow());
        }
      }
      setRows(remainingRows);
      setStep(1);
    } catch (err: any) {
      alert("Gagal import: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const renderTd = (colName: keyof SpreadsheetRow, rowIdx: number, value: string, children: React.ReactNode, tdClassName: string = "p-2") => {
    const isDraggingHere = dragFill && dragFill.active && dragFill.colName === colName && 
      rowIdx >= Math.min(dragFill.startRowIdx, dragFill.currentRowIdx) && 
      rowIdx <= Math.max(dragFill.startRowIdx, dragFill.currentRowIdx);

    return (
      <td 
        className={`relative group ${tdClassName}`}
        onMouseEnter={() => handleCellMouseEnter(rowIdx, colName)}
      >
        {children}
        <div 
          className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:scale-150"
          onMouseDown={(e) => handleFillHandleMouseDown(e, rowIdx, colName, value)}
        />
        {isDraggingHere && (
          <div className="absolute inset-0 border-2 border-blue-400 pointer-events-none z-20 bg-blue-50/20" />
        )}
      </td>
    );
  };

  return (
    <div className="space-y-6 w-full mx-auto py-6 px-4">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.push(`/creator-pool`)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Import / Update Kreator Baru</h2>
          <p className="text-sm text-slate-500">Mode Spreadsheet. Auto-saved.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {step === 1 && (
            <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-3 font-semibold text-slate-700 w-10">No</th>
                    <th className="p-3 font-semibold text-slate-700 min-w-[150px]">Username <span className="text-red-500">*</span></th>
                    <th className="p-3 font-semibold text-slate-700 min-w-[150px]">No. Whatsapp <span className="text-red-500">*</span></th>
                    <th className="p-3 font-semibold text-slate-700 min-w-[120px]">Followers</th>
                    <th className="p-3 font-semibold text-slate-700 min-w-[100px]">Tier</th>
                    <th className="p-3 font-semibold text-slate-700 min-w-[100px]">Level</th>
                    <th className="p-3 font-semibold text-slate-700 min-w-[120px]">Audiens Age</th>
                    <th className="px-3 py-3 font-semibold text-slate-600 text-left w-32 border-b-2 border-slate-200">GMV 30 Days</th>
                    <th className="px-3 py-3 font-semibold text-rose-600 text-left w-36 border-b-2 border-rose-200">Niche *</th>
                    <th className="px-3 py-3 font-semibold text-slate-600 text-left w-36 border-b-2 border-slate-200">MCN</th>
                    <th className="px-3 py-3 font-semibold text-slate-600 text-left w-32 border-b-2 border-slate-200">Ratecard (Rp)</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors ${row.status === 'error' ? 'bg-red-50' : ''}`}>
                      <td className="p-2 text-center text-slate-400 font-medium">
                        {idx + 1}
                        {row.status === 'error' && <span title={row.errorMsg}><AlertCircle className="w-4 h-4 text-red-500 inline ml-1" /></span>}
                      </td>
                      {renderTd('username', idx, row.username, (
                        <input type="text" value={row.username} 
                          onBlur={(e) => {
                             const val = e.target.value.trim();
                             if (val) runBulkAutoDetect([val]);
                          }}
                          onPaste={(e) => handleGlobalPaste(e, idx, 'username')}
                          onChange={e => updateRow(row.id, 'username', e.target.value.replace('@', '').toLowerCase())} className="w-full border-none bg-transparent focus:ring-1 focus:ring-blue-500 p-1 rounded" placeholder="username" />
                      ))}
                      {renderTd('whatsapp', idx, row.whatsapp, (
                        <input type="text" value={row.whatsapp} onPaste={(e) => handleGlobalPaste(e, idx, 'whatsapp')} onChange={e => updateRow(row.id, 'whatsapp', e.target.value)} className="w-full border-none bg-transparent focus:ring-1 focus:ring-blue-500 p-1 rounded" placeholder="08..." />
                      ))}
                      {renderTd('followers', idx, row.followers, (
                        <input type="number" value={row.followers} onPaste={(e) => handleGlobalPaste(e, idx, 'followers')} onChange={e => updateRow(row.id, 'followers', e.target.value)} className="w-full border-none bg-transparent focus:ring-1 focus:ring-blue-500 p-1 rounded" placeholder="10000" />
                      ))}
                      <td className="p-2">
                        <input type="text" value={row.followers ? getAutoTier(parseInt(row.followers) || 0) : ''} readOnly className="w-full border-none bg-transparent p-1 rounded text-slate-400 font-medium cursor-not-allowed" placeholder="Auto" />
                      </td>
                      {renderTd('level', idx, row.level, (
                        <input type="number" value={row.level} onPaste={(e) => handleGlobalPaste(e, idx, 'level')} onChange={e => updateRow(row.id, 'level', e.target.value)} className="w-full border-none bg-transparent focus:ring-1 focus:ring-blue-500 p-1 rounded" placeholder="2" />
                      ))}
                      {renderTd('audience_age', idx, row.audience_age, (
                        <input type="text" value={row.audience_age} onPaste={(e) => handleGlobalPaste(e, idx, 'audience_age')} onChange={e => updateRow(row.id, 'audience_age', e.target.value)} className="w-full border-none bg-transparent focus:ring-1 focus:ring-blue-500 p-1 rounded" placeholder="18-24" />
                      ))}
                      {renderTd('gmv_30d', idx, row.gmv_30d, (
                        <input type="number" className="w-full h-full p-2 bg-transparent border-none outline-none" value={row.gmv_30d} onPaste={(e) => handleGlobalPaste(e, idx, 'gmv_30d')} onChange={(e) => updateRow(row.id, 'gmv_30d', e.target.value)} placeholder="5000000" />
                      ), "p-0 border-r border-slate-200")}
                      {renderTd('niche', idx, row.niche, (
                        <input type="text" list="niche-options" className="w-full h-full p-2 bg-transparent border-none outline-none" value={row.niche} onPaste={(e) => handleGlobalPaste(e, idx, 'niche')} onChange={(e) => updateRow(row.id, 'niche', e.target.value)} placeholder="Ketik..." />
                      ), "p-0 border-r border-rose-100 bg-rose-50/30")}
                      {renderTd('mcn', idx, row.mcn, (
                        <input type="text" className="w-full h-full p-2 bg-transparent border-none outline-none" value={row.mcn} onPaste={(e) => handleGlobalPaste(e, idx, 'mcn')} onChange={(e) => updateRow(row.id, 'mcn', e.target.value)} placeholder="MCN" />
                      ), "p-0 border-r border-slate-200")}
                      {renderTd('ratecard', idx, row.ratecard, (
                        <input type="number" className="w-full h-full p-2 bg-transparent border-none outline-none" value={row.ratecard} onPaste={(e) => handleGlobalPaste(e, idx, 'ratecard')} onChange={(e) => updateRow(row.id, 'ratecard', e.target.value)} placeholder="150000" />
                      ), "p-0 border-r border-slate-200")}
                      <td className="p-2 text-center">
                        <button onClick={() => setRows(rows.filter(r => r.id !== row.id))} className="text-red-400 hover:text-red-600 p-1 rounded transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3 bg-slate-50 flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => setRows([...rows, getEmptyRow()])}>
                  <Plus className="w-4 h-4 mr-1" /> Tambah Baris
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRows([...rows, ...Array(5).fill(null).map(getEmptyRow)])}>
                  + 5 Baris
                </Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="mt-6 flex justify-end">
              <Button onClick={handleVerify} disabled={isVerifying} className="bg-indigo-600 hover:bg-indigo-700">
                {isVerifying ? 'Memeriksa...' : 'Verifikasi Data'} <Play className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-blue-50 text-blue-800 p-4 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 mt-0.5" />
                <div>
                  <h4 className="font-semibold">Verifikasi Selesai</h4>
                  <p className="text-sm mt-1">Silakan periksa kembali status kreator di bawah ini sebelum melakukan Import.</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3 font-semibold text-slate-700">Username</th>
                      <th className="p-3 font-semibold text-slate-700">Followers</th>
                      <th className="p-3 font-semibold text-slate-700">Tier</th>
                      <th className="p-3 font-semibold text-slate-700">No. WhatsApp</th>
                      <th className="p-3 font-semibold text-slate-700">Niche</th>
                      <th className="p-3 font-semibold text-slate-700">Status</th>
                      <th className="p-3 font-semibold text-slate-700">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.filter(r => r.username.trim() !== '').map(row => (
                      <tr key={row.id} className="border-b border-slate-100 last:border-0">
                        <td className="p-3 font-medium text-slate-800">@{row.username}</td>
                        <td className="p-3">{row.followers || '-'}</td>
                        <td className="p-3">{row.followers ? getAutoTier(parseInt(row.followers) || 0) : '-'}</td>
                        <td className="p-3">{row.whatsapp}</td>
                        <td className="p-3">{row.niche}</td>
                        <td className="p-3">
                          {row.status === 'baru' && <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">Baru</span>}
                          {row.status === 'update' && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">Update Data</span>}
                        </td>
                        <td className="p-3 text-xs text-slate-500">{row.existingInfo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setStep(1)} disabled={isImporting}>
                  Kembali Edit
                </Button>
                <Button onClick={handleImport} disabled={isImporting} className="bg-indigo-600 hover:bg-indigo-700">
                  {isImporting ? 'Menyimpan...' : 'Import Sekarang'} <Save className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <datalist id="niche-options">
        {niches.map(n => (
          <option key={n.id} value={n.nama} />
        ))}
      </datalist>
    </div>
  );
}
