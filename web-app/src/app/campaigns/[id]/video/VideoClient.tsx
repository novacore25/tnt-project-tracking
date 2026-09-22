"use client";

import React, { useState, useEffect } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
// Replaced standard UI imports
import { getCreatorType } from "@/utils/computed";
import { formatDateTime, formatDateTimeShort, formatDate } from "@/utils/formatters";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Link as LinkIcon, Save, Edit2, Loader2, ChevronDown, ChevronRight, Plus, PlayCircle, X, Download, ExternalLink, CheckCircle2, Clock, Film, FileVideo, RotateCw, Calendar, Info } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { useAuth } from "@/providers/AuthProvider";
import { useCampaignFilter } from "@/providers/CampaignFilterProvider";
import { getInternalVideoData } from "../../actions/videoActions";
import {
  fetchCampaignConceptsAction,
  fetchRevisionNotesAction,
  upsertRevisionNoteAction,
  upsertVideoAction,
  deleteVideosAction,
  fetchVideosByCcIdsAction,
  insertCreatorsAndCcAction,
  bulkInsertVideosAction
} from "@/app/actions/campaignPageActions";
import * as XLSX from "xlsx";

const extractGDriveId = (url: string) => {
  if (!url) return null;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
};

const extractCampaignSnapshot = (creator: any, campaignCreatedAt?: string) => {
  const snaps = creator?.creator_snapshots || [];
  if (snaps.length === 0) return {};
  
  const sortedSnaps = [...snaps].sort((a:any, b:any) => {
    const tDiff = new Date(b.tanggal_update || b.created_at || 0).getTime() - new Date(a.tanggal_update || a.created_at || 0).getTime();
    if (tDiff !== 0) return tDiff;
    return b.id - a.id;
  });

  let targetSnaps = sortedSnaps;
  if (campaignCreatedAt) {
    const cTime = new Date(campaignCreatedAt).getTime();
    const gracePeriod = 86400000; // 24 hours grace period
    const targetSnap = sortedSnaps.find((s: any) => {
      const sTime = new Date(s.tanggal_update || s.created_at || 0).getTime();
      return sTime <= cTime + gracePeriod;
    });
    const baseSnap = targetSnap || sortedSnaps[sortedSnaps.length - 1];
    targetSnaps = sortedSnaps.slice(sortedSnaps.indexOf(baseSnap));
  }

  return targetSnaps.reduce((acc: any, curr: any) => ({
    followers: acc.followers ?? curr.followers,
    tier: acc.tier ?? curr.tier,
    audience_age: acc.audience_age ?? curr.audience_age,
    level: acc.level ?? curr.level,
    ratecard: acc.ratecard ?? curr.ratecard,
    gmv_30d: acc.gmv_30d ?? curr.gmv_30d,
  }), { followers: null, tier: null, audience_age: null, level: null, ratecard: null, gmv_30d: null } as any);
};

