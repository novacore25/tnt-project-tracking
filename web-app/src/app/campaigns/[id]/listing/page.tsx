"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { getCreatorType, getJenisKerjasama } from "@/utils/computed";
import { formatAbbreviated } from "@/utils/formatters";
import { ChevronDown, ChevronRight, ChevronLeft, Edit2, Check, X, Loader2, Trash2, Download, ArrowUp, ArrowDown, ArrowUpDown, Plus, AlertCircle, CheckCircle2, Save, Filter, GitMerge } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { exportToCSV } from "@/utils/exportCsv";
import * as XLSX from "xlsx";
import { useAuth } from "@/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { MultiSelect } from "@/components/MultiSelect";
import { useCampaignFilter } from "@/providers/CampaignFilterProvider";
import { NotesTimeline } from "@/components/NotesTimeline";
import { CreatorRow } from "./CreatorRow";
import {
  fetchCampaignConceptsAction,
  fetchRevisionNotesAction,
  upsertRevisionNoteAction,
  upsertVideoAction,
  insertVideoAction,
  deleteVideoAction,
  fetchCampaignCreatorCountsAction,
  fetchCampaignCreatorsRecapAction,
  fetchCampaignCreatorsDuplicateCheckAction,
  fetchDuplicateCcDetailsAction,
  mergeCampaignCreatorsAction,
  fetchListingPagePaginatedAction,
  searchCreatorsWithSnapshotsAction,
  fetchCreatorSnapshotsBatchAction,
  fetchExistingCcUsernamesAction,
  insertCreatorsAndCcAction,
  fetchExportCampaignCreatorsAction,
  fetchStaffProfilesAction,
  fetchSalesByCreatorUsernamesAction,
  batchUpdateCampaignCreatorsApprovalAction,
  batchDeleteCampaignCreatorsAction,
  deleteSingleDuplicateCampaignCreatorAction,
} from "@/app/actions/campaignPageActions";

const PAGE_SIZE = 100;

const extractCampaignSnapshot = (creator: any, campaignCreatedAt?: string) => {
  const snaps = creator?.creator_snapshots || [];
  if (snaps.length === 0) return {};
  
  // Sort by date DESC, then by id DESC (newest first)
  const sortedSnaps = [...snaps].sort((a:any, b:any) => {
    const tDiff = new Date(b.tanggal_update || b.created_at || 0).getTime() - new Date(a.tanggal_update || a.created_at || 0).getTime();
    if (tDiff !== 0) return tDiff;
    return b.id - a.id;
  });

  if (campaignCreatedAt) {
    const cDate = new Date(campaignCreatedAt).toISOString().split('T')[0];
    const cTime = new Date(campaignCreatedAt).getTime();
    const gracePeriod = 86400000; // 24 hours

    // Priority 1: Find snapshot with exact same date as campaign (edited in-place)
    const sameDateSnap = sortedSnaps.find((s: any) => {
      const sDate = s.tanggal_update ? new Date(s.tanggal_update).toISOString().split('T')[0] : null;
      return sDate === cDate;
    });

    if (sameDateSnap) {
      // Use same-date snapshot as primary, fill nulls from older snapshots
      const olderSnaps = sortedSnaps.filter((s: any) => {
        const sTime = new Date(s.tanggal_update || s.created_at || 0).getTime();
        return sTime <= cTime + gracePeriod && s.id !== sameDateSnap.id;
      });
      
      return [sameDateSnap, ...olderSnaps].reduce((acc: any, curr: any) => ({
        followers: acc.followers ?? curr.followers,
        tier: acc.tier ?? curr.tier,
        audience_age: acc.audience_age ?? curr.audience_age,
        level: acc.level ?? curr.level,
        ratecard: acc.ratecard ?? curr.ratecard,
        gmv_30d: acc.gmv_30d ?? curr.gmv_30d,
        gmv_30d_video: acc.gmv_30d_video ?? curr.gmv_30d_video,
        gmv_30d_live: acc.gmv_30d_live ?? curr.gmv_30d_live,
      }), { followers: null, tier: null, audience_age: null, level: null, ratecard: null, gmv_30d: null, gmv_30d_video: null, gmv_30d_live: null } as any);
    }

    // Priority 2: Find closest snapshot before campaign date + grace period
    const targetSnap = sortedSnaps.find((s: any) => {
      const sTime = new Date(s.tanggal_update || s.created_at || 0).getTime();
      return sTime <= cTime + gracePeriod;
    });
    const baseSnap = targetSnap || sortedSnaps[sortedSnaps.length - 1];
    const targetSnaps = sortedSnaps.slice(sortedSnaps.indexOf(baseSnap));

    return targetSnaps.reduce((acc: any, curr: any) => ({
      followers: acc.followers ?? curr.followers,
      tier: acc.tier ?? curr.tier,
      audience_age: acc.audience_age ?? curr.audience_age,
      level: acc.level ?? curr.level,
      ratecard: acc.ratecard ?? curr.ratecard,
      gmv_30d: acc.gmv_30d ?? curr.gmv_30d,
      gmv_30d_video: acc.gmv_30d_video ?? curr.gmv_30d_video,
      gmv_30d_live: acc.gmv_30d_live ?? curr.gmv_30d_live,
    }), { followers: null, tier: null, audience_age: null, level: null, ratecard: null, gmv_30d: null, gmv_30d_video: null, gmv_30d_live: null } as any);
  }

  // No campaignCreatedAt — just use the latest snapshot
  return sortedSnaps.reduce((acc: any, curr: any) => ({
    followers: acc.followers ?? curr.followers,
    tier: acc.tier ?? curr.tier,
    audience_age: acc.audience_age ?? curr.audience_age,
    level: acc.level ?? curr.level,
    ratecard: acc.ratecard ?? curr.ratecard,
    gmv_30d: acc.gmv_30d ?? curr.gmv_30d,
    gmv_30d_video: acc.gmv_30d_video ?? curr.gmv_30d_video,
    gmv_30d_live: acc.gmv_30d_live ?? curr.gmv_30d_live,
  }), { followers: null, tier: null, audience_age: null, level: null, ratecard: null, gmv_30d: null, gmv_30d_video: null, gmv_30d_live: null } as any);
};

export default function CampaignListingPage() {
  return (
    <ErrorBoundary>
      <CampaignListingContent />
    </ErrorBoundary>
  );
}

