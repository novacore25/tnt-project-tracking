"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Save, Plus, AlertCircle, CheckCircle2, Wand2, Loader2, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useAuth } from "@/providers/AuthProvider";
import {
  fetchCreatorsWithSnapshotsForImportAction,
  fetchCampaignCreatorsForImportAction,
  fetchCampaignCreatorsFullForImportAction,
  saveCreatorImportBatchAction,
} from "@/app/actions/campaignPageActions";

type SpreadsheetRow = {
  id: string;
  username: string;
  followers: string;
  gmv_30_days: string;
  gmv_30_days_video: string;
  gmv_30_days_live: string;
  rate_card: string;
  qty_vt: string;
  qty_live: string;
  content_type: string;
  no_wa: string;
  level: string;
  
  status?: 'baru' | 'update' | 'error' | 'duplicate_campaign' | 'incomplete';
  errorMsg?: string;
  creatorId?: number;
  existingData?: any; 
  action?: 'update' | 'skip'; 
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
  gmv_30_days: '',
  gmv_30_days_video: '',
  gmv_30_days_live: '',
  rate_card: '0',
  qty_vt: '1',
  qty_live: '0',
  content_type: 'Video',
  no_wa: '',
  level: '',
});

const determineContentType = (vt: number, live: number) => {
  if (vt > 0 && live > 0) return 'Video & Live';
  if (vt > 0 && live === 0) return 'Video';
  if (vt === 0 && live > 0) return 'Live';
  return '';
};

const parseSmartNumber = (val: string): string => {
  if (!val) return '';
  let str = val.toString().trim().toUpperCase();
  
  // Handle empty or dash inputs
  if (str === '-' || str === '_' || str === 'NA' || str === 'N/A') return '0';

  // Handle K, M, B suffixes like 1.5M, 10K
  const match = str.match(/^([0-9.,]+)([KMB]?)$/);
  if (match) {
    let numStr = match[1];
    const suffix = match[2];
    
    if (suffix) {
      numStr = numStr.replace(',', '.'); // treat comma as decimal
      let numPart = parseFloat(numStr);
      if (!isNaN(numPart)) {
        if (suffix === 'K') return Math.round(numPart * 1000).toString();
        if (suffix === 'M') return Math.round(numPart * 1000000).toString();
        if (suffix === 'B') return Math.round(numPart * 1000000000).toString();
      }
    }
  }
  
  // Fallback: strip everything except digits
  const fallback = str.replace(/\D/g, '');
  return fallback;
};