// Algoritma Snowflake TikTok - Akurat 100% tanpa API
function extractTikTokUploadDate(videoId: string): string | null {
  try {
    const id = BigInt(videoId);
    const timestamp = Number(id >> BigInt(32)) * 1000;
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

export default function CampaignVideoPage({
  initialListingData,
  initialVideos,
  initialRevisionNotes
}: {
  initialListingData: any[],
  initialVideos: any[],
  initialRevisionNotes?: Record<string, any>
}) {
  const { id } = useParams();
  const campaignId = Number(id);
  
  const { 
    creators, 
    videos,
    sales,
    skus,
    fetchData,
    campaigns
  } = useDatabaseStore();

  const { canEditCampaign, profile, isManager, isExecutive } = useAuth();
  const hasAccess = canEditCampaign(campaignId);
  const canManageRevisionNotes = isManager || isExecutive;
  const { isCreatorVisible } = useCampaignFilter();

  const campaign = campaigns.find(c => c.id === campaignId);

  const isAwareness = campaign?.tipe_campaign === 'awareness';

  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [localVideos, setLocalVideos] = useState<any[]>(initialVideos || []);
  const [listingData, setListingData] = useState<any[]>(initialListingData || []);

  // Clean up any stale draft_videos_campaign from localStorage to prevent cache corruption
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(`draft_videos_campaign_${campaignId}`);
      } catch {}
    }
  }, [campaignId]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandingLinks, setExpandingLinks] = useState<Record<string, boolean>>({});
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkResults, setBulkResults] = useState<any[]>([]);
  const [bulkMinimized, setBulkMinimized] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const previewRef = React.useRef<HTMLDivElement>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<number>>(new Set());
  const [deletingHistory, setDeletingHistory] = useState(false);

  useEffect(() => {
    if (!previewOpen || !previewUrl) return;
    const existingScript = document.querySelector('script[src="https://www.tiktok.com/embed.js"]');
    if (existingScript) existingScript.remove();
    const timer = setTimeout(() => {
      const script = document.createElement('script');
      script.src = 'https://www.tiktok.com/embed.js';
      script.async = true;
      document.body.appendChild(script);
    }, 100);
    return () => clearTimeout(timer);
  }, [previewOpen, previewUrl]);

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // New Filters & Sort states
    const [dateSortBy, setDateSortBy] = useState<'latest'|'oldest'|'gmv_desc'|'views_desc'>('latest');
  const [expandedDates, setExpandedDates] = useState<string[]>([]);
  const toggleDateExpanded = (d: string) => {
    setExpandedDates(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };
  const [filterSow, setFilterSow] = useState('all');
  const [filterSales, setFilterSales] = useState('all');
  const [filterSku, setFilterSku] = useState('all');
  const [filterConcept, setFilterConcept] = useState('');
  const [sortBy, setSortBy] = useState('latest_post');
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [clientPage, setClientPage] = useState(1);
  const [viewMode, setViewMode] = useState<'creator' | 'video' | 'draft' | 'date'>('creator');
  const [isFiltering, setIsFiltering] = useState(false);

  // Draft Video specific states
  const [filterDraftApproval, setFilterDraftApproval] = useState<'all' | 'pending' | 'approved' | 'revisi'>('all');
  const [filterDraftLink, setFilterDraftLink] = useState<'all' | 'has_draft' | 'no_draft'>('all');
  const [filterDraftTiktok, setFilterDraftTiktok] = useState<'all' | 'uploaded' | 'not_uploaded'>('all');
  const [playingDriveId, setPlayingDriveId] = useState<string | null>(null);
  const [masterConcepts, setMasterConcepts] = useState<any[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<any | null>(null);

  // Draft Video Revision Notes states
  const [revisionNotes, setRevisionNotes] = useState<Record<string, any>>(initialRevisionNotes || {});
  const [savingFields, setSavingFields] = useState<Record<string, boolean>>({});
  const [revisionModalState, setRevisionModalState] = useState<{
    open: boolean;
    video: any | null;
    noteText: string;
    isSaving: boolean;
  }>({
    open: false,
    video: null,
    noteText: '',
    isSaving: false
  });

  // Posting Date Range Filter states (specifically for 'video' viewMode)
  const [postDateStart, setPostDateStart] = useState<string>('');
  const [postDateEnd, setPostDateEnd] = useState<string>('');
  const [datePreset, setDatePreset] = useState<string>('all');

  const handleApplyDatePreset = (preset: string) => {
    const today = new Date();
    const formatDateStr = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (preset === 'all') {
      setPostDateStart('');
      setPostDateEnd('');
      setDatePreset('all');
      return;
    }

    if (preset === '3d') {
      const start = new Date(today);
      start.setDate(today.getDate() - 2);
      setPostDateStart(formatDateStr(start));
      setPostDateEnd(formatDateStr(today));
      setDatePreset('3d');
      return;
    }

    if (preset === '7d') {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      setPostDateStart(formatDateStr(start));
      setPostDateEnd(formatDateStr(today));
      setDatePreset('7d');
      return;
    }

    if (preset === '14d') {
      const start = new Date(today);
      start.setDate(today.getDate() - 13);
      setPostDateStart(formatDateStr(start));
      setPostDateEnd(formatDateStr(today));
      setDatePreset('14d');
      return;
    }

    if (preset === '30d') {
      const start = new Date(today);
      start.setDate(today.getDate() - 29);
      setPostDateStart(formatDateStr(start));
      setPostDateEnd(formatDateStr(today));
      setDatePreset('30d');
      return;
    }

    if (preset === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setPostDateStart(formatDateStr(start));
      setPostDateEnd(formatDateStr(today));
      setDatePreset('this_month');
      return;
    }

    if (preset === 'campaign_period' && campaign?.start_date) {
      setPostDateStart(campaign.start_date.substring(0, 10));
      if (campaign.end_date) {
        setPostDateEnd(campaign.end_date.substring(0, 10));
      } else {
        setPostDateEnd(formatDateStr(today));
      }
      setDatePreset('campaign_period');
      return;
    }
  };

  const handleResetDateFilter = () => {
    setPostDateStart('');
    setPostDateEnd('');
    setDatePreset('all');
  };

  const formatDateInputDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Fetch master concepts for this campaign
  useEffect(() => {
    if (!campaignId) return;
    fetchCampaignConceptsAction(campaignId).then(res => {
      if (res.success && res.data) {
        const sorted = [...res.data].sort((a: any, b: any) => (Number(a.no_konsep) || 0) - (Number(b.no_konsep) || 0));
        setMasterConcepts(sorted);
      }
    });
  }, [campaignId]);

  // Fetch draft revision notes for creators in this campaign
  useEffect(() => {
    if (!campaignId || listingData.length === 0) return;
    const ccIds = listingData.map((cc: any) => cc.id).filter(Boolean);
    if (ccIds.length === 0) return;

    fetchRevisionNotesAction(ccIds).then(res => {
      if (res.success && res.data) {
        const map: Record<string, any> = {};
        res.data.forEach((n: any) => {
          const match = n.role.match(/^draft_revisi_(\d+)$/);
          if (match) {
            const urutan = parseInt(match[1]);
            map[`${n.campaign_creator_id}_${urutan}`] = n;
          }
        });
        setRevisionNotes(prev => ({ ...prev, ...map }));
      }
    });
  }, [campaignId, listingData.length]);

  // Reset clientPage when filters change
  useEffect(() => {
    setIsFiltering(true);
    setClientPage(1);
    const timer = setTimeout(() => setIsFiltering(false), 300);
    return () => clearTimeout(timer);
  }, [debouncedSearch, filterSow, filterSales, filterSku, filterConcept, sortBy, viewMode, filterDraftApproval, filterDraftLink, filterDraftTiktok, postDateStart, postDateEnd]);
  const CLIENT_PAGE_SIZE = 50;

  useEffect(() => {
    setClientPage(1);
  }, [filterSow, filterSales, filterSku, filterConcept, sortBy, debouncedSearch, viewMode, filterDraftApproval, filterDraftLink, filterDraftTiktok, postDateStart, postDateEnd]);
  
  const toggleGroup = (id: number) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };
  
  const PAGE_SIZE = 50;

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);



  const fetchApprovedCreators = async (pageNum: number, isReset: boolean = false) => {
    setIsLoading(true);
    try {
      const data = await getInternalVideoData(campaignId, debouncedSearch);
      if (data) {
        setHasMore(false);
        setListingData(data.listingData);
        
        if (isReset) {
          setLocalVideos(data.allVideos);
        } else {
          setLocalVideos((prev: any[]) => {
            const existingIds = new Set(prev.map(p => p.id));
            return [...prev, ...data.allVideos.filter((v: any) => !existingIds.has(v.id))];
          });
        }
      }
    } catch (err) {
      console.error("Error fetching video data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync state if initialListingData arrives or updates from SSR
  useEffect(() => {
    if (initialListingData && initialListingData.length > 0) {
      setListingData(initialListingData);
    }
  }, [initialListingData]);

  useEffect(() => {
    if (initialVideos && initialVideos.length > 0) {
      setLocalVideos(initialVideos);
    }
  }, [initialVideos]);

  const [isFirstMount, setIsFirstMount] = useState(true);

  useEffect(() => {
    if (isFirstMount) {
      setIsFirstMount(false);
      // If initialListingData or initialVideos is empty, auto-fetch on mount to self-heal
      if ((!initialListingData || initialListingData.length === 0 || !initialVideos || initialVideos.length === 0) && campaignId) {
        setPage(0);
        fetchApprovedCreators(0, true);
      }
      return;
    }
    if (campaignId) {
      setPage(0);
      fetchApprovedCreators(0, true);
    }
  }, [debouncedSearch]);

  const handleManualRefresh = () => {
    if (campaignId && !isLoading) {
      setPage(0);
      fetchApprovedCreators(0, true);
    }
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchApprovedCreators(next, false);
  };

  const handleVideoChange = (ccId: number, urutan: number, field: string, value: string) => {
    setLocalVideos((prev: any[]) => {
      const exists = prev.find(v => v.campaign_creator_id === ccId && v.urutan === urutan);

      if (exists) {
        return prev.map(v => {
          if (v.campaign_creator_id === ccId && v.urutan === urutan) {
            if (field === 'concept') {
              return { 
                ...v, 
                [field]: value,
                concept_updated_at: new Date().toISOString(),
                concept_updated_by: profile?.nama || 'System'
              };
            }
            return { ...v, [field]: value };
          }
          return v;
        });
      } else {
        const newObj: any = {
          campaign_creator_id: ccId,
          urutan: urutan,
          [field]: value
        };
        if (field === 'concept') {
          newObj.concept_updated_at = new Date().toISOString();
          newObj.concept_updated_by = profile?.nama || 'System';
        }
        return [...prev, newObj];
      }
    });
  };

  const isShortLink = (link: string) => {
    return link && (link.includes('vt.tiktok.com') || link.includes('vm.tiktok.com'));
  };

  const convertShortLink = async (ccId: number, urutan: number, shortUrl: string, expectedUsername: string) => {
    if (!isShortLink(shortUrl)) return;
    
    const key = `${ccId}_${urutan}`;
    setExpandingLinks(prev => ({ ...prev, [key]: true }));
    
    try {
      const res = await fetch('/api/expand-tiktok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortUrl })
      });
      const data = await res.json();
      
      if (res.ok && data.expandedUrl) {
        const expanded = data.expandedUrl;
        const usernameMatch = expanded.match(/@([^\/]+)/);
        if (usernameMatch && usernameMatch[1].toLowerCase() !== expectedUsername.toLowerCase()) {
           alert(`Peringatan: Video ini milik kreator @${usernameMatch[1]}, bukan @${expectedUsername}!\nLink tidak akan disimpan untuk mencegah salah input.`);
           handleVideoChange(ccId, urutan, 'link_video', '');
        } else {
           handleVideoChange(ccId, urutan, 'link_video', expanded);
        }
      } else {
        alert('Gagal mengekspansi link: ' + (data.error || 'Unknown error'));
      }
    } catch (err: any) {
       alert('Gagal menghubungi server untuk ekspansi link');
    } finally {
       setExpandingLinks(prev => ({ ...prev, [key]: false }));
    }
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = () => {
    try {
      if (viewMode === 'draft') {
        if (processedDraftsData.length === 0) {
          alert("Belum ada draft video untuk diekspor");
          return;
        }
        setIsExporting(true);

        const formattedDraftData = processedDraftsData.map((d: any, idx: number) => {
          const conceptNum = parseInt(d.concept);
          const matchedConcept = !isNaN(conceptNum) ? masterConcepts.find((c: any) => c.no_konsep === conceptNum) : null;
          
          return {
            'No': idx + 1,
            'Creator Name': d.creatorUsername ? `@${d.creatorUsername}` : '-',
            'Tier': d.creatorTier || '-',
            'No WA': d.creatorContact || '-',
            'Urutan VT': d.urutan || '-',
            'Konsep #': d.concept || '-',
            'Judul Konsep': matchedConcept?.judul_konsep || '-',
            'Link Draft Video (GDrive)': d.link_draft || '-',
            'Status Draft': d.link_draft ? 'Sudah Setor' : 'Belum Setor',
            'Link Video (TikTok)': d.link_video || '-',
            'Status VT Approval': d.vt_approval || 'pending',
            'Notes Revisi': revisionNotes[`${d.ccId}_${d.urutan}`]?.isi || '-',
            'Disetujui Oleh': d.vt_approved_by || '-',
            'Tanggal Approval': d.vt_approved_at ? new Date(d.vt_approved_at).toLocaleString('id-ID') : '-'
          };
        });

        const ws = XLSX.utils.json_to_sheet(formattedDraftData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Draft Videos");
        XLSX.writeFile(wb, `Export_Draft_Video_Campaign_${campaignId}_${new Date().toISOString().split('T')[0]}.xlsx`);
        return;
      }

      if (processedVideosData.length === 0) {
        alert("Belum ada video untuk diekspor");
        return;
      }
      setIsExporting(true);

      const formattedData = processedVideosData.map((v: any) => {
        const cc = listingData.find(c => c.id === v.ccId);
        const creator = cc?.creators || {};
        const noWa = creator.creator_contacts?.find((c: any) => c.status === 'aktif')?.nomor || creator.creator_contacts?.[0]?.nomor || '-';
        
        const sku: any = skus.find(s => s.id === v.sku_id) || {};
        
        let postTime = '-';
        if (v.post_time) {
          const d = new Date(v.post_time);
          postTime = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
        } else if (v.content_uid) {
           const extractedDate = extractTikTokUploadDate(v.content_uid);
           if (extractedDate) {
              // TikTok format: YYYY-MM-DD HH:mm:ss
              const d = new Date(extractedDate);
              postTime = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
           }
        }
        
        return {
          'Video ID': v.content_uid || '-',
          'Creator Name': v.creatorUsername || '-',
          'No WA': noWa,
          'Product ID': sku.product_id || '-',
          'Product Name': sku.nama_produk || '-',
          'Campaign ID': campaignId,
          'Post Time': postTime,
          'Video Views': v.vidViews || 0,
          'Video Likes': v.vidLikes || 0,
          'Duration': '-', 
          'Video Product RPM': v.rpm ? Number(v.rpm.toFixed(2)) : 0,
          'GMV': v.vidGmv || 0 // Added as bonus since they previously requested GMV
        };
      });

      const ws = XLSX.utils.json_to_sheet(formattedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Videos");
      const dateRangeSuffix = (postDateStart || postDateEnd) ? `_${postDateStart || 'start'}_sd_${postDateEnd || 'end'}` : '';
      XLSX.writeFile(wb, `Export_Video_Campaign_${campaignId}${dateRangeSuffix}_${new Date().toISOString().split('T')[0]}.xlsx`);

    } catch (err: any) {
      console.error("Export Error:", err);
      alert("Gagal melakukan export: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveVT = async (ccId: number) => {
    setSaving(prev => ({ ...prev, [ccId]: true }));
    try {
      const creatorVideos = localVideos.filter(vid => vid.campaign_creator_id === ccId);
      
      // Validasi semua link sebelum save
      for (const v of creatorVideos) {
        if (v.link_video) {
          if (isShortLink(v.link_video)) {
             alert('Sistem tidak bisa menyimpan link pendek (vt.tiktok.com). Harap copy link panjang dari PC.');
             setSaving(prev => ({ ...prev, [ccId]: false }));
             return;
          }
          
          const match = v.link_video.match(/video\/(\d+)/);
          if (!match) {
             alert(`Format link tidak valid: ${v.link_video}\\nHarap gunakan format: https://www.tiktok.com/@username/video/123456789`);
             setSaving(prev => ({ ...prev, [ccId]: false }));
             return;
          }
        }
      }

      for (const v of creatorVideos) {
        let finalContentUid = v.content_uid;
        if (v.link_video) {
           const match = v.link_video.match(/video\/(\d+)/);
           if (match) finalContentUid = match[1];
        }

        if (v.id && typeof v.id === 'number') {
          await upsertVideoAction({
            id: v.id,
            campaign_creator_id: ccId,
            urutan: v.urutan,
            concept: v.concept,
            concept_updated_at: v.concept_updated_at,
            concept_updated_by: v.concept_updated_by,
            link_draft: v.link_draft || null,
            link_video: v.link_video,
            vt_approval: v.vt_approval || 'pending',
            vt_approved_by: v.vt_approved_by || null,
            vt_approved_at: v.vt_approved_at || null,
            content_uid: finalContentUid,
            sku_id: v.sku_id ? Number(v.sku_id) : null
          });
        } else {
          await upsertVideoAction({
            campaign_creator_id: ccId,
            urutan: v.urutan,
            concept: v.concept,
            concept_updated_at: v.concept_updated_at,
            concept_updated_by: v.concept_updated_by,
            link_draft: v.link_draft || null,
            link_video: v.link_video,
            content_uid: finalContentUid,
            sku_id: v.sku_id ? Number(v.sku_id) : null,
            vt_approval: v.vt_approval || 'approved',
            vt_approved_by: v.vt_approved_by || null,
            vt_approved_at: v.vt_approved_at || null
          });
        }
      }
      
      await fetchData(); 
      
      // Ambil ulang data video dari DB untuk kreator ini agar ID terupdate
      const vidRes = await fetchVideosByCcIdsAction([ccId]);
      const updatedDbVideos = vidRes.data || [];
      
      // Update local storage dengan data segar dari DB (termasuk ID asli dari auto-detect yang baru disave)
      setLocalVideos((prev: any[]) => {
         const others = prev.filter(v => v.campaign_creator_id !== ccId);
         return [...others, ...(updatedDbVideos || [])];
      });
      
      alert('Perubahan berhasil disimpan');
    } catch (error) {
      console.error('Error saving videos:', error);
      alert('Gagal menyimpan video');
    } finally {
      setSaving(prev => ({ ...prev, [ccId]: false }));
    }
  };

  // Fast single-video updater (optimistic + background DB persistence)
  const handleUpdateSingleVideoField = async (
    ccId: number, 
    video: any, 
    fields: Record<string, any>
  ) => {
    const realNumericId = typeof video.id === 'number' ? video.id : null;
    const saveKey = `${ccId}_${video.urutan}`;
    setSavingFields(prev => ({ ...prev, [saveKey]: true }));
    
    // 1. Optimistic update in localVideos
    setLocalVideos((prev: any[]) => {
      const exists = prev.some(v => v.campaign_creator_id === ccId && v.urutan === video.urutan);
      if (exists) {
        return prev.map(v => {
          if (v.campaign_creator_id === ccId && v.urutan === video.urutan) {
            return { ...v, ...fields };
          }
          return v;
        });
      } else {
        return [...prev, {
          ...video,
          campaign_creator_id: ccId,
          urutan: video.urutan,
          concept: video.concept || '',
          link_draft: video.link_draft || null,
          link_video: video.link_video || null,
          vt_approval: video.vt_approval || 'pending',
          ...fields
        }];
      }
    });

    // 2. Persist to DB
    try {
      const cleanFields: Record<string, any> = {};
      const allowedKeys = [
        'concept', 'concept_updated_at', 'concept_updated_by',
        'link_draft', 'link_video', 'content_uid', 'sku_id',
        'vt_approval', 'vt_approved_by', 'vt_approved_at'
      ];
      for (const k of allowedKeys) {
        if (k in fields && fields[k] !== undefined) {
          cleanFields[k] = fields[k];
        }
      }

      const res = await upsertVideoAction({
        id: realNumericId || undefined,
        campaign_creator_id: ccId,
        urutan: video.urutan,
        concept: video.concept || '',
        concept_updated_at: video.concept_updated_at || null,
        concept_updated_by: video.concept_updated_by || null,
        link_draft: video.link_draft || null,
        link_video: video.link_video || null,
        vt_approval: video.vt_approval || 'pending',
        ...cleanFields
      });

      if (!res.success) {
        console.error('Failed to update video:', res.error);
        alert('Gagal menyimpan perubahan video ke database: ' + (res.error || 'Unknown error'));
      } else if (res.data) {
        setLocalVideos((prev: any[]) => {
          const exists = prev.some(v => v.campaign_creator_id === ccId && v.urutan === video.urutan);
          if (exists) {
            return prev.map(v => {
              if (v.campaign_creator_id === ccId && v.urutan === video.urutan) {
                return { ...v, ...res.data };
              }
              return v;
            });
          } else {
            return [...prev, res.data];
          }
        });

        // Also sync listingData cc.videos
        setListingData((prevList: any[]) => {
          return prevList.map(cc => {
            if (cc.id === ccId) {
              const prevVids = cc.videos || [];
              const vExists = prevVids.some((v: any) => v.urutan === video.urutan);
              const nextVids = vExists
                ? prevVids.map((v: any) => v.urutan === video.urutan ? { ...v, ...res.data } : v)
                : [...prevVids, res.data];
              return { ...cc, videos: nextVids };
            }
            return cc;
          });
        });
      }
    } catch (err: any) {
      console.error('Background sync video field error:', err);
      alert('Gagal menyimpan video: ' + (err?.message || 'Error'));
    } finally {
      setSavingFields(prev => ({ ...prev, [saveKey]: false }));
    }
  };

  const handleOpenRevisionModal = (video: any) => {
    if (!canManageRevisionNotes) {
      alert('Hanya Manager dan Eksekutif yang memiliki hak akses untuk mengedit catatan revisi.');
      return;
    }
    const ccId = Number(video.campaign_creator_id || video.ccId || video.cc?.id);
    const urutan = Number(video.urutan || 1);
    const existingNote = revisionNotes[`${ccId}_${urutan}`]?.isi || revisionNotes[`${video.ccId}_${urutan}`]?.isi || '';
    setRevisionModalState({
      open: true,
      video: { ...video, campaign_creator_id: ccId, ccId, urutan },
      noteText: existingNote,
      isSaving: false
    });
  };

  const handleVtApprovalChange = (video: any, newStatus: string) => {
    if (!canManageRevisionNotes) {
      alert('Hanya Manager dan Eksekutif yang dapat mengubah status approval video.');
      return;
    }
    const ccId = Number(video.campaign_creator_id || video.ccId || video.cc?.id);
    const urutan = Number(video.urutan || 1);
    const fields: Record<string, any> = {
      vt_approval: newStatus,
      vt_approved_by: profile?.nama || (isExecutive ? 'Executive' : 'Manager'),
      vt_approved_at: new Date().toISOString()
    };
    handleUpdateSingleVideoField(ccId, { ...video, campaign_creator_id: ccId, urutan }, fields);

    if (newStatus === 'revisi') {
      const existingNote = revisionNotes[`${ccId}_${urutan}`]?.isi || revisionNotes[`${video.ccId}_${urutan}`]?.isi || '';
      setRevisionModalState({
        open: true,
        video: { ...video, campaign_creator_id: ccId, ccId, urutan },
        noteText: existingNote,
        isSaving: false
      });
    }
  };

  const handleSaveRevisionNote = async () => {
    if (!canManageRevisionNotes) {
      alert('Hanya Manager dan Eksekutif yang memiliki hak akses untuk menyimpan catatan revisi.');
      return;
    }
    if (!revisionModalState.video) return;
    const { video, noteText } = revisionModalState;
    const ccId = Number(video.campaign_creator_id || video.ccId || video.cc?.id);
    const urutan = Number(video.urutan || 1);
    const existing = revisionNotes[`${ccId}_${urutan}`] || revisionNotes[`${video.ccId}_${urutan}`];

    setRevisionModalState(prev => ({ ...prev, isSaving: true }));
    setSavingFields(prev => ({ ...prev, [`${ccId}_${urutan}_note`]: true }));

    try {
      const res = await upsertRevisionNoteAction({
        existingId: existing?.id,
        ccId,
        urutan,
        noteText,
        authorId: profile?.id,
        authorName: profile?.nama || (isExecutive ? 'Executive' : 'Manager'),
      });

      if (!res.success) throw new Error(res.error);
      if (res.data) {
        setRevisionNotes(prev => ({ 
          ...prev, 
          [`${ccId}_${urutan}`]: res.data,
          [`${video.ccId}_${urutan}`]: res.data 
        }));

        // Immediately update localVideos and listingData state
        setLocalVideos((prev: any[]) => {
          return prev.map(v => {
            const vCcId = Number(v.campaign_creator_id || v.ccId);
            if (vCcId === ccId && v.urutan === urutan) {
              return {
                ...v,
                revision_notes: noteText,
                revision_notes_updated_by: res.data.author_name,
                revision_notes_updated_at: res.data.updated_at,
              };
            }
            return v;
          });
        });

        setListingData((prevList: any[]) => {
          return prevList.map(cc => {
            if (cc.id === ccId) {
              const prevVids = cc.videos || [];
              const nextVids = prevVids.map((v: any) => {
                if (v.urutan === urutan) {
                  return {
                    ...v,
                    revision_notes: noteText,
                    revision_notes_updated_by: res.data.author_name,
                    revision_notes_updated_at: res.data.updated_at,
                  };
                }
                return v;
              });
              return { ...cc, videos: nextVids };
            }
            return cc;
          });
        });
      }
      setRevisionModalState(prev => ({ ...prev, open: false, isSaving: false }));
    } catch (err: any) {
      console.error("Error saving revision note:", err);
      alert("Gagal menyimpan catatan revisi: " + (err?.message || 'Error'));
      setRevisionModalState(prev => ({ ...prev, isSaving: false }));
    } finally {
      setSavingFields(prev => ({ ...prev, [`${ccId}_${urutan}_note`]: false }));
    }
  };

  const handleAddVideoRow = (ccId: number) => {
    setLocalVideos((prev: any[]) => {
      const creatorVideos = prev.filter(v => v.campaign_creator_id === ccId);
      const nextUrutan = creatorVideos.length > 0 ? Math.max(...creatorVideos.map(v => v.urutan)) + 1 : 1;
      return [...prev, {
        campaign_creator_id: ccId,
        urutan: nextUrutan,
        concept: '',
        link_video: '',
        vt_approval: 'pending'
      }];
    });
  };

  const handleProcessBulk = async () => {
    if (!bulkInput.trim()) return;
    setBulkProcessing(true);
    setBulkResults([]);
    
    // Deduplicate input lines first
    const lines = Array.from(new Set(bulkInput.split('\n').map(l => l.trim()).filter(Boolean)));
    const results: any[] = [];
    
    setBulkTotal(lines.length);
    setBulkProgress(0);

    const assignedLinks = new Set(localVideos.map(v => v.link_video).filter(Boolean));
    const assignedVids = new Set(localVideos.map(v => v.content_uid).filter(Boolean));
    
    let currentProgress = 0;
    const BATCH_SIZE = 3; // Kurangi dari 10 jadi 3 biar ga kena rate limit TikTok
    
    // Fungsi pembantu untuk jeda
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < lines.length; i += BATCH_SIZE) {
      const chunk = lines.slice(i, i + BATCH_SIZE);
      
      const chunkPromises = chunk.map(async (link) => {
        const usernameMatchInitial = link.match(/@([^\/]+)/);
        const videoIdMatchInitial = link.match(/video\/(\d+)/);
        let initialUsername = usernameMatchInitial ? usernameMatchInitial[1].toLowerCase() : undefined;
        let initialVideoId = videoIdMatchInitial ? videoIdMatchInitial[1] : undefined;

        if (assignedLinks.has(link)) {
          return { original: link, username: initialUsername, videoId: initialVideoId, status: 'duplicate', message: 'Link sudah terdaftar di sistem' };
        }
        
        let finalLink = link;
        let isShort = isShortLink(link);
        
        if (isShort) {
          try {
            const res = await fetch('/api/expand-tiktok', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ shortUrl: link })
            });
            const data = await res.json();
            if (res.ok && data.expandedUrl) {
              finalLink = data.expandedUrl;
            } else {
              return { original: link, status: 'error', message: 'Gagal konversi link pendek' };
            }
          } catch (err) {
            return { original: link, status: 'error', message: 'Koneksi gagal saat konversi' };
          }
        }

        const usernameMatch = finalLink.match(/@([^\/]+)/);
        const videoIdMatch = finalLink.match(/video\/(\d+)/);
        const username = usernameMatch ? usernameMatch[1].toLowerCase() : undefined;
        const videoId = videoIdMatch ? videoIdMatch[1] : undefined;

        if (assignedLinks.has(finalLink)) {
          return { original: link, expanded: finalLink, username, videoId, status: 'duplicate', message: 'Link sudah terdaftar di sistem' };
        }
        
        if (!username || !videoId) {
          return { original: link, expanded: finalLink, status: 'error', message: 'Format link panjang tidak valid' };
        }
        
        if (assignedVids.has(videoId)) {
          return { original: link, expanded: finalLink, username, videoId, status: 'duplicate', message: 'Video ID sudah terdaftar di sistem' };
        }
        
        const creatorMatch = finalListingData.find((cc: any) => cc.creators?.username.toLowerCase() === username);
        
        if (creatorMatch) {
          return { original: link, expanded: finalLink, username, videoId, status: 'valid', ccId: creatorMatch.id, message: 'Siap ditambahkan' };
        } else {
          return { original: link, expanded: finalLink, username, videoId, status: 'valid_new_creator', message: 'Otomatis Ditambah (Auto-Detect)' };
        }
      });
      
      const chunkResults = await Promise.all(chunkPromises);
      
      for (const res of chunkResults) {
        if (res.status === 'valid' || res.status === 'valid_new_creator') {
          if (res.expanded) assignedLinks.add(res.expanded);
          if (res.videoId) assignedVids.add(res.videoId);
        }
        results.push(res);
      }
      
      currentProgress += chunk.length;
      setBulkProgress(currentProgress);
      
      // Kasih jeda 1 detik tiap batch biar TikTok ga nge-block IP server (Error 429)
      if (i + BATCH_SIZE < lines.length) {
         await delay(1000);
      }
    }
    
    setBulkResults(results);
    setBulkProcessing(false);
  };

  const handleSaveBulk = async () => {
    const validExisting = bulkResults.filter(r => r.status === 'valid');
    const validNewCreator = bulkResults.filter(r => r.status === 'valid_new_creator');
    
    if (validExisting.length === 0 && validNewCreator.length === 0) return;
    
    setBulkProcessing(true);
    const newDbEntries: any[] = [];
    const ccIdGroups: Record<number, any[]> = {};
    
    validExisting.forEach(r => {
       if (!ccIdGroups[r.ccId]) ccIdGroups[r.ccId] = [];
       ccIdGroups[r.ccId].push(r);
    });

    if (validNewCreator.length > 0) {
      try {
        const newUsernames = Array.from(new Set(validNewCreator.map(r => r.username)));
        const creatorPayloads = newUsernames.map(u => ({
          username: u,
          link_account: `https://www.tiktok.com/@${u}`,
          added_by: profile?.id
        }));
        const ccPayloads = newUsernames.map(u => ({
          username: u,
          tier: 'Nano',
          price: 0,
          qty_vt: validNewCreator.filter(r => r.username === u).length,
          qty_live: 0,
          content_type: 'Video',
          pic_assist: profile?.nama || '-',
          client_approval: 'not_required',
          added_by: profile?.id,
          hasSnapshot: false
        }));

        await insertCreatorsAndCcAction(campaignId, creatorPayloads, ccPayloads);
        await fetchData();
      } catch (err) {
        console.error('Error creating new creators:', err);
      }
    }
    
    for (const ccIdStr of Object.keys(ccIdGroups)) {
       const ccId = Number(ccIdStr);
       const creatorVideos = localVideos.filter(v => v.campaign_creator_id === ccId);
       let nextUrutan = creatorVideos.length > 0 ? Math.max(...creatorVideos.map(v => v.urutan)) + 1 : 1;
       
       for (const r of ccIdGroups[ccId]) {
          newDbEntries.push({
            campaign_creator_id: ccId,
            urutan: nextUrutan,
            concept: '',
            link_video: r.expanded,
            content_uid: r.videoId,
            vt_approval: r.status === 'valid_new_creator' ? 'pending' : 'approved'
          });
          nextUrutan++;
       }
    }
    
    try {
      if (newDbEntries.length > 0) {
        await bulkInsertVideosAction(newDbEntries);
        await fetchData();
        const ccIds = Object.keys(ccIdGroups).map(Number);
        const vidRes = await fetchVideosByCcIdsAction(ccIds);
        const updatedDbVideos = vidRes.data || [];
        
        setLocalVideos((prev: any[]) => {
           const others = prev.filter(v => !ccIds.includes(v.campaign_creator_id));
           return [...others, ...updatedDbVideos];
        });
        
        alert(`Berhasil menyimpan ${newDbEntries.length} video baru!`);
        setBulkImportOpen(false);
        setBulkInput('');
        setBulkResults([]);
      }
    } catch (err: any) {
      alert('Gagal menyimpan massal: ' + err.message);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleDeleteHistoryBatch = async () => {
    if (selectedHistoryIds.size === 0) return;
    if (!confirm(`Yakin ingin menghapus ${selectedHistoryIds.size} video dari database? Tindakan ini tidak dapat dibatalkan.`)) return;

    setDeletingHistory(true);
    try {
      const idsToDelete = Array.from(selectedHistoryIds);
      const res = await deleteVideosAction(idsToDelete);
      
      if (!res.success) throw new Error(res.error);
      
      setLocalVideos(prev => prev.filter(v => !selectedHistoryIds.has(v.id)));
      setSelectedHistoryIds(new Set());
      alert(`Berhasil menghapus ${idsToDelete.length} video.`);
    } catch (err: any) {
      alert('Gagal menghapus video: ' + err.message);
    } finally {
      setDeletingHistory(false);
    }
  };

  const handleResetSearch = () => {
    setSearchQuery('');
    setPage(0);
    setListingData([]);
  };

  const processedListingData = React.useMemo(() => {
    let data = [...listingData];
    
    // Apply Global Creator Filter
    data = data.filter((cc: any) => isCreatorVisible(cc.creators?.username));

    const metricsMap = new Map();
    data.forEach(cc => {
       const creator = cc.creators;
       if (!creator) return;
       
       let creatorVideos = localVideos.filter(v => v.campaign_creator_id === cc.id);
       if (creatorVideos.length === 0 && cc.videos && cc.videos.length > 0) {
          creatorVideos = cc.videos;
       }
       const uploadedVtCount = creatorVideos.filter(v => v.link_video).length;
       const targetVt = cc.qty_vt || 0;
       
       const vStats = cc._videoStats || [];
       let totalGmv = 0;
       let totalViews = 0;
       let totalLikes = 0;

       const validContentUids = new Set<string>();
       creatorVideos.forEach((v: any) => {
          if (v.content_uid) {
             validContentUids.add(v.content_uid);
             validContentUids.add(v.content_uid.replace(/^video_/, ''));
          }
          if (v.link_video) {
             const match = v.link_video.match(/video\/(\d+)/);
             if (match) {
                validContentUids.add(match[1]);
             }
          }
       });

       vStats.forEach((s: any) => {
          const sUid = s.content_uid ? s.content_uid.replace(/^video_/, '') : '';
          if (s.content_uid && (validContentUids.has(s.content_uid) || validContentUids.has(sUid))) {
             totalGmv += (s.gmv || 0);
             totalViews += (s.views || 0);
             totalLikes += (s.likes || 0);
          }
       });

       metricsMap.set(cc.id, {
          uploadedVtCount,
          targetVt,
          totalGmv,
          totalViews,
          totalLikes
       });
    });

    if (filterSow !== 'all') {
      data = data.filter(cc => {
         const m = metricsMap.get(cc.id);
         if (!m) return false;
         if (filterSow === 'done') return m.uploadedVtCount >= m.targetVt && m.targetVt > 0;
         if (filterSow === 'pending') return m.uploadedVtCount < m.targetVt;
         return true;
      });
    }

    if (filterSales !== 'all') {
      data = data.filter(cc => {
         const m = metricsMap.get(cc.id);
         if (!m) return false;
         if (filterSales === 'pecah') return m.totalGmv > 0;
         if (filterSales === 'nol') return m.totalGmv === 0;
         return true;
      });
    }

    if (filterSku !== 'all') {
       data = data.filter(cc => {
          const vStats = cc._videoStats || [];
          return vStats.some((s: any) => s.product_id === filterSku);
       });
    }

    if (filterConcept) {
       data = data.filter(cc => {
          let creatorVideos = localVideos.filter(v => v.campaign_creator_id === cc.id);
          if (creatorVideos.length === 0 && cc.videos && cc.videos.length > 0) {
             creatorVideos = cc.videos;
          }
          return creatorVideos.some(v => String(v.concept || '') === String(filterConcept));
       });
    }

    if (sortBy !== 'none') {
       data.sort((a, b) => {
          const ma = metricsMap.get(a.id);
          const mb = metricsMap.get(b.id);
          
          if (sortBy === 'latest_post') {
             const getMaxDate = (ccItem: any) => {
                let vids = localVideos.filter(v => v.campaign_creator_id === ccItem.id && v.content_uid);
                if (vids.length === 0 && ccItem.videos && ccItem.videos.length > 0) {
                   vids = ccItem.videos.filter((v: any) => v.content_uid);
                }
                let maxT = 0;
                vids.forEach((v: any) => {
                   let t = 0;
                   if (v.post_time) {
                     t = new Date(v.post_time).getTime();
                   } else {
                     const d = extractTikTokUploadDate(v.content_uid);
                     if (d) t = new Date(d).getTime();
                   }
                   if (t > maxT) maxT = t;
                });
                return maxT;
             };
             return getMaxDate(b) - getMaxDate(a);
          }

          switch(sortBy) {
             case 'gmv_desc': return (mb?.totalGmv || 0) - (ma?.totalGmv || 0);
             case 'gmv_asc': return (ma?.totalGmv || 0) - (mb?.totalGmv || 0);
             case 'vt_desc': return (mb?.uploadedVtCount || 0) - (ma?.uploadedVtCount || 0);
             case 'vt_asc': return (ma?.uploadedVtCount || 0) - (mb?.uploadedVtCount || 0);
             case 'views_desc': return (mb?.totalViews || 0) - (ma?.totalViews || 0);
             case 'views_asc': return (ma?.totalViews || 0) - (mb?.totalViews || 0);
             case 'likes_desc': return (mb?.totalLikes || 0) - (ma?.totalLikes || 0);
             case 'likes_asc': return (ma?.totalLikes || 0) - (mb?.totalLikes || 0);
             default: return 0;
          }
       });
    }

    return { data, metricsMap };
  }, [listingData, localVideos, skus, campaignId, filterSow, filterSales, filterSku, filterConcept, sortBy, isCreatorVisible]);

  const { data: finalListingData, metricsMap } = processedListingData;
  const visibleData = finalListingData.slice(0, clientPage * CLIENT_PAGE_SIZE);
  const hasMoreClient = finalListingData.length > visibleData.length;

  const processedVideosData = React.useMemo(() => {
    let allVids: any[] = [];
    
    const sourceVideos = localVideos.length > 0 ? localVideos : (initialVideos && initialVideos.length > 0 ? initialVideos : listingData.flatMap(c => c.videos || []));

    sourceVideos.forEach(v => {
       const cc = listingData.find(c => c.id === v.campaign_creator_id);
       if (!cc || !cc.creators || !isCreatorVisible(cc.creators.username)) return;
       
       const creator = cc.creators;
       const vStats = cc._videoStats || [];
       
       let dynamicContentUid = (v.content_uid && v.content_uid !== '') ? v.content_uid : null;
       if (!dynamicContentUid && v.link_video) {
         const match = v.link_video.match(/video\/(\d+)/);
         if (match) {
           dynamicContentUid = match[1];
         }
       }
        const hasContentUid = Boolean(dynamicContentUid);
        
        let vidGmv = 0;
        let vidViews = 0;
        let vidLikes = 0;
        let resolvedSkuId = v.sku_id;
        
        if (dynamicContentUid) {
           const rawUid = dynamicContentUid.replace(/^video_/, '');
           const matchingStat = vStats.find((s: any) => {
             const sUid = s.content_uid ? s.content_uid.replace(/^video_/, '') : '';
             return s.content_uid === dynamicContentUid || sUid === rawUid;
           });
           if (matchingStat) {
               vidGmv = matchingStat.gmv || 0;
               vidViews = matchingStat.views || 0;
               vidLikes = matchingStat.likes || 0;
               if (!resolvedSkuId && matchingStat.product_id) {
                 const matchedSku = skus.find((s: any) => s.product_id === matchingStat.product_id && s.campaign_id === campaignId);
                 if (matchedSku) {
                   resolvedSkuId = matchedSku.id;
                 }
               }
           }
        }

        if (!resolvedSkuId && cc.assigned_sku_ids && cc.assigned_sku_ids.length === 1) {
          resolvedSkuId = cc.assigned_sku_ids[0];
        }

        let cleanConcept = v.concept;
        if (typeof cleanConcept === 'string' && cleanConcept.includes('Auto-detected')) {
          cleanConcept = null;
        }
        
        const rpm = vidViews > 0 ? (vidGmv / vidViews) * 1000 : 0;
        
        // Filter out empty rows that haven't been filled
        if (!v.link_video && !dynamicContentUid && !v.concept) return;

        let effectivePostTime = v.post_time || null;
        if (!effectivePostTime && dynamicContentUid) {
          effectivePostTime = extractTikTokUploadDate(dynamicContentUid);
        }

        allVids.push({
           ...v,
           concept: cleanConcept,
           sku_id: resolvedSkuId || v.sku_id || null,
           post_time: effectivePostTime,
           creatorUsername: creator.username,
           creatorTier: cc.tier,
           creatorId: creator.id,
           ccId: cc.id,
           vidGmv,
           vidViews,
           vidLikes,
           rpm,
           hasContentUid,
           dynamicContentUid
        });
     });

    // 1. Posting Date Range Filter (Khusus Tampilan: Semua Video)
    if (postDateStart || postDateEnd) {
       let effectiveStart = postDateStart;
       let effectiveEnd = postDateEnd;
       if (postDateStart && postDateEnd && postDateStart > postDateEnd) {
          effectiveStart = postDateEnd;
          effectiveEnd = postDateStart;
       }

       const startTime = effectiveStart ? new Date(`${effectiveStart}T00:00:00`).getTime() : null;
       const endTime = effectiveEnd ? new Date(`${effectiveEnd}T23:59:59.999`).getTime() : null;

       allVids = allVids.filter(v => {
          let vidTime: number | null = null;
          if (v.post_time) {
             vidTime = new Date(v.post_time).getTime();
          } else if (v.dynamicContentUid) {
             const d = extractTikTokUploadDate(v.dynamicContentUid);
             if (d) vidTime = new Date(d).getTime();
          }
          if (vidTime === null || isNaN(vidTime)) return false;
          if (startTime !== null && vidTime < startTime) return false;
          if (endTime !== null && vidTime > endTime) return false;
          return true;
       });
    }

    if (debouncedSearch) {
       const term = debouncedSearch.toLowerCase().trim();
       allVids = allVids.filter(v => 
          v.creatorUsername?.toLowerCase().includes(term) ||
          v.link_video?.toLowerCase().includes(term) ||
          String(v.content_uid || '').includes(term) ||
          String(v.dynamicContentUid || '').includes(term)
       );
    }

    if (filterSow !== 'all') {
       allVids = allVids.filter(v => {
          const m = metricsMap.get(v.ccId);
          if (!m) return false;
          if (filterSow === 'done') return m.uploadedVtCount >= m.targetVt && m.targetVt > 0;
          if (filterSow === 'pending') return m.uploadedVtCount < m.targetVt;
          return true;
       });
    }

    if (filterSales !== 'all') {
       allVids = allVids.filter(v => {
          if (filterSales === 'pecah') return v.vidGmv > 0;
          if (filterSales === 'nol') return v.vidGmv === 0;
          return true;
       });
    }

    if (filterSku !== 'all') {
       allVids = allVids.filter(v => {
          const skuObj = skus.find(s => s.product_id === filterSku);
          if (skuObj && v.sku_id === skuObj.id) return true;
          if (v.product_id === filterSku) return true;
          if (String(v.sku_id) === String(filterSku)) return true;
          return false;
       });
    }

    if (filterConcept) {
       allVids = allVids.filter(v => String(v.concept || '') === String(filterConcept));
    }

    if (sortBy !== 'none') {
       allVids.sort((a, b) => {
          if (sortBy === 'latest_post') {
             let timeA = 0;
             let timeB = 0;
             if (a.post_time) timeA = new Date(a.post_time).getTime();
             else if (a.dynamicContentUid) {
               const dateA = extractTikTokUploadDate(a.dynamicContentUid);
               if (dateA) timeA = new Date(dateA).getTime();
             }
             if (b.post_time) timeB = new Date(b.post_time).getTime();
             else if (b.dynamicContentUid) {
               const dateB = extractTikTokUploadDate(b.dynamicContentUid);
               if (dateB) timeB = new Date(dateB).getTime();
             }
             return timeB - timeA;
          }
          switch(sortBy) {
             case 'gmv_desc': return b.vidGmv - a.vidGmv;
             case 'gmv_asc': return a.vidGmv - b.vidGmv;
             case 'vt_desc': 
             case 'views_desc': return b.vidViews - a.vidViews;
             case 'vt_asc':
             case 'views_asc': return a.vidViews - b.vidViews;
             case 'likes_desc': return b.vidLikes - a.vidLikes;
             case 'likes_asc': return a.vidLikes - b.vidLikes;
             default: return 0;
          }
       });
    }

    return allVids;
  }, [localVideos, initialVideos, listingData, metricsMap, debouncedSearch, filterSow, filterSales, filterSku, filterConcept, sortBy, isCreatorVisible, skus, postDateStart, postDateEnd]);

  const visibleVideosData = processedVideosData.slice(0, clientPage * CLIENT_PAGE_SIZE);
  const hasMoreVideosClient = processedVideosData.length > visibleVideosData.length;

  // Processed draft videos for 'draft' viewMode
  const processedDraftsData = React.useMemo(() => {
    if (viewMode !== 'draft') return [];

    const drafts: any[] = [];

    listingData.forEach(cc => {
      const creator = cc.creators;
      if (!creator) return;
      if (!isCreatorVisible(creator.username)) return;

      // Filter debouncedSearch
      if (debouncedSearch && !creator.username.toLowerCase().includes(debouncedSearch.toLowerCase())) {
        return;
      }

      let creatorVideos = localVideos.filter(v => v.campaign_creator_id === cc.id);
      if (creatorVideos.length === 0 && cc.videos && cc.videos.length > 0) {
        creatorVideos = cc.videos;
      }
      const target = cc.qty_vt || 0;
      
      const vids = [...creatorVideos];
      
      // Pad phantom slots up to target SOW
      if (vids.length < target) {
        const diff = target - vids.length;
        let nextUrutan = vids.length > 0 ? Math.max(...vids.map(v => v.urutan || 0)) + 1 : 1;
        for (let i = 0; i < diff; i++) {
          vids.push({
            id: `phantom_${cc.id}_${nextUrutan}`,
            campaign_creator_id: cc.id,
            urutan: nextUrutan,
            concept: '',
            concept_updated_at: null,
            concept_updated_by: null,
            link_video: '',
            link_draft: '',
            vt_approval: 'pending',
            vt_approved_by: null,
            vt_approved_at: null
          });
          nextUrutan++;
        }
      }

      if (vids.length === 0) {
        vids.push({
          id: `phantom_${cc.id}_1`,
          campaign_creator_id: cc.id,
          urutan: 1,
          concept: '',
          concept_updated_at: null,
          concept_updated_by: null,
          link_video: '',
          link_draft: '',
          vt_approval: 'pending',
          vt_approved_by: null,
          vt_approved_at: null
        });
      }

      vids.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

      vids.forEach(v => {
        drafts.push({
          ...v,
          creatorUsername: creator.username,
          creatorTier: cc.tier,
          creatorId: creator.id,
          creatorContact: creator.creator_contacts?.find((c: any) => c.status === 'aktif')?.nomor || null,
          creatorLink: creator.link_account || `https://www.tiktok.com/@${creator.username}`,
          ccId: cc.id,
          cc
        });
      });
    });

    let filtered = drafts;

    if (filterDraftApproval !== 'all') {
      filtered = filtered.filter(d => (d.vt_approval || 'pending') === filterDraftApproval);
    }

    if (filterDraftLink !== 'all') {
      if (filterDraftLink === 'has_draft') {
        filtered = filtered.filter(d => Boolean(d.link_draft && d.link_draft.trim() !== ''));
      } else if (filterDraftLink === 'no_draft') {
        filtered = filtered.filter(d => !d.link_draft || d.link_draft.trim() === '');
      }
    }

    if (filterDraftTiktok !== 'all') {
      if (filterDraftTiktok === 'uploaded') {
        filtered = filtered.filter(d => Boolean(d.link_video && d.link_video.trim() !== ''));
      } else if (filterDraftTiktok === 'not_uploaded') {
        filtered = filtered.filter(d => !d.link_video || d.link_video.trim() === '');
      }
    }

    if (filterConcept) {
      filtered = filtered.filter(d => String(d.concept || '') === String(filterConcept));
    }

    return filtered;
  }, [viewMode, listingData, localVideos, debouncedSearch, filterDraftApproval, filterDraftLink, filterDraftTiktok, filterConcept, isCreatorVisible]);

  const draftSummaryMetrics = React.useMemo(() => {
    let total = 0;
    let readyForReview = 0;
    let approved = 0;
    let revisi = 0;
    let noDraft = 0;

    listingData.forEach(cc => {
      const creator = cc.creators;
      if (!creator) return;
      if (!isCreatorVisible(creator.username)) return;

      let creatorVideos = localVideos.filter(v => v.campaign_creator_id === cc.id);
      if (creatorVideos.length === 0 && cc.videos && cc.videos.length > 0) {
        creatorVideos = cc.videos;
      }
      const target = cc.qty_vt || 0;
      const count = Math.max(target, creatorVideos.length, 1);
      
      const vids = [...creatorVideos];
      if (vids.length < count) {
        for (let i = vids.length; i < count; i++) {
          vids.push({ link_draft: '', vt_approval: 'pending' });
        }
      }

      vids.forEach(v => {
        total++;
        const hasDraft = Boolean(v.link_draft && v.link_draft.trim() !== '');
        const approval = v.vt_approval || 'pending';

        if (hasDraft && approval === 'pending') {
          readyForReview++;
        }
        if (approval === 'approved') {
          approved++;
        } else if (approval === 'revisi') {
          revisi++;
        }
        if (!hasDraft) {
          noDraft++;
        }
      });
    });

    return { total, readyForReview, approved, revisi, noDraft };
  }, [listingData, localVideos, isCreatorVisible]);

  
  const aggregatedByDate = React.useMemo(() => {
    const grouped = new Map<string, any[]>();
    processedVideosData.forEach(v => {
      if (!v.post_time) return;
      const d = new Date(v.post_time);
      if (isNaN(d.getTime())) return;
      
      const pad = (n: number) => n.toString().padStart(2, '0');
      const dateKey = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      
      if (!grouped.has(dateKey)) grouped.set(dateKey, []);
      grouped.get(dateKey).push(v);
    });

    const result = Array.from(grouped.entries()).map(([dateStr, vids]) => {
      const creatorsSet = new Set(vids.map(v => (v.creatorUsername || '').toLowerCase()));
      const totalCreators = creatorsSet.size;
      const totalVideos = vids.length;
      const totalViews = vids.reduce((acc, v) => acc + (Number(v.vidViews) || 0), 0);
      const totalLikes = vids.reduce((acc, v) => acc + (Number(v.vidLikes) || 0), 0);
      const totalGmv = vids.reduce((acc, v) => acc + (Number(v.vidGmv) || 0), 0);
      
      return {
        dateStr,
        dateObj: new Date(dateStr),
        totalCreators,
        totalVideos,
        totalViews,
        totalLikes,
        totalGmv,
        vids: vids.sort((a, b) => new Date(a.post_time).getTime() - new Date(b.post_time).getTime())
      };
    });

    result.sort((a, b) => {
      if (dateSortBy === 'latest') return b.dateObj.getTime() - a.dateObj.getTime();
      if (dateSortBy === 'oldest') return a.dateObj.getTime() - b.dateObj.getTime();
      if (dateSortBy === 'gmv_desc') return b.totalGmv - a.totalGmv;
      if (dateSortBy === 'views_desc') return b.totalViews - a.totalViews;
      return 0;
    });
    
    return result;
  }, [processedVideosData, dateSortBy]);

  const visibleDraftsData = processedDraftsData.slice(0, clientPage * CLIENT_PAGE_SIZE);
  const hasMoreDrafts = processedDraftsData.length > visibleDraftsData.length;

  const historyVideos = React.useMemo(() => {
    if (!historyOpen) return [];
    const sourceVids = localVideos.length > 0 ? localVideos : (initialVideos && initialVideos.length > 0 ? initialVideos : listingData.flatMap(c => c.videos || []));
    const videos = sourceVids.filter(v => typeof v.id === 'number' && v.created_at);
    videos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return videos.map(v => {
      const cc = listingData.find(c => c.id === v.campaign_creator_id);
      return {
        ...v,
        creatorUsername: cc?.creators?.username || '-',
        creatorName: cc?.creators?.nama_asli || '-'
      };
    });
  }, [localVideos, initialVideos, listingData, historyOpen]);
  const HISTORY_PAGE_SIZE = 15;
  const paginatedHistoryVideos = historyVideos.slice(historyPage * HISTORY_PAGE_SIZE, (historyPage + 1) * HISTORY_PAGE_SIZE);
  const totalHistoryPages = Math.ceil(historyVideos.length / HISTORY_PAGE_SIZE);

  return (
    <>
      <div className="space-y-[24px]">
      <div className="flex justify-between items-center mb-[24px] gap-[16px] flex-wrap">
        <div>
          <h2 className="text-[20px] font-bold">Video & VT</h2>
          <p className="text-[13px] text-text-soft">Kelola konsep, link video, dan approval VT untuk kreator yang di-approve.</p>
          <div className="mt-[12px] bg-blue-50/80 border border-blue-200/80 p-[12px] rounded-[8px] text-[12px] text-blue-800 flex gap-[10px] items-start max-w-3xl">
            <span className="text-[16px] leading-none mt-0.5">💡</span>
            <div>
              <strong className="text-blue-900">Penting: Format Link Video TikTok</strong><br/>
              Agar performa (GMV) video dapat ditarik secara otomatis oleh sistem, <strong>wajib</strong> memasukkan link TikTok versi panjang yang mengandung <i>username</i> dan <i>ID Video</i>.<br/>
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 font-bold">✅ BENAR</span>
                  <code className="bg-white px-2 py-0.5 rounded border border-blue-100 text-blue-900 text-[11px] font-mono">https://www.tiktok.com/@username/video/1234567890</code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-red-600 font-bold">❌ SALAH</span>
                  <code className="bg-white px-2 py-0.5 rounded border border-red-100 text-red-900 text-[11px] font-mono">https://vt.tiktok.com/ZSxxxx/</code>
                  <span className="text-blue-700 italic text-[11px] ml-1">(link dari tombol "Copy Link" di HP tidak akan terbaca sistem)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div>
          <div className="flex flex-col gap-4 bg-slate-50 p-4 border border-line rounded-lg">
              <div className="flex justify-between items-start gap-4">
                <div className="flex bg-white rounded-md border border-slate-200 overflow-hidden w-fit h-fit">
                   <button 
                     onClick={() => setViewMode('creator')}
                     className={`px-4 py-2 text-sm font-semibold transition-colors ${viewMode === 'creator' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                   >
                     Tampilan: Per Kreator
                   </button>
                   <div className="w-[1px] bg-slate-200"></div>
                   <button 
                     onClick={() => setViewMode('video')}
                     className={`px-4 py-2 text-sm font-semibold transition-colors ${viewMode === 'video' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                   >
                     Tampilan: Semua Video
                   </button>
                     <div className="w-[1px] bg-slate-200"></div>
                     <button 
                       onClick={() => setViewMode('date')}
                       className={`px-4 py-2 text-sm font-semibold transition-colors ${viewMode === 'date' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                     >
                       Tampilan: Per Tanggal
                     </button>
                   <div className="w-[1px] bg-slate-200"></div>
                   <button 
                     onClick={() => setViewMode('draft')}
                     className={`px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-1.5 ${viewMode === 'draft' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                   >
                     <Film className="w-4 h-4" />
                     Draft Video
                     {draftSummaryMetrics.readyForReview > 0 && (
                       <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 ml-1">
                         {draftSummaryMetrics.readyForReview}
                       </span>
                     )}
                   </button>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleManualRefresh} 
                    disabled={isLoading} 
                    className="btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-2 whitespace-nowrap h-fit"
                    title="Muat ulang data terbaru"
                  >
                    <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-primary' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                  <button onClick={handleExport} disabled={isExporting} className="btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-2 whitespace-nowrap h-fit">
                     {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Export
                  </button>
                  {hasAccess && (
                    <>
                      <button onClick={() => {
                        setHistoryOpen(true);
                        setHistoryPage(0);
                        setSelectedHistoryIds(new Set());
                      }} className="btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-2 whitespace-nowrap h-fit">
                         Aktivitas Import Terakhir
                      </button>
                      <button onClick={() => setBulkImportOpen(true)} className="btn btn-primary flex items-center gap-2 whitespace-nowrap h-fit">
                         <Plus className="w-4 h-4" /> Bulk Import Link
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Filter Rentang Tanggal Posting (Paling Atas, Khusus Tampilan: Semua Video) */}
              {(viewMode === 'video' || viewMode === 'date') && (
                <div className="bg-white p-3.5 rounded-lg border border-indigo-100 shadow-xs flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <Calendar className="w-4 h-4 text-indigo-600" />
                        <span>Rentang Tanggal Posting:</span>
                      </div>
                      
                      {(postDateStart || postDateEnd) ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <span>
                            {postDateStart ? formatDateInputDisplay(postDateStart) : 'Awal'} — {postDateEnd ? formatDateInputDisplay(postDateEnd) : 'Sekarang'}
                          </span>
                          <button 
                            type="button"
                            onClick={handleResetDateFilter}
                            className="hover:bg-indigo-200/60 p-0.5 rounded-full transition-colors text-indigo-600 hover:text-indigo-900"
                            title="Reset ke All Time"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                          All Time (Semua Waktu)
                        </span>
                      )}
                    </div>

                    {/* Ringkasan metrik video pada rentang tanggal aktif */}
                    <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-600 flex-wrap">
                      <span className="bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                        Total Video: <strong className="text-slate-800">{processedVideosData.length}</strong>
                      </span>
                      <span className="bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 text-emerald-800">
                        Total GMV: <strong>Rp {processedVideosData.reduce((acc, v) => acc + (v.vidGmv || 0), 0).toLocaleString('id-ID')}</strong>
                      </span>
                      <span className="bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200 text-indigo-800">
                        Total Views: <strong>{processedVideosData.reduce((acc, v) => acc + (v.vidViews || 0), 0).toLocaleString('id-ID')}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Tombol Preset & Input Tanggal Kustom */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Preset:</span>
                      <button
                        type="button"
                        onClick={() => handleApplyDatePreset('all')}
                        className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${datePreset === 'all' && !postDateStart && !postDateEnd ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        Semua Waktu
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyDatePreset('3d')}
                        className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${datePreset === '3d' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        3 Hari Terakhir
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyDatePreset('7d')}
                        className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${datePreset === '7d' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        7 Hari (1 Minggu)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyDatePreset('14d')}
                        className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${datePreset === '14d' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        14 Hari
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyDatePreset('30d')}
                        className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${datePreset === '30d' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        30 Hari
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyDatePreset('this_month')}
                        className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${datePreset === 'this_month' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        Bulan Ini
                      </button>
                      {campaign?.start_date && (
                        <button
                          type="button"
                          onClick={() => handleApplyDatePreset('campaign_period')}
                          className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${datePreset === 'campaign_period' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                          Periode Campaign
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-auto flex-wrap">
                      <span className="text-xs text-slate-500 font-medium">Pilih Tanggal:</span>
                      <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-md border border-slate-200">
                        <input
                          type="date"
                          className="px-2 py-1 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 text-slate-700"
                          value={postDateStart}
                          onChange={(e) => {
                            setPostDateStart(e.target.value);
                            setDatePreset('custom');
                          }}
                          placeholder="Dari"
                          title="Tanggal Mulai Posting"
                        />
                        <span className="text-xs text-slate-400 font-medium">s/d</span>
                        <input
                          type="date"
                          className="px-2 py-1 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 text-slate-700"
                          value={postDateEnd}
                          onChange={(e) => {
                            setPostDateEnd(e.target.value);
                            setDatePreset('custom');
                          }}
                          placeholder="Sampai"
                          title="Tanggal Akhir Posting"
                        />
                      </div>
                      {(postDateStart || postDateEnd) && (
                        <button
                          type="button"
                          onClick={handleResetDateFilter}
                          className="btn bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs py-1 px-2.5 h-auto flex items-center gap-1 font-medium"
                          title="Reset ke All Time"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reset Tanggal</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-4 items-end">
                 <div className="space-y-2 flex-1 min-w-[200px]">
                    <label className="text-xs font-semibold text-text-soft">
                       {(viewMode === 'video' || viewMode === 'date') ? 'Pencarian Kreator / Link / UID' : 'Pencarian Kreator'}
                    </label>
                    <input 
                       type="text" 
                       placeholder={(viewMode === 'video' || viewMode === 'date') ? "Cari username, link tiktok, atau UID..." : "Cari username..."} 
                       className="input w-full"
                       value={searchQuery}
                       onChange={e => setSearchQuery(e.target.value)}
                    />
                 </div>

                 {viewMode === 'draft' ? (
                   <>
                     <div className="space-y-2">
                        <label className="text-xs font-semibold text-text-soft">Status VT Approval</label>
                        <select className="select w-full" value={filterDraftApproval} onChange={e => setFilterDraftApproval(e.target.value as any)}>
                           <option value="all">Semua Status Approval</option>
                           <option value="pending">Pending (Menunggu Review)</option>
                           <option value="approved">Approved</option>
                           <option value="revisi">Revisi</option>
                        </select>
                     </div>
                     <div className="space-y-2">
                        <label className="text-xs font-semibold text-text-soft">Status Draft GDrive</label>
                        <select className="select w-full" value={filterDraftLink} onChange={e => setFilterDraftLink(e.target.value as any)}>
                           <option value="all">Semua Status Draft</option>
                           <option value="has_draft">Ada Link Draft</option>
                           <option value="no_draft">Belum Ada Draft</option>
                        </select>
                     </div>
                     <div className="space-y-2">
                        <label className="text-xs font-semibold text-text-soft">Upload TikTok (Final)</label>
                        <select className="select w-full" value={filterDraftTiktok} onChange={e => setFilterDraftTiktok(e.target.value as any)}>
                           <option value="all">Semua Status Final</option>
                           <option value="uploaded">Sudah Upload TikTok</option>
                           <option value="not_uploaded">Belum Upload TikTok</option>
                        </select>
                     </div>
                     <div className="space-y-2">
                        <label className="text-xs font-semibold text-text-soft">Filter Konsep</label>
                        <select className="select w-full max-w-[150px]" value={filterConcept} onChange={e => setFilterConcept(e.target.value)}>
                           <option value="">Semua Konsep</option>
                           {masterConcepts && masterConcepts.length > 0 ? (
                              [...masterConcepts]
                                .sort((a: any, b: any) => (Number(a.no_konsep) || 0) - (Number(b.no_konsep) || 0))
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
                     </div>
                   </>
                 ) : (
                   <>
                     <div className="space-y-2">
                        <label className="text-xs font-semibold text-text-soft">Status SOW</label>
                        <select className="select w-full" value={filterSow} onChange={e => setFilterSow(e.target.value)}>
                           <option value="all">Semua SOW</option>
                           <option value="done">Sudah Upload (Memenuhi Target)</option>
                           <option value="pending">Belum Upload / Kurang Target</option>
                        </select>
                     </div>
                     <div className="space-y-2">
                        <label className="text-xs font-semibold text-text-soft">Status Penjualan</label>
                        <select className="select w-full" value={filterSales} onChange={e => setFilterSales(e.target.value)}>
                           <option value="all">Semua Status</option>
                           <option value="pecah">Sudah Pecah Telur (GMV &gt; 0)</option>
                           <option value="nol">Belum Ada Penjualan</option>
                        </select>
                     </div>
                     <div className="space-y-2">
                        <label className="text-xs font-semibold text-text-soft">Filter Produk</label>
                        <select className="select w-full max-w-[200px]" value={filterSku} onChange={e => setFilterSku(e.target.value)}>
                           <option value="all">Semua Produk Campaign</option>
                           {skus.filter(s => s.campaign_id === campaignId).map(sku => (
                              <option key={sku.id} value={sku.product_id}>{sku.nama_produk || sku.product_id}</option>
                           ))}
                        </select>
                     </div>
                     <div className="space-y-2">
                        <label className="text-xs font-semibold text-text-soft">Filter Konsep</label>
                        <select className="select w-full max-w-[150px]" value={filterConcept} onChange={e => setFilterConcept(e.target.value)}>
                           <option value="">Semua Konsep</option>
                           {masterConcepts && masterConcepts.length > 0 ? (
                              [...masterConcepts]
                                .sort((a: any, b: any) => (Number(a.no_konsep) || 0) - (Number(b.no_konsep) || 0))
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
                     </div>
                     <div className="space-y-2">
                        <label className="text-xs font-semibold text-text-soft">Urutkan (Sort)</label>
                        <select className="select w-full font-semibold" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                           <option value="none">Tanpa Pengurutan</option>
                           <option value="latest_post">Terbaru Diposting</option>
                           <optgroup label="Berdasarkan GMV">
                              <option value="gmv_desc">Total GMV (Tertinggi)</option>
                              <option value="gmv_asc">Total GMV (Terendah)</option>
                           </optgroup>
                           <optgroup label="Berdasarkan Upload">
                              <option value="vt_desc">Jumlah Video (Terbanyak)</option>
                              <option value="vt_asc">Jumlah Video (Terdikit)</option>
                           </optgroup>
                           <optgroup label="Berdasarkan Views & Likes">
                              <option value="views_desc">Total Views (Tertinggi)</option>
                              <option value="views_asc">Total Views (Terendah)</option>
                              <option value="likes_desc">Total Likes (Tertinggi)</option>
                              <option value="likes_asc">Total Likes (Terendah)</option>
                           </optgroup>
                        </select>
                     </div>
                   </>
                 )}
              </div>
           </div>
        </div>
      </div>

      <div className="ccard p-[24px]">
        {isLoading ? (
          <div className="text-center py-[48px] text-text-soft flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span>Memuat data creator & video...</span>
          </div>
        ) : listingData.length === 0 ? (
          <div className="text-center py-[48px] text-text-soft flex flex-col items-center justify-center gap-3">
            <p>Belum ada creator yang berstatus "Approved" di campaign ini atau data sedang dimuat.</p>
            <button 
              onClick={handleManualRefresh}
              className="btn btn-outline flex items-center gap-2 text-xs"
            >
              <RotateCw className="w-3.5 h-3.5" /> Muat Ulang Data
            </button>
          </div>
        ) : viewMode === 'creator' ? (
          <div className={isFiltering ? "opacity-50 transition-opacity space-y-[48px] pb-[24px]" : "transition-opacity space-y-[48px] pb-[24px]"}>
            {visibleData.map(cc => {
              const creator = cc.creators;
              if (!creator) return null;
              
              let creatorVideos = localVideos.filter(v => v.campaign_creator_id === cc.id);
              if (creatorVideos.length === 0 && cc.videos && cc.videos.length > 0) {
                 creatorVideos = cc.videos;
              }
              
              // Re-assign urutan for auto videos so they appear at the bottom sequentially
              let maxUrutan = Math.max(0, ...creatorVideos.filter(v => typeof v.id === 'number').map(v => v.urutan));
              creatorVideos = creatorVideos.map(v => {
                if (typeof v.id === 'string' && v.id.startsWith('auto_')) {
                   maxUrutan++;
                   return { ...v, urutan: maxUrutan };
                }
                return v;
              });

              creatorVideos.sort((a, b) => a.urutan - b.urutan);
              if (creatorVideos.length === 0) {
                creatorVideos = [{ campaign_creator_id: cc.id, urutan: 1, concept: '', link_video: '', vt_approval: 'pending' }];
              }

              const isExpanded = expandedGroups.has(cc.id);
              const m = metricsMap.get(cc.id);

              return (
                <div key={cc.id} className="border border-line rounded-[12px] overflow-hidden bg-white">
                  <div 
                    className="bg-slate-50 p-[16px] border-b border-line flex flex-wrap justify-between items-center gap-[16px] cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => toggleGroup(cc.id)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`p-2 rounded-full ${isExpanded ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <Link href={`/creator-pool/${creator.id}`} className="font-bold text-[16px] hover:text-indigo-600 hover:underline transition-colors">
                          @{creator.username}
                        </Link>
                      </div>
                      
                      {/* Summary Metrics */}
                      <div className="ml-auto hidden md:flex items-center gap-4 lg:gap-6 text-sm">
                        <div className="text-center px-2 lg:px-4 border-l border-slate-200">
                          <p className="text-[10px] text-slate-500 font-medium">SOW VT</p>
                          <p className="font-bold text-slate-700">{cc.qty_vt}</p>
                        </div>
                        <div className="text-center px-2 lg:px-4 border-l border-slate-200">
                          <p className="text-[10px] text-slate-500 font-medium">TOTAL VT</p>
                          <p className="font-bold text-slate-700">{m?.uploadedVtCount ?? creatorVideos.filter((v: any) => v.link_video).length}</p>
                        </div>
                        <div className="text-center px-2 lg:px-4 border-l border-slate-200">
                          <p className="text-[10px] text-emerald-600 font-medium">TOTAL GMV</p>
                          <p className="font-bold text-emerald-700">Rp {m?.totalGmv?.toLocaleString('id-ID') || 0}</p>
                        </div>
                        <div className="text-center px-2 lg:px-4 border-l border-slate-200">
                          <p className="text-[10px] text-slate-500 font-medium">TOTAL VIEWS</p>
                          <p className="font-bold text-slate-700">{m?.totalViews?.toLocaleString('id-ID') || 0}</p>
                        </div>
                        <div className="text-center px-2 lg:px-4 border-l border-slate-200">
                          <p className="text-[10px] text-slate-500 font-medium">TOTAL LIKES</p>
                          <p className="font-bold text-slate-700">{m?.totalLikes?.toLocaleString('id-ID') || 0}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-[10px]" onClick={e => e.stopPropagation()}>
                      {hasAccess && (
                        <>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleAddVideoRow(cc.id); if(!isExpanded) toggleGroup(cc.id); }}
                            className="btn btn-outline"
                          >
                            + Tambah Baris
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleSaveVT(cc.id); }}
                            disabled={saving[cc.id]}
                            className="btn btn-primary"
                          >
                            {saving[cc.id] ? <Loader2 className="ico animate-spin" /> : <Save className="ico" />}
                            {saving[cc.id] ? 'Menyimpan...' : 'Simpan Perubahan'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="p-[16px]">
                      <div className="tbl-wrap">

                      <table className="w-full">
                        <thead>
                          <tr>
                            <th className="w-16 text-center">Urutan</th>
                            <th className={isAwareness ? "w-1/3" : "w-1/4"}>{isAwareness ? "Konsep / Ide SOW" : "Konsep / Ide"}</th>
                            <th className="p-3 font-semibold text-slate-500 text-xs w-32 text-center">Tanggal Posting</th>
                            <th className={isAwareness ? "w-1/3" : "w-1/4"}>Link Video TikTok</th>
                            <th>Performa</th>
                            <th>Produk</th>
                          </tr>
                        </thead>
                        <tbody>
                          {creatorVideos.map((v) => {
                            const warningShortLink = !isAwareness && isShortLink(v.link_video);
                            const extractedMatch = v.link_video?.match(/video\/(\d+)/);
                            const dynamicContentUid = extractedMatch ? extractedMatch[1] : v.content_uid;
                            const hasContentUid = !!dynamicContentUid;

                            // Calculate metrics for this specific video
                            let vidGmv = 0;
                            let vidViews = 0;
                            let vidLikes = 0;

                            if (hasContentUid) {
                               const vStats = cc._videoStats || [];
                               const rawUid = dynamicContentUid.replace(/^video_/, '');
                               const matchingStat = vStats.find((s: any) => {
                                 const sUid = s.content_uid ? s.content_uid.replace(/^video_/, '') : '';
                                 return s.content_uid === dynamicContentUid || sUid === rawUid;
                               });
                               if (matchingStat) {
                                  vidGmv = matchingStat.gmv || 0;
                                  vidViews = matchingStat.views || 0;
                                  vidLikes = matchingStat.likes || 0;
                               }
                            }

                            const rpm = vidViews > 0 ? (vidGmv / vidViews) * 1000 : 0;
                            let cleanConcept = v.concept;
                            if (typeof cleanConcept === 'string' && cleanConcept.includes('Auto-detected')) {
                              cleanConcept = null;
                            }
                            const conceptNum = parseInt(cleanConcept);
                            const matchedConcept = !isNaN(conceptNum) ? masterConcepts.find((c: any) => c.no_konsep === conceptNum) : null;
                            const isConceptError = cleanConcept && !matchedConcept && masterConcepts.length > 0;

                            let resolvedCreatorSkuId = v.sku_id;
                            if (!resolvedCreatorSkuId && hasContentUid) {
                              const vStats = cc._videoStats || [];
                              const rawUid = dynamicContentUid.replace(/^video_/, '');
                              const matchingStat = vStats.find((s: any) => {
                                const sUid = s.content_uid ? s.content_uid.replace(/^video_/, '') : '';
                                return s.content_uid === dynamicContentUid || sUid === rawUid;
                              });
                              if (matchingStat?.product_id) {
                                const matchedSku = skus.find((s: any) => s.product_id === matchingStat.product_id && s.campaign_id === campaignId);
                                if (matchedSku) resolvedCreatorSkuId = matchedSku.id;
                              }
                            }
                            if (!resolvedCreatorSkuId && cc.assigned_sku_ids && cc.assigned_sku_ids.length === 1) {
                              resolvedCreatorSkuId = cc.assigned_sku_ids[0];
                            }

                            return (
                              <tr key={v.urutan}>
                                <td className="font-semibold text-center">{v.urutan}</td>
                                <td>
                                  <div className="flex flex-col gap-1.5 pr-2 min-w-[220px] max-w-[320px]">
                                    {masterConcepts.length === 0 ? (
                                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-tight flex items-start gap-1.5 shadow-sm">
                                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                        <div className="flex flex-col gap-0.5">
                                          <span className="font-medium">Belum ada konsep di master konsep campaign ini.</span>
                                          <Link 
                                            href={`/campaigns/${campaignId}/concepts`}
                                            className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-1"
                                          >
                                            + Tambah di Menu Konsep
                                          </Link>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5">
                                        <div className="relative flex-1">
                                          <select
                                            className={`select select-sm w-full text-[12px] font-medium rounded-lg border shadow-sm transition-all focus:ring-1 ${
                                              isConceptError 
                                                ? 'border-red-400 bg-red-50 text-red-900 focus:ring-red-400' 
                                                : matchedConcept 
                                                  ? 'border-indigo-200 bg-indigo-50/50 text-slate-800 focus:border-indigo-400 focus:ring-indigo-400' 
                                                  : 'border-slate-200 bg-white text-slate-600 focus:border-slate-400'
                                            }`}
                                            value={cleanConcept || ''}
                                            onChange={(e) => handleVideoChange(cc.id, v.urutan, 'concept', e.target.value)}
                                            disabled={!hasAccess || v.vt_approval === 'approved'}
                                            title={v.vt_approval === 'approved' ? "Tidak bisa diubah karena VT sudah di-approve" : "Pilih konsep"}
                                          >
                                            <option value="">- (Belum Dipilih)</option>
                                            {cleanConcept && !matchedConcept && (
                                              <option value={cleanConcept}>
                                                [Custom] {cleanConcept}
                                              </option>
                                            )}
                                            {[...masterConcepts]
                                              .sort((a: any, b: any) => (Number(a.no_konsep) || 0) - (Number(b.no_konsep) || 0))
                                              .map((c: any) => {
                                                const sku = skus.find((s: any) => s.id === c.sku_id);
                                                const productLabel = sku?.nama_produk || c.skus?.nama_produk || 'Semua Produk';
                                                const optionLabel = `No. ${c.no_konsep} - ${productLabel} - ${c.judul_konsep || 'Tanpa Judul'}`;
                                                return (
                                                  <option key={c.id || c.no_konsep} value={String(c.no_konsep)}>
                                                    {optionLabel}
                                                  </option>
                                                );
                                              })}
                                          </select>
                                        </div>

                                        {matchedConcept && (
                                          <button
                                            type="button"
                                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 hover:border-indigo-200 transition-colors shrink-0 shadow-sm"
                                            onClick={() => setSelectedConcept(matchedConcept)}
                                            title="Lihat Detail Brief Konsep"
                                          >
                                            <Info className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    )}

                                    {isConceptError && (
                                      <p className="text-[10px] text-red-500 font-medium leading-tight">
                                        Konsep belum ada di master konsep campaign ini.
                                      </p>
                                    )}

                                    {v.concept && v.concept_updated_at && v.concept_updated_by ? (
                                      <p className="text-[10px] text-slate-400 leading-tight">
                                        Diinput pd {formatDateTimeShort(v.concept_updated_at)} <br/>
                                        Oleh: <span className="font-medium text-slate-500">{v.concept_updated_by}</span>
                                      </p>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="p-3 align-middle text-center">
                                  {v.post_time ? (
                                    <span className="text-[13px] font-medium text-slate-700 whitespace-nowrap">{formatDateTimeShort(v.post_time)}</span>
                                  ) : (
                                    <span className="text-slate-400 italic text-[12px]">-</span>
                                  )}
                                </td>
                                <td>
                                  <div className="space-y-[8px]">
                                    <div className="flex items-center gap-2">
                                      <button 
                                        className={`btn btn-soft p-0 flex items-center justify-center h-10 w-10 flex-shrink-0 ${v.link_video ? 'text-indigo-600 hover:bg-indigo-100' : 'text-slate-400'}`}
                                        title={v.link_video ? "Tonton Video" : "Link video belum diisi"}
                                        disabled={!v.link_video}
                                        onClick={() => {
                                          if(v.link_video) {
                                            setPreviewUrl(v.link_video);
                                            setPreviewOpen(true);
                                          }
                                        }}
                                      >
                                        <PlayCircle className="w-5 h-5" />
                                      </button>
                                      <a
                                        href={v.link_video || '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`btn btn-soft p-0 flex items-center justify-center h-10 w-10 flex-shrink-0 ${v.link_video ? 'text-indigo-600 hover:bg-indigo-100' : 'text-slate-400 pointer-events-none'}`}
                                        title={v.link_video ? "Buka di Tab Baru" : "Link video belum diisi"}
                                      >
                                        <ExternalLink className="w-4 h-4" />
                                      </a>
                                      <div className="relative flex-grow">
                                        <LinkIcon className="w-4 h-4 absolute left-[10px] top-[10px] text-text-soft" />
                                        <input 
                                          type="text"
                                          className={`input !pl-[34px] ${warningShortLink ? 'border-amber-400 bg-amber-50' : ''}`}
                                          placeholder={isAwareness ? "https://..." : "https://www.tiktok.com/@..."}
                                          value={v.link_video || ''}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            handleVideoChange(cc.id, v.urutan, 'link_video', val);
                                            if (isShortLink(val)) {
                                              convertShortLink(cc.id, v.urutan, val, cc.creators.username);
                                            }
                                          }}
                                          disabled={!hasAccess || expandingLinks[`${cc.id}_${v.urutan}`]}
                                        />
                                        {expandingLinks[`${cc.id}_${v.urutan}`] && <Loader2 className="w-4 h-4 absolute right-[10px] top-[10px] animate-spin text-indigo-500" />}
                                      </div>
                                    </div>
                                    {warningShortLink && (
                                      <p className="text-[11px] text-amber-600 flex items-start gap-[4px]">
                                        <AlertCircle className="w-3 h-3 shrink-0 mt-[2px]" />
                                        Sistem tidak bisa melacak GMV dari link pendek (vt.tiktok.com). Harap buka link ini di PC lalu copy link panjangnya.
                                      </p>
                                    )}
                                    {v.link_video && !warningShortLink && !hasContentUid && !isAwareness && (
                                      <p className="text-[11px] text-red-500 flex items-start gap-[4px]">
                                        <AlertCircle className="w-3 h-3 shrink-0 mt-[2px]" />
                                        Format link salah. Content ID (19 digit) tidak ditemukan.
                                      </p>
                                    )}
                                    {hasContentUid && !isAwareness && (
                                      <div className="flex flex-col gap-[4px]">
                                        <p className="text-[11px] text-green-600 flex items-center gap-[4px]">
                                          ✓ Terhubung dengan Content ID: {dynamicContentUid}
                                        </p>
                                      </div>
                                    )}
                                    {hasContentUid && (
                                      <div className="mt-2 grid grid-cols-4 gap-1 bg-slate-50 border border-slate-200 p-2 rounded-md text-xs">
                                         <div className="text-center">
                                            <div className="text-slate-400 text-[10px]">Views</div>
                                            <div className="font-semibold text-slate-700">{vidViews.toLocaleString('id-ID')}</div>
                                         </div>
                                         <div className="text-center border-l border-slate-200">
                                            <div className="text-slate-400 text-[10px]">Likes</div>
                                            <div className="font-semibold text-slate-700">{vidLikes.toLocaleString('id-ID')}</div>
                                         </div>
                                         <div className="text-center border-l border-slate-200">
                                            <div className="text-slate-400 text-[10px]">GMV</div>
                                            <div className="font-semibold text-emerald-600">Rp {vidGmv.toLocaleString('id-ID')}</div>
                                         </div>
                                         <div className="text-center border-l border-slate-200" title="GMV Per Mille (Per 1000 Views)">
                                            <div className="text-slate-400 text-[10px]">GPM</div>
                                            <div className="font-semibold text-indigo-600">Rp {Math.round(rpm).toLocaleString('id-ID')}</div>
                                         </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <div className="font-semibold text-[15px] text-emerald-600">
                                    {hasContentUid ? (
                                      `Rp ${vidGmv.toLocaleString('id-ID')}`
                                    ) : (
                                      <span className="text-text-soft text-[13px] font-normal">Belum ada GMV</span>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <select 
                                    className="select w-full"
                                    value={v.sku_id || resolvedCreatorSkuId || ''}
                                    onChange={(e) => handleVideoChange(cc.id, v.urutan, 'sku_id', e.target.value)}
                                    disabled={!hasAccess}
                                  >
                                    <option value="">Pilih Produk...</option>
                                    {skus.filter(s => s.campaign_id === campaignId).map(s => (
                                      <option key={s.id} value={s.id}>{s.nama_produk || s.product_id}</option>
                                    ))}
                                  </select>
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
              );
            })}
            
            {hasMoreClient && (
              <div className="flex justify-center mt-[24px]">
                <button onClick={() => setClientPage(p => p + 1)} className="btn btn-outline">
                  <ChevronDown className="ico" />
                  Tampilkan Lebih Banyak
                </button>
              </div>
            )}
          </div>
        ) : (viewMode === 'video' || viewMode === 'date') ? (
          <div className="overflow-x-auto pb-[24px]">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr>
                  <th className="p-4 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">Kreator</th>
                  <th className="p-4 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">Konsep</th>
                  <th className="p-4 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 text-center">Tanggal Posting</th>
                  <th className="p-4 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 w-[300px]">Link Video TikTok</th>
                  <th className="p-4 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">Produk</th>
                  <th className="p-4 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">GMV & GPM</th>
                  <th className="p-4 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">Views & Likes</th>
                  <th className="p-4 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 rounded-tr-xl">Aksi</th>
                </tr>
              </thead>
              <tbody className={isFiltering ? "opacity-50 transition-opacity" : "transition-opacity"}>
                {visibleVideosData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-text-soft">
                      Tidak ada video yang ditemukan.
                    </td>
                  </tr>
                ) : (
                  visibleVideosData.map(v => {
                    const warningShortLink = v.link_video?.includes('vt.tiktok.com');
                    const conceptNum = parseInt(v.concept);
                    const matchedConcept = !isNaN(conceptNum) ? masterConcepts.find((c: any) => c.no_konsep === conceptNum) : null;
                    const isConceptError = v.concept && !matchedConcept && masterConcepts.length > 0;
                    return (
                    <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="p-4 align-top">
                        <div>
                          <Link href={`/creator-pool/${v.creatorId}`} className="font-bold text-sm hover:text-indigo-600 hover:underline transition-colors">
                            @{v.creatorUsername}
                          </Link>
                        </div>
                        <div className="text-[11px] font-semibold text-slate-500 bg-slate-100 w-fit px-2 py-0.5 rounded mt-1">{v.creatorTier || 'Tier -'}</div>
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex flex-col gap-1.5 pr-2 min-w-[220px] max-w-[300px]">
                          {masterConcepts.length === 0 ? (
                            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-tight flex items-start gap-1.5 shadow-sm">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium">Belum ada konsep di master konsep campaign ini.</span>
                                <Link 
                                  href={`/campaigns/${campaignId}/concepts`}
                                  className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-1"
                                >
                                  + Tambah di Menu Konsep
                                </Link>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <div className="relative flex-1">
                                <select
                                  className={`select select-sm w-full text-[12px] font-medium rounded-lg border shadow-sm transition-all focus:ring-1 ${
                                    isConceptError 
                                      ? 'border-red-400 bg-red-50 text-red-900 focus:ring-red-400' 
                                      : matchedConcept 
                                        ? 'border-indigo-200 bg-indigo-50/50 text-slate-800 focus:border-indigo-400 focus:ring-indigo-400' 
                                        : 'border-slate-200 bg-white text-slate-600 focus:border-slate-400'
                                  }`}
                                  value={v.concept || ''}
                                  onChange={(e) => handleVideoChange(v.ccId, v.urutan, 'concept', e.target.value)}
                                  disabled={!hasAccess || v.vt_approval === 'approved'}
                                  title={v.vt_approval === 'approved' ? "Tidak bisa diubah karena VT sudah di-approve" : "Pilih konsep"}
                                >
                                  <option value="">- (Belum Dipilih)</option>
                                  {v.concept && !matchedConcept && (
                                    <option value={v.concept}>
                                      [Custom] {v.concept}
                                    </option>
                                  )}
                                  {[...masterConcepts]
                                    .sort((a: any, b: any) => (Number(a.no_konsep) || 0) - (Number(b.no_konsep) || 0))
                                    .map((c: any) => {
                                      const sku = skus.find((s: any) => s.id === c.sku_id);
                                      const productLabel = sku?.nama_produk || c.skus?.nama_produk || 'Semua Produk';
                                      const optionLabel = `No. ${c.no_konsep} - ${productLabel} - ${c.judul_konsep || 'Tanpa Judul'}`;
                                      return (
                                        <option key={c.id || c.no_konsep} value={String(c.no_konsep)}>
                                          {optionLabel}
                                        </option>
                                      );
                                    })}
                                </select>
                              </div>

                              {matchedConcept && (
                                <button
                                  type="button"
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 hover:border-indigo-200 transition-colors shrink-0 shadow-sm"
                                  onClick={() => setSelectedConcept(matchedConcept)}
                                  title="Lihat Detail Brief Konsep"
                                >
                                  <Info className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}

                          {isConceptError && (
                            <p className="text-[10px] text-red-500 font-medium leading-tight">
                              Konsep belum ada di master konsep campaign ini.
                            </p>
                          )}

                          {v.concept && v.concept_updated_at && v.concept_updated_by ? (
                            <p className="text-[9px] text-slate-400 leading-tight">
                              Diinput pd {formatDateTimeShort(v.concept_updated_at)} <br/>
                              Oleh: <span className="font-medium text-slate-500">{v.concept_updated_by}</span>
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-4 align-middle text-center">
                        {v.post_time ? (
                          <div className="flex flex-col items-center">
                            <span className="text-[13px] font-medium text-slate-700 whitespace-nowrap">
                              {formatDate(v.post_time)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(v.post_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[12px]">-</span>
                        )}
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex flex-col gap-2">
                           <div className="flex gap-2">
                              <button 
                                className="btn-icon bg-slate-100 shrink-0 hover:bg-slate-200 transition-colors" 
                                title="Putar Video"
                                onClick={() => {
                                  if(v.link_video) {
                                    setPreviewUrl(v.link_video);
                                    setPreviewOpen(true);
                                  }
                                }}
                              >
                                <PlayCircle className="w-5 h-5 text-indigo-600" />
                              </button>
                              <a
                                href={v.link_video || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`btn-icon bg-slate-100 shrink-0 hover:bg-slate-200 transition-colors flex items-center justify-center ${!v.link_video ? 'pointer-events-none opacity-50' : ''}`}
                                title="Buka di Tab Baru"
                              >
                                <ExternalLink className="w-4 h-4 text-indigo-600" />
                              </a>
                              <div className="relative flex-grow">
                                <LinkIcon className="w-4 h-4 absolute left-[10px] top-[10px] text-text-soft" />
                                <input 
                                  type="text"
                                  className={`input !pl-[34px] w-full text-[13px] ${warningShortLink ? 'border-amber-400 bg-amber-50' : ''}`}
                                  placeholder="https://www.tiktok.com/@..."
                                  value={v.link_video || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    handleVideoChange(v.ccId, v.urutan, 'link_video', val);
                                    if (isShortLink(val)) {
                                      convertShortLink(v.ccId, v.urutan, val, v.creatorUsername);
                                    }
                                  }}
                                  disabled={!hasAccess || expandingLinks[`${v.ccId}_${v.urutan}`]}
                                />
                                {expandingLinks[`${v.ccId}_${v.urutan}`] && <Loader2 className="w-4 h-4 absolute right-[10px] top-[10px] animate-spin text-indigo-500" />}
                              </div>
                           </div>
                           {warningShortLink && (
                              <p className="text-[11px] text-amber-600 flex items-start gap-[4px]">
                                <AlertCircle className="w-3 h-3 shrink-0 mt-[2px]" />
                                Sistem tidak bisa melacak GMV dari link pendek (vt.tiktok.com).
                              </p>
                           )}
                           {v.hasContentUid && (
                              <div className="flex flex-col gap-1">
                                <p className="text-[10px] text-emerald-600 font-medium">✓ Content ID: {v.dynamicContentUid}</p>
                              </div>
                           )}
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <select 
                          className="select w-full text-[13px]"
                          value={v.sku_id || ''}
                          onChange={(e) => handleVideoChange(v.ccId, v.urutan, 'sku_id', e.target.value)}
                          disabled={!hasAccess}
                        >
                          <option value="">Pilih Produk...</option>
                          {skus.filter(s => s.campaign_id === campaignId).map(s => (
                            <option key={s.id} value={s.id}>{s.nama_produk || s.product_id}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4 align-top">
                        <div className="font-bold text-emerald-700 text-[15px]">Rp {v.vidGmv.toLocaleString('id-ID')}</div>
                        {v.rpm > 0 && <div className="text-[11px] font-semibold text-indigo-600 mt-1 bg-indigo-50 px-2 py-0.5 rounded w-fit border border-indigo-100">GPM: Rp {Math.round(v.rpm).toLocaleString('id-ID')}</div>}
                      </td>
                      <td className="p-4 align-top">
                        <div className="font-semibold text-slate-700 text-sm">{v.vidViews.toLocaleString('id-ID')} <span className="text-[11px] font-normal text-slate-500">views</span></div>
                        <div className="text-[12px] text-slate-500 mt-0.5">{v.vidLikes.toLocaleString('id-ID')} <span className="text-[10px]">likes</span></div>
                      </td>
                      <td className="p-4 align-top">
                         {hasAccess && (
                           <button 
                             onClick={() => handleSaveVT(v.ccId)}
                             className="btn btn-primary text-xs w-full py-2 h-auto min-h-0 font-semibold shadow-sm"
                             disabled={saving[v.ccId]}
                           >
                             {saving[v.ccId] ? 'Menyimpan...' : 'Simpan'}
                           </button>
                        )}
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
            
            {hasMoreVideosClient && (
              <div className="flex justify-center mt-[24px]">
                <button onClick={() => setClientPage(p => p + 1)} className="btn btn-outline">
                  <ChevronDown className="ico" />
                  Tampilkan Lebih Banyak
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 pb-[24px]">
            {/* Summary Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <button 
                onClick={() => { setFilterDraftApproval('all'); setFilterDraftLink('all'); setFilterDraftTiktok('all'); }} 
                className={`p-3 rounded-xl border text-left transition-all ${filterDraftApproval === 'all' && filterDraftLink === 'all' && filterDraftTiktok === 'all' ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
              >
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Slot Video</div>
                <div className="text-xl font-bold text-slate-800 mt-1">{draftSummaryMetrics.total}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Semua slot SOW kreator</div>
              </button>

              <button 
                onClick={() => { setFilterDraftApproval('pending'); setFilterDraftLink('has_draft'); }} 
                className={`p-3 rounded-xl border text-left transition-all ${filterDraftApproval === 'pending' && filterDraftLink === 'has_draft' ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  Siap Di-Review
                </div>
                <div className="text-xl font-bold text-amber-800 mt-1">{draftSummaryMetrics.readyForReview}</div>
                <div className="text-[10px] text-amber-600 mt-0.5">Ada draft & status pending</div>
              </button>

              <button 
                onClick={() => { setFilterDraftApproval('approved'); setFilterDraftLink('all'); }} 
                className={`p-3 rounded-xl border text-left transition-all ${filterDraftApproval === 'approved' && filterDraftLink === 'all' ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
              >
                <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Approved</div>
                <div className="text-xl font-bold text-emerald-800 mt-1">{draftSummaryMetrics.approved}</div>
                <div className="text-[10px] text-emerald-600 mt-0.5">Siap di-upload kreator</div>
              </button>

              <button 
                onClick={() => { setFilterDraftApproval('revisi'); setFilterDraftLink('all'); }} 
                className={`p-3 rounded-xl border text-left transition-all ${filterDraftApproval === 'revisi' ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
              >
                <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Perlu Revisi</div>
                <div className="text-xl font-bold text-rose-800 mt-1">{draftSummaryMetrics.revisi}</div>
                <div className="text-[10px] text-rose-600 mt-0.5">Harus diperbaiki kreator</div>
              </button>

              <button 
                onClick={() => { setFilterDraftApproval('all'); setFilterDraftLink('no_draft'); }} 
                className={`p-3 rounded-xl border text-left transition-all ${filterDraftLink === 'no_draft' ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
              >
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Belum Setor Draft</div>
                <div className="text-xl font-bold text-slate-700 mt-1">{draftSummaryMetrics.noDraft}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Menunggu input PIC</div>
              </button>
            </div>

            {/* Draft Video Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500">
                    <th className="p-4 w-12 text-center">#</th>
                    <th className="p-4 min-w-[180px]">Kreator</th>
                    <th className="p-4 w-28">Konsep</th>
                    <th className="p-4 min-w-[280px]">Link Draft Video (GDrive)</th>
                    <th className="p-4 min-w-[240px]">Link Final (TikTok)</th>
                    <th className="p-4 min-w-[180px]">VT Approval (Manager)</th>
                    <th className="p-4 min-w-[240px]">Notes Revisi</th>
                    <th className="p-4 w-28 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className={isFiltering ? "opacity-50 transition-opacity" : "transition-opacity"}>
                  {visibleDraftsData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400 italic">
                        Tidak ada draft video yang cocok dengan filter yang dipilih.
                      </td>
                    </tr>
                  ) : (
                    visibleDraftsData.map((v) => {
                      const hasDriveDraft = Boolean(v.link_draft && extractGDriveId(v.link_draft));
                      const conceptNum = parseInt(v.concept);
                      const matchedConcept = !isNaN(conceptNum) ? masterConcepts.find((c: any) => c.no_konsep === conceptNum) : null;
                      const isConceptError = v.concept && !matchedConcept && masterConcepts.length > 0;
                      const gdriveId = extractGDriveId(v.link_draft);

                      return (
                        <tr key={`${v.ccId}_${v.urutan}`} className="border-b border-slate-100 hover:bg-slate-50/60 align-top transition-colors">
                          <td className="p-4 text-center">
                            <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-bold">
                              #{v.urutan}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Link href={`/creator-pool/${v.creatorId}`} className="font-bold text-sm text-indigo-700 hover:underline">
                                @{v.creatorUsername}
                              </Link>
                              {v.creatorTier && (
                                <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {v.creatorTier}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              {v.creatorLink && (
                                <a href={v.creatorLink} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity shrink-0" title="Buka Profil TikTok">
                                  <img src="/logo-tiktok-landscape-button.svg" alt="TikTok" className="h-[18px]" />
                                </a>
                              )}
                              {v.creatorContact && (
                                <a 
                                  href={`https://wa.me/${v.creatorContact.replace(/^0/, '62').replace(/\D/g, '')}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-[10px] text-emerald-700 hover:underline flex items-center gap-1 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200"
                                  title="Chat WhatsApp"
                                >
                                  WA: {v.creatorContact}
                                </a>
                              )}
                            </div>
                          </td>

                          {/* Konsep */}
                          <td className="p-4 align-top">
                            <div className="flex flex-col gap-1.5 pr-2 min-w-[220px] max-w-[300px]">
                              {masterConcepts.length === 0 ? (
                                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-tight flex items-start gap-1.5 shadow-sm">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-medium">Belum ada konsep di master konsep campaign ini.</span>
                                    <Link 
                                      href={`/campaigns/${campaignId}/concepts`}
                                      className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-1"
                                    >
                                      + Tambah di Menu Konsep
                                    </Link>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <div className="relative flex-1">
                                    <select
                                      className={`select select-sm w-full text-[12px] font-medium rounded-lg border shadow-sm transition-all focus:ring-1 ${
                                        isConceptError 
                                          ? 'border-red-400 bg-red-50 text-red-900 focus:ring-red-400' 
                                          : matchedConcept 
                                            ? 'border-indigo-200 bg-indigo-50/50 text-slate-800 focus:border-indigo-400 focus:ring-indigo-400' 
                                            : 'border-slate-200 bg-white text-slate-600 focus:border-slate-400'
                                      }`}
                                      value={v.concept || ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (hasAccess && val !== (v.concept || '')) {
                                          handleUpdateSingleVideoField(v.ccId, v, { 
                                            concept: val,
                                            concept_updated_at: new Date().toISOString(),
                                            concept_updated_by: profile?.nama || 'System'
                                          });
                                        }
                                      }}
                                      disabled={!hasAccess || v.vt_approval === 'approved'}
                                    >
                                      <option value="">- (Belum Dipilih)</option>
                                      {v.concept && !matchedConcept && (
                                        <option value={v.concept}>
                                          [Custom] {v.concept}
                                        </option>
                                      )}
                                      {[...masterConcepts]
                                        .sort((a: any, b: any) => (Number(a.no_konsep) || 0) - (Number(b.no_konsep) || 0))
                                        .map((c: any) => {
                                          const sku = skus.find((s: any) => s.id === c.sku_id);
                                          const productLabel = sku?.nama_produk || c.skus?.nama_produk || 'Semua Produk';
                                          const optionLabel = `No. ${c.no_konsep} - ${productLabel} - ${c.judul_konsep || 'Tanpa Judul'}`;
                                          return (
                                            <option key={c.id || c.no_konsep} value={String(c.no_konsep)}>
                                              {optionLabel}
                                            </option>
                                          );
                                        })}
                                    </select>
                                  </div>

                                  {matchedConcept && (
                                    <button
                                      type="button"
                                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 hover:border-indigo-200 transition-colors shrink-0 shadow-sm"
                                      onClick={() => setSelectedConcept(matchedConcept)}
                                      title="Lihat Detail Brief Konsep"
                                    >
                                      <Info className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}

                              {isConceptError && (
                                <p className="text-[10px] text-red-500 font-medium leading-tight">
                                  Konsep belum ada di master konsep campaign ini.
                                </p>
                              )}

                              {v.concept && v.concept_updated_at && v.concept_updated_by ? (
                                <p className="text-[9px] text-slate-400 leading-tight">
                                  {formatDateTimeShort(v.concept_updated_at)} ({v.concept_updated_by})
                                </p>
                              ) : null}
                            </div>
                          </td>

                          {/* Link Draft Video GDrive */}
                          <td className="p-4">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-1.5">
                                {hasDriveDraft && (
                                  <button
                                    type="button"
                                    onClick={() => setPlayingDriveId(gdriveId)}
                                    className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-md transition-colors shrink-0 flex items-center gap-1"
                                    title="Putar Video Draft di Aplikasi"
                                  >
                                    <PlayCircle className="w-4 h-4" />
                                    <span className="text-[11px] font-semibold">Tonton</span>
                                  </button>
                                )}
                                {v.link_draft && (
                                  <a 
                                    href={v.link_draft} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-md transition-colors shrink-0" 
                                    title="Buka Link GDrive di Tab Baru"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                )}
                                <div className="flex-1">
                                  {hasAccess && v.vt_approval !== 'approved' ? (
                                    <input 
                                      key={`draft_input_${v.ccId}_${v.urutan}_${v.id || 'new'}`}
                                      type="text" 
                                      className="input w-full !text-[12px] !p-1.5"
                                      placeholder="Tempel link GDrive..."
                                      defaultValue={v.link_draft || ''}
                                      onBlur={(e) => {
                                        const val = e.target.value.trim();
                                        if (val !== (v.link_draft || '')) {
                                          handleUpdateSingleVideoField(v.ccId, v, { link_draft: val });
                                        }
                                      }}
                                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                    />
                                  ) : (
                                    v.link_draft ? (
                                      <a href={v.link_draft} target="_blank" rel="noreferrer" className="text-[12px] text-indigo-600 hover:underline break-all">
                                        {v.link_draft}
                                      </a>
                                    ) : <span className="text-slate-300 italic text-[12px]">- Belum diisi -</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Link Final TikTok */}
                          <td className="p-4">
                            {v.link_video ? (
                              <div className="flex items-center gap-2">
                                <button 
                                  className="btn-icon bg-slate-100 shrink-0 hover:bg-slate-200 transition-colors" 
                                  title="Putar Video TikTok"
                                  onClick={() => {
                                    setPreviewUrl(v.link_video);
                                    setPreviewOpen(true);
                                  }}
                                >
                                  <PlayCircle className="w-4 h-4 text-indigo-600" />
                                </button>
                                <a
                                  href={v.link_video}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[12px] text-indigo-600 hover:underline break-all truncate max-w-[180px]"
                                  title={v.link_video}
                                >
                                  {v.link_video}
                                </a>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs italic bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                Belum upload
                              </span>
                            )}
                          </td>

                          {/* VT Approval (Manager & Executive) */}
                          <td className="p-4">
                            {canManageRevisionNotes ? (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <select 
                                    className={`select !p-1.5 w-[125px] font-bold !text-[12px] border rounded-md shadow-sm transition-colors ${
                                      v.vt_approval === 'approved' ? 'text-emerald-700 bg-emerald-50 border-emerald-300' :
                                      v.vt_approval === 'revisi' ? 'text-rose-700 bg-rose-50 border-rose-300' :
                                      'text-amber-700 bg-amber-50 border-amber-300'
                                    }`}
                                    value={v.vt_approval || 'pending'}
                                    disabled={savingFields[`${v.ccId}_${v.urutan}`]}
                                    onChange={(e) => handleVtApprovalChange(v, e.target.value)}
                                  >
                                    <option value="pending">⏳ Pending</option>
                                    <option value="approved">✅ Approved</option>
                                    <option value="revisi">🔄 Revisi</option>
                                  </select>
                                  {savingFields[`${v.ccId}_${v.urutan}`] && (
                                    <div className="flex items-center gap-1.5 text-[10px] text-indigo-700 font-semibold animate-pulse bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 shrink-0">
                                      <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                                      <span>Menyimpan ke database...</span>
                                    </div>
                                  )}
                                </div>
                                
                                {v.vt_approved_by ? (
                                  <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                                    Oleh: <span className="font-semibold text-slate-700">{v.vt_approved_by}</span>
                                    {v.vt_approved_at && (
                                      <div className="text-[9px] text-slate-400">
                                        {new Date(v.vt_approved_at).toLocaleDateString('id-ID', {
                                          day: 'numeric',
                                          month: 'short',
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">Belum di-review</span>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <span className={`badge ${v.vt_approval === 'approved' ? 'b-success' : v.vt_approval === 'revisi' ? 'b-warning' : 'b-neutral'}`}>
                                  {v.vt_approval === 'approved' ? 'Approved' : v.vt_approval === 'revisi' ? 'Revisi' : 'Pending'}
                                </span>
                                {v.vt_approved_by && (
                                  <span className="text-[10px] text-slate-400">Oleh: {v.vt_approved_by}</span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Notes Revisi */}
                          <td className="p-4 align-top">
                            {(() => {
                              const isSavingNote = savingFields[`${v.ccId}_${v.urutan}_note`] || savingFields[`${v.campaign_creator_id}_${v.urutan}_note`];
                              const revNote = revisionNotes[`${v.ccId}_${v.urutan}`] || revisionNotes[`${v.campaign_creator_id}_${v.urutan}`];
                              const noteContent = revNote?.isi || revNote?.notes || v.revision_notes || '';
                              const noteAuthor = revNote?.author_name || revNote?.updated_by || v.revision_notes_updated_by || 'Manager';
                              const noteDate = revNote?.updated_at || revNote?.created_at || v.revision_notes_updated_at;
                              const isRevisiStatus = v.vt_approval === 'revisi';

                              if (isSavingNote) {
                                return (
                                  <div className="p-2.5 rounded-lg border border-rose-300 bg-rose-50 text-xs flex items-center gap-2 text-rose-700 font-semibold shadow-sm animate-pulse">
                                    <Loader2 className="w-4 h-4 animate-spin text-rose-600 shrink-0" />
                                    <span>Sedang menyimpan catatan ke database...</span>
                                  </div>
                                );
                              }

                              if (noteContent && noteContent.trim() !== '') {
                                return (
                                  <div className={`p-2.5 rounded-lg border text-xs shadow-sm transition-all ${
                                    isRevisiStatus 
                                      ? 'bg-rose-50/80 border-rose-200 text-rose-950' 
                                      : 'bg-amber-50/60 border-amber-200 text-slate-800'
                                  }`}>
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                        isRevisiStatus ? 'text-rose-700' : 'text-amber-700'
                                      }`}>
                                        {isRevisiStatus ? 'Catatan Revisi' : 'Riwayat Revisi'}
                                      </span>
                                      {canManageRevisionNotes && (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenRevisionModal(v)}
                                          className="text-slate-400 hover:text-slate-700 p-0.5 hover:bg-white/80 rounded transition-colors"
                                          title="Edit Catatan Revisi (Manager / Eksekutif)"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                    <p className="whitespace-pre-wrap text-[12px] leading-relaxed break-words font-medium">
                                      {noteContent}
                                    </p>
                                    {(noteAuthor || noteDate) && (
                                      <div className="text-[9px] text-slate-500 mt-1.5 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                                        <span>Oleh: <strong className="text-slate-700">{noteAuthor}</strong></span>
                                        {noteDate && <span>{formatDateTimeShort(noteDate)}</span>}
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              if (isRevisiStatus) {
                                return (
                                  <div>
                                    {canManageRevisionNotes ? (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenRevisionModal(v)}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 transition-colors shadow-sm"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Tulis Catatan Revisi</span>
                                      </button>
                                    ) : (
                                      <span className="text-xs text-rose-600 italic">Menunggu catatan revisi manager</span>
                                    )}
                                  </div>
                                );
                              }

                              return (
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-300 text-xs italic">-</span>
                                  {canManageRevisionNotes && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenRevisionModal(v)}
                                      className="opacity-0 hover:opacity-100 group-hover:opacity-100 text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded transition-opacity"
                                      title="Tambah Catatan Revisi"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          {/* Status */}
                          <td className="p-4 text-center">
                            {v.link_video ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Selesai
                              </span>
                            ) : v.vt_approval === 'approved' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                <Clock className="w-3 h-3 text-blue-600" /> Siap Post
                              </span>
                            ) : v.link_draft ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" /> Review
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                Draft Kosong
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {hasMoreDrafts && (
              <div className="flex justify-center mt-[24px]">
                <button onClick={() => setClientPage(p => p + 1)} className="btn btn-outline">
                  <ChevronDown className="ico" />
                  Tampilkan Lebih Banyak ({visibleDraftsData.length} dari {processedDraftsData.length})
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[400px] p-0 overflow-hidden bg-black/95 border-none">
          <div className="relative">
            <button 
              onClick={() => setPreviewOpen(false)}
              className="absolute top-2 right-2 z-50 p-2 bg-black/50 hover:bg-black text-white rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-full min-h-[500px] flex items-center justify-center bg-black pt-12 pb-4 px-4 overflow-y-auto max-h-[85vh]" ref={previewRef}>
              {previewUrl && (() => {
                const match = previewUrl.match(/video\/(\d+)/);
                const videoId = match ? match[1] : '';
                return videoId ? (
                  <iframe 
                    src={`https://www.tiktok.com/player/v1/${videoId}?music_info=1&description=1`}
                    className="w-full h-[600px] max-w-[325px] rounded-lg"
                    allow="fullscreen"
                    title="TikTok Video Player"
                  ></iframe>
                ) : (
                  <p className="text-white text-sm">ID Video tidak valid</p>
                );
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <div className="p-6 border-b border-line shrink-0">
            <h2 className="text-xl font-bold">Bulk Import Link Video</h2>
            <p className="text-sm text-text-soft mt-1">Paste puluhan link video (termasuk vt.tiktok.com) dari Excel. Sistem akan otomatis konversi dan deteksi pemilik video.</p>
          </div>
          
          <div className="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Paste Link di Sini (Satu baris per link)</label>
              <textarea 
                className="input w-full min-h-[150px] font-mono text-sm leading-relaxed" 
                placeholder="https://vt.tiktok.com/ZSxxxx/&#10;https://www.tiktok.com/@creator/video/123456789"
                value={bulkInput}
                onChange={e => setBulkInput(e.target.value)}
                disabled={bulkProcessing}
              />
            </div>
            
            <div className="flex justify-end">
              <button 
                onClick={handleProcessBulk} 
                disabled={!bulkInput.trim() || bulkProcessing}
                className="btn btn-primary"
              >
                {bulkProcessing && bulkResults.length === 0 ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {bulkProcessing ? `Memproses ${bulkProgress}/${bulkTotal} Link...` : `Proses ${bulkInput.split('\n').filter(l => l.trim()).length} Link`}
              </button>
            </div>
            
            {bulkResults.length > 0 && (
              <div className="ccard !p-0 overflow-hidden bg-white border border-slate-200">
                <div className="p-4 border-b border-line flex justify-between items-center bg-slate-100">
                  <h3 className="font-semibold text-sm">Hasil Verifikasi</h3>
                  <div className="flex gap-4 text-xs font-medium">
                    <span className="text-emerald-600">✅ {bulkResults.filter(r => r.status === 'valid').length} Valid</span>
                    <span className="text-red-600">❌ {bulkResults.filter(r => r.status !== 'valid').length} Invalid/Duplikat</span>
                  </div>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 sticky top-0 shadow-sm">
                      <tr>
                        <th className="p-3 font-semibold w-[40%]">Original Link</th>
                        <th className="p-3 font-semibold">Kreator</th>
                        <th className="p-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {bulkResults.map((r, i) => (
                        <tr key={i} className={r.status === 'valid' ? 'bg-emerald-50/30' : 'bg-red-50/30'}>
                          <td className="p-3">
                            <div className="font-mono text-[11px] truncate max-w-[300px] text-slate-700" title={r.original}>{r.original}</div>
                            {r.expanded && r.expanded !== r.original && (
                              <div className="font-mono text-[10px] text-text-soft truncate max-w-[300px] mt-1" title={r.expanded}>→ {r.expanded}</div>
                            )}
                          </td>
                          <td className="p-3">
                            {r.username ? <span className="font-medium text-[12px] text-slate-700">@{r.username}</span> : <span className="text-slate-400 italic text-[12px]">-</span>}
                          </td>
                          <td className="p-3">
                            {r.status === 'valid' ? (
                              <span className="text-emerald-600 font-medium text-[11px] flex items-center gap-1">
                                ✅ Siap ditambahkan
                              </span>
                            ) : (
                              <span className="text-red-600 font-medium text-[11px] flex items-center gap-1">
                                ❌ {r.message}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          
          <div className="p-6 border-t border-line flex justify-between items-center bg-white shrink-0">
             <button onClick={() => setBulkImportOpen(false)} className="btn btn-outline">Tutup</button>
             {bulkResults.filter(r => r.status === 'valid').length > 0 && (
               <button 
                  onClick={handleSaveBulk} 
                  disabled={bulkProcessing}
                  className="btn btn-primary"
               >
                 {bulkProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                 Simpan {bulkResults.filter(r => r.status === 'valid').length} Link ke Database
               </button>
             )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white">
          <div className="p-6 border-b border-line flex justify-between items-center bg-white shrink-0">
            <h2 className="text-xl font-bold">Aktivitas Import Video Terbaru</h2>
            <button onClick={() => setHistoryOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          
          <div className="flex-1 overflow-auto bg-slate-50 p-6">
            <div className="ccard !p-0 overflow-hidden bg-white border border-slate-200">
              <div className="p-4 border-b border-line flex justify-between items-center bg-slate-100">
                <div className="flex items-center gap-4">
                  <h3 className="font-semibold text-sm">Riwayat Upload</h3>
                  <span className="text-xs text-text-soft">Total: {historyVideos.length} video</span>
                </div>
                {selectedHistoryIds.size > 0 && (
                  <button 
                    onClick={handleDeleteHistoryBatch}
                    disabled={deletingHistory}
                    className="btn bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 text-xs py-1.5 px-3 flex items-center gap-1"
                  >
                    {deletingHistory ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    Hapus Terpilih & Simpan ({selectedHistoryIds.size})
                  </button>
                )}
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-line">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-primary focus:ring-primary"
                        checked={paginatedHistoryVideos.length > 0 && selectedHistoryIds.size === paginatedHistoryVideos.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const newSet = new Set(selectedHistoryIds);
                            paginatedHistoryVideos.forEach(v => newSet.add(v.id));
                            setSelectedHistoryIds(newSet);
                          } else {
                            const newSet = new Set(selectedHistoryIds);
                            paginatedHistoryVideos.forEach(v => newSet.delete(v.id));
                            setSelectedHistoryIds(newSet);
                          }
                        }}
                      />
                    </th>
                    <th className="p-3 font-semibold">Waktu Masuk</th>
                    <th className="p-3 font-semibold">Kreator</th>
                    <th className="p-3 font-semibold">Link Video</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {paginatedHistoryVideos.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500 italic">Belum ada riwayat video.</td>
                    </tr>
                  ) : paginatedHistoryVideos.map((v, i) => (
                    <tr key={v.id} className="hover:bg-slate-50/50">
                      <td className="p-3 text-center">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-primary focus:ring-primary"
                          checked={selectedHistoryIds.has(v.id)}
                          onChange={(e) => {
                            const newSet = new Set(selectedHistoryIds);
                            if (e.target.checked) newSet.add(v.id);
                            else newSet.delete(v.id);
                            setSelectedHistoryIds(newSet);
                          }}
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-slate-700">{new Date(v.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        <div className="text-xs text-text-soft">{new Date(v.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-slate-700">{v.creatorName}</div>
                        <div className="text-xs text-text-soft">@{v.creatorUsername}</div>
                      </td>
                      <td className="p-3">
                        <a href={v.link_video} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-blue-600 hover:underline break-all block max-w-[300px]">
                          {v.link_video}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalHistoryPages > 1 && (
                <div className="p-3 border-t border-line flex justify-between items-center bg-slate-50">
                  <button 
                    disabled={historyPage === 0}
                    onClick={() => setHistoryPage(p => p - 1)}
                    className="btn btn-outline text-xs py-1 px-2"
                  >
                    Sebelumnya
                  </button>
                  <span className="text-xs text-slate-500">
                    Halaman {historyPage + 1} dari {totalHistoryPages}
                  </span>
                  <button 
                    disabled={historyPage >= totalHistoryPages - 1}
                    onClick={() => setHistoryPage(p => p + 1)}
                    className="btn btn-outline text-xs py-1 px-2"
                  >
                    Selanjutnya
                  </button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Brief Konsep */}
      {selectedConcept && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-line">
            <div className="sticky top-0 bg-white border-b border-line px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Brief Konsep #{selectedConcept.no_konsep}</h3>
                <p className="text-sm text-slate-500">{selectedConcept.judul_konsep}</p>
              </div>
              <button 
                onClick={() => setSelectedConcept(null)}
                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <table className="w-full text-sm text-left border border-line rounded-lg overflow-hidden">
                <tbody className="divide-y divide-line">
                  <tr className="bg-slate-50"><th className="px-4 py-3 w-1/4 font-semibold text-slate-600">Product</th><td className="px-4 py-3 bg-white">{skus.find(s => s.id === selectedConcept.sku_id)?.nama_produk || '-'}</td></tr>
                  <tr className="bg-slate-50"><th className="px-4 py-3 font-semibold text-slate-600">Tier</th><td className="px-4 py-3 bg-white"><span className="badge b-neutral">{selectedConcept.tier || '-'}</span></td></tr>
                  <tr className="bg-slate-50"><th className="px-4 py-3 font-semibold text-slate-600">Hook</th><td className="px-4 py-3 bg-white whitespace-pre-wrap">{selectedConcept.hook || '-'}</td></tr>
                  <tr className="bg-slate-50"><th className="px-4 py-3 font-semibold text-slate-600">Fitur / USP</th><td className="px-4 py-3 bg-white whitespace-pre-wrap">{selectedConcept.fitur_usp || '-'}</td></tr>
                  <tr className="bg-slate-50"><th className="px-4 py-3 font-semibold text-slate-600">CTA</th><td className="px-4 py-3 bg-white whitespace-pre-wrap">{selectedConcept.cta || '-'}</td></tr>
                </tbody>
              </table>
              <div className="mt-6 flex justify-end">
                <button 
                  onClick={() => setSelectedConcept(null)}
                  className="btn btn-primary"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Video Player (GDrive) */}
      {playingDriveId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-black rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col relative border border-slate-700">
            <div className="absolute -top-12 right-0 flex items-center gap-2">
              <a 
                href={`https://drive.google.com/file/d/${playingDriveId}/view`}
                target="_blank"
                rel="noreferrer"
                className="text-white/70 hover:text-white hover:bg-white/10 px-4 py-2 rounded-full transition-colors text-sm font-medium border border-white/20"
              >
                Buka di Tab Baru
              </a>
              <button 
                onClick={() => setPlayingDriveId(null)}
                className="text-white/70 hover:text-white hover:bg-white/10 px-4 py-2 rounded-full transition-colors flex items-center gap-2 text-sm font-medium border border-white/20"
              >
                Tutup <span className="text-xl leading-none">&times;</span>
              </button>
            </div>
            <div className="flex-1 w-full h-full rounded-xl overflow-hidden bg-black flex items-center justify-center relative">
              <iframe 
                src={`https://drive.google.com/file/d/${playingDriveId}/preview`} 
                className="absolute inset-0 w-full h-full border-0 bg-transparent"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                referrerPolicy="no-referrer"
                title="Google Drive Video Player"
              ></iframe>
            </div>
          </div>
        </div>
      )}

      {/* Revision Note Modal */}
      <Dialog open={revisionModalState.open} onOpenChange={(open) => setRevisionModalState(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-[480px] p-6 bg-white rounded-2xl shadow-2xl border border-slate-100">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <RotateCw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">Catatan Revisi Draft Video</h3>
                <p className="text-xs text-slate-500">
                  Kreator: <strong className="text-indigo-600">@{revisionModalState.video?.creatorUsername}</strong> (Slot #{revisionModalState.video?.urutan})
                </p>
              </div>
            </div>
            <button 
              onClick={() => setRevisionModalState(prev => ({ ...prev, open: false }))}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="py-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Isi Catatan / Feedback Revisi:
              </label>
              <textarea
                rows={4}
                value={revisionModalState.noteText}
                onChange={(e) => setRevisionModalState(prev => ({ ...prev, noteText: e.target.value }))}
                placeholder="Tuliskan poin-poin yang perlu direvisi oleh kreator / PIC..."
                className="input w-full !p-3 text-sm resize-y min-h-[100px] border border-slate-200 focus:border-rose-400 focus:ring-1 focus:ring-rose-400"
                autoFocus
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Catatan ini akan tetap tersimpan ke database VPS dan dapat dilihat meskipun status video nantinya diubah menjadi Approved.
              </p>
            </div>

            {revisionModalState.isSaving && (
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold animate-pulse shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-rose-600 shrink-0" />
                <span>Sedang menyimpan catatan ke database VPS... Mohon tunggu sebentar.</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setRevisionModalState(prev => ({ ...prev, open: false }))}
              className="btn btn-outline text-xs px-4 py-2"
              disabled={revisionModalState.isSaving}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveRevisionNote}
              className="btn bg-rose-600 hover:bg-rose-700 text-white text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm"
              disabled={revisionModalState.isSaving}
            >
              {revisionModalState.isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan ke database...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Catatan</span>
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