function CampaignListingContent() {
  const { id } = useParams();
  const campaignId = Number(id);
  
  const { 
    campaigns, 
    campaign_creators, 
    creators, 
    creator_snapshots,
    videos,
    skus,
    niches,
    updateCampaignCreator, 
    deleteCampaignCreator 
  } = useDatabaseStore();

  const { profile, canEditCampaign } = useAuth();
  const hasAccess = canEditCampaign(campaignId);
  const router = useRouter();
  const { isCreatorVisible } = useCampaignFilter();

  const campaign = campaigns.find(c => c.id === campaignId);
  const isClientApprovalRequired = campaign?.require_client_approval || false;
  const campaignSkus = skus.filter(s => s.campaign_id === campaignId);

  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [masterConcepts, setMasterConcepts] = useState<any[]>([]);

  useEffect(() => {
    if (campaignId) {
      fetchCampaignConceptsAction(campaignId).then((res) => {
        if (res.success && res.data) {
          const sorted = (res.data || []).sort((a: any, b: any) => (Number(a.no_konsep) || 0) - (Number(b.no_konsep) || 0));
          setMasterConcepts(sorted);
        }
      });
    }
  }, [campaignId]);

  // --- Batch Edit System ---
  type PendingChange = {
    price?: number;
    qty_vt?: number;
    qty_live?: number;
    approval?: string;
    client_approval?: string;
    assigned_sku_ids?: number[];
    content_type?: string;
    followers?: number;
    level?: string;
    gmv_30d?: number;
    gmv_30d_video?: number;
    gmv_30d_live?: number;
    creator_id?: number;
    tier?: string;
    audience_age?: string;
    ratecard?: number;
    original: any;
  };
  const [pendingChanges, setPendingChanges] = useState<Map<number, PendingChange>>(new Map());
  const [editingCellId, setEditingCellId] = useState<string | null>(null); // "ccId-field" e.g. "123-price"
  const [showUnsavedFirst, setShowUnsavedFirst] = useState(false);
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [isSavingVideo, setIsSavingVideo] = useState(false);
  const [batchSaveProgress, setBatchSaveProgress] = useState(0);

  // beforeunload protection
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pendingChanges.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [pendingChanges.size]);

  // Auto-save debouncer (Google Sheets style)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (pendingChanges.size > 0 && !isBatchSaving) {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = setTimeout(() => {
        batchSaveAll();
      }, 2000); // 2 seconds debounce
    }
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [pendingChanges, isBatchSaving]);

  const getPendingValue = (ccId: number, field: keyof PendingChange, originalValue: any) => {
    const change = pendingChanges.get(ccId);
    if (change && change[field] !== undefined) return change[field];
    return originalValue;
  };

  const setCellChange = (ccId: number, field: string, value: any, cc: any) => {
    setPendingChanges(prev => {
      const next = new Map(prev);
      const snap = extractCampaignSnapshot(cc.creators, cc.created_at);
      const existing = next.get(ccId) || {
        original: {
          price: cc.price,
          qty_vt: cc.qty_vt,
          qty_live: cc.qty_live || 0,
          approval: cc.approval,
          client_approval: cc.client_approval || 'not_required',
          assigned_sku_ids: cc.assigned_sku_ids || [],
          content_type: cc.content_type || null,
          followers: snap.followers,
          level: snap.level,
          gmv_30d: snap.gmv_30d,
          gmv_30d_video: snap.gmv_30d_video,
          gmv_30d_live: snap.gmv_30d_live,
          creator_id: cc.creator_id,
          tier: snap.tier,
          audience_age: snap.audience_age,
          ratecard: snap.ratecard,
          cc_created_at: cc.created_at
        }
      };
      (existing as any)[field] = value;

      // Check if all changed fields match original
      const orig = existing.original;
      const fields = ['price', 'qty_vt', 'qty_live', 'approval', 'client_approval', 'assigned_sku_ids', 'content_type', 'followers', 'level', 'gmv_30d', 'gmv_30d_video', 'gmv_30d_live'] as const;
      let hasRealChange = false;
      for (const f of fields) {
        const changedVal = (existing as any)[f];
        if (changedVal !== undefined) {
          if (f === 'assigned_sku_ids') {
            if (JSON.stringify(changedVal) !== JSON.stringify(orig[f])) hasRealChange = true;
          } else {
            if (changedVal !== orig[f]) hasRealChange = true;
          }
        }
      }

      if (hasRealChange) {
        next.set(ccId, existing);
      } else {
        next.delete(ccId);
      }
      return next;
    });
  };

  const batchSaveAll = async () => {
    if (pendingChanges.size === 0) return;
    setIsBatchSaving(true);
    setBatchSaveProgress(0);
    const entries = Array.from(pendingChanges.entries());
    let done = 0;
    try {
      for (const [ccId, change] of entries) {
        const updates: any = {};
        if (change.price !== undefined) updates.price = change.price;
        if (change.qty_vt !== undefined) updates.qty_vt = change.qty_vt;
        if (change.qty_live !== undefined) updates.qty_live = change.qty_live;
        if (change.assigned_sku_ids !== undefined) updates.assigned_sku_ids = change.assigned_sku_ids;
        if (change.content_type !== undefined) updates.content_type = change.content_type;
        if (change.approval !== undefined) {
          updates.approval = change.approval;
          if (change.approval !== change.original.approval) {
            if (change.approval === 'approved') {
              updates.approved_by = profile?.id;
              updates.approved_at = new Date().toISOString();
            } else if (change.approval === 'not_approved' || change.approval === 'alternate') {
              updates.not_approved_by = profile?.id;
              updates.not_approved_at = new Date().toISOString();
            }
          }
        }
        if (isClientApprovalRequired && change.client_approval !== undefined) {
          updates.client_approval = change.client_approval;
        }

        if (Object.keys(updates).length > 0) {
          await updateCampaignCreator(ccId, updates, profile?.nama || 'System');
        }

        // Handle creator snapshot updates (excluding price which is now campaign-specific)
        if (change.followers !== undefined || change.level !== undefined || change.gmv_30d !== undefined || change.gmv_30d_video !== undefined || change.gmv_30d_live !== undefined) {
          try {
            const today = new Date().toISOString().split('T')[0];
            const newFollowers = (change.followers !== undefined && change.followers !== '') ? change.followers : change.original.followers;
            const newGmv = (change.gmv_30d !== undefined && change.gmv_30d !== '') ? change.gmv_30d : change.original.gmv_30d;
            const newGmvVid = (change.gmv_30d_video !== undefined && change.gmv_30d_video !== '') ? change.gmv_30d_video : change.original.gmv_30d_video;
            const newGmvLive = (change.gmv_30d_live !== undefined && change.gmv_30d_live !== '') ? change.gmv_30d_live : change.original.gmv_30d_live;
            const newLevel = (change.level !== undefined && change.level !== '') ? change.level : change.original.level;
            const newRatecard = change.original.ratecard;
            
            let newTier = change.original.tier;
            if (change.followers !== undefined && change.followers !== '' && Number(change.followers) !== 0) {
               const f = Number(newFollowers);
               if (f < 10000) newTier = 'Nano';
               else if (f < 100000) newTier = 'Micro';
               else if (f < 1000000) newTier = 'Macro';
               else newTier = 'Mega';
            }
            
            if (newTier) {
              await updateCampaignCreator(ccId, { tier: newTier }, profile?.nama || 'System');
            }

            await useDatabaseStore.getState().addCreatorSnapshot({
              creator_id: change.original.creator_id,
              tanggal_update: change.original.cc_created_at || new Date().toISOString(),
              followers: newFollowers,
              level: newLevel,
              gmv_30d: newGmv,
              gmv_30d_video: newGmvVid,
              gmv_30d_live: newGmvLive,
              tier: newTier,
              audience_age: change.original.audience_age,
              ratecard: newRatecard,
              updated_by: profile?.nama || null
            });
          } catch (snapErr) {
            console.error("Failed to add snapshot:", snapErr);
          }
        }

        done++;
        setBatchSaveProgress(Math.round((done / entries.length) * 100));
      }
      
      pendingChanges.clear();
      setPendingChanges(new Map());
      // Refetch from DB with reset to get freshly written data including approval metadata
      await fetchListing(page, true);
    } catch (error) {
      console.error("Batch save error:", error);
      alert("Terjadi kesalahan saat menyimpan perubahan.");
    } finally {
      setIsBatchSaving(false);
      setShowUnsavedFirst(false);
    }
  };

  // Legacy single-row edit state (kept for backwards compat with pencil icon)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSampleProgress, setEditSampleProgress] = useState<any>('Done Req Sample');
  const [editStatusBayar, setEditStatusBayar] = useState<any>('belum');
  const [editNotesManager, setEditNotesManager] = useState('');
  const [editNotesPic, setEditNotesPic] = useState('');

  // Niche Editing
  const [nicheModalOpen, setNicheModalOpen] = useState(false);
  const [nicheEditCreatorId, setNicheEditCreatorId] = useState<number | null>(null);
  const [nicheEditForm, setNicheEditForm] = useState<number[]>([]);
  const [isSavingNiche, setIsSavingNiche] = useState(false);

  const handleSaveNiche = async () => {
    if (!nicheEditCreatorId) return;
    setIsSavingNiche(true);
    try {
      await useDatabaseStore.getState().updateCreatorNiches(nicheEditCreatorId, nicheEditForm);
      await fetchListing(page, false);
      setNicheModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Gagal update niche");
    } finally {
      setIsSavingNiche(false);
    }
  };

  const [filterType, setFilterType] = useState<'all' | 'regular' | 'auto_detect'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'alternate' | 'not_approved'>('all');
  
  // New Multidimensional Filters
  const [filterTier, setFilterTier] = useState<string>('');
  const [filterContentType, setFilterContentType] = useState<string>('');
  const [filterLevel, setFilterLevel] = useState<string>('');
  const [filterNiche, setFilterNiche] = useState<string>('');
  const [filterAddedBy, setFilterAddedBy] = useState<string>('');
  const [filterActionBy, setFilterActionBy] = useState<string>('');
  const [filterNotes, setFilterNotes] = useState<string>('');
  const [filterUnattributed, setFilterUnattributed] = useState(false);
  const [filterConcept, setFilterConcept] = useState<string>('');
  const [filterActionDate, setFilterActionDate] = useState<string>('');
  const [staffProfiles, setStaffProfiles] = useState<{id: string, nama: string}[]>([]);

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSelection, setExportSelection] = useState({
    approved: true,
    not_approved: true,
    alternate: true,
    pending: true
  });
  const [exportProgress, setExportProgress] = useState<{current: number, total: number | null}>({ current: 0, total: null });

  useEffect(() => {
    fetchStaffProfilesAction().then(res => {
      if (res.success && res.data) setStaffProfiles(res.data);
    });
  }, []);

  const [tableSearch, setTableSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'id', dir: 'desc' });

  const toggleSort = (key: string) => {
    setSortConfig(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortConfig.key !== col) return <ArrowUpDown className="w-3 h-3 ml-1 text-slate-400" />;
    return sortConfig.dir === 'asc' ? <ArrowUp className="w-3 h-3 ml-1 text-blue-500" /> : <ArrowDown className="w-3 h-3 ml-1 text-blue-500" />;
  };

  // Data State
  const [listingData, setListingData] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [revisionNotes, setRevisionNotes] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!campaignId || listingData.length === 0) return;
    const ccIds = listingData.map((cc: any) => cc.id).filter(Boolean);
    if (ccIds.length === 0) return;

    fetchRevisionNotesAction(ccIds).then((res) => {
      if (res.success && res.data) {
        const map: Record<string, any> = {};
        res.data.forEach((n: any) => {
          const match = n.role.match(/^draft_revisi_(\d+)$/);
          if (match) {
            const urutan = parseInt(match[1]);
            map[`${n.campaign_creator_id}_${urutan}`] = n;
          }
        });
        setRevisionNotes(map);
      }
    });
  }, [campaignId, listingData]);

  // Counts State
  const [counts, setCounts] = useState({ approved: 0, pending: 0, alternate: 0, not_approved: 0, all: 0 });
  const [recapLoadingProgress, setRecapLoadingProgress] = useState<number | null>(null);
  const [tierCounts, setTierCounts] = useState<Record<string, Record<string, number>>>({
    all: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
    approved: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
    pending: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
    alternate: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
    not_approved: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
  });
  const [dailyRecap, setDailyRecap] = useState<any[]>([]);
  const [rawRecapData, setRawRecapData] = useState<any[]>([]);
  const [recapFilterPic, setRecapFilterPic] = useState<string>('');
  const [recapStartIndex, setRecapStartIndex] = useState(0);
  const [filterPendingWithVideo, setFilterPendingWithVideo] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<any[]>([]);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [selectedCreators, setSelectedCreators] = useState<Set<number>>(new Set());
  const [bulkActionProcessing, setBulkActionProcessing] = useState(false);

  // Add Creator Modal State
  type DynamicRow = { id: string; username: string; price: string; qtyVt: string; qtyLive: string; contentType: string };
  type DragFillState = { active: boolean; startRowIdx: number; currentRowIdx: number; colName: keyof DynamicRow; value: string; };

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [dynamicRows, setDynamicRows] = useState<DynamicRow[]>([{ id: Math.random().toString(36).substring(2, 9), username: '', price: '0', qtyVt: '1', qtyLive: '0', contentType: 'Video' }]);
  const [dragFill, setDragFill] = useState<DragFillState | null>(null);
  const [existingCreators, setExistingCreators] = useState<any[]>([]);
  const [missingCreators, setMissingCreators] = useState<any[]>([]);
  const [isAddingBulk, setIsAddingBulk] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);

  const runBulkAutoDetect = async (usernamesToDetect: string[]) => {
    const usernames = usernamesToDetect.map(u => u.replace('@', '').trim().toLowerCase()).filter(Boolean);
    if (usernames.length === 0) return;
    
    setIsAutoDetecting(true);
    try {
      const res = await searchCreatorsWithSnapshotsAction(usernames);
      const matchedCreators = res.data || [];
        
      if (matchedCreators && matchedCreators.length > 0) {
        setDynamicRows(currentRows => {
          const newRows = [...currentRows];
          let updated = false;
          
          for (let i = 0; i < newRows.length; i++) {
            const row = newRows[i];
            const uname = row.username.replace('@', '').trim().toLowerCase();
            if (!uname) continue;
            
            const matched = matchedCreators.find((c: any) => c.username.toLowerCase() === uname);
            if (!matched) continue;
            
            const snaps = (matched.creator_snapshots || []).sort((a: any, b: any) => b.id - a.id);
            const mergedRatecard = snaps.reduce((acc: any, curr: any) => acc ?? curr.ratecard, null);
            
            if ((!row.price || row.price === '0') && mergedRatecard !== null) {
               newRows[i].price = mergedRatecard.toString();
               updated = true;
            }
          }
          return updated ? newRows : currentRows;
        });
      }
    } catch (err) {
      console.error(err);
    }
    setIsAutoDetecting(false);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragFill) {
        setDragFill(null);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragFill]);

  const handleFillHandleMouseDown = (rowIdx: number, colName: keyof DynamicRow, value: string, e: React.MouseEvent) => {
    e.preventDefault();
    setDragFill({
      active: true,
      startRowIdx: rowIdx,
      currentRowIdx: rowIdx,
      colName,
      value
    });
  };

  const handleCellMouseEnter = (rowIdx: number, colName: keyof DynamicRow) => {
    if (!dragFill?.active || dragFill.colName !== colName) return;
    
    if (rowIdx !== dragFill.currentRowIdx) {
      setDragFill(prev => prev ? { ...prev, currentRowIdx: rowIdx } : null);
      
      const start = Math.min(dragFill.startRowIdx, rowIdx);
      const end = Math.max(dragFill.startRowIdx, rowIdx);
      
      setDynamicRows(prev => prev.map((r, i) => {
        if (i >= start && i <= end) {
          const updated = { ...r, [dragFill.colName]: dragFill.value };
          return updated;
        }
        return r;
      }));
    }
  };


  const COLUMNS: (keyof DynamicRow)[] = ['username', 'price', 'qtyVt', 'qtyLive', 'contentType'];

  const handleGlobalPaste = (e: React.ClipboardEvent<HTMLInputElement | HTMLSelectElement>, startRowIdx: number, startColName: keyof DynamicRow) => {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\n') && !text.includes('\t')) return;

    e.preventDefault();
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return;

    setDynamicRows(prevRows => {
      const newRows = [...prevRows];
      const startColIdx = COLUMNS.indexOf(startColName);
      if (startColIdx === -1) return prevRows;

      const pastedUsernames: string[] = [];

      lines.forEach((line, lineIdx) => {
        const rawCols = line.split('\t');
        let cols = rawCols;

        const targetRowIdx = startRowIdx + lineIdx;
        let rowDataToUpdate: Partial<DynamicRow> = {};
        
        cols.forEach((colVal, colOffset) => {
          const targetColIdx = startColIdx + colOffset;
          if (targetColIdx < COLUMNS.length) {
            const field = COLUMNS[targetColIdx];
            let cleanVal = colVal;
            
            if (field === 'username') cleanVal = cleanVal.replace('@', '').trim().toLowerCase();
            else if (['price', 'qtyVt', 'qtyLive'].includes(field)) cleanVal = cleanVal.replace(/[^0-9]/g, '');
            else cleanVal = cleanVal.trim();

            if (field === 'contentType') {
                const ctypeRaw = cleanVal.toLowerCase();
                let ctype = 'Video';
                if (ctypeRaw.includes('live') && ctypeRaw.includes('video')) ctype = 'Video & Live';
                else if (ctypeRaw.includes('live')) ctype = 'Live';
                rowDataToUpdate[field] = ctype;
            } else {
                rowDataToUpdate[field] = cleanVal as any;
            }
            
            if (field === 'username' && cleanVal) {
              pastedUsernames.push(cleanVal);
            }
          }
        });

        if (targetRowIdx < newRows.length) {
          Object.assign(newRows[targetRowIdx], rowDataToUpdate);
        } else {
          newRows.push({
            id: Math.random().toString(36).substring(2, 9),
            username: '',
            price: '0',
            qtyVt: '1',
            qtyLive: '0',
            contentType: 'Video',
            ...rowDataToUpdate
          } as DynamicRow);
        }
      });

      if (pastedUsernames.length > 0) {
        runBulkAutoDetect(pastedUsernames);
      }

      return newRows;
    });
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(tableSearch);
    }, 500);
    return () => clearTimeout(handler);
  }, [tableSearch]);

  const checkDuplicates = useCallback(async () => {
    try {
      const res = await fetchCampaignCreatorsDuplicateCheckAction(campaignId);
      const allData = res.data || [];

      const groupings: Record<string, any[]> = {};
      for (const row of allData) {
        const uname = row.username?.toLowerCase() || `unknown_${row.id}`;
        const key = `${row.campaign_id}_${uname}`;
        if (!groupings[key]) groupings[key] = [];
        groupings[key].push(row);
      }

      const dups: any[] = [];
      for (const [key, rows] of Object.entries(groupings)) {
        if (rows.length > 1) {
          dups.push(rows);
        }
      }

      // Hanya jika ada duplikat, ambil detail lengkap (video, notes, status) untuk baris duplikat tersebut saja
      if (dups.length > 0) {
        const allDupIds = dups.flat().map(r => r.id);
        const { data: fullDupRows } = await fetchDuplicateCcDetailsAction(allDupIds);
        
        const fullMap = new Map((fullDupRows || []).map((r: any) => [r.id, r]));
        const fullDups = dups.map(group => group.map(r => fullMap.get(r.id) || r));
        setDuplicateGroups(fullDups);
      } else {
        setDuplicateGroups([]);
      }
    } catch (err) {
      console.warn("Check duplicates error:", err);
    }
  }, [campaignId]);

  useEffect(() => {
    checkDuplicates();
  }, [checkDuplicates]);

  const handleMergeDuplicateGroup = async (group: any[], gIdx: number) => {
    if (!group || group.length < 2) return;
    const username = group[0]?.creators?.username || group[0]?.username || 'kreator';
    
    if (!confirm(`Gabungkan (Merge) semua data dobel untuk @${username}? \n\nSistem akan mengambil data tertinggi / paling lengkap, memindahkan semua video ke satu baris utama, dan menghapus baris duplikat lainnya.`)) {
      return;
    }

    setIsMerging(true);
    try {
      // 1. Tentukan baris utama (surviving row) - baris dengan ID terkecil
      const sortedGroup = [...group].sort((a, b) => a.id - b.id);
      const survivingRow = sortedGroup[0];
      const otherRows = sortedGroup.slice(1);
      const otherIds = otherRows.map(r => r.id);

      // 2. Hitung nilai gabungan (ambil nilai tertinggi / terlengkap)
      const mergedPrice = Math.max(...group.map(r => Number(r.price) || 0));
      const mergedQtyVt = Math.max(...group.map(r => Number(r.qty_vt) || 0));
      const mergedQtyLive = Math.max(...group.map(r => Number(r.qty_live) || 0));

      const approvalPriority: Record<string, number> = {
        approved: 4,
        alternate: 3,
        pending: 2,
        not_approved: 1
      };
      let mergedApproval = survivingRow.approval;
      let highestApprovalScore = approvalPriority[survivingRow.approval] || 0;
      let approvedBy = survivingRow.approved_by;
      let approvedAt = survivingRow.approved_at;
      let notApprovedBy = survivingRow.not_approved_by;
      let notApprovedAt = survivingRow.not_approved_at;

      for (const r of group) {
        const score = approvalPriority[r.approval] || 0;
        if (score > highestApprovalScore) {
          highestApprovalScore = score;
          mergedApproval = r.approval;
          if (r.approval === 'approved') {
            approvedBy = r.approved_by || profile?.id;
            approvedAt = r.approved_at || new Date().toISOString();
          } else if (r.approval === 'alternate' || r.approval === 'not_approved') {
            notApprovedBy = r.not_approved_by || profile?.id;
            notApprovedAt = r.not_approved_at || new Date().toISOString();
          }
        }
      }

      const validSample = group.find(r => r.sample_progress && r.sample_progress !== '-' && r.sample_progress !== 'Belum' && r.sample_progress !== 'belum');
      const mergedSampleProgress = validSample ? validSample.sample_progress : (group.find(r => r.sample_progress && r.sample_progress !== '-')?.sample_progress || survivingRow.sample_progress);

      const payPriority: Record<string, number> = {
        paid: 3,
        lunas: 3,
        request: 2,
        belum: 1
      };
      let mergedStatusBayar = survivingRow.status_bayar || 'belum';
      let highestPayScore = payPriority[(mergedStatusBayar || '').toLowerCase()] || 0;
      for (const r of group) {
        const pScore = payPriority[(r.status_bayar || '').toLowerCase()] || 0;
        if (pScore > highestPayScore) {
          highestPayScore = pScore;
          mergedStatusBayar = r.status_bayar;
        }
      }

      const allContentTypes = group.map(r => r.content_type).filter(Boolean);
      let mergedContentType = survivingRow.content_type;
      if (allContentTypes.some(c => c.toLowerCase().includes('video') && c.toLowerCase().includes('live')) || 
          (allContentTypes.some(c => c.toLowerCase().includes('video')) && allContentTypes.some(c => c.toLowerCase().includes('live')))) {
        mergedContentType = 'Video & Live';
      } else if (allContentTypes.length > 0) {
        mergedContentType = allContentTypes[0];
      }

      const tierPriority: Record<string, number> = {
        mega: 5,
        macro: 4,
        micro: 3,
        nano: 2,
        'auto-detect': 1
      };
      let mergedTier = survivingRow.tier;
      let highestTierScore = tierPriority[(survivingRow.tier || '').toLowerCase()] || 0;
      for (const r of group) {
        const tScore = tierPriority[(r.tier || '').toLowerCase()] || 0;
        if (tScore > highestTierScore) {
          highestTierScore = tScore;
          mergedTier = r.tier;
        }
      }

      const managerNotes = Array.from(new Set(group.map(r => r.notes_manager).filter(Boolean))).join(' | ');
      const picNotes = Array.from(new Set(group.map(r => r.notes_pic).filter(Boolean))).join(' | ');
      const allSkus = Array.from(new Set(group.flatMap(r => r.assigned_sku_ids || [])));

      const updateData: any = {
        price: mergedPrice,
        qty_vt: mergedQtyVt,
        qty_live: mergedQtyLive,
        approval: mergedApproval,
        sample_progress: mergedSampleProgress,
        status_bayar: mergedStatusBayar,
        content_type: mergedContentType,
        tier: mergedTier,
        notes_manager: managerNotes || null,
        notes_pic: picNotes || null,
        assigned_sku_ids: allSkus.length > 0 ? allSkus : null,
      };
      if (approvedBy) updateData.approved_by = approvedBy;
      if (approvedAt) updateData.approved_at = approvedAt;
      if (notApprovedBy) updateData.not_approved_by = notApprovedBy;
      if (notApprovedAt) updateData.not_approved_at = notApprovedAt;

      const res = await mergeCampaignCreatorsAction(survivingRow.id, otherIds, updateData);
      if (!res.success) throw new Error(res.error);

      // Update UI
      setDuplicateGroups(prev => prev.filter((_, idx) => idx !== gIdx));
      await fetchListing(0, true);
      await fetchCounts();
      alert(`Berhasil menggabungkan data dobel @${username}!`);
    } catch (err: any) {
      console.error("Merge error:", err);
      alert("Gagal melakukan merge data: " + (err.message || err.toString()));
    } finally {
      setIsMerging(false);
    }
  };

  const fetchCounts = useCallback(async () => {
    let hasRpcSucceeded = false;
    if (!filterActionDate) {
      try {
        const res = await fetchCampaignCreatorCountsAction(campaignId);
        if (res.success) {
          setCounts({
            approved: Number(res.approved || 0),
            pending: Number(res.pending || 0),
            alternate: Number(res.alternate || 0),
            not_approved: Number(res.not_approved || 0),
            all: Number(res.total || 0),
          });
          hasRpcSucceeded = true;
        }
      } catch (err) {
        console.warn("Counts fetch failed", err);
      }
    }

    // 2. Fetch recap data
    setRecapLoadingProgress(0);
    const recapRes = await fetchCampaignCreatorsRecapAction(campaignId);
    let allRecapData: any[] = recapRes.data || [];
    setRecapLoadingProgress(allRecapData.length);

    // Resolusi fallback snapshot untuk kreator yang tier-nya masih kosong secara batch cepat
    const missingTierCreatorIds = Array.from(new Set(
      allRecapData.filter(r => !r.tier).map(r => r.creator_id)
    ));
    if (missingTierCreatorIds.length > 0) {
      const snapMap = new Map();
      const snapRes = await fetchCreatorSnapshotsBatchAction(missingTierCreatorIds);
      (snapRes.data || []).forEach((s: any) => {
        if (!snapMap.has(s.creator_id)) {
          let t = s.tier;
          if (!t && s.followers !== null) {
            const f = Number(s.followers);
            t = f < 10000 ? 'Nano' : f < 100000 ? 'Micro' : f < 1000000 ? 'Macro' : 'Mega';
          }
          snapMap.set(s.creator_id, t || 'Nano');
        }
      });
      allRecapData.forEach(r => {
        if (!r.tier) {
          r.tier = snapMap.get(r.creator_id) || 'Nano';
        }
      });
    }

    setRecapLoadingProgress(null);

    // Deduplicate by username (or fallback to id)
    const uniqueMap = new Map();
    for (const row of allRecapData) {
       const uname = row.creators?.username?.toLowerCase() || `unknown_${row.creator_id || row.id}`;
       if (!uniqueMap.has(uname)) {
          uniqueMap.set(uname, row);
       } else {
          // If duplicate exists, prefer 'approved' over others
          const existing = uniqueMap.get(uname);
          if (existing.approval !== 'approved' && row.approval === 'approved') {
              uniqueMap.set(uname, row);
          }
       }
    }
    const deduplicatedData = Array.from(uniqueMap.values());

    if (!hasRpcSucceeded) {
      let approved = 0, pending = 0, alternate = 0, not_approved = 0;
      let finalDataToCount = deduplicatedData;

      if (filterActionDate) {
        const start = new Date(`${filterActionDate}T00:00:00`).getTime();
        const end = new Date(`${filterActionDate}T23:59:59`).getTime();
        
        finalDataToCount = deduplicatedData.filter(row => {
          if (row.approval === 'approved' && row.approved_at) {
            const t = new Date(row.approved_at).getTime();
            return t >= start && t <= end;
          }
          if ((row.approval === 'not_approved' || row.approval === 'alternate') && row.not_approved_at) {
            const t = new Date(row.not_approved_at).getTime();
            return t >= start && t <= end;
          }
          if (row.approval === 'pending' && row.created_at) {
            const t = new Date(row.created_at).getTime();
            return t >= start && t <= end;
          }
          return false;
        });
      }

      for (const row of finalDataToCount) {
         if (row.approval === 'approved') approved++;
         else if (row.approval === 'pending') pending++;
         else if (row.approval === 'alternate') alternate++;
         else if (row.approval === 'not_approved') not_approved++;
      }
      setCounts({ approved, pending, alternate, not_approved, all: finalDataToCount.length });
    }

    setRawRecapData(deduplicatedData);
  }, [campaignId, filterActionDate]);

  useEffect(() => {
    let filteredData = rawRecapData;
    if (recapFilterPic) {
      filteredData = filteredData.filter(r => r.added_by === recapFilterPic);
    }
    const group: Record<string, { total: number, approved: number, pending: number, alternate: number, not_approved: number, nano: number, micro: number, macro: number, mega: number }> = {};
    
    // Helper to get local date string (YYYY-MM-DD) to avoid UTC timezone shifts
    const getLocalDateStr = (dateString: string) => {
      const d = new Date(dateString);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    filteredData.forEach(r => {
      // 1. Process "Added" and "Pending" based on created_at
      if (r.created_at) {
        const createDateKey = getLocalDateStr(r.created_at);
        if (!group[createDateKey]) group[createDateKey] = { total: 0, approved: 0, pending: 0, alternate: 0, not_approved: 0, nano: 0, micro: 0, macro: 0, mega: 0 };
        
        group[createDateKey].total++;
        if (r.approval === 'pending') {
          group[createDateKey].pending++;
        }
        
        let t = r.tier || 'Nano';
        t = t.toLowerCase();
        if (t === 'mega') group[createDateKey].mega++;
        else if (t === 'macro') group[createDateKey].macro++;
        else if (t === 'micro') group[createDateKey].micro++;
        else group[createDateKey].nano++;
      }

      // 2. Process Action (Approved, Alternate, Not Approved) based on approved_at
      if (r.approved_at && r.approval !== 'pending') {
        const actionDateKey = getLocalDateStr(r.approved_at);
        if (!group[actionDateKey]) group[actionDateKey] = { total: 0, approved: 0, pending: 0, alternate: 0, not_approved: 0, nano: 0, micro: 0, macro: 0, mega: 0 };
        
        if (r.approval === 'approved') group[actionDateKey].approved++;
        else if (r.approval === 'alternate') group[actionDateKey].alternate++;
        else if (r.approval === 'not_approved') group[actionDateKey].not_approved++;
      }
    });
    // Sort ascending so oldest is first, newest is last
    const sortedKeys = Object.keys(group).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const recapArr = sortedKeys.map(k => ({ date: k, ...group[k] }));
    setDailyRecap(recapArr);
    // Start window at the very end
    setRecapStartIndex(Math.max(0, recapArr.length - 4));

    // Calculate tier breakdowns for all statuses
    const tCounts: Record<string, Record<string, number>> = {
      all: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
      approved: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
      pending: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
      alternate: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
      not_approved: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
    };

    rawRecapData.forEach(r => {
      let t = r.tier || 'Nano';
      t = t.toLowerCase();
      if (t === 'mega') t = 'Mega';
      else if (t === 'macro') t = 'Macro';
      else if (t === 'micro') t = 'Micro';
      else t = 'Nano';

      if (['Nano', 'Micro', 'Macro', 'Mega'].includes(t)) {
        tCounts.all[t]++;
        if (r.approval === 'approved') tCounts.approved[t]++;
        else if (r.approval === 'alternate') tCounts.alternate[t]++;
        else if (r.approval === 'not_approved') tCounts.not_approved[t]++;
        else if (r.approval === 'pending') tCounts.pending[t]++;
      }
    });
    setTierCounts(tCounts);

  }, [rawRecapData, recapFilterPic]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const fetchIdRef = useRef(0);

  const fetchListing = useCallback(async (pageNum: number, isReset = false) => {
    const currentFetchId = ++fetchIdRef.current;
    setIsLoading(true);
    try {
      const res = await fetchListingPagePaginatedAction({
        campaignId,
        pageNum,
        pageSize: PAGE_SIZE,
        statusFilter,
        tierFilter,
        levelFilter,
        nicheFilter,
        addedByFilter,
        actionByFilter,
        contentTypeFilter,
        conceptFilter,
        search: debouncedSearch,
        actionDateFilter,
      });

      if (currentFetchId !== fetchIdRef.current) return;
      if (!res.success) throw new Error(res.error);

      let finalData = res.data || [];

      // Auto-detect videos from sales
      if (finalData.length > 0 && campaignSkus.length > 0) {
        const skuList = campaignSkus.map((s: any) => s.product_id).filter(Boolean);
        const creatorUsernames = finalData.map((cc: any) => cc.creators?.username).filter(Boolean);

        if (skuList.length > 0 && creatorUsernames.length > 0) {
          const salesRes = await fetchSalesByCreatorUsernamesAction(campaignId, creatorUsernames, skuList);
          const sData = salesRes.data || [];

          if (sData.length > 0) {
            finalData = finalData.map((cc: any) => {
              if (!cc.creators) return cc;
              const cName = cc.creators.username;
              const cSales = sData.filter((s: any) => s.creator_username === cName);
              const uniqueUids = Array.from(new Set(cSales.map((s: any) => s.content_uid)));
              
              const existingVids = cc.videos || [];
              const autoVids: any[] = [];
              
              for (const uid of uniqueUids) {
                if (!uid) continue;
                const exists = existingVids.some((v: any) => v.content_uid === uid);
                if (!exists) {
                  autoVids.push({
                    id: `auto_${uid}`,
                    concept: 'Auto-detected from Sales CSV',
                    link_video: `https://www.tiktok.com/@${cName}/video/${uid}`,
                    vt_approval: 'approved',
                    content_uid: uid,
                    urutan: 999
                  });
                }
              }
              
              return {
                ...cc,
                videos: [...existingVids, ...autoVids]
              };
            });
          }
        }
      }

      // Deduplicate finalData by username
      const uniqueMap = new Map();
      for (const row of finalData) {
         const uname = row.creators?.username?.toLowerCase() || `unknown_${row.id}`;
         if (!uniqueMap.has(uname)) {
            uniqueMap.set(uname, row);
         } else {
            const existing = uniqueMap.get(uname);
            if (existing.approval !== 'approved' && row.approval === 'approved') {
               uniqueMap.set(uname, row);
            }
         }
      }
      finalData = Array.from(uniqueMap.values());
      
      if (filterNotes === 'Ada Notes') {
        const parseNotesList = (raw: string) => {
          if (!raw) return [];
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed.filter((n: any) => n.isi && n.isi.trim() !== '');
            return [{ isi: raw, created_at: null }];
          } catch { return [{ isi: raw, created_at: null }]; }
        };

        finalData = finalData.filter(cc => {
          const mn = parseNotesList(cc.notes_manager);
          const pn = parseNotesList(cc.notes_pic);
          return mn.length > 0 || pn.length > 0;
        });

        finalData.sort((a, b) => {
          const getLatest = (cc: any) => {
            const mn = parseNotesList(cc.notes_manager);
            const pn = parseNotesList(cc.notes_pic);
            const all = [...mn, ...pn];
            if (all.length === 0) return 0;
            const validDates = all.filter(n => n.created_at).map(n => new Date(n.created_at).getTime());
            if (validDates.length > 0) {
              return Math.max(...validDates);
            }
            return 0;
          };
          return getLatest(b) - getLatest(a);
        });

        setHasMore(false);
      } else {
        setHasMore(res.hasMore);
      }

      if (isReset || filterNotes === 'Ada Notes') {
        setListingData(finalData);
      } else {
        setListingData(prev => [...prev, ...finalData]);
      }
    } catch (err) {
      if (currentFetchId === fetchIdRef.current) {
         console.error(err);
      }
    } finally {
      if (currentFetchId === fetchIdRef.current) {
         setIsLoading(false);
      }
    }
  }, [campaignId, filterType, statusFilter, debouncedSearch, sortConfig, filterTier, filterLevel, filterNiche, filterAddedBy, filterActionBy, filterPendingWithVideo, filterUnattributed, filterContentType, filterNotes, filterConcept, filterActionDate]);

  useEffect(() => {
    fetchListing(page);
  }, [page, campaignId, filterType, statusFilter, debouncedSearch, sortConfig, filterTier, filterLevel, filterNiche, filterAddedBy, filterActionBy, filterPendingWithVideo, filterUnattributed, filterContentType, filterNotes, filterConcept, filterActionDate]);

  useEffect(() => {
    setPage(0);
    fetchListing(0, true);
  }, [debouncedSearch, filterType, statusFilter, sortConfig, fetchListing, filterTier, filterLevel, filterNiche, filterAddedBy, filterActionBy, filterPendingWithVideo, filterUnattributed, filterContentType, filterNotes, filterConcept, filterActionDate]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchListing(next, false);
  };


  const toggleExpand = (ccId: number) => {
    setExpandedRows(prev => ({ ...prev, [ccId]: !prev[ccId] }));
  };

  const startEdit = (cc: any) => {
    setEditingId(cc.id);
    setEditSampleProgress(cc.sample_progress || 'Done Req Sample');
    setEditStatusBayar(cc.status_bayar || 'belum');
    setEditNotesManager(cc.notes_manager || '');
    setEditNotesPic(cc.notes_pic || '');
  };

  const saveEdit = async (ccId: number) => {
    if (!hasAccess) return;
    // Only save notes/sample_progress/status_bayar via legacy edit (non-batch fields)
    await updateCampaignCreator(ccId, {
      sample_progress: editSampleProgress,
      notes_manager: editNotesManager,
      notes_pic: editNotesPic,
    }, profile?.nama || 'System');
    setEditingId(null);
    setPage(0);
    fetchListing(0, true);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const updateVideoField = useCallback(async (videoId: number, ccId: number, fields: any) => {
    setIsSavingVideo(true);
    // Optimistic update
    setListingData((prev) => 
      prev.map(cc => {
        if (cc.id === ccId) {
          return {
            ...cc,
            videos: (cc.videos || []).map((v: any) => {
              if (v.id === videoId) {
                return { ...v, ...fields };
              }
              return v;
            })
          };
        }
        return cc;
      })
    );

    try {
      await upsertVideoAction({
        id: videoId,
        campaign_creator_id: ccId,
        urutan: fields.urutan || 1,
        ...fields
      });
    } catch (err) {
      console.warn('Failed to update video:', err);
    }
    setIsSavingVideo(false);
  }, []);

  const addEmptyVideoRow = useCallback(async (ccId: number) => {
    try {
      const cc = listingData.find(c => c.id === ccId);
      if (!cc) return;
      const currentVideos = cc.videos || [];
      const nextUrutan = currentVideos.length > 0 ? Math.max(...currentVideos.map((v: any) => v.urutan)) + 1 : 1;
      
      const res = await insertVideoAction({
        campaign_creator_id: ccId,
        urutan: nextUrutan,
        concept: '',
        link_video: '',
        vt_approval: 'pending'
      });
      
      if (!res.success) throw new Error(res.error);
      
      setListingData(prev => prev.map(c => {
        if (c.id === ccId) {
          return { ...c, videos: [...(c.videos || []), res.data] };
        }
        return c;
      }));
    } catch (err) {
      console.error('Failed to add empty video row', err);
      alert('Gagal menambah slot konsep');
    }
  }, [listingData]);

  const deleteVideoRow = useCallback(async (ccId: number, videoId: string | number) => {
    if (!confirm('Hapus slot video ini?')) return;
    
    // Optimistic update
    setListingData(prev => prev.map(c => {
      if (c.id === ccId) {
        return {
          ...c,
          videos: (c.videos || []).filter((v: any) => v.id !== videoId)
        };
      }
      return c;
    }));

    if (typeof videoId === 'number') {
      try {
        await deleteVideoAction(videoId);
      } catch (err) {
        console.error('Failed to delete video row', err);
        alert('Gagal menghapus slot dari database');
      }
    }
  }, []);

  const addAndSetVideoField = useCallback(async (ccId: number, urutan: number, fields: any) => {
    setIsSavingVideo(true);
    const tempId = `temp_${Date.now()}`;
    const newVideo = {
      id: tempId,
      campaign_creator_id: ccId,
      urutan,
      concept: '',
      link_video: '',
      link_draft: '',
      vt_approval: 'pending',
      ...fields
    };

    setListingData(prev => prev.map(c => {
      if (c.id === ccId) {
        return { ...c, videos: [...(c.videos || []), newVideo] };
      }
      return c;
    }));

    try {
      const res = await upsertVideoAction({
        campaign_creator_id: ccId,
        urutan,
        ...fields,
        vt_approval: fields.vt_approval || 'pending'
      });
      
      if (res.success && res.data) {
        setListingData(prev => prev.map(c => {
          if (c.id === ccId) {
            return {
              ...c,
              videos: (c.videos || []).map((v: any) => v.id === tempId ? res.data : v)
            };
          }
          return c;
        }));
      }
    } catch (err) {
      console.warn('Failed to add and set video field', err);
    }
    setIsSavingVideo(false);
  }, []);

  const saveRevisionNote = useCallback(async (ccId: number, urutan: number, noteText: string) => {
    const existing = revisionNotes[`${ccId}_${urutan}`];

    try {
      const res = await upsertRevisionNoteAction({
        existingId: existing?.id,
        ccId,
        urutan,
        noteText,
        authorId: profile?.id,
        authorName: profile?.nama || 'Manager',
      });

      if (!res.success) throw new Error(res.error);
      if (res.data) {
        setRevisionNotes(prev => ({ ...prev, [`${ccId}_${urutan}`]: res.data }));
      }
    } catch (err) {
      console.error("Failed to save revision note:", err);
      alert("Gagal menyimpan catatan revisi");
    }
  }, [revisionNotes, profile]);

  const handleDeleteCreator = async (ccId: number) => {
    if (!confirm('Yakin ingin mengeluarkan kreator ini dari campaign? Data performa campaign kreator ini akan ikut terhapus. (Kreator tetap ada di Pool)')) return;
    try {
      setListingData(prev => prev.filter(c => c.id !== ccId));
      await useDatabaseStore.getState().deleteCampaignCreator(ccId);
      fetchListing(page, true);
      fetchCounts();
    } catch (err) {
      alert('Gagal menghapus kreator.');
    }
  };

  const optimisticUpdateCampaignCreator = async (ccId: number, data: any, changedBy?: string) => {
    setListingData(prev => prev.map(c => c.id === ccId ? { ...c, ...data } : c));
    await updateCampaignCreator(ccId, data, changedBy);
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasAccess || isAddingBulk) return;

    setIsAddingBulk(true);

    try {
      const validRows = dynamicRows.filter(r => r.username.trim() !== '');
      if (validRows.length === 0) {
        setIsAddingBulk(false);
        return;
      }

      const usernames = validRows.map(r => r.username.replace('@', '').trim().toLowerCase());
      const uniqueUsernames = Array.from(new Set(usernames));

      // Fetch existing creators
      const res = await searchCreatorsWithSnapshotsAction(uniqueUsernames);
      const existingData = res.data || [];

      const existingMap = new Map((existingData || []).map((c: any) => [c.username.toLowerCase(), c]));
      
      const missing: any[] = [];
      const existing: any[] = [];

      for (const row of validRows) {
        const uname = row.username.replace('@', '').trim().toLowerCase();
        const found = existingMap.get(uname);
        if (found) {
          existing.push({ ...row, ...found });
        } else {
          missing.push(row);
        }
      }

      setExistingCreators(existing);
      setMissingCreators(missing);
      setModalStep(2);

    } catch (err: any) {
      console.error(err);
      alert('Gagal melakukan scan kreator: ' + (err.message || err.toString()));
    } finally {
      setIsAddingBulk(false);
    }
  };

  const handleRescanMissing = async () => {
    if (missingCreators.length === 0) return;
    setIsAddingBulk(true);
    try {
      const usernames = missingCreators.map(m => m.username.replace('@', '').trim().toLowerCase());
      const res = await searchCreatorsWithSnapshotsAction(usernames);
      const foundInDb = res.data || [];
        
      if (foundInDb && foundInDb.length > 0) {
        const foundUsernames = new Set(foundInDb.map((c: any) => c.username.toLowerCase()));
        
        const newExisting = missingCreators
          .filter(m => foundUsernames.has(m.username.replace('@', '').trim().toLowerCase()))
          .map(m => {
            const dbData = foundInDb.find((d: any) => d.username.toLowerCase() === m.username.replace('@', '').trim().toLowerCase());
            return { ...m, ...dbData };
          });
          
        setExistingCreators(prev => [...prev, ...newExisting]);
        setMissingCreators(prev => prev.filter(m => !foundUsernames.has(m.username.replace('@', '').trim().toLowerCase())));
      } else {
        alert("Belum ada data kreator yang masuk di database. Silakan import/lengkapi dulu.");
      }
    } catch (err: any) {
      alert("Gagal scan ulang: " + err.message);
    } finally {
      setIsAddingBulk(false);
    }
  };

  const handleSubmitToCampaign = async (group: 'existing' | 'missing') => {
    if (!hasAccess || isAddingBulk) return;
    setIsAddingBulk(true);

    try {
      const rowsToProcess = group === 'existing' ? existingCreators : missingCreators;
      if (rowsToProcess.length === 0) return;

      const creatorPayloads = rowsToProcess.map(r => ({
        username: r.username.replace('@', '').trim().toLowerCase(),
        link_account: `https://www.tiktok.com/@${r.username.replace('@', '').trim().toLowerCase()}`,
        added_by: profile?.id
      }));

      // Calculate Tier
      const calculateTier = (followers: number): string => {
        if (followers < 10000) return 'Nano';
        if (followers < 100000) return 'Micro';
        if (followers < 1000000) return 'Macro';
        return 'Mega';
      };

      const campaignPayloads = rowsToProcess.map(c => {
        const snaps = c.creator_snapshots || [];
        const followers = snaps[0]?.followers || 0;
        const tier = calculateTier(followers);

        return {
          username: c.username.replace('@', '').trim().toLowerCase(),
          creator_id: c.id,
          tier,
          price: Number(c.price),
          qty_vt: Number(c.qtyVt),
          qty_live: Number(c.qtyLive) || 0,
          content_type: c.contentType || 'Video',
          pic_assist: profile?.nama || '-',
          client_approval: isClientApprovalRequired ? 'pending' : 'not_required',
          added_by: profile?.id || null,
          hasSnapshot: snaps.length > 0
        };
      });

      const res = await insertCreatorsAndCcAction(campaignId, creatorPayloads, campaignPayloads);
      if (!res.success) throw new Error(res.error);

      // Refresh to show changes immediately
      setPage(0);
      fetchListing(0, true);
      fetchCounts();

      alert(`Berhasil menambahkan ${rowsToProcess.length} kreator ke campaign!`);

      if (group === 'existing') {
        setExistingCreators([]);
      } else {
        setMissingCreators([]);
      }

      if (group === 'existing' && missingCreators.length === 0) {
        setIsAddModalOpen(false);
      } else if (group === 'missing' && existingCreators.length === 0) {
        // Keep modal open so they can click the redirect button
      }

    } catch (err: any) {
      console.error(err);
      alert('Gagal menambahkan kreator ke campaign: ' + (err.message || err.toString()));
    } finally {
      setIsAddingBulk(false);
    }
  };


  const handleExport = () => {
    setShowExportModal(true);
  };

  const executeExport = async () => {
    setIsExporting(true);
    setExportProgress({ current: 0, total: null });

    try {
      const selectedStatuses = Object.entries(exportSelection)
        .filter(([_, isSelected]) => isSelected)
        .map(([status]) => status);

      if (selectedStatuses.length === 0) {
        alert("Pilih minimal satu status untuk diekspor!");
        setIsExporting(false);
        return;
      }

      const exportRes = await fetchExportCampaignCreatorsAction(campaignId, selectedStatuses);
      if (!exportRes.success) {
        alert("Gagal mengambil data ekspor: " + exportRes.error);
        setIsExporting(false);
        return;
      }

      const allData: any[] = exportRes.data || [];
      setExportProgress({ current: allData.length, total: allData.length });

      const formattedData = allData.map((cc: any, index: number) => {
        const creator = cc.creators || {};
        const snapshot = extractCampaignSnapshot(creator, cc.created_at);
        
        const addedByName = staffProfiles.find(p => p.id === cc.added_by)?.nama || 'System';
        
        let updatePic = '-';
        let updateDate = '-';
        
        if (cc.approval === 'approved') {
          updatePic = staffProfiles.find(p => p.id === (cc.approved_by || cc.added_by))?.nama || 'System';
          updateDate = cc.approved_at || cc.created_at ? new Date(cc.approved_at || cc.created_at).toLocaleString('id-ID') : '-';
        } else if (cc.approval === 'not_approved' || cc.approval === 'alternate') {
          updatePic = staffProfiles.find(p => p.id === (cc.not_approved_by || cc.added_by))?.nama || 'System';
          updateDate = cc.not_approved_at || cc.created_at ? new Date(cc.not_approved_at || cc.created_at).toLocaleString('id-ID') : '-';
        } else {
          updatePic = addedByName;
          updateDate = cc.created_at ? new Date(cc.created_at).toLocaleString('id-ID') : '-';
        }

        return {
          'No': index + 1,
          'Username': creator.username || '',
          'Nama Asli': creator.nama_asli || '',
          'Nomor WA': creator.creator_contacts?.find((c: any) => c.status === 'aktif')?.nomor || creator.creator_contacts?.[0]?.nomor || '',
          'Followers': snapshot.followers || 0,
          'GMV 30 Days': snapshot.gmv_30d || 0,
          'GMV (Video)': snapshot.gmv_30d_video || 0,
          'GMV (Live)': snapshot.gmv_30d_live || 0,
          'Tier': cc.tier || '',
          'Level': snapshot.level || '',
          'Niche': cc.niche || '',
          'Tanggal Input': cc.created_at ? new Date(cc.created_at).toLocaleString('id-ID') : '-',
          'PIC Input': addedByName,
          'Tanggal Update Status': updateDate,
          'PIC Update Status': updatePic,
          'Status (Approval)': cc.approval || '',
          'Tipe Kerjasama': cc.price > 0 ? 'Ratecard' : 'Barter',
          'Nominal (Rp)': cc.price || 0,
          'Qty VT SOW': cc.qty_vt || 0,
          'Qty Live SOW': cc.qty_live || 0,
          'Tipe Konten': cc.tipe_konten || '',
          'Produk': cc.product || ''
        };
      });

      const ws = XLSX.utils.json_to_sheet(formattedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Creators");
      XLSX.writeFile(wb, `Export_Campaign_${campaignId}_${new Date().toISOString().split('T')[0]}.xlsx`);

      setShowExportModal(false);
    } catch (err: any) {
      console.error("Export Error:", err);
      alert("Gagal melakukan export: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const renderTd = (colName: keyof DynamicRow, rowIdx: number, value: string, children: React.ReactNode, tdClassName: string = "py-2 pr-2") => {
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
          className="absolute bottom-0 right-2 w-2 h-2 bg-blue-500 cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:scale-150"
          onMouseDown={(e) => handleFillHandleMouseDown(rowIdx, colName, value, e)}
        />
        {isDraggingHere && (
          <div className="absolute inset-0 border-2 border-blue-400 pointer-events-none z-20 bg-blue-50/20" />
        )}
      </td>
    );
  };
  type StatusFilterType = 'pending' | 'approved' | 'alternate' | 'not_approved' | 'all';

  const handleCapsuleClick = (status: StatusFilterType, tier: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (statusFilter === status && filterTier === tier) {
      setStatusFilter('all');
      setFilterTier('');
    } else {
      setStatusFilter(status);
      setFilterTier(tier);
    }
  };

  const renderTierCapsules = (statusKey: StatusFilterType, baseColorClass: string, activeColorClass: string) => {
    const tCounts = tierCounts[statusKey] || { Nano: 0, Micro: 0, Macro: 0, Mega: 0 };
    const tiers = ['Nano', 'Micro', 'Macro', 'Mega'];
    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {tiers.map(t => {
          const isActive = statusFilter === statusKey && filterTier === t;
          const count = tCounts[t] || 0;
          return (
            <div 
              key={t}
              onClick={(e) => handleCapsuleClick(statusKey, t, e)}
              className={`text-[10px] px-2 py-0.5 rounded-full cursor-pointer border transition-colors ${isActive ? activeColorClass : `bg-white ${baseColorClass} hover:bg-slate-100`}`}
            >
              <span className="font-semibold">{t}</span> {count}
            </div>
          );
        })}
      </div>
    );
  };

  let displayData = showUnsavedFirst
    ? [...listingData].sort((a, b) => {
        const aHas = pendingChanges.has(a.id) ? 0 : 1;
        const bHas = pendingChanges.has(b.id) ? 0 : 1;
        return aHas - bHas;
      })
    : [...listingData];
  
  // Apply Global Creator Filter
  displayData = displayData.filter((c: any) => isCreatorVisible(c.creators?.username));
  
  displayData = Array.from(new Map(displayData.map(c => [c.creators?.username?.toLowerCase() || c.id, c])).values());

  // Pre-calculate snapshots to prevent severe O(N log N) performance degradation during sorting
  displayData = displayData.map((c: any) => {
      c._cachedSnapshot = c._cachedSnapshot || extractCampaignSnapshot(c.creators, c.created_at);
      return c;
  });

  // Frontend Sorting for 100% accuracy on all columns
  if (sortConfig.key !== 'id') {
    displayData.sort((a: any, b: any) => {
      let valA: any = 0;
      let valB: any = 0;
      
      if (sortConfig.key === 'username') {
        valA = a.creators?.username?.toLowerCase() || '';
        valB = b.creators?.username?.toLowerCase() || '';
      } else if (sortConfig.key === 'price') {
        valA = Number(a.price) || 0;
        valB = Number(b.price) || 0;
      } else if (sortConfig.key === 'qty_vt') {
        valA = Number(a.qty_vt) || 0;
        valB = Number(b.qty_vt) || 0;
      } else if (sortConfig.key === 'qty_live') {
        valA = Number(a.qty_live) || 0;
        valB = Number(b.qty_live) || 0;
      } else if (sortConfig.key === 'approval') {
        valA = a.approval || '';
        valB = b.approval || '';
      } else if (sortConfig.key === 'followers') {
        valA = Number(a._cachedSnapshot?.followers) || 0;
        valB = Number(b._cachedSnapshot?.followers) || 0;
      } else if (sortConfig.key === 'tier') {
        valA = a._cachedSnapshot?.tier || a.tier || '';
        valB = b._cachedSnapshot?.tier || b.tier || '';
      } else if (sortConfig.key === 'level') {
        valA = Number(a._cachedSnapshot?.level) || 0;
        valB = Number(b._cachedSnapshot?.level) || 0;
      } else if (sortConfig.key === 'content_type') {
        const getDerivedCT = (c: any) => {
          let ct = c.content_type || '-';
          if (ct === '-') {
            const v = Number(c.qty_vt) || 0;
            const l = Number(c.qty_live) || 0;
            if (v >= 1 && l === 0) ct = 'Video';
            else if (v === 0 && l >= 1) ct = 'Live';
            else if (v >= 1 && l >= 1) ct = 'Video & Live';
          }
          return ct;
        };
        valA = getDerivedCT(a);
        valB = getDerivedCT(b);
      } else if (sortConfig.key === 'gmv') {
        valA = Number(a._cachedSnapshot?.gmv_30d) || 0;
        valB = Number(b._cachedSnapshot?.gmv_30d) || 0;
      }

      if (valA < valB) return sortConfig.dir === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const toggleSelectAll = () => {
    if (selectedCreators.size === displayData.length && displayData.length > 0) {
      setSelectedCreators(new Set());
    } else {
      setSelectedCreators(new Set(displayData.map((c: any) => c.id).filter(Boolean)));
    }
  };

  const toggleSelectCreator = (id: number) => {
    setSelectedCreators(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkApproval = async (status: 'approved' | 'pending' | 'alternate' | 'not_approved') => {
    if (selectedCreators.size === 0) return;
    setBulkActionProcessing(true);
    try {
      const creatorIds = Array.from(selectedCreators);
      const now = new Date().toISOString();
      
      const updatePayload: any = { approval: status };
      if (status === 'approved') {
        updatePayload.approved_by = profile?.id;
        updatePayload.approved_at = now;
      } else if (status === 'not_approved' || status === 'alternate') {
        updatePayload.not_approved_by = profile?.id;
        updatePayload.not_approved_at = now;
      }

      const res = await batchUpdateCampaignCreatorsApprovalAction(creatorIds, status, profile?.id);
      if (!res.success) throw new Error(res.error);
      
      setSelectedCreators(new Set());
      // Refetch from DB with await to get the freshly written data
      await fetchListing(0, true);
      fetchCounts();
    } catch (err: any) {
      alert('Gagal melakukan aksi massal: ' + err.message);
    } finally {
      setBulkActionProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCreators.size === 0) return;
    if (!window.confirm(`Yakin ingin menghapus ${selectedCreators.size} kreator ini dari campaign?`)) return;
    setBulkActionProcessing(true);
    try {
      const creatorIds = Array.from(selectedCreators);
      const res = await batchDeleteCampaignCreatorsAction(creatorIds);
      if (!res.success) throw new Error(res.error);
      
      setListingData(prev => prev.filter(c => !creatorIds.includes(c.id)));
      setSelectedCreators(new Set());
      fetchListing();
      fetchCounts();
    } catch (err: any) {
      alert('Gagal menghapus massal: ' + err.message);
    } finally {
      setBulkActionProcessing(false);
    }
  };

  return (
    <div className="space-y-[32px]">
      <div className="flex justify-between items-start mb-[24px] gap-[16px] flex-wrap">
        <div>
          <h2 className="text-[20px] font-bold">Daftar Creator</h2>
          <p className="text-[13px] text-text-soft">Kelola status dan rate card creator di campaign ini. (Paginated)</p>
        </div>
        <div className="flex flex-wrap gap-[10px] items-center justify-end">
          <button className="btn btn-outline" onClick={handleExport}>
            <Download className="ico" /> Export
          </button>
          <input 
            type="text" 
            placeholder="Cari username..." 
            value={tableSearch} 
            onChange={e => setTableSearch(e.target.value)} 
            className="input min-w-[200px] md:w-auto"
          />
          <select 
            value={filterType}
            onChange={(e: any) => setFilterType(e.target.value)}
            className="select min-w-[150px] md:w-auto"
          >
            <option value="all">Semua Tipe</option>
            <option value="regular">Reguler (Manual)</option>
            <option value="auto_detect">Auto-Detect</option>
          </select>
          {isClientApprovalRequired && hasAccess && (
            <button className="btn btn-outline" onClick={async () => {
              const pendingIds = listingData.filter(cc => cc.client_approval === 'not_required' || cc.client_approval === 'pending').map(cc => cc.id);
              if (pendingIds.length === 0) {
                alert('Semua kreator sudah disetujui / ditolak klien.');
                return;
              }
              if (confirm(`Approve ${pendingIds.length} kreator sekaligus?`)) {
                for (const id of pendingIds) {
                  await updateCampaignCreator(id, { client_approval: 'approved' }, profile?.nama || 'Bulk Action');
                }
                setPage(0);
                fetchListing(0, true);
              }
            }}>
              Bulk Approve Klien
            </button>
          )}

          {hasAccess && (
            <button 
              className={`btn ${duplicateGroups.length > 0 ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 animate-pulse' : 'btn-outline border-slate-200 text-slate-500 hover:bg-slate-50'}`}
              onClick={() => {
                if (duplicateGroups.length > 0) setIsDuplicateModalOpen(true);
              }}
              disabled={duplicateGroups.length === 0}
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              Data Dobel ({duplicateGroups.length})
            </button>
          )}

          {hasAccess && (
            <button className="btn btn-primary" onClick={() => {
              router.push(`/campaigns/${campaignId}/listing/import-creator`);
            }}>
              + Tambah Creator
            </button>
          )}
        </div>
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-[24px]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Multi-dimensional Filter</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)} className="select !mb-0 min-w-[120px] md:w-auto flex-1 text-sm py-1.5">
            <option value="">Semua Tier</option>
            <option value="Nano">Nano</option>
            <option value="Micro">Micro</option>
            <option value="Macro">Macro</option>
            <option value="Mega">Mega</option>
          </select>
          <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="select !mb-0 min-w-[120px] md:w-auto flex-1 text-sm py-1.5">
            <option value="">Semua Level</option>
            <option value="1">Level 1</option>
            <option value="2">Level 2</option>
            <option value="3">Level 3</option>
            <option value="4">Level 4</option>
            <option value="5">Level 5</option>
          </select>
          <select value={filterConcept} onChange={(e) => setFilterConcept(e.target.value)} className="select !mb-0 min-w-[120px] md:w-auto flex-1 text-sm py-1.5">
            <option value="">Semua Konsep</option>
            {masterConcepts && masterConcepts.length > 0 ? (
              [...masterConcepts]
                .sort((a, b) => (Number(a.no_konsep) || 0) - (Number(b.no_konsep) || 0))
                .map((c: any) => (
                  <option key={c.id || c.no_konsep} value={String(c.no_konsep)}>
                    No. {c.no_konsep} {c.judul_konsep ? `- ${c.judul_konsep}` : ''}
                  </option>
                ))
            ) : (
              Array.from({length: 20}, (_, i) => (
                <option key={i+1} value={`${i+1}`}>Konsep {i+1}</option>
              ))
            )}
          </select>
          <select value={filterContentType} onChange={(e) => setFilterContentType(e.target.value)} className="select !mb-0 min-w-[120px] md:w-auto flex-1 text-sm py-1.5">
            <option value="">Semua Tipe Konten</option>
            <option value="Video">Video</option>
            <option value="Live">Live</option>
            <option value="Video & Live">Video & Live</option>
          </select>
          <select value={filterNiche} onChange={(e) => setFilterNiche(e.target.value)} className="select !mb-0 min-w-[120px] md:w-auto flex-1 text-sm py-1.5">
            <option value="">Semua Niche</option>
            {niches.map(n => (
              <option key={n.id} value={n.id}>{n.nama}</option>
            ))}
          </select>
          <select value={filterAddedBy} onChange={(e) => setFilterAddedBy(e.target.value)} className="select !mb-0 min-w-[140px] md:w-auto flex-1 text-sm py-1.5">
            <option value="">Semua PIC (Added By)</option>
            {staffProfiles.map(p => (
              <option key={p.id} value={p.id}>{p.nama}</option>
            ))}
          </select>
          <select value={filterActionBy} onChange={(e) => setFilterActionBy(e.target.value)} className="select !mb-0 min-w-[150px] md:w-auto flex-1 text-sm py-1.5">
            <option value="">Semua PIC (Approval)</option>
            {staffProfiles.map(p => (
              <option key={p.id} value={p.id}>{p.nama}</option>
            ))}
          </select>
          <select value={filterNotes} onChange={(e) => setFilterNotes(e.target.value)} className="select !mb-0 min-w-[120px] md:w-auto flex-1 text-sm py-1.5 border-orange-300 bg-orange-50 text-orange-800">
            <option value="">Semua Notes</option>
            <option value="Ada Notes">Hanya Ada Notes</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
            <input 
              type="checkbox" 
              checked={filterPendingWithVideo}
              onChange={(e) => {
                setFilterPendingWithVideo(e.target.checked);
                if (e.target.checked) setStatusFilter('all');
              }}
              className="rounded border-slate-300 text-p300 focus:ring-p300"
            />
            <span className="font-medium whitespace-nowrap">Sisa ber-Video (Belum Approved)</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
            <input 
              type="checkbox" 
              checked={filterUnattributed}
              onChange={(e) => {
                setFilterUnattributed(e.target.checked);
                if (e.target.checked) {
                  setStatusFilter('all');
                  setFilterPendingWithVideo(false);
                }
              }}
              className="rounded border-slate-300 text-p300 focus:ring-p300"
            />
            <span className="font-medium whitespace-nowrap">Unattributed (Sisa + GMV)</span>
          </label>
          {(statusFilter !== 'all' || filterTier || filterLevel || filterNiche || filterAddedBy || filterActionBy || filterPendingWithVideo || filterUnattributed || filterContentType || filterConcept || filterActionDate) && (
            <button 
              onClick={() => {
                setStatusFilter('all');
                setFilterTier('');
                setFilterLevel('');
                setFilterNiche('');
                setFilterAddedBy('');
                setFilterActionBy('');
                setFilterPendingWithVideo(false);
                setFilterUnattributed(false);
                setFilterContentType('');
                setFilterConcept('');
                setFilterActionDate('');
              }} 
              className="btn btn-outline text-red-500 border-red-200 hover:bg-red-50 flex-1 md:flex-none"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>
      {recapLoadingProgress !== null && (
        <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm flex items-center border border-blue-200">
          <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          Mempersiapkan data rekap harian... (Menarik {recapLoadingProgress} baris data).
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-[16px]">
        <div className={`metric cursor-pointer ${statusFilter === 'all' ? 'ring-2 ring-p300' : ''}`} onClick={() => setStatusFilter('all')}>
          <div className="mlbl">Total Creator</div>
          <div className="mval">{counts.all}</div>
          {renderTierCapsules('all', 'text-slate-500 border-slate-200', 'bg-slate-800 text-white border-slate-800')}
        </div>
        <div className={`metric cursor-pointer ${statusFilter === 'approved' ? 'ring-2 ring-green-500 bg-green-50/50' : ''}`} onClick={() => setStatusFilter('approved')}>
          <div className="mlbl text-green-700">Approved</div>
          <div className="mval text-green-700">{counts.approved}</div>
          {renderTierCapsules('approved', 'text-green-600 border-green-200', 'bg-green-700 text-white border-green-700')}
        </div>
        <div className={`metric cursor-pointer ${statusFilter === 'pending' ? 'ring-2 ring-orange-400 bg-orange-50/50' : ''}`} onClick={() => setStatusFilter('pending')}>
          <div className="mlbl text-orange-600">Pending</div>
          <div className="mval text-orange-600">{counts.pending}</div>
          {renderTierCapsules('pending', 'text-orange-600 border-orange-200', 'bg-orange-600 text-white border-orange-600')}
        </div>
        <div className={`metric cursor-pointer ${statusFilter === 'alternate' ? 'ring-2 ring-purple-400 bg-purple-50/50' : ''}`} onClick={() => setStatusFilter('alternate')}>
          <div className="mlbl text-purple-600">Alternate</div>
          <div className="mval text-purple-600">{counts.alternate}</div>
          {renderTierCapsules('alternate', 'text-purple-600 border-purple-200', 'bg-purple-600 text-white border-purple-600')}
        </div>
        <div className={`metric cursor-pointer ${statusFilter === 'not_approved' ? 'ring-2 ring-red-400 bg-red-50/50' : ''}`} onClick={() => setStatusFilter('not_approved')}>
          <div className="mlbl text-red-600">Not Approved</div>
          <div className="mval text-red-600">{counts.not_approved}</div>
          {renderTierCapsules('not_approved', 'text-red-600 border-red-200', 'bg-red-600 text-white border-red-600')}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6 mt-4 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
        <label className="text-sm font-semibold text-slate-700">Filter Tanggal Aksi:</label>
        <input 
          type="date"
          value={filterActionDate}
          onChange={(e) => setFilterActionDate(e.target.value)}
          className="input !mb-0 py-1.5 text-sm w-auto max-w-[200px]"
        />
        {filterActionDate && (
          <button onClick={() => setFilterActionDate('')} className="text-sm text-red-500 hover:underline">
            Reset Tanggal
          </button>
        )}
        <span className="text-xs text-slate-500 italic ml-1 md:ml-3">
          (Mencocokkan tanggal berdasarkan kartu status yang sedang Anda pilih: 
          {statusFilter === 'pending' ? ' Tanggal Ditambahkan' : statusFilter === 'approved' ? ' Tanggal Di-approve' : statusFilter === 'not_approved' || statusFilter === 'alternate' ? ' Tanggal Ditolak' : ' Tanggal Aksi'})
        </span>
      </div>

      <div className="ccard mb-[24px] !p-0 overflow-hidden">
        <details className="group">
          <summary className="flex cursor-pointer items-center justify-between bg-slate-50 px-[16px] py-[12px] font-semibold text-text hover:bg-slate-100 transition-colors">
            <div className="flex items-center gap-4">
              <span>Rekap Harian (Progres Pencarian & Approval)</span>
              <select 
                value={recapFilterPic} 
                onChange={(e) => setRecapFilterPic(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="select !mb-0 py-1 text-xs w-auto font-normal"
              >
                <option value="">Semua PIC</option>
                {staffProfiles.map(p => (
                  <option key={p.id} value={p.id}>{p.nama}</option>
                ))}
              </select>
            </div>
            <span className="transition group-open:rotate-180">
              <ChevronDown className="w-5 h-5 text-text-soft" />
            </span>
          </summary>
          <div className="border-t border-line bg-white p-[16px] overflow-hidden">
            {dailyRecap.length === 0 ? (
              <p className="text-[13px] text-text-soft text-center py-[16px]">Belum ada progres terekam.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] text-left">
                  <thead className="bg-slate-50 border-b border-line">
                    <tr>
                      <th className="p-[12px] font-semibold text-text border-r border-line w-32">Tanggal</th>
                      <th className="p-[8px] border-r border-line text-center w-10">
                        <button 
                          onClick={() => setRecapStartIndex(Math.max(0, recapStartIndex - 1))}
                          disabled={recapStartIndex === 0}
                          className="p-[4px] hover:bg-slate-200 rounded disabled:opacity-30"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      </th>
                      {dailyRecap.slice(recapStartIndex, recapStartIndex + 5).map(d => (
                        <th key={d.date} className="p-[12px] font-semibold text-text text-center border-r border-line min-w-[120px]">
                          {new Date(d.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </th>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - dailyRecap.slice(recapStartIndex, recapStartIndex + 5).length) }).map((_, i) => (
                        <th key={`empty-th-${i}`} className="p-[12px] border-r border-line min-w-[120px]"></th>
                      ))}
                      <th className="p-[8px] text-center w-10">
                        <button 
                          onClick={() => setRecapStartIndex(Math.min(Math.max(0, dailyRecap.length - 5), recapStartIndex + 1))}
                          disabled={recapStartIndex >= dailyRecap.length - 5}
                          className="p-[4px] hover:bg-slate-200 rounded disabled:opacity-30"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-line">
                      <td className="p-[12px] font-medium text-text-soft border-r border-line">Total Add</td>
                      <td className="border-r border-line bg-slate-50"></td>
                      {dailyRecap.slice(recapStartIndex, recapStartIndex + 5).map(d => (
                        <td key={`total-${d.date}`} className="p-[12px] text-center border-r border-line font-semibold text-text bg-slate-50/50">{d.total}</td>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - dailyRecap.slice(recapStartIndex, recapStartIndex + 5).length) }).map((_, i) => <td key={`e1-${i}`} className="border-r border-line bg-slate-50/50"></td>)}
                      <td className="bg-slate-50"></td>
                    </tr>
                    <tr className="border-b border-line">
                      <td className="p-[12px] pl-[24px] text-[13px] text-text-soft border-r border-line">Nano</td>
                      <td className="border-r border-line bg-slate-50"></td>
                      {dailyRecap.slice(recapStartIndex, recapStartIndex + 5).map(d => (
                        <td key={`nano-${d.date}`} className="p-[12px] text-center border-r border-line text-[13px] text-text-soft">{d.nano}</td>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - dailyRecap.slice(recapStartIndex, recapStartIndex + 5).length) }).map((_, i) => <td key={`enano-${i}`} className="border-r border-line"></td>)}
                      <td className="bg-slate-50"></td>
                    </tr>
                    <tr className="border-b border-line">
                      <td className="p-[12px] pl-[24px] text-[13px] text-text-soft border-r border-line">Micro</td>
                      <td className="border-r border-line bg-slate-50"></td>
                      {dailyRecap.slice(recapStartIndex, recapStartIndex + 5).map(d => (
                        <td key={`micro-${d.date}`} className="p-[12px] text-center border-r border-line text-[13px] text-text-soft">{d.micro}</td>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - dailyRecap.slice(recapStartIndex, recapStartIndex + 5).length) }).map((_, i) => <td key={`emicro-${i}`} className="border-r border-line"></td>)}
                      <td className="bg-slate-50"></td>
                    </tr>
                    <tr className="border-b border-line">
                      <td className="p-[12px] pl-[24px] text-[13px] text-text-soft border-r border-line">Macro</td>
                      <td className="border-r border-line bg-slate-50"></td>
                      {dailyRecap.slice(recapStartIndex, recapStartIndex + 5).map(d => (
                        <td key={`macro-${d.date}`} className="p-[12px] text-center border-r border-line text-[13px] text-text-soft">{d.macro}</td>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - dailyRecap.slice(recapStartIndex, recapStartIndex + 5).length) }).map((_, i) => <td key={`emacro-${i}`} className="border-r border-line"></td>)}
                      <td className="bg-slate-50"></td>
                    </tr>
                    <tr className="border-b border-line">
                      <td className="p-[12px] pl-[24px] text-[13px] text-text-soft border-r border-line">Mega</td>
                      <td className="border-r border-line bg-slate-50"></td>
                      {dailyRecap.slice(recapStartIndex, recapStartIndex + 5).map(d => (
                        <td key={`mega-${d.date}`} className="p-[12px] text-center border-r border-line text-[13px] text-text-soft">{d.mega}</td>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - dailyRecap.slice(recapStartIndex, recapStartIndex + 5).length) }).map((_, i) => <td key={`emega-${i}`} className="border-r border-line"></td>)}
                      <td className="bg-slate-50"></td>
                    </tr>
                    <tr className="border-b border-line">
                      <td className="p-[12px] font-medium text-orange-600 border-r border-line">Pending</td>
                      <td className="border-r border-line bg-slate-50"></td>
                      {dailyRecap.slice(recapStartIndex, recapStartIndex + 5).map(d => (
                        <td key={`pending-${d.date}`} className="p-[12px] text-center border-r border-line font-semibold text-orange-600">{d.pending}</td>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - dailyRecap.slice(recapStartIndex, recapStartIndex + 5).length) }).map((_, i) => <td key={`e2-${i}`} className="border-r border-line"></td>)}
                      <td className="bg-slate-50"></td>
                    </tr>
                    <tr className="border-b border-line">
                      <td className="p-[12px] font-medium text-green-600 border-r border-line">Approve</td>
                      <td className="border-r border-line bg-slate-50"></td>
                      {dailyRecap.slice(recapStartIndex, recapStartIndex + 5).map(d => (
                        <td key={`approve-${d.date}`} className="p-[12px] text-center border-r border-line font-semibold text-green-600">{d.approved}</td>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - dailyRecap.slice(recapStartIndex, recapStartIndex + 5).length) }).map((_, i) => <td key={`e3-${i}`} className="border-r border-line"></td>)}
                      <td className="bg-slate-50"></td>
                    </tr>
                    <tr className="border-b border-line">
                      <td className="p-[12px] font-medium text-red-600 border-r border-line">Not Approve</td>
                      <td className="border-r border-line bg-slate-50"></td>
                      {dailyRecap.slice(recapStartIndex, recapStartIndex + 5).map(d => (
                        <td key={`not_approve-${d.date}`} className="p-[12px] text-center border-r border-line font-semibold text-red-600">{d.not_approved}</td>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - dailyRecap.slice(recapStartIndex, recapStartIndex + 5).length) }).map((_, i) => <td key={`e4-${i}`} className="border-r border-line"></td>)}
                      <td className="bg-slate-50"></td>
                    </tr>
                    <tr>
                      <td className="p-[12px] font-medium text-purple-600 border-r border-line">Alternate</td>
                      <td className="border-r border-line bg-slate-50"></td>
                      {dailyRecap.slice(recapStartIndex, recapStartIndex + 5).map(d => (
                        <td key={`alternate-${d.date}`} className="p-[12px] text-center border-r border-line font-semibold text-purple-600">{d.alternate}</td>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - dailyRecap.slice(recapStartIndex, recapStartIndex + 5).length) }).map((_, i) => <td key={`e5-${i}`} className="border-r border-line"></td>)}
                      <td className="bg-slate-50"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </details>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative shadow-2xl">
            {isAutoDetecting && (
              <div className="absolute top-4 right-10 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-in slide-in-from-top-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-medium">Mengecek database...</span>
              </div>
            )}
            <div className="p-[24px] flex flex-col min-h-0 flex-1 relative">
              <h3 className="text-[18px] font-bold mb-[16px]">Tambah Creator ke Campaign</h3>
            
            <div className="flex-1 overflow-y-auto min-h-0 pr-2">
              {modalStep === 1 && (
                <form onSubmit={handleScan} className="space-y-[16px]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="pb-2">Username</th>
                          <th className="pb-2">Rate Card (Rp)</th>
                          <th className="pb-2">Qty VT</th>
                          <th className="pb-2">Qty Live</th>
                          <th className="pb-2">Tipe Konten</th>
                          <th className="pb-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {dynamicRows.map((row, index) => (
                          <tr key={row.id} className="border-b">
                            {renderTd('username', index, row.username, (
                              <input 
                                type="text"
                                required
                                value={row.username}
                                onChange={e => {
                                  const newRows = [...dynamicRows];
                                  newRows[index].username = e.target.value;
                                  setDynamicRows(newRows);
                                }}
                                onPaste={e => handleGlobalPaste(e, index, 'username')}
                                onBlur={e => {
                                  const val = e.target.value.replace('@', '').trim();
                                  if (val) runBulkAutoDetect([val]);
                                }}
                                className="input h-9 text-sm w-full"
                                placeholder="tanpa @"
                              />
                            ))}
                            {renderTd('price', index, row.price, (
                              <input 
                                type="number"
                                required
                                min="0"
                                value={row.price}
                                onPaste={e => handleGlobalPaste(e, index, 'price')}
                                onChange={e => {
                                  const newRows = [...dynamicRows];
                                  newRows[index].price = e.target.value;
                                  setDynamicRows(newRows);
                                }}
                                className="input h-9 text-sm w-full"
                              />
                            ))}
                            {renderTd('qtyVt', index, row.qtyVt, (
                              <input 
                                type="number"
                                required
                                min="0"
                                value={row.qtyVt}
                                onPaste={e => handleGlobalPaste(e, index, 'qtyVt')}
                                onChange={e => {
                                  const newRows = [...dynamicRows];
                                  newRows[index].qtyVt = e.target.value;
                                  setDynamicRows(newRows);
                                }}
                                className="input h-9 text-sm w-full"
                              />
                            ))}
                            {renderTd('qtyLive', index, row.qtyLive, (
                              <input 
                                type="number"
                                required
                                min="0"
                                value={row.qtyLive}
                                onPaste={e => handleGlobalPaste(e, index, 'qtyLive')}
                                onChange={e => {
                                  const newRows = [...dynamicRows];
                                  newRows[index].qtyLive = e.target.value;
                                  setDynamicRows(newRows);
                                }}
                                className="input h-9 text-sm w-full"
                              />
                            ))}
                            {renderTd('contentType', index, row.contentType, (
                              <select
                                value={row.contentType}
                                onPaste={e => handleGlobalPaste(e, index, 'contentType')}
                                onChange={e => {
                                  const newRows = [...dynamicRows];
                                  newRows[index].contentType = e.target.value;
                                  setDynamicRows(newRows);
                                }}
                                className="input h-9 text-sm w-full bg-white"
                              >
                                <option value="Video">Video</option>
                                <option value="Live">Live</option>
                                <option value="Video & Live">Video & Live</option>
                              </select>
                            ))}
                            <td className="py-2 text-center">
                              <button 
                                type="button" 
                                onClick={() => {
                                  if (dynamicRows.length > 1) {
                                    setDynamicRows(dynamicRows.filter(r => r.id !== row.id));
                                  }
                                }}
                                className="text-error hover:bg-error/10 p-1 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <button 
                      type="button" 
                      onClick={() => {
                        setDynamicRows([...dynamicRows, { id: Math.random().toString(36).substring(2, 9), username: '', price: '0', qtyVt: '1', qtyLive: '0', contentType: 'Video' }]);
                      }}
                      className="text-p500 text-sm font-semibold hover:underline flex items-center"
                    >
                      <Plus className="w-4 h-4 mr-1" /> Tambah Baris
                    </button>
                  </div>

                  <div className="flex justify-end gap-[10px] mt-[24px] pt-4 border-t">
                    <button type="button" className="btn btn-outline" onClick={() => setIsAddModalOpen(false)}>Batal</button>
                    <button type="submit" className="btn btn-primary" disabled={isAddingBulk}>
                      {isAddingBulk ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-2 inline-block" /> Scanning...</>
                      ) : (
                        'Scan & Cek Database'
                      )}
                    </button>
                  </div>
                </form>
              )}

              {modalStep === 2 && (
                <div className="space-y-6">
                  {/* Table 1: Existing Creators */}
                  <div className="border rounded-xl p-4">
                    <h4 className="font-bold text-p500 mb-2 flex items-center">
                      <CheckCircle2 className="w-5 h-5 mr-2" /> 
                      Sudah Ada di Pool ({existingCreators.length})
                    </h4>
                    {existingCreators.length > 0 ? (
                      <>
                        <div className="max-h-40 overflow-y-auto border rounded mb-3">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 sticky top-0">
                              <tr>
                                <th className="p-2 border-b">Username</th>
                                <th className="p-2 border-b">Rate Card</th>
                                <th className="p-2 border-b">Qty VT</th>
                              </tr>
                            </thead>
                            <tbody>
                              {existingCreators.map(c => (
                                <tr key={c.id} className="border-b">
                                  <td className="p-2">
                                    <div className="font-medium text-slate-800">@{c.username}</div>
                                    {c.campaign_creators && c.campaign_creators.length > 0 && (
                                      <div className="text-[10px] text-slate-500 mt-1 flex flex-wrap gap-1">
                                        {c.campaign_creators.map((cc: any, idx: number) => (
                                          <span key={idx} className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 truncate max-w-[120px]" title={cc.campaigns?.nama}>
                                            {cc.campaigns?.nama || 'Campaign'}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-2">Rp {Number(c.price).toLocaleString('id-ID')}</td>
                                  <td className="p-2">{c.qtyVt}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <button 
                          onClick={() => handleSubmitToCampaign('existing')}
                          disabled={isAddingBulk}
                          className="btn btn-primary w-full"
                        >
                          {isAddingBulk ? 'Memproses...' : 'Tambah ke Campaign'}
                        </button>
                      </>
                    ) : (
                      <p className="text-sm text-text-soft">Tidak ada kreator di kategori ini.</p>
                    )}
                  </div>

                  {/* Table 2: Missing Creators */}
                  <div className="border border-error/30 rounded-xl p-4 bg-error/5">
                    <h4 className="font-bold text-error mb-2 flex items-center">
                      <AlertCircle className="w-5 h-5 mr-2" /> 
                      Belum Ada di Pool ({missingCreators.length})
                    </h4>
                    {missingCreators.length > 0 ? (
                      <>
                        <p className="text-xs text-error font-semibold mb-3">
                          Peringatan: Kreator ini belum terdaftar di Creator Pool. Jika Anda tambahkan ke campaign, Anda WAJIB melengkapinya nanti.
                        </p>
                        <div className="max-h-40 overflow-y-auto border rounded mb-3 border-error/20 bg-white">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-error/10 sticky top-0">
                              <tr>
                                <th className="p-2 border-b border-error/20">Username</th>
                                <th className="p-2 border-b border-error/20">Rate Card</th>
                                <th className="p-2 border-b border-error/20">Qty VT</th>
                              </tr>
                            </thead>
                            <tbody>
                              {missingCreators.map(c => (
                                <tr key={c.id} className="border-b border-error/10">
                                  <td className="p-2">@{c.username}</td>
                                  <td className="p-2">Rp {Number(c.price).toLocaleString('id-ID')}</td>
                                  <td className="p-2">{c.qtyVt}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex flex-col gap-2 mt-4 bg-slate-50 p-4 rounded-b-xl border-t border-slate-200">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleSubmitToCampaign('missing')}
                              disabled={isAddingBulk}
                              className="btn bg-error hover:bg-error-dark text-white flex-1"
                            >
                              {isAddingBulk ? 'Memproses...' : 'Import ke Campaign (Tanpa Snapshot)'}
                            </button>
                            <button 
                              onClick={() => {
                                const usernames = missingCreators.map(c => c.username.replace('@', '')).join(',');
                                window.open(`/creator-pool/import?usernames=${usernames}`, '_blank');
                              }}
                              className="btn border border-error text-error hover:bg-error/10 flex-1"
                            >
                              Lengkapi Data di Creator Pool
                            </button>
                          </div>
                          <button 
                            type="button"
                            onClick={handleRescanMissing}
                            disabled={isAddingBulk}
                            className="btn bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 w-full mt-2"
                          >
                            {isAddingBulk ? 'Mengecek...' : 'Cek Ulang (Jika sudah dilengkapi di tab sebelah)'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-text-soft">Tidak ada kreator di kategori ini.</p>
                    )}
                  </div>

                  <div className="flex justify-between pt-4 border-t">
                    <button type="button" className="btn btn-outline" onClick={() => setModalStep(1)}>
                      Kembali Input
                    </button>
                    <button type="button" className="btn btn-outline" onClick={() => {
                      setIsAddModalOpen(false);
                      setModalStep(1);
                      setDynamicRows([{ id: Math.random().toString(36).substring(2, 9), username: '', price: '0', qtyVt: '1', qtyLive: '0', contentType: 'Video' }]);
                    }}>
                      Tutup Modal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Auto-Save Toast Banner */}
      {(pendingChanges.size > 0 || isBatchSaving || isSavingVideo) && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] pointer-events-none animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-slate-900/90 backdrop-blur-sm text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700/50">
            {isBatchSaving || isSavingVideo ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                <span className="text-sm font-medium tracking-wide">Menyimpan ke database... {batchSaveProgress > 0 ? `${batchSaveProgress}%` : ''}</span>
              </>
            ) : (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span className="text-sm font-medium tracking-wide text-amber-100">Menunggu {pendingChanges.size} perubahan (Autosave dalam 2d)...</span>
              </>
            )}
          </div>
        </div>
      )}

      <div className="tbl-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="w-10 text-center">
                {hasAccess && (
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-p300 focus:ring-p300 cursor-pointer w-4 h-4"
                    checked={displayData.length > 0 && selectedCreators.size === displayData.length}
                    onChange={toggleSelectAll}
                  />
                )}
              </th>
              <th className="w-10"></th>
              <th className="w-12 text-center text-text-soft">No.</th>
              <th>
                <button onClick={() => toggleSort('username')} className="flex items-center text-left font-semibold hover:text-p300 transition-colors">
                  Creator <SortIcon col="username" />
                </button>
              </th>
              <th className="text-right">
                <button onClick={() => toggleSort('followers')} className="flex items-center justify-end font-semibold hover:text-p300 transition-colors w-full">
                  Followers <SortIcon col="followers" />
                </button>
              </th>
              <th className="text-right">
                <button onClick={() => toggleSort('tier')} className="flex items-center justify-end font-semibold hover:text-p300 transition-colors w-full">
                  Tier <SortIcon col="tier" />
                </button>
              </th>
              <th className="text-center">
                <button onClick={() => toggleSort('level')} className="flex items-center justify-center font-semibold hover:text-p300 transition-colors w-full">
                  Level <SortIcon col="level" />
                </button>
              </th>
              <th>Niche</th>
              <th>Tanggal & PIC</th>
              <th>Kerjasama</th>
              <th>
                <button onClick={() => toggleSort('price')} className="flex items-center font-semibold hover:text-p300 transition-colors">
                  Price (Rp) <SortIcon col="price" />
                </button>
              </th>
              <th>
                <button onClick={() => toggleSort('qty_vt')} className="flex items-center font-semibold hover:text-p300 transition-colors">
                  Qty VT SOW <SortIcon col="qty_vt" />
                </button>
              </th>
              <th>
                <button onClick={() => toggleSort('qty_live')} className="flex items-center font-semibold hover:text-p300 transition-colors">
                  Qty Live SOW <SortIcon col="qty_live" />
                </button>
              </th>
              <th>
                <button onClick={() => toggleSort('content_type')} className="flex items-center font-semibold hover:text-p300 transition-colors">
                  Tipe Konten <SortIcon col="content_type" />
                </button>
              </th>
              <th>Produk</th>
              <th>
                <button onClick={() => toggleSort('approval')} className="flex items-center font-semibold hover:text-p300 transition-colors">
                  Approval <SortIcon col="approval" />
                </button>
              </th>
              {isClientApprovalRequired && <th>Notes Client</th>}
              {isClientApprovalRequired && <th>Client Status</th>}
              <th className="text-right">
                <button onClick={() => toggleSort('gmv')} className="flex items-center justify-end font-semibold hover:text-p300 transition-colors w-full">
                  GMV Creator <SortIcon col="gmv" />
                </button>
              </th>
              <th className="text-right">GMV (Video)</th>
              <th className="text-right">GMV (Live)</th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              return displayData.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={isClientApprovalRequired ? 14 : 12} className="text-center py-[32px] text-text-soft">
                  Belum ada creator di campaign ini.
                </td>
              </tr>
            ) : (
              displayData.map((cc: any, index) => {
                const creator = cc.creators;
                if (!creator) return null;
                const hasPending = pendingChanges.has(cc.id);
                const snapshot = cc._cachedSnapshot;
                const type = getCreatorType(snapshot?.audience_age || null);
                const gmvCreator = snapshot?.gmv_30d || 0;
                const isExpanded = expandedRows[cc.id];
                const isEditing = editingId === cc.id;
                const creatorVideos = cc.videos || [];

                return (
                  <CreatorRow 
                    key={cc.id}
                    cc={cc}
                    index={index}
                    creator={creator}
                    snapshot={snapshot}
                    hasPending={hasPending}
                    pendingChange={pendingChanges.get(cc.id)}
                    isExpanded={isExpanded}
                    activeEditingField={editingCellId?.startsWith(`${cc.id}-`) ? editingCellId.split('-')[1] : null}
                    creatorVideos={creatorVideos}
                    hasAccess={hasAccess}
                    isSelected={selectedCreators.has(cc.id)}
                    toggleSelectCreator={toggleSelectCreator}
                    toggleExpand={toggleExpand}
                    setEditingCellId={setEditingCellId}
                    setCellChange={setCellChange}
                    getPendingValue={getPendingValue}
                    campaignSkus={campaignSkus}
                    setNicheEditCreatorId={setNicheEditCreatorId}
                    setNicheEditForm={setNicheEditForm}
                    setNicheModalOpen={setNicheModalOpen}
                    staffProfiles={staffProfiles}
                    isClientApprovalRequired={isClientApprovalRequired}
                    profile={profile}
                    isBatchSaving={isBatchSaving}
                    handleDeleteCreator={handleDeleteCreator}
                    updateCampaignCreator={optimisticUpdateCampaignCreator}
                    fetchListing={fetchListing}
                    page={page}
                    updateVideoField={updateVideoField}
                    addEmptyVideoRow={addEmptyVideoRow}
                    addAndSetVideoField={addAndSetVideoField}
                    deleteVideoRow={deleteVideoRow}
                    masterConcepts={masterConcepts}
                    revisionNotes={revisionNotes}
                    saveRevisionNote={saveRevisionNote}
                  />
                );
              })
            );
            })()}
          </tbody>
        </table>
      </div>

      {hasMore && listingData.length > 0 && (
        <div className="flex justify-center mt-[24px]">
          <button className="btn btn-outline w-[200px] justify-center" onClick={handleLoadMore} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 mr-[8px] animate-spin" /> : null}
            {isLoading ? "Memuat..." : "Muat Lebih Banyak"}
          </button>
        </div>
      )}

      {isLoading && listingData.length === 0 && (
         <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
         </div>
      )}

      {isDuplicateModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-xl">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  Duplicate Manager
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Ditemukan {duplicateGroups.length} kreator dengan data ganda. Silakan pilih data mana yang ingin dihapus. Data video pada baris yang dihapus akan otomatis dipindahkan ke baris yang dipertahankan.
                </p>
              </div>
              <button onClick={() => setIsDuplicateModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-2 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
              {duplicateGroups.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h4 className="text-lg font-bold text-slate-800">Semua Bersih!</h4>
                  <p className="text-slate-500">Tidak ada data ganda yang terdeteksi.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {duplicateGroups.map((group, gIdx) => (
                    <div key={gIdx} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                            {gIdx + 1}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800">@{group[0]?.creators?.username}</h4>
                            <span className="text-xs text-slate-500">Terdapat {group.length} baris data</span>
                          </div>
                        </div>
                        <button
                          className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700 shadow-sm border-0 font-medium px-3 flex items-center gap-1.5 transition-all"
                          onClick={() => handleMergeDuplicateGroup(group, gIdx)}
                          disabled={isMerging}
                          title="Gabungkan data dobel: ambil nilai tertinggi / paling lengkap dan satukan video"
                        >
                          {isMerging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitMerge className="w-3.5 h-3.5" />}
                          Merge Data
                        </button>
                      </div>
                      <div className="p-4 overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                            <tr>
                              <th className="px-4 py-2 rounded-tl-lg">ID</th>
                              <th className="px-4 py-2">Status</th>
                              <th className="px-4 py-2">Harga</th>
                              <th className="px-4 py-2">Progres Sampel</th>
                              <th className="px-4 py-2">Status Bayar</th>
                              <th className="px-4 py-2">Video (Qty)</th>
                              <th className="px-4 py-2 rounded-tr-lg">Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.map((row: any, rIdx: number) => (
                              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-4 py-3 font-mono text-xs">{row.id}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${row.approval === 'approved' ? 'bg-green-100 text-green-700' : row.approval === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'}`}>
                                    {row.approval}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-medium">Rp {row.price?.toLocaleString('id-ID') || 0}</td>
                                <td className="px-4 py-3 text-slate-600">{row.sample_progress || '-'}</td>
                                <td className="px-4 py-3 text-slate-600">{row.status_bayar || 'belum'}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1">
                                    <span className="font-bold text-blue-600">{row.videos?.length || 0}</span>
                                    <span className="text-slate-400 text-xs">/ {row.qty_vt || 0}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <button 
                                    className="btn btn-sm bg-red-50 text-red-600 hover:bg-red-500 hover:text-white border-0 transition-colors"
                                    onClick={async () => {
                                      if (confirm(`Yakin ingin MENGHAPUS baris ID ${row.id} ini? \n\n(Jika ada video di baris ini, akan dipindahkan ke baris lain)`)) {
                                        const keepRow = group.find((r: any) => r.id !== row.id);
                                        try {
                                          const res = await deleteSingleDuplicateCampaignCreatorAction(row.id, keepRow?.id);
                                          if (!res.success) throw new Error(res.error);
                                          
                                          setDuplicateGroups(prev => {
                                            const next = [...prev];
                                            next[gIdx] = next[gIdx].filter((r: any) => r.id !== row.id);
                                            if (next[gIdx].length <= 1) next.splice(gIdx, 1);
                                            return next;
                                          });
                                          fetchListing(0, true);
                                          fetchCounts();
                                        } catch (err: any) {
                                          alert("Gagal menghapus data dobel: " + (err.message || ''));
                                        }
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3 mr-1" /> Hapus
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Modal Edit Niche */}
      <Dialog open={nicheModalOpen} onOpenChange={setNicheModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Niche Kreator</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-500">
              Perubahan niche ini akan mengubah profil kreator secara global di semua campaign.
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1 border rounded-lg bg-slate-50">
              {niches.map(niche => (
                <label key={niche.id} className="flex items-center gap-2 text-sm p-2 border rounded cursor-pointer hover:bg-white transition-colors bg-transparent">
                  <input 
                    type="checkbox" 
                    checked={nicheEditForm.includes(niche.id)}
                    onChange={(e) => {
                      if(e.target.checked) setNicheEditForm([...nicheEditForm, niche.id]);
                      else setNicheEditForm(nicheEditForm.filter(id => id !== niche.id));
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  {niche.nama}
                </label>
              ))}
            </div>
            <button 
              className="btn btn-primary w-full" 
              onClick={handleSaveNiche}
              disabled={isSavingNiche}
            >
              {isSavingNiche ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Simpan Niche Global'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating Bulk Action Toolbar */}
      {hasAccess && selectedCreators.size > 0 && (
        <div className="fixed bottom-[24px] left-1/2 -translate-x-1/2 bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200 p-2 pr-4 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="bg-p300 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-inner">
            {selectedCreators.size}
          </div>
          <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">Creator Terpilih</span>
          <div className="w-[1px] h-[24px] bg-slate-200 mx-2"></div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                const idsToOpen = Array.from(selectedCreators);
                const creatorsToOpen = displayData.filter((cc: any) => idsToOpen.includes(cc.id));
                creatorsToOpen.forEach((cc: any) => {
                  const username = cc.creators?.username;
                  if (username) {
                    const cleanUsername = username.replace('@', '');
                    const url = `https://www.tiktok.com/@${cleanUsername}`;
                    window.open(url, '_blank');
                  }
                });
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors flex items-center gap-1.5"
            >
              Open Profil Creator
              <img src="https://campaign.tntkreatif.com/logo-tiktok-landscape-button.svg" alt="TikTok" className="h-3.5" />
            </button>
            <button 
              onClick={() => handleBulkApproval('approved')}
              disabled={bulkActionProcessing}
              className="px-3 py-1.5 text-xs font-semibold rounded-full bg-green-50 text-green-700 hover:bg-green-100 transition-colors flex items-center gap-1"
            >
              {bulkActionProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Set Approved'}
            </button>
            <button 
              onClick={() => handleBulkApproval('alternate')}
              disabled={bulkActionProcessing}
              className="px-3 py-1.5 text-xs font-semibold rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors flex items-center gap-1"
            >
              {bulkActionProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Set Alternate'}
            </button>
            <button 
              onClick={() => handleBulkApproval('not_approved')}
              disabled={bulkActionProcessing}
              className="px-3 py-1.5 text-xs font-semibold rounded-full bg-red-50 text-red-700 hover:bg-red-100 transition-colors flex items-center gap-1"
            >
              {bulkActionProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Set Not Approved'}
            </button>
            <button 
              onClick={() => handleBulkApproval('pending')}
              disabled={bulkActionProcessing}
              className="px-3 py-1.5 text-xs font-semibold rounded-full bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors flex items-center gap-1"
            >
              {bulkActionProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Set Pending'}
            </button>
            <div className="w-[1px] h-[24px] bg-slate-200 mx-1"></div>
            <button 
              onClick={handleBulkDelete}
              disabled={bulkActionProcessing}
              className="px-3 py-1.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-700 transition-colors flex items-center gap-1"
            >
              {bulkActionProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Trash2 className="w-3 h-3" /> Hapus</>}
            </button>
          </div>
        </div>
      )}
      {/* MODAL EXPORT */}
      {showExportModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-lg text-slate-800">Export Data Creator</h3>
              <button 
                onClick={() => !isExporting && setShowExportModal(false)}
                disabled={isExporting}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 mb-2">Pilih status creator yang ingin diekspor ke Excel (semua data akan ditarik utuh):</p>
              
              <div className="grid grid-cols-2 gap-3">
                {Object.keys(exportSelection).map((status) => (
                  <label key={status} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      checked={exportSelection[status as keyof typeof exportSelection]}
                      onChange={(e) => setExportSelection(prev => ({...prev, [status]: e.target.checked}))}
                      disabled={isExporting}
                    />
                    <span className="text-sm font-medium capitalize text-slate-700">
                      {status.replace('_', ' ')}
                    </span>
                  </label>
                ))}
              </div>

              {isExporting && (
                <div className="mt-4 p-4 bg-blue-50 text-blue-700 rounded-lg text-sm flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>
                    Menarik data... {exportProgress.total !== null ? `${exportProgress.current} / ${exportProgress.total}` : exportProgress.current} baris
                  </span>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
                onClick={() => setShowExportModal(false)}
                disabled={isExporting}
              >
                Batal
              </button>
              <button 
                className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={executeExport}
                disabled={isExporting || !Object.values(exportSelection).some(Boolean)}
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Export ke Excel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