export default function SpreadsheetImportCreatorClient() {
  const router = useRouter();
  const rawParams = useParams();
  const rawId = rawParams?.id;
  const campaignId = Number(Array.isArray(rawId) ? rawId[0] : rawId);
  const { campaigns } = useDatabaseStore();
  const { profile, canEditCampaign } = useAuth();
  
  const campaign = campaigns.find(c => c.id === campaignId);
  const isClientApprovalRequired = campaign?.require_client_approval || false;
  const hasAccess = !isNaN(campaignId) ? canEditCampaign(campaignId) : false;
  
  const [rows, setRows] = useState<SpreadsheetRow[]>(() => Array(5).fill(null).map(getEmptyRow));
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [isLoadingAuto, setIsLoadingAuto] = useState(false);
  const [autoApprovalFilter, setAutoApprovalFilter] = useState<'all' | 'approve' | 'not_approve' | 'pending' | 'alternate' | 'auto_detect'>('all');
  const [showAutoFilterMenu, setShowAutoFilterMenu] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
  const [dragFill, setDragFill] = useState<DragFillState | null>(null);

  // Popup state
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [duplicateRows, setDuplicateRows] = useState<SpreadsheetRow[]>([]);
  const [incompleteRows, setIncompleteRows] = useState<SpreadsheetRow[]>([]);
  const [selectedDuplicateIds, setSelectedDuplicateIds] = useState<Set<string>>(new Set());

  // Safely load draft from localStorage after mount to prevent hydration mismatches and handle corrupted data
  useEffect(() => {
    if (!campaignId || isNaN(campaignId)) return;
    
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('reset') === 'true') {
          try {
            localStorage.removeItem(`tnt_import_creator_${campaignId}`);
            window.history.replaceState({}, '', window.location.pathname);
          } catch (e) {}
          setIsLoaded(true);
          return;
        }

        const saved = localStorage.getItem(`tnt_import_creator_${campaignId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const cleaned = parsed.slice(0, 500).map((r: any): SpreadsheetRow => ({
              id: (r && typeof r.id === 'string' && r.id) ? r.id : Math.random().toString(36).substring(2, 9),
              username: (r && typeof r.username === 'string') ? r.username : '',
              followers: (r && typeof r.followers === 'string') ? r.followers : (r?.followers?.toString() || ''),
              gmv_30_days: (r && typeof r.gmv_30_days === 'string') ? r.gmv_30_days : (r?.gmv_30_days?.toString() || ''),
              gmv_30_days_video: (r && typeof r.gmv_30_days_video === 'string') ? r.gmv_30_days_video : (r?.gmv_30_days_video?.toString() || ''),
              gmv_30_days_live: (r && typeof r.gmv_30_days_live === 'string') ? r.gmv_30_days_live : (r?.gmv_30_days_live?.toString() || ''),
              rate_card: (r && typeof r.rate_card === 'string') ? r.rate_card : (r?.rate_card?.toString() || '0'),
              qty_vt: (r && typeof r.qty_vt === 'string') ? r.qty_vt : (r?.qty_vt?.toString() || '1'),
              qty_live: (r && typeof r.qty_live === 'string') ? r.qty_live : (r?.qty_live?.toString() || '0'),
              content_type: (r && typeof r.content_type === 'string') ? r.content_type : 'Video',
              no_wa: (r && typeof r.no_wa === 'string') ? r.no_wa : (r?.no_wa?.toString() || ''),
              level: (r && typeof r.level === 'string') ? r.level : (r?.level?.toString() || ''),
              status: (r && ['baru', 'update', 'error', 'duplicate_campaign', 'incomplete'].includes(r.status)) ? r.status : undefined,
              errorMsg: (r && typeof r.errorMsg === 'string') ? r.errorMsg : undefined,
              creatorId: (r && typeof r.creatorId === 'number') ? r.creatorId : undefined,
              existingData: r?.existingData || undefined,
              action: (r && ['update', 'skip'].includes(r.action)) ? r.action : undefined,
            }));

            if (cleaned.length > 0) {
              setRows(cleaned);
            }
          }
        }
      } catch (err) {
        console.warn("Failed to load draft from localStorage:", err);
        try {
          localStorage.removeItem(`tnt_import_creator_${campaignId}`);
        } catch (e) {}
      }
    }
    setIsLoaded(true);
  }, [campaignId]);

  // Safely persist draft to localStorage
  useEffect(() => {
    if (!isLoaded || !campaignId || isNaN(campaignId)) return;
    if (typeof window === 'undefined') return;

    try {
      const hasData = rows.some(r => r && (r.username || '').trim() !== '');
      if (hasData) {
        localStorage.setItem(`tnt_import_creator_${campaignId}`, JSON.stringify(rows));
      } else {
        localStorage.removeItem(`tnt_import_creator_${campaignId}`);
      }
    } catch (err) {
      console.warn("Failed to save draft to localStorage:", err);
    }
  }, [rows, campaignId, isLoaded]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragFill) {
        setDragFill(null);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [dragFill]);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    if (!showAutoFilterMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-auto-filter-menu]')) {
        setShowAutoFilterMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAutoFilterMenu]);

  const handleDragFillStart = (idx: number, colName: keyof SpreadsheetRow, value: string) => {
    setDragFill({ active: true, startRowIdx: idx, currentRowIdx: idx, colName, value });
  };

  const handleDragFillEnter = (idx: number) => {
    if (dragFill && dragFill.active) {
      setDragFill({ ...dragFill, currentRowIdx: idx });
      
      setRows(prev => {
        const newRows = [...prev];
        const min = Math.min(dragFill.startRowIdx, idx);
        const max = Math.max(dragFill.startRowIdx, idx);
        
        for (let i = min; i <= max; i++) {
          let val = dragFill.value;
          (newRows[i] as any)[dragFill.colName] = val;
          
          if (dragFill.colName === 'qty_vt' || dragFill.colName === 'qty_live') {
            const vt = Number(newRows[i].qty_vt) || 0;
            const live = Number(newRows[i].qty_live) || 0;
            newRows[i].content_type = determineContentType(vt, live);
          }
        }
        return newRows;
      });
    }
  };

  const handlePaste = async (e: React.ClipboardEvent, startRowIdx: number, startColName: keyof SpreadsheetRow) => {
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData) return;

    if (pasteData.includes('\t') || pasteData.includes('\n')) {
      e.preventDefault();
      
      const parsedRows: string[][] = [];
      let currentRow: string[] = [];
      let currentCell = '';
      let inQuotes = false;
      
      for (let i = 0; i < pasteData.length; i++) {
        const char = pasteData[i];
        const nextChar = pasteData[i+1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            currentCell += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === '\t' && !inQuotes) {
          currentRow.push(currentCell.trim());
          currentCell = '';
        } else if (char === '\n' && !inQuotes) {
          currentRow.push(currentCell.trim());
          if (currentRow.some(c => c !== '')) {
            parsedRows.push(currentRow);
          }
          currentRow = [];
          currentCell = '';
        } else if (char === '\r' && !inQuotes) {
          // ignore \r
        } else {
          currentCell += char;
        }
      }
      if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c !== '')) {
          parsedRows.push(currentRow);
        }
      }

      const columns: (keyof SpreadsheetRow)[] = ['username', 'no_wa', 'followers', 'level', 'gmv_30_days', 'gmv_30_days_video', 'gmv_30_days_live', 'rate_card', 'qty_vt', 'qty_live'];
      const startColIdx = columns.indexOf(startColName);
      if (startColIdx === -1) return;

      const newRows = [...rows];
      
      // Ensure enough rows
      const requiredRows = startRowIdx + parsedRows.length;
      if (requiredRows > newRows.length) {
        const rowsToAdd = requiredRows - newRows.length;
        for (let i = 0; i < rowsToAdd; i++) {
          newRows.push(getEmptyRow());
        }
      }

      for (let i = 0; i < parsedRows.length; i++) {
        const targetRowIndex = startRowIdx + i;
        const pasteRow = parsedRows[i];
        
        for (let j = 0; j < pasteRow.length; j++) {
          const targetColIdx = startColIdx + j;
          if (targetColIdx < columns.length) {
            const targetColName = columns[targetColIdx];
            let cleanedVal = pasteRow[j];
            
            if (targetColName === 'username') {
              cleanedVal = cleanedVal.replace(/^@/, '').toLowerCase();
            } else if (['level', 'followers', 'gmv_30_days', 'gmv_30_days_video', 'gmv_30_days_live', 'rate_card', 'qty_vt', 'qty_live'].includes(targetColName)) {
              cleanedVal = parseSmartNumber(cleanedVal);
              if (!cleanedVal && ['qty_vt', 'qty_live', 'rate_card'].includes(targetColName)) cleanedVal = '0';
            }
            
            (newRows[targetRowIndex] as any)[targetColName] = cleanedVal;
          }
        }
        
        // Recompute content type
        const vt = Number(newRows[targetRowIndex].qty_vt) || 0;
        const live = Number(newRows[targetRowIndex].qty_live) || 0;
        newRows[targetRowIndex].content_type = determineContentType(vt, live);
        
        newRows[targetRowIndex].status = undefined;
        newRows[targetRowIndex].errorMsg = undefined;
      }
      
      setRows(newRows);
      
      // Auto-fill historical data for pasted usernames
      const pastedUsernames = parsedRows.map((r, i) => {
        const usernameIdx = columns.indexOf('username');
        if (usernameIdx !== -1 && startColIdx <= usernameIdx && usernameIdx < startColIdx + r.length) {
           return newRows[startRowIdx + i].username;
        }
        return null;
      }).filter(Boolean) as string[];
      
      const uniqueUsernames = Array.from(new Set(pastedUsernames));
      if (uniqueUsernames.length > 0) {
        try {
          const { data: dbCreators } = await fetchCreatorsWithSnapshotsForImportAction(uniqueUsernames);
            
          if (dbCreators && dbCreators.length > 0) {
            const creatorIds = dbCreators.map((c: any) => c.id);
            const { data: ccDatas } = await fetchCampaignCreatorsForImportAction(campaignId, creatorIds);
              
            setRows(prev => {
              const updatedRows = [...prev];
              let hasChanges = false;
              
              for (let i = 0; i < parsedRows.length; i++) {
                const rowIdx = startRowIdx + i;
                const row = { ...updatedRows[rowIdx] };
                const uname = row.username;
                if (!uname) continue;
                
                const dbCreator = dbCreators.find((c: any) => c.username.toLowerCase() === uname.toLowerCase());
                if (!dbCreator) continue;
                
                const snaps = (dbCreator.creator_snapshots || []).sort((a: any, b: any) => b.id - a.id);
                const lastSnap = snaps[0] || {};
                const activeContact = (dbCreator.creator_contacts || []).find((c: any) => c.status === 'aktif');
                const ccData = (ccDatas || []).find((c: any) => c.creator_id === dbCreator.id);
                
                let rowUpdated = false;
                
                const checkAndUpdate = (field: keyof SpreadsheetRow, newVal: any) => {
                  if (newVal !== undefined && newVal !== null && newVal !== '') {
                    const strVal = newVal.toString();
                    const isDefault = 
                      !row[field] || 
                      (field === 'qty_vt' && row[field] === '1') || 
                      (field === 'qty_live' && row[field] === '0') || 
                      (field === 'rate_card' && row[field] === '0') ||
                      row[field] === '0';
                      
                    if (isDefault && row[field] !== strVal) {
                      (row as any)[field] = strVal;
                      rowUpdated = true;
                    }
                  }
                };

                if (activeContact?.nomor) checkAndUpdate('no_wa', activeContact.nomor);
                if (lastSnap.followers) checkAndUpdate('followers', lastSnap.followers);
                if (lastSnap.level) checkAndUpdate('level', lastSnap.level);
                if (lastSnap.gmv_30d) checkAndUpdate('gmv_30_days', lastSnap.gmv_30d);
                if (lastSnap.gmv_30d_video) checkAndUpdate('gmv_30_days_video', lastSnap.gmv_30d_video);
                if (lastSnap.gmv_30d_live) checkAndUpdate('gmv_30_days_live', lastSnap.gmv_30d_live);
                
                if (ccData) {
                  if (ccData.price) checkAndUpdate('rate_card', ccData.price);
                  if (ccData.qty_vt !== undefined) checkAndUpdate('qty_vt', ccData.qty_vt);
                  if (ccData.qty_live !== undefined) checkAndUpdate('qty_live', ccData.qty_live);
                  
                  const vt = Number(row.qty_vt) || 0;
                  const live = Number(row.qty_live) || 0;
                  row.content_type = determineContentType(vt, live);
                } else if (lastSnap.ratecard) {
                  checkAndUpdate('rate_card', lastSnap.ratecard);
                }
                
                if (rowUpdated) {
                  updatedRows[rowIdx] = row;
                  hasChanges = true;
                }
              }
              
              return hasChanges ? updatedRows : prev;
            });
          }
        } catch (e) {
          console.error("Auto-fill on paste error:", e);
        }
      }
    }
  };

  const handleUsernameBlur = async (idx: number, val: string) => {
    const uname = val.replace(/^@/, '').toLowerCase().trim();
    if (!uname) return;
    
    try {
      // Fetch DB
      const { data: dbCreators } = await fetchCreatorsWithSnapshotsForImportAction([uname]);
      const dbCreator = (dbCreators || [])[0];
        
      if (!dbCreator) return;
      
      const snaps = (dbCreator.creator_snapshots || []).sort((a: any, b: any) => b.id - a.id);
      const lastSnap = snaps[0] || {};
      const activeContact = (dbCreator.creator_contacts || []).find((c: any) => c.status === 'aktif');
      
      const { data: ccDatas } = await fetchCampaignCreatorsForImportAction(campaignId, [dbCreator.id]);
      const ccData = (ccDatas || [])[0];

      setRows(prev => {
        const newRows = [...prev];
        const row = { ...newRows[idx] };
        
        let updated = false;
        
        const checkAndUpdate = (field: keyof SpreadsheetRow, newVal: any) => {
          if (newVal !== undefined && newVal !== null && newVal !== '') {
            const strVal = newVal.toString();
            const isDefault = 
              !row[field] || 
              (field === 'qty_vt' && row[field] === '1') || 
              (field === 'qty_live' && row[field] === '0') || 
              (field === 'rate_card' && row[field] === '0') ||
              row[field] === '0';
              
            if (isDefault && row[field] !== strVal) {
              (row as any)[field] = strVal;
              updated = true;
            }
          }
        };

        if (activeContact?.nomor) checkAndUpdate('no_wa', activeContact.nomor);
        if (lastSnap.followers) checkAndUpdate('followers', lastSnap.followers);
        if (lastSnap.level) checkAndUpdate('level', lastSnap.level);
        if (lastSnap.gmv_30d) checkAndUpdate('gmv_30_days', lastSnap.gmv_30d);
        if (lastSnap.gmv_30d_video) checkAndUpdate('gmv_30_days_video', lastSnap.gmv_30d_video);
        if (lastSnap.gmv_30d_live) checkAndUpdate('gmv_30_days_live', lastSnap.gmv_30d_live);
        
        if (ccData) {
          if (ccData.price) checkAndUpdate('rate_card', ccData.price);
          if (ccData.qty_vt !== undefined) checkAndUpdate('qty_vt', ccData.qty_vt);
          if (ccData.qty_live !== undefined) checkAndUpdate('qty_live', ccData.qty_live);
          
          const vt = Number(row.qty_vt) || 0;
          const live = Number(row.qty_live) || 0;
          row.content_type = determineContentType(vt, live);
        } else if (lastSnap.ratecard) {
          checkAndUpdate('rate_card', lastSnap.ratecard);
        }

        if (updated) {
          newRows[idx] = row;
          return newRows;
        }
        return prev;
      });
    } catch (e) {
      console.error(e);
    }
  };

  const updateCell = (idx: number, field: keyof SpreadsheetRow, value: string) => {
    const newRows = [...rows];
    let cleaned = value;
    
    if (field === 'username') cleaned = cleaned.replace(/^@/, '').toLowerCase();
    else if (['followers', 'gmv_30_days', 'gmv_30_days_video', 'gmv_30_days_live', 'rate_card', 'qty_vt', 'qty_live'].includes(field)) {
      cleaned = parseSmartNumber(cleaned);
    }
    
    newRows[idx] = { ...newRows[idx], [field]: cleaned, status: undefined, errorMsg: undefined };
    
    if (field === 'qty_vt' || field === 'qty_live') {
      const vt = Number(newRows[idx].qty_vt) || 0;
      const live = Number(newRows[idx].qty_live) || 0;
      newRows[idx].content_type = determineContentType(vt, live);
    }
    
    setRows(newRows);
  };

  const handleAutofillRatecard = async () => {
    const validRows = rows.filter(r => r && (r.username || '').trim() !== '' && (!r.rate_card || r.rate_card === '0'));
    if (validRows.length === 0) {
      alert("Semua kreator sudah memiliki Rate Card > 0, atau tidak ada Username yang diisi.");
      return;
    }
    
    setIsAutoDetecting(true);
    try {
      const usernames = validRows.map(r => (r.username || '').trim());
      const { data: matchedCreators } = await fetchCreatorsWithSnapshotsForImportAction(usernames);
        
      if (matchedCreators && matchedCreators.length > 0) {
        setRows(currentRows => {
          const newRows = [...currentRows];
          let updatedCount = 0;
          
          for (let i = 0; i < newRows.length; i++) {
            const row = newRows[i];
            if (!row) continue;
            const uname = (row.username || '').trim();
            if (!uname || (row.rate_card && row.rate_card !== '0')) continue;
            
            const matched = matchedCreators.find((c: any) => c && (c.username || '').toLowerCase() === uname.toLowerCase());
            if (!matched) continue;
            
            const snaps = (matched.creator_snapshots || []).sort((a: any, b: any) => b.id - a.id);
            const mergedRatecard = snaps.reduce((acc: any, curr: any) => acc ?? curr.ratecard, null);
            
            if (mergedRatecard !== null && mergedRatecard > 0) {
               newRows[i].rate_card = mergedRatecard.toString();
               updatedCount++;
            }
          }
          if (updatedCount > 0) alert(`Berhasil autofill ratecard untuk ${updatedCount} kreator.`);
          else alert("Tidak ada data ratecard terbaru yang ditemukan untuk di-autofill.");
          return newRows;
        });
      } else {
        alert("Tidak ada data ratecard terbaru yang ditemukan untuk di-autofill.");
      }
    } catch (err) {
      console.error(err);
      alert("Gagal melakukan autofill ratecard.");
    }
    setIsAutoDetecting(false);
  };

  const handleLoadIncompleteAuto = async (approvalFilter: 'all' | 'approve' | 'not_approve' | 'pending' | 'alternate' | 'auto_detect' = autoApprovalFilter) => {
    if (!campaignId) return;
    setIsLoadingAuto(true);
    setShowAutoFilterMenu(false);
    try {
      const { data: autoList, error: autoErr } = await fetchCampaignCreatorsFullForImportAction(campaignId, approvalFilter);

      if (autoErr) throw new Error(autoErr);

      const filterLabel: Record<string, string> = {
        all: 'semua kreator',
        approve: 'Approve',
        not_approve: 'Not Approve',
        pending: 'Pending',
        alternate: 'Alternate',
        auto_detect: 'Auto-Detect',
      };

      if (!autoList || autoList.length === 0) {
        alert(`Tidak ada kreator dengan status ${filterLabel[approvalFilter]} yang terdaftar di campaign ini.`);
        setIsLoadingAuto(false);
        return;
      }

      // 2. Evaluasi setiap kreator dan hitung tingkat ketidaklengkapan datanya
      const evaluatedRows: (SpreadsheetRow & { missingScore: number })[] = [];

      for (const cc of autoList) {
        const c = Array.isArray(cc.creators) ? cc.creators[0] : cc.creators;
        if (!c) continue;

        const activeContact = (c.creator_contacts || []).find((ct: any) => ct.status === 'aktif') || c.creator_contacts?.[0];
        const noWa = activeContact?.nomor ? String(activeContact.nomor).trim() : '';

        // Ambil snapshot terbaru
        const sortedSnaps = [...(c.creator_snapshots || [])].sort((a: any, b: any) => {
          const tDiff = new Date(b.tanggal_update || 0).getTime() - new Date(a.tanggal_update || 0).getTime();
          if (tDiff !== 0) return tDiff;
          return (b.id || 0) - (a.id || 0);
        });
        const snap = sortedSnaps[0];

        const followers = snap?.followers ? String(snap.followers) : '';
        const level = snap?.level ? String(snap.level) : '';
        const gmv30d = snap?.gmv_30d ? String(snap.gmv_30d) : '';
        const gmv30dVid = snap?.gmv_30d_video ? String(snap.gmv_30d_video) : '';
        const gmv30dLive = snap?.gmv_30d_live ? String(snap.gmv_30d_live) : '';
        const rateCard = cc.price ? String(cc.price) : (snap?.ratecard ? String(snap.ratecard) : '0');
        const qtyVt = cc.qty_vt !== null && cc.qty_vt !== undefined ? String(cc.qty_vt) : '1';
        const qtyLive = cc.qty_live !== null && cc.qty_live !== undefined ? String(cc.qty_live) : '0';
        const contentType = cc.content_type || 'Video';

        // Hitung skor ketidaklengkapan (setiap kolom yang kosong / bernilai 0 menambah skor)
        let missingScore = 0;
        if (!noWa || noWa === '-' || noWa === '_') missingScore++;
        if (!followers || followers === '0') missingScore++;
        if (!level || level === '0') missingScore++;
        if (!gmv30d || gmv30d === '0') missingScore++;
        if (!gmv30dVid || gmv30dVid === '0') missingScore++;
        if (!gmv30dLive || gmv30dLive === '0') missingScore++;
        if (!rateCard || rateCard === '0') missingScore++;
        if (!contentType || contentType === '-') missingScore++;

        // Masukkan hanya yang ada kolom belum lengkap
        if (missingScore > 0) {
          evaluatedRows.push({
            id: Math.random().toString(36).substring(2, 9),
            username: c.username || '',
            no_wa: noWa,
            followers,
            level,
            gmv_30_days: gmv30d,
            gmv_30_days_video: gmv30dVid,
            gmv_30_days_live: gmv30dLive,
            rate_card: rateCard,
            qty_vt: qtyVt,
            qty_live: qtyLive,
            content_type: contentType,
            creatorId: c.id,
            status: 'update',
            action: 'update',
            missingScore
          });
        }
      }

      if (evaluatedRows.length === 0) {
        alert(`Semua data kreator (${filterLabel[approvalFilter]}) di campaign ini sudah lengkap 100%!`);
        setIsLoadingAuto(false);
        return;
      }

      // 3. Urutkan dari yang paling tidak lengkap ke yang lumayan lengkap
      evaluatedRows.sort((a, b) => b.missingScore - a.missingScore);

      // 4. Bersihkan property missingScore dan masukkan ke tabel rows
      const cleanRows: SpreadsheetRow[] = evaluatedRows.map(({ missingScore, ...rest }) => rest);
      setRows(cleanRows);

      alert(`Ditemukan ${cleanRows.length} kreator (${filterLabel[approvalFilter]}) yang datanya belum lengkap.\nData berhasil dimuat dan diurutkan dari yang paling belum lengkap ke yang lumayan lengkap.`);
    } catch (err: any) {
      console.error("Error load auto incomplete:", err);
      alert("Gagal memuat kreator: " + (err.message || err.toString()));
    } finally {
      setIsLoadingAuto(false);
    }
  };

  const handleExportExcel = () => {
    const validRows = rows.filter(r => r && (
      (r.username || '').trim() !== '' ||
      (r.no_wa || '').trim() !== '' ||
      (r.followers || '').trim() !== '' ||
      (r.gmv_30_days || '').trim() !== ''
    ));

    if (validRows.length === 0) {
      alert("Tidak ada data di tabel yang bisa diekspor.");
      return;
    }

    const exportData = validRows.map((r, idx) => ({
      "No": idx + 1,
      "Username": r.username || '',
      "No WA": r.no_wa || '',
      "Followers": r.followers || '',
      "Level": r.level || '',
      "GMV 30 Days": r.gmv_30_days || '',
      "GMV 30D (Video)": r.gmv_30_days_video || '',
      "GMV 30D (Live)": r.gmv_30_days_live || '',
      "Rate Card (Rp)": r.rate_card || '0',
      "Qty VT": r.qty_vt || '1',
      "Qty Live": r.qty_live || '0',
      "Tipe Konten": r.content_type || 'Video',
      "Keterangan": r.errorMsg || r.status || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Draft Kreator");

    const campaignName = campaign?.nama ? campaign.nama.replace(/[^a-zA-Z0-9_-]/g, '_') : `campaign_${campaignId}`;
    const filename = `Draft_Import_Kreator_${campaignName}_${new Date().toISOString().split('T')[0]}.xlsx`;

    XLSX.writeFile(workbook, filename);
  };

  const clearAll = () => {
    if (confirm("Kosongkan semua data di tabel?")) {
      setRows(Array(5).fill(null).map(getEmptyRow));
      if (typeof window !== 'undefined' && campaignId) {
        try {
          localStorage.removeItem(`tnt_import_creator_${campaignId}`);
        } catch (e) {}
      }
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
    setSelectedDuplicateIds(new Set());
    
    const validated = [...rows];
    const toCheckUsernames = validated
      .filter(r => r && (r.username || '').trim())
      .map(r => (r.username || '').trim().toLowerCase());
    const uniqueUsernames = [...new Set(toCheckUsernames)];
    
    // Fetch central creators DB for snapshot data (case-insensitive)
    const { data: allExistingCreators } = await fetchCreatorsWithSnapshotsForImportAction(uniqueUsernames);
    const creatorIds = (allExistingCreators || []).map((c: any) => c.id);
      
    // Fetch existing campaign_creators for dup check
    const { data: campaignCreatorsData } = await fetchCampaignCreatorsForImportAction(campaignId, creatorIds);
      
    const campaignMap = new Map((campaignCreatorsData || []).map((cc: any) => {
      const u = cc.username;
      return [u ? u.toLowerCase() : '', cc];
    }));
    const existingMap = new Map((allExistingCreators || []).map((c: any) => [(c.username || '').toLowerCase(), c]));

    let hasDuplicates = false;
    let hasIncompletes = false;
    
    // Track usernames seen within the spreadsheet to detect in-spreadsheet duplicates
    const seenInSpreadsheet = new Set<string>();

    for (let i = 0; i < validated.length; i++) {
      const row = validated[i];
      if (!row || !(row.username || '').trim()) continue;
      
      const vt = Number(row.qty_vt) || 0;
      const live = Number(row.qty_live) || 0;
      
      if (vt === 0 && live === 0) {
        row.status = 'error';
        row.errorMsg = 'Minimal salah satu (Qty VT / Qty Live) harus > 0';
        continue;
      }
      
      const uname = (row.username || '').trim();
      const unameLower = uname.toLowerCase();
      
      // Check if same username already appears earlier in this spreadsheet
      if (seenInSpreadsheet.has(unameLower)) {
        row.status = 'error';
        row.errorMsg = `Username duplikat di spreadsheet (sudah ada di baris sebelumnya)`;
        continue;
      }
      seenInSpreadsheet.add(unameLower);
      
      const dbCreator = existingMap.get(unameLower);
      const campaignCreator = campaignMap.get(unameLower);
      
      let currentGmv = row.gmv_30_days;
      let currentGmvVid = row.gmv_30_days_video;
      let currentGmvLive = row.gmv_30_days_live;
      let currentFollowers = row.followers;

      if (dbCreator) {
        row.creatorId = dbCreator.id;
        const snaps = (dbCreator.creator_snapshots || []).sort((a: any, b: any) => b.id - a.id);
        const lastSnap = snaps[0] || {};
        const activeContact = (dbCreator.creator_contacts || []).find((c: any) => c.status === 'aktif');
        
        const checkAndUpdate = (field: keyof SpreadsheetRow, newVal: any) => {
          if (newVal !== undefined && newVal !== null && newVal !== '') {
            const strVal = newVal.toString();
            const isDefault = 
              !row[field] || 
              (field === 'qty_vt' && row[field] === '1') || 
              (field === 'qty_live' && row[field] === '0') || 
              (field === 'rate_card' && row[field] === '0') ||
              row[field] === '0';
              
            if (isDefault && row[field] !== strVal) {
              (row as any)[field] = strVal;
            }
          }
        };

        if (activeContact?.nomor) checkAndUpdate('no_wa', activeContact.nomor);
        if (lastSnap.followers) checkAndUpdate('followers', lastSnap.followers);
        if (lastSnap.level) checkAndUpdate('level', lastSnap.level);
        if (lastSnap.gmv_30d) checkAndUpdate('gmv_30_days', lastSnap.gmv_30d);
        if (lastSnap.gmv_30d_video) checkAndUpdate('gmv_30_days_video', lastSnap.gmv_30d_video);
        if (lastSnap.gmv_30d_live) checkAndUpdate('gmv_30_days_live', lastSnap.gmv_30d_live);
        
        if (campaignCreator) {
          if (campaignCreator.price) checkAndUpdate('rate_card', campaignCreator.price);
          if (campaignCreator.qty_vt !== undefined) checkAndUpdate('qty_vt', campaignCreator.qty_vt);
          if (campaignCreator.qty_live !== undefined) checkAndUpdate('qty_live', campaignCreator.qty_live);
          
          const vt = Number(row.qty_vt) || 0;
          const live = Number(row.qty_live) || 0;
          row.content_type = determineContentType(vt, live);
          
          // Auto-update instead of prompting
          row.status = 'duplicate_campaign';
          row.existingData = campaignCreator;
          row.action = 'update';
        } else {
          if (lastSnap.ratecard) checkAndUpdate('rate_card', lastSnap.ratecard);
          
          if (!row.followers || (!row.gmv_30_days && !row.gmv_30_days_video && !row.gmv_30_days_live)) {
            row.status = 'incomplete';
            hasIncompletes = true;
          } else {
            row.status = 'baru';
          }
        }
      } else {
        if (!row.followers || (!row.gmv_30_days && !row.gmv_30_days_video && !row.gmv_30_days_live)) {
          row.status = 'incomplete';
          hasIncompletes = true;
        } else {
          row.status = 'baru';
        }
      }
    }
    
    setRows(validated);
    setIsVerifying(false);

    if (hasDuplicates || hasIncompletes) {
      setDuplicateRows(validated.filter(r => r.status === 'duplicate_campaign'));
      setIncompleteRows(validated.filter(r => r.status === 'incomplete'));
      setShowConfirmPopup(true);
      return false;
    } else {
      return true;
    }
  };

  const handleSimpan = async () => {
    const isReady = await verifyData();
    if (isReady) {
      executeSaveToDatabase();
    }
  };

  const handleUpdateIncomplete = (idx: number, field: 'followers' | 'gmv_30_days' | 'gmv_30_days_video' | 'gmv_30_days_live', val: string) => {
    const cleaned = parseSmartNumber(val);
    const newInc = [...incompleteRows];
    newInc[idx][field] = cleaned;
    
    if (newInc[idx].followers && (newInc[idx].gmv_30_days || newInc[idx].gmv_30_days_video || newInc[idx].gmv_30_days_live)) {
      newInc[idx].status = 'baru';
    } else {
      newInc[idx].status = 'incomplete';
    }
    
    setIncompleteRows(newInc);
    
    // Also sync back to main rows
    const rowId = newInc[idx].id;
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: cleaned, status: newInc[idx].status } : r));
  };

  const handleUpdateAction = (id: string, action: 'update' | 'skip') => {
    setDuplicateRows(prev => prev.map(r => r.id === id ? { ...r, action } : r));
    setRows(prev => prev.map(r => r.id === id ? { ...r, action } : r));
  };

  const handleUpdateSelectedAction = (action: 'update' | 'skip') => {
    setDuplicateRows(prev => prev.map(r => selectedDuplicateIds.has(r.id) ? { ...r, action } : r));
    setRows(prev => prev.map(r => selectedDuplicateIds.has(r.id) ? { ...r, action } : r));
    setSelectedDuplicateIds(new Set());
  };

  const handleUpdateAllAction = (action: 'update' | 'skip') => {
    setDuplicateRows(prev => prev.map(r => ({ ...r, action })));
    setRows(prev => prev.map(r => r.status === 'duplicate_campaign' ? { ...r, action } : r));
  };

  const executeSaveToDatabase = async () => {
    setShowConfirmPopup(false);
    const dataToSave = rows.filter(r => r && (r.username || '').trim() && r.status !== 'error' && r.status !== 'incomplete');
    
    if (dataToSave.length === 0) {
      alert("Tidak ada data valid yang bisa disimpan.");
      return;
    }

    setIsImporting(true);
    setSaveProgress({ current: 0, total: dataToSave.length });

    const BATCH_SIZE = 25;
    let successCount = 0;
    
    const calculateTier = (followers: number): string => {
      if (followers < 10000) return 'Nano';
      if (followers < 100000) return 'Micro';
      if (followers < 1000000) return 'Macro';
      return 'Mega';
    };

    for (let i = 0; i < dataToSave.length; i += BATCH_SIZE) {
      const batch = dataToSave.slice(i, i + BATCH_SIZE);
      
      const rowsForBatch = batch.map(row => ({
        username: row.username.trim(),
        creatorId: row.creatorId,
        status: row.status || '',
        action: row.action,
        followers: Number(row.followers) || 0,
        gmv_30_days: Number(row.gmv_30_days) || 0,
        gmv_30_days_video: Number(row.gmv_30_days_video) || 0,
        gmv_30_days_live: Number(row.gmv_30_days_live) || 0,
        ratecard: Number(row.rate_card) || 0,
        tier: calculateTier(Number(row.followers) || 0),
        level: row.level ? Number(row.level) : null,
        no_wa: row.no_wa || '',
        qty_vt: Number(row.qty_vt) || 0,
        qty_live: Number(row.qty_live) || 0,
        content_type: row.content_type || 'Video',
      }));

      try {
        const res = await saveCreatorImportBatchAction({
          campaignId,
          isClientApprovalRequired,
          picName: profile?.nama,
          picId: profile?.id,
          rows: rowsForBatch as any
        });

        if (res.success) {
          successCount += res.successCount || 0;
          const errorMap = new Map((res.errors || []).map((e: any) => [e.username.toLowerCase(), e.error]));
          
          setRows(prev => prev.map(r => {
            const inBatch = batch.some(b => b.id === r.id);
            if (!inBatch) return r;
            const err = errorMap.get(r.username.trim().toLowerCase());
            if (err) return { ...r, status: 'error', errorMsg: err };
            return { ...r, status: 'berhasil' };
          }));
        }
      } catch (err: any) {
        console.error('Batch import error:', err);
      }

      setSaveProgress(prev => ({ ...prev, current: Math.min(prev.current + BATCH_SIZE, prev.total) }));
    }

    setIsImporting(false);
    setSaveProgress({ current: 0, total: 0 });
    alert(`Import selesai!\nBerhasil memproses ${successCount} kreator.`);
  };

  const TableHeader = ({ title, width }: { title: string, width?: string }) => (
    <th className={`px-2 py-2 text-left font-semibold text-slate-600 border-b border-r border-slate-300 bg-slate-100 whitespace-nowrap text-xs shadow-sm sticky top-0 z-10 ${width || 'w-48'}`}>
      {title}
    </th>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50">
      <div className="flex-none bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4 mr-1" /> Kembali
          </Button>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Import Kreator Massal</h1>
            <p className="text-xs text-slate-500">Paste data dari Excel ke tabel di bawah ini.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleAutofillRatecard} disabled={isAutoDetecting} className="text-blue-600 border-blue-200 hover:bg-blue-50">
            <Wand2 className="w-4 h-4 mr-2" /> Autofill Ratecard
          </Button>
          <Button variant="outline" onClick={clearAll} className="text-slate-600 bg-white shadow-sm hover:bg-slate-50">
            Bersihkan
          </Button>
          <Button variant="outline" onClick={handleExportExcel} className="text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 shadow-sm flex items-center gap-1.5" title="Ekspor data di tabel saat ini ke file Excel">
            <Download className="w-4 h-4 mr-1" /> Export Excel
          </Button>
          {/* Split Button: Tampilkan Kreator Belum Lengkap + Filter Approval */}
          <div className="relative flex items-stretch" data-auto-filter-menu="true">
            {/* Main button */}
            <Button
              variant="outline"
              onClick={() => handleLoadIncompleteAuto(autoApprovalFilter)}
              disabled={isLoadingAuto || isImporting || isVerifying || isAutoDetecting}
              className="rounded-r-none border-r-0 text-amber-700 bg-amber-50 border-amber-300 hover:bg-amber-100 shadow-sm flex items-center gap-1.5"
              title="Tampilkan kreator yang datanya belum lengkap"
            >
              {isLoadingAuto ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {isLoadingAuto
                ? 'Memuat...'
                : `Kreator Belum Lengkap${autoApprovalFilter !== 'all' ? ` (${autoApprovalFilter === 'approve' ? 'Approve' : autoApprovalFilter === 'not_approve' ? 'Not Approve' : autoApprovalFilter === 'pending' ? 'Pending' : autoApprovalFilter === 'alternate' ? 'Alternate' : 'Auto-Detect'})` : ''}`
              }
            </Button>
            {/* Dropdown toggle */}
            <button
              type="button"
              disabled={isLoadingAuto || isImporting || isVerifying || isAutoDetecting}
              onClick={() => setShowAutoFilterMenu(v => !v)}
              className="px-2 rounded-r border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700 flex items-center shadow-sm transition-colors disabled:opacity-50"
              title="Pilih filter"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
            {/* Dropdown menu */}
            {showAutoFilterMenu && (
              <div className="absolute top-full right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 text-sm">
                <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100">Filter Kreator Belum Lengkap</div>
                {([
                  { value: 'all', label: '✦ Semua Kreator', desc: 'Tanpa filter status/tier' },
                  { value: 'auto_detect', label: '⚡ Auto-Detect', desc: 'Hanya tier Auto-Detect' },
                  { value: 'approve', label: '✅ Approve', desc: 'Hanya yang diapprove' },
                  { value: 'not_approve', label: '❌ Not Approve', desc: 'Hanya yang ditolak' },
                  { value: 'pending', label: '⏳ Pending', desc: 'Hanya yang pending' },
                  { value: 'alternate', label: '🔄 Alternate', desc: 'Hanya yang alternate' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`w-full text-left px-3 py-2 hover:bg-amber-50 transition-colors flex flex-col gap-0.5 ${autoApprovalFilter === opt.value ? 'bg-amber-50 font-semibold text-amber-800' : 'text-slate-700'}`}
                    onClick={() => {
                      setAutoApprovalFilter(opt.value);
                      handleLoadIncompleteAuto(opt.value);
                    }}
                  >
                    <span>{opt.label}</span>
                    <span className="text-xs text-slate-400 font-normal">{opt.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button onClick={verifyData} disabled={isVerifying || isAutoDetecting || isLoadingAuto} className="bg-slate-800 hover:bg-slate-900 text-white shadow-sm min-w-[120px]">
            {isVerifying ? 'Memeriksa...' : 'Cek Data'}
          </Button>
          <Button onClick={handleSimpan} disabled={isImporting} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm min-w-[140px]">
            {isImporting ? `Menyimpan ${saveProgress.current}/${saveProgress.total}...` : (
              <><Save className="w-4 h-4 mr-2" /> Simpan Ke Database</>
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
        <Card className="shadow-xl bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col h-full">
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th className="w-12 px-2 py-2 bg-slate-100 border-b border-r border-slate-300 sticky top-0 z-10 text-center text-xs font-semibold text-slate-500">No</th>
                  <TableHeader title="Username *" width="w-48" />
                  <TableHeader title="No WA" width="w-40" />
                  <TableHeader title="Followers *" width="w-32" />
                  <TableHeader title="Level" width="w-24" />
                  <TableHeader title="GMV 30 Days *" width="w-40" />
                  <TableHeader title="GMV 30D (Video)" width="w-32" />
                  <TableHeader title="GMV 30D (Live)" width="w-32" />
                  <TableHeader title="Rate Card (Rp)" width="w-40" />
                  <TableHeader title="Qty VT" width="w-24" />
                  <TableHeader title="Qty Live" width="w-24" />
                  <TableHeader title="Tipe Konten" width="w-32" />
                  <TableHeader title="Keterangan" width="w-64" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  if (!row) return null;
                  return (
                    <tr key={row.id || idx} className="hover:bg-slate-50/50">
                      <td className="px-2 py-1 border-b border-r border-slate-300 text-center text-xs text-slate-400 font-mono bg-slate-50">
                        {idx + 1}
                      </td>
                      
                      <td className="relative p-0 border-b border-r border-slate-300 group">
                        <input type="text" value={row.username || ''} onChange={(e) => updateCell(idx, 'username', e.target.value)} onBlur={(e) => handleUsernameBlur(idx, e.target.value)} onPaste={(e) => handlePaste(e, idx, 'username')} className={`w-full h-full min-h-[36px] px-3 py-1 outline-none text-sm transition-colors focus:bg-blue-50 w-48`} />
                      </td>
                      
                      <td className="relative p-0 border-b border-r border-slate-300 group">
                        <input type="text" value={row.no_wa || ''} onChange={(e) => updateCell(idx, 'no_wa', e.target.value)} onPaste={(e) => handlePaste(e, idx, 'no_wa')} className={`w-full h-full min-h-[36px] px-3 py-1 outline-none text-sm transition-colors focus:bg-blue-50 w-40`} />
                      </td>
                      
                      <td className="relative p-0 border-b border-r border-slate-300 group">
                        <input type="text" value={row.followers || ''} onChange={(e) => updateCell(idx, 'followers', e.target.value)} onPaste={(e) => handlePaste(e, idx, 'followers')} className={`w-full h-full min-h-[36px] px-3 py-1 outline-none text-sm transition-colors focus:bg-blue-50 w-32`} />
                      </td>

                      <td className="relative p-0 border-b border-r border-slate-300 group">
                        <input type="text" value={row.level || ''} onChange={(e) => updateCell(idx, 'level', e.target.value)} onPaste={(e) => handlePaste(e, idx, 'level')} className={`w-full h-full min-h-[36px] px-3 py-1 outline-none text-sm transition-colors focus:bg-blue-50 w-24`} />
                      </td>
                      
                      <td className="relative p-0 border-b border-r border-slate-300 group">
                        <input type="text" value={row.gmv_30_days || ''} onChange={(e) => updateCell(idx, 'gmv_30_days', e.target.value)} onPaste={(e) => handlePaste(e, idx, 'gmv_30_days')} className={`w-full h-full min-h-[36px] px-3 py-1 outline-none text-sm transition-colors focus:bg-blue-50 w-40`} />
                      </td>
                      <td className="relative p-0 border-b border-r border-slate-300 group">
                        <input type="text" value={row.gmv_30_days_video || ''} onChange={(e) => updateCell(idx, 'gmv_30_days_video', e.target.value)} onPaste={(e) => handlePaste(e, idx, 'gmv_30_days_video')} className={`w-full h-full min-h-[36px] px-3 py-1 outline-none text-sm transition-colors focus:bg-blue-50 w-32`} />
                      </td>
                      <td className="relative p-0 border-b border-r border-slate-300 group">
                        <input type="text" value={row.gmv_30_days_live || ''} onChange={(e) => updateCell(idx, 'gmv_30_days_live', e.target.value)} onPaste={(e) => handlePaste(e, idx, 'gmv_30_days_live')} className={`w-full h-full min-h-[36px] px-3 py-1 outline-none text-sm transition-colors focus:bg-blue-50 w-32`} />
                      </td>
                      
                      <td className="relative p-0 border-b border-r border-slate-300 group">
                        <input type="text" value={row.rate_card || ''} onChange={(e) => updateCell(idx, 'rate_card', e.target.value)} onPaste={(e) => handlePaste(e, idx, 'rate_card')} className={`w-full h-full min-h-[36px] px-3 py-1 outline-none text-sm transition-colors focus:bg-blue-50 w-40`} />
                      </td>
                      
                      {/* QTY VT */}
                      <td className="relative p-0 border-b border-r border-slate-300 group" onMouseEnter={() => handleDragFillEnter(idx)}>
                        <input type="text" value={row.qty_vt || ''} onChange={(e) => updateCell(idx, 'qty_vt', e.target.value)} onPaste={(e) => handlePaste(e, idx, 'qty_vt')} className={`w-full h-full min-h-[36px] px-3 py-1 outline-none text-sm transition-colors focus:bg-blue-50 w-24`} />
                        <div className="absolute right-0 bottom-0 w-2 h-2 bg-blue-500 cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-10" onMouseDown={(e) => { e.preventDefault(); handleDragFillStart(idx, 'qty_vt', row.qty_vt || ''); }} />
                      </td>
                      
                      {/* QTY LIVE */}
                      <td className="relative p-0 border-b border-r border-slate-300 group" onMouseEnter={() => handleDragFillEnter(idx)}>
                        <input type="text" value={row.qty_live || ''} onChange={(e) => updateCell(idx, 'qty_live', e.target.value)} onPaste={(e) => handlePaste(e, idx, 'qty_live')} className={`w-full h-full min-h-[36px] px-3 py-1 outline-none text-sm transition-colors focus:bg-blue-50 w-24`} />
                        <div className="absolute right-0 bottom-0 w-2 h-2 bg-blue-500 cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-10" onMouseDown={(e) => { e.preventDefault(); handleDragFillStart(idx, 'qty_live', row.qty_live || ''); }} />
                      </td>
                      
                      {/* TIPE KONTEN */}
                      <td className="p-0 border-b border-r border-slate-300 bg-slate-50">
                        <div className="w-full h-full min-h-[36px] px-3 py-1 text-sm flex items-center font-medium text-slate-700 w-32">
                          {row.content_type || ''}
                        </div>
                      </td>
                      
                      {/* KETERANGAN */}
                      <td className="p-2 border-b border-r border-slate-300 align-top w-64 text-xs">
                        {row.status === 'error' && (
                          <div className="text-red-600 flex items-center gap-1 font-medium bg-red-50 p-1.5 rounded"><AlertCircle className="w-3.5 h-3.5" /> {row.errorMsg}</div>
                        )}
                        {row.status === 'incomplete' && (
                          <div className="text-amber-600 flex items-center gap-1 font-medium bg-amber-50 p-1.5 rounded"><AlertCircle className="w-3.5 h-3.5" /> Followers/GMV belum lengkap</div>
                        )}
                        {row.status === 'baru' && (
                          <div className="text-emerald-600 flex items-center gap-1 font-medium bg-emerald-50 p-1.5 rounded"><CheckCircle2 className="w-3.5 h-3.5" /> Siap ditambahkan</div>
                        )}
                        {row.status === 'berhasil' && (
                          <div className="text-blue-600 flex items-center gap-1 font-medium bg-blue-50 p-1.5 rounded"><CheckCircle2 className="w-3.5 h-3.5" /> Data berhasil tersimpan</div>
                        )}
                        {row.status === 'duplicate_campaign' && (
                          <div className="text-rose-600 flex flex-col gap-1.5 font-medium bg-rose-50 p-2 rounded border border-rose-100">
                            <div className="flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Sudah ada di listing</div>
                            <div className="flex gap-1 mt-1">
                              <button onClick={() => handleUpdateAction(row.id, 'update')} className={`flex-1 py-1 px-2 text-[10px] rounded border ${row.action === 'update' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'}`}>Update</button>
                              <button onClick={() => handleUpdateAction(row.id, 'skip')} className={`flex-1 py-1 px-2 text-[10px] rounded border ${row.action === 'skip' ? 'bg-slate-600 text-white border-slate-600' : 'bg-white text-slate-600 border-slate-300'}`}>Lewati</button>
                            </div>
                            
                            {(row.existingData?.price?.toString() !== row.rate_card || row.existingData?.qty_vt?.toString() !== row.qty_vt || row.existingData?.qty_live?.toString() !== row.qty_live) && (
                               <div className="text-[10px] text-slate-500 mt-1 font-normal bg-white p-1.5 rounded">
                                 <div>Old Rate: <b>{row.existingData?.price || 0}</b></div>
                                 <div>Old Qty VT: <b>{row.existingData?.qty_vt || 0}</b></div>
                                 <div>Old Qty Live: <b>{row.existingData?.qty_live || 0}</b></div>
                               </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 border-t border-slate-200 p-2 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setRows([...rows, getEmptyRow()])} className="text-slate-600 bg-white">
              <Plus className="w-4 h-4 mr-1" /> Tambah Baris
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRows([...rows, ...Array(5).fill(null).map(getEmptyRow)])} className="text-slate-600 bg-white">
              <Plus className="w-4 h-4 mr-1" /> Tambah 5 Baris
            </Button>
          </div>
        </Card>
      </div>

      {/* CONFIRMATION POPUP */}
      {showConfirmPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-full">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Konfirmasi Import Kreator</h2>
              <p className="text-slate-500 text-sm mt-1">Selesaikan duplikasi dan data yang belum lengkap sebelum menyimpan.</p>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
              
              {/* SECTION 1: DUPLICATES */}
              {duplicateRows.length > 0 && (
                <div className="border border-rose-200 rounded-lg overflow-hidden">
                  <div className="bg-rose-50 px-4 py-3 border-b border-rose-200 flex justify-between items-center">
                    <h3 className="font-semibold text-rose-800 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" /> Kreator Sudah Ada di Listing ({duplicateRows.length} kreator)
                    </h3>
                    <div className="flex gap-2">
                      {selectedDuplicateIds.size > 0 ? (
                        <>
                          <button onClick={() => handleUpdateSelectedAction('update')} className="text-xs font-medium px-3 py-1.5 bg-blue-600 text-white rounded shadow-sm hover:bg-blue-700 transition">Update Terpilih ({selectedDuplicateIds.size})</button>
                          <button onClick={() => handleUpdateSelectedAction('skip')} className="text-xs font-medium px-3 py-1.5 bg-slate-600 text-white rounded shadow-sm hover:bg-slate-700 transition">Lewati Terpilih ({selectedDuplicateIds.size})</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => handleUpdateAllAction('update')} className="text-xs font-medium px-3 py-1.5 bg-white border border-rose-200 text-rose-700 rounded shadow-sm hover:bg-rose-100 transition">Update Semua</button>
                          <button onClick={() => handleUpdateAllAction('skip')} className="text-xs font-medium px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded shadow-sm hover:bg-slate-100 transition">Lewati Semua</button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-white border-b border-slate-100 text-slate-500 text-xs">
                        <tr>
                          <th className="px-4 py-3 w-10 text-center">
                            <input 
                              type="checkbox" 
                              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                              checked={duplicateRows.length > 0 && selectedDuplicateIds.size === duplicateRows.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const newSet = new Set(selectedDuplicateIds);
                                  duplicateRows.forEach(r => newSet.add(r.id));
                                  setSelectedDuplicateIds(newSet);
                                } else {
                                  setSelectedDuplicateIds(new Set());
                                }
                              }}
                            />
                          </th>
                          <th className="px-4 py-3 font-medium">Username</th>
                          <th className="px-4 py-3 font-medium">Rate Card (Lama → Baru)</th>
                          <th className="px-4 py-3 font-medium">Qty VT (Lama → Baru)</th>
                          <th className="px-4 py-3 font-medium">Qty Live (Lama → Baru)</th>
                          <th className="px-4 py-3 font-medium">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {duplicateRows.map(r => {
                          const oldRate = r.existingData?.price?.toString() || '0';
                          const oldVt = r.existingData?.qty_vt?.toString() || '0';
                          const oldLive = r.existingData?.qty_live?.toString() || '0';
                          
                          const rateDiff = oldRate !== r.rate_card;
                          const vtDiff = oldVt !== r.qty_vt;
                          const liveDiff = oldLive !== r.qty_live;
                          
                          return (
                            <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 text-center">
                                <input 
                                  type="checkbox" 
                                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                                  checked={selectedDuplicateIds.has(r.id)}
                                  onChange={(e) => {
                                    const newSet = new Set(selectedDuplicateIds);
                                    if (e.target.checked) newSet.add(r.id);
                                    else newSet.delete(r.id);
                                    setSelectedDuplicateIds(newSet);
                                  }}
                                />
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-800">@{r.username}</td>
                              <td className={`px-4 py-3 ${rateDiff ? 'bg-amber-50 text-amber-800' : 'text-slate-600'}`}>Rp {Number(oldRate).toLocaleString()} → <b>Rp {Number(r.rate_card).toLocaleString()}</b></td>
                              <td className={`px-4 py-3 ${vtDiff ? 'bg-amber-50 text-amber-800' : 'text-slate-600'}`}>{oldVt} → <b>{r.qty_vt}</b></td>
                              <td className={`px-4 py-3 ${liveDiff ? 'bg-amber-50 text-amber-800' : 'text-slate-600'}`}>{oldLive} → <b>{r.qty_live}</b></td>
                              <td className="px-4 py-3">
                                <div className="flex bg-slate-100 rounded p-1 w-max">
                                  <button onClick={() => handleUpdateAction(r.id, 'update')} className={`px-3 py-1 text-xs font-medium rounded ${r.action === 'update' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Update</button>
                                  <button onClick={() => handleUpdateAction(r.id, 'skip')} className={`px-3 py-1 text-xs font-medium rounded ${r.action === 'skip' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Lewati</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* SECTION 2: INCOMPLETE */}
              {incompleteRows.length > 0 && (
                <div className="border border-amber-200 rounded-lg overflow-hidden">
                  <div className="bg-amber-50 px-4 py-3 border-b border-amber-200">
                    <h3 className="font-semibold text-amber-800 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" /> Data Belum Lengkap ({incompleteRows.filter(r => r.status === 'incomplete').length} kreator)
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-white border-b border-slate-100 text-slate-500 text-xs">
                        <tr>
                          <th className="px-4 py-3 font-medium">Username</th>
                          <th className="px-4 py-3 font-medium w-48">Followers</th>
                          <th className="px-4 py-3 font-medium w-48">GMV 30 Days</th>
                          <th className="px-4 py-3 font-medium w-32">GMV (Video)</th>
                          <th className="px-4 py-3 font-medium w-32">GMV (Live)</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {incompleteRows.map((r, idx) => {
                          const missF = !r.followers;
                          const missG = !r.gmv_30_days && !r.gmv_30_days_video && !r.gmv_30_days_live;
                          return (
                            <tr key={`inc_${r.id}`} className={r.status === 'baru' ? 'bg-emerald-50/30' : 'bg-white'}>
                              <td className="px-4 py-3 font-medium text-slate-700">@{r.username}</td>
                              <td className="px-4 py-3">
                                <input type="text" value={r.followers} onChange={e => handleUpdateIncomplete(idx, 'followers', e.target.value)} placeholder="0" className={`w-full px-3 py-1.5 text-sm border rounded ${missF ? 'border-red-300 focus:border-red-500 outline-none focus:ring-1 ring-red-500' : 'border-slate-200'}`} />
                              </td>
                              <td className="px-4 py-3">
                                <input type="text" value={r.gmv_30_days} onChange={e => handleUpdateIncomplete(idx, 'gmv_30_days', e.target.value)} placeholder="0" className={`w-full px-3 py-1.5 text-sm border rounded ${missG ? 'border-red-300 focus:border-red-500 outline-none focus:ring-1 ring-red-500' : 'border-slate-200'}`} />
                              </td>
                              <td className="px-4 py-3">
                                <input type="text" value={r.gmv_30_days_video} onChange={e => handleUpdateIncomplete(idx, 'gmv_30_days_video', e.target.value)} placeholder="0" className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded" />
                              </td>
                              <td className="px-4 py-3">
                                <input type="text" value={r.gmv_30_days_live} onChange={e => handleUpdateIncomplete(idx, 'gmv_30_days_live', e.target.value)} placeholder="0" className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded" />
                              </td>
                              <td className="px-4 py-3">
                                {r.status === 'baru' ? (
                                  <span className="inline-flex items-center px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium"><CheckCircle2 className="w-3 h-3 mr-1"/> Lengkap</span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 bg-rose-100 text-rose-700 rounded text-xs font-medium">Wajib diisi</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-xl">
              <Button variant="outline" onClick={() => setShowConfirmPopup(false)} className="text-slate-600 bg-white">Batal</Button>
              <Button onClick={executeSaveToDatabase} disabled={incompleteRows.some(r => r.status === 'incomplete') || isImporting} className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[200px]">
                {incompleteRows.some(r => r.status === 'incomplete') ? 'Lengkapi data di atas' : isImporting ? 'Menyimpan...' : 'Lanjutkan Import'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
