"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TrendingUp, Video, Users, Package, Calendar, CheckCircle, CheckCircle2, XCircle, Activity, BarChart3, ChevronDown, ChevronUp, Search, ChevronLeft, ChevronRight, Filter, ArrowUp, ArrowDown, ArrowUpDown, Download, ShoppingCart, Loader2, Eye, ExternalLink } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { submitClientApproval, updateResiByClient, batchUpdateResiByClient, type BatchUpdateData, updateClientNotes } from "../actions/portalActions";
import { sumNum } from "@/utils/computed";
import { formatAbbreviated, formatDateTime, formatDateTimeShort } from "@/utils/formatters";
import { useRouter } from "next/navigation";

const SortableHeader = ({ label, sortKey, currentSort, onSort, className = "" }: { label: string, sortKey: string, currentSort: {key: string, direction: 'asc'|'desc'} | null, onSort: (k: string) => void, className?: string }) => {
  return (
    <TableHead className={`py-[16px] cursor-pointer hover:bg-slate-50 transition-colors select-none group ${className}`} onClick={() => onSort(sortKey)}>
      <div className={`flex items-center gap-2 ${className.includes('text-right') ? 'justify-end' : className.includes('text-center') ? 'justify-center' : 'justify-start'}`}>
        {label}
        {currentSort?.key === sortKey ? (
          currentSort.direction === 'asc' ? <ArrowUp className="w-4 h-4 text-blue-600" /> : <ArrowDown className="w-4 h-4 text-blue-600" />
        ) : (
          <ArrowUpDown className="w-4 h-4 text-slate-400 transition-opacity" />
        )}
      </div>
    </TableHead>
  );
};

export default function PortalDashboardClient({ data, campaignId }: { data: any, campaignId: number }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'performa' | 'approval' | 'sampel' | 'live' | 'video'>('performa');
  const [expandedVideos, setExpandedVideos] = useState<Record<string, boolean>>({});
  const [isApproving, setIsApproving] = useState<number | null>(null);
  const [editedSamples, setEditedSamples] = useState<Record<number, BatchUpdateData>>({});
  const [editedNotesClient, setEditedNotesClient] = useState<Record<number, string>>({});
  const [autoSavingItems, setAutoSavingItems] = useState<Record<number, boolean>>({});
  const [autoSavingNotes, setAutoSavingNotes] = useState<Record<number, boolean>>({});
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  
  // Filter, Sort, & Pagination States
  const PAGE_SIZE = 50;
  
  type SortDirection = 'asc' | 'desc';
  const [performaSort, setPerformaSort] = useState<{key: string, direction: SortDirection}>({ key: 'total_gmv', direction: 'desc' });
  const [listingSort, setListingSort] = useState<{key: string, direction: SortDirection}>({ key: 'username', direction: 'asc' });
  const [sampleSort, setSampleSort] = useState<{key: string, direction: SortDirection}>({ key: 'tanggal_kirim', direction: 'desc' });
  const [liveSort, setLiveSort] = useState<{key: string, direction: SortDirection} | null>(null);
  const [videoSort, setVideoSort] = useState<{key: string, direction: SortDirection} | null>(null);

  const handleSort = (tab: 'performa' | 'listing' | 'sample' | 'live' | 'video', key: string) => {
    const setterMap = { performa: setPerformaSort, listing: setListingSort, sample: setSampleSort, live: setLiveSort, video: setVideoSort };
    // @ts-ignore
    setterMap[tab]((prev: any) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };
  const [performaSearch, setPerformaSearch] = useState('');
  const [performaPage, setPerformaPage] = useState(0);

  const [listingSearch, setListingSearch] = useState('');
  const [listingTypeFilter, setListingTypeFilter] = useState('all');
  const [listingPage, setListingPage] = useState(0);

  const [sampleSearch, setSampleSearch] = useState('');
  const [sampleStatusFilter, setSampleStatusFilter] = useState('all');
  const [samplePage, setSamplePage] = useState(0);

  const [liveSearch, setLiveSearch] = useState('');
  const [liveFilterType, setLiveFilterType] = useState('all');
  const [livePage, setLivePage] = useState(0);

  const [videoSearch, setVideoSearch] = useState('');
  const [videoPage, setVideoPage] = useState(0);
  const [videoFilterView, setVideoFilterView] = useState<'creator' | 'video'>('creator');
  const [isVideoFiltering, setIsVideoFiltering] = useState(false);

  // New States: Top 10 Leaderboard & Winning Concepts
  const [top10Tab, setTop10Tab] = useState<'gmv' | 'views' | 'er' | 'itemsSold'>('gmv');
  const [expandedConcepts, setExpandedConcepts] = useState<Record<number, boolean>>({});
  const toggleConceptExpand = (no: number) => {
    setExpandedConcepts(prev => ({ ...prev, [no]: !prev[no] }));
  };

  // Reset video page and show loading effect when filters change
  React.useEffect(() => {
    setIsVideoFiltering(true);
    setVideoPage(0);
    const timer = setTimeout(() => setIsVideoFiltering(false), 300);
    return () => clearTimeout(timer);
  }, [videoSearch, videoSort, videoFilterView]);

  const [isExporting, setIsExporting] = useState(false);

  // Reset page when tab changes
  React.useEffect(() => {
    setPerformaPage(0);
    setListingPage(0);
    setSamplePage(0);
    setLivePage(0);
    setVideoPage(0);
  }, [activeTab]);

  // Auto-save logic replaces batch save prompt requirement
  React.useEffect(() => {
    // No-op for beforeunload since we auto-save on blur/change
  }, []);

  const { 
    campaign, summary, ccData: approvalList, samples, schedules, videos, skus, 
    rpc, fastCountsData, fastVideoCountsData, initialTotalAdsGmv, 
    totalSales, totalAwareness, salesPerProduct, totalItemsSold,
    metrics, top10Creators, winningConcepts
  } = data;
  
  const isAwareness = campaign?.tipe_campaign === 'awareness' || campaign?.tipe_campaign === 'gmv_awareness';
  const approvedOnlyList = approvalList?.filter((cc: any) => cc.approval === 'approved' || cc.client_approval === 'approved') || [];

  const totalApprovedCreators = fastCountsData ? fastCountsData.approved : (rpc?.total_approved_creators !== undefined ? Number(rpc.total_approved_creators) : 0);
  const totalPendingCreators = fastCountsData ? fastCountsData.pending : (rpc?.total_pending_creators !== undefined ? Number(rpc.total_pending_creators) : 0);
  const pendingCreatorsWithVideosCount = fastCountsData ? fastCountsData.pending_with_videos : 0;

  const totalApprovedVideos = fastVideoCountsData ? fastVideoCountsData.total_approved : 0;
  const totalPendingVideos = fastVideoCountsData ? fastVideoCountsData.total_pending : 0;
  const totalCampaignLivestreams = fastVideoCountsData ? fastVideoCountsData.total_livestream : 0;

  const totalOrganic = rpc?.organic_gmv !== undefined ? Number(rpc.organic_gmv) : 0;
  // Use initialTotalAdsGmv for global total consistency with internal dashboard & Ads Report
  const totalAdsGmv = initialTotalAdsGmv || 0; 
  const unattributedGmv = rpc?.unattributed_gmv !== undefined ? Number(rpc.unattributed_gmv) : 0;
  
  // In the Brand Portal, Total Achievement counts ONLY approved organic GMV + Ads GMV.
  const totalAllGmv = totalOrganic + totalAdsGmv;
  const percentGmv = campaign?.target_gmv ? Math.round((totalAllGmv / campaign.target_gmv) * 100) : 0;
  
  const trackedOrganic = totalOrganic;
  const attributionGap = 0; // Hidden in portal
  const gapPercentage = 0;

  const totalCampaignViews = rpc?.total_views !== undefined ? Number(rpc.total_views) : 0;
  const totalCampaignLikes = rpc?.total_likes !== undefined ? Number(rpc.total_likes) : 0;
  const totalCampaignVideos = rpc?.total_videos !== undefined ? Number(rpc.total_videos) : 0;
  
  const creatorsWithVideo = Number(totalSales?.creatorsWithVideo || 0);
  const creatorsWithLive = Number(totalSales?.creatorsWithLive || 0);

  const targetVideo = campaign?.target_video || 0;
  const percentVideo = targetVideo > 0 ? Math.round((totalCampaignVideos / targetVideo) * 100) : 0;
  
  const targetCreator = campaign?.target_creator || 0;
  const percentCapaiCreator = targetCreator > 0 ? Math.round((totalApprovedCreators / targetCreator) * 100) : 0;

  const formatCompactNumber = (num: number | undefined) => {
    if (num === undefined || isNaN(num)) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const [toastMessage, setToastMessage] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleApproval = async (ccId: number, status: 'approved' | 'rejected') => {
    setIsApproving(ccId);
    try {
      await submitClientApproval(campaignId, ccId, status);
      router.refresh();
      showToast("Persetujuan berhasil disimpan!", "success");
    } catch (err) {
      alert("Gagal menyimpan persetujuan. Silakan coba lagi.");
    } finally {
      setIsApproving(null);
    }
  };

  const handleQueueUpdate = (addrId: number, field: keyof BatchUpdateData, value: string) => {
    setEditedSamples(prev => ({
      ...prev,
      [addrId]: {
        ...prev[addrId],
        addressId: addrId,
        [field]: value
      }
    }));
  };

  const handleAutoSave = async (addrId: number, field: keyof BatchUpdateData, value: string) => {
    handleQueueUpdate(addrId, field, value);
    setAutoSavingItems(prev => ({ ...prev, [addrId]: true }));
    try {
      await batchUpdateResiByClient(campaignId, [{ addressId: addrId, [field]: value }]);
      
      setEditedSamples(prev => {
        const next = { ...prev };
        if (next[addrId]) {
          delete next[addrId][field];
          if (Object.keys(next[addrId]).length <= 1) { // only addressId left or empty
            delete next[addrId];
          }
        }
        return next;
      });
      router.refresh();
      showToast("Perubahan berhasil disimpan!", "success");
    } catch (err) {
      console.error("Auto-save failed", err);
      showToast("Gagal menyimpan perubahan", "error");
    } finally {
      setAutoSavingItems(prev => ({ ...prev, [addrId]: false }));
    }
  };

  const handleNotesClientAutoSave = async (ccId: number, value: string) => {
    setAutoSavingNotes(prev => ({ ...prev, [ccId]: true }));
    try {
      await updateClientNotes(campaignId, ccId, value);
      router.refresh();
    } catch (err) {
      console.error("Failed to save client notes", err);
    } finally {
      setAutoSavingNotes(prev => ({ ...prev, [ccId]: false }));
    }
  };

  const handleBatchSave = async () => {
    const updates = Object.values(editedSamples);
    if (updates.length === 0) return;

    setIsSavingBatch(true);
    try {
      await batchUpdateResiByClient(campaignId, updates);
      setEditedSamples({});
      router.refresh();
      alert("Semua perubahan berhasil disimpan!");
    } catch (err) {
      alert("Gagal menyimpan perubahan. Silakan coba lagi.");
    } finally {
      setIsSavingBatch(false);
    }
  };

  // ============================
  // EXPORT TO EXCEL (XLSX)
  // ============================
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const xlsxModule = await import('xlsx');
      const XLSX = xlsxModule.default || xlsxModule;
      const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summaryRows = [
      ['Campaign', campaign.nama],
      ['Periode', `${new Date(campaign.start_date).toLocaleDateString('id-ID')} - ${new Date(campaign.end_date).toLocaleDateString('id-ID')}`],
      ['Total GMV', totalAllGmv],
      ['Total Views', totalCampaignViews],
      ['Total Video', totalCampaignVideos],
      ['Total Livestream', totalCampaignLivestreams],
      ['Total Kreator Approved', totalApprovedCreators],
      ['Total Item Sold', totalItemsSold || 0],
      [],
      ['Top 5 Product ID by GMV'],
      ['Product ID', 'Nama Produk', 'GMV', 'Items Sold'],
      ...(salesPerProduct || []).slice(0, 5).map((p: any) => [p.product_id, p.nama_produk, p.gmv, p.items_sold])
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');

    // Sheet 2: Listing Kreator
    const creatorRows = approvalList.map((cc: any) => ({
      'Username': cc.creators?.username || 'Unknown',
      'Followers': cc.followers || 0,
      'Level': cc.level || '-',
      'Tier': cc.tier || '-',
      'Tipe Konten': cc.content_type || '-',
      'Progress Sampel': cc.sample_progress || '-',
      'Status Approval': cc.client_approval || '-',
      'GMV Organic': cc.gmv_organic || 0,
      'GMV Ads': cc.gmv_ads || 0,
      'Total GMV': (cc.gmv_organic || 0) + (cc.gmv_ads || 0),
      'Item Sold': cc.items_sold || 0,
      'Total VT': cc.total_vt || 0,
      'Total Livestream': cc.total_livestreams || 0
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(creatorRows), 'Listing Kreator');

    // Sheet 3: Video & Konten
    const videoRows: any[] = [];
    (videos || []).forEach((vGroup: any) => {
      (vGroup.videos || []).forEach((v: any) => {
        videoRows.push({
          'Kreator': vGroup.creator_username,
          'Link Video': v.link_video || '-',
          'Views': v.views || 0,
          'Likes': v.likes || 0,
          'GMV': v.gmv || 0,
          'Auto Tracked': v.isAuto ? 'Ya' : 'Tidak'
        });
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(videoRows.length > 0 ? videoRows : [{ 'Info': 'Tidak ada data video' }]), 'Video & Konten');

    // Sheet 4: Sampel & Resi
    const sampleRows = (samples || []).map((addr: any, idx: number) => {
      const cc = approvalList.find((c: any) => c.id === addr.campaign_creator_id);
      
      const skuNames = (cc?.assigned_sku_ids || []).map((id: number) => {
        const sku = skus?.find((s: any) => s.id === id);
        return sku ? sku.nama_produk : '';
      }).filter(Boolean).join(', ');

      return {
        'No': idx + 1,
        'Product': skuNames || '',
        'Username': cc?.creators?.username || addr.creator_username || 'Unknown',
        'No Whatsapp': cc?.no_whatsapp || '-',
        'Nama Penerima': addr.nama_penerima || '',
        'Nama Jalan': addr.nama_jalan || '',
        'Provinsi': addr.provinsi || '',
        'Kabupaten/Kota': addr.kabupaten_kota || '',
        'Kecamatan': addr.kecamatan || '',
        'Kelurahan': addr.kelurahan || '',
        'Kode Pos': addr.kode_pos || '',
        'Tanggal Kirim': addr.tanggal_kirim ? new Date(addr.tanggal_kirim).toLocaleDateString('id-ID') : '',
        'Resi': addr.resi || '',
        'Ekspedisi': addr.ekspedisi || '',
        'Notes': addr.notes || '',
        'Status': addr.proses || 'Belum diproses'
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sampleRows.length > 0 ? sampleRows : [{ 'Info': 'Tidak ada data sampel' }]), 'Sampel & Resi');

    // Write and download
    XLSX.writeFile(wb, `${campaign.nama}_Portal_Export_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.xlsx`);
    
    } catch (err) {
      console.error("Failed to export excel:", err);
      showToast("Gagal mengekspor file Excel.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  // ============================
  // DERIVED DATA FOR PAGINATION & SORTING
  // ============================

  const genericSort = (arr: any[], sortConfig: {key: string, direction: SortDirection}, getValue: (item: any) => any) => {
    return [...arr].sort((a, b) => {
      let valA = getValue(a);
      let valB = getValue(b);
      // Handle string comparison gracefully
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      
      if (valA === valB) return 0;
      // Handle undefined/null (push them to the end)
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      
      const comparison = valA > valB ? 1 : -1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  };

  // 1. Performa (Wajib match dengan Internal App: HANYA APPROVED CREATORS)
  let filteredPerforma = approvedOnlyList.filter((cc: any) => {
    if (performaSearch && !cc.creators?.username?.toLowerCase().includes(performaSearch.toLowerCase())) return false;
    return true;
  });
  filteredPerforma = genericSort(filteredPerforma, performaSort, (c) => {
    if (performaSort.key === 'username') return c.creators?.username;
    if (performaSort.key === 'total_vt') {
       return c.total_vt || 0;
    }
    if (performaSort.key === 'total_live') return c.total_livestreams || 0;
    if (performaSort.key === 'items_sold') return c.items_sold || 0;
    if (performaSort.key === 'gmv_organic') return c.gmv_organic || 0;
    if (performaSort.key === 'gmv_ads') return c.gmv_ads || 0;
    if (performaSort.key === 'total_gmv') return (c.gmv_organic || 0) + (c.gmv_ads || 0);
    return 0;
  });
  const performaTotalPages = Math.ceil(filteredPerforma.length / PAGE_SIZE) || 1;
  const paginatedPerforma = filteredPerforma.slice(performaPage * PAGE_SIZE, (performaPage + 1) * PAGE_SIZE);

  // 2. Listing
  let filteredListing = approvalList.filter((cc: any) => {
    if (listingSearch && !cc.creators?.username?.toLowerCase().includes(listingSearch.toLowerCase())) return false;
    if (listingTypeFilter !== 'all' && cc.content_type?.toLowerCase() !== listingTypeFilter.toLowerCase()) return false;
    return true;
  });
  filteredListing = genericSort(filteredListing, listingSort, (c) => {
    if (listingSort.key === 'username') return c.creators?.username;
    if (listingSort.key === 'followers') return c.followers || 0;
    if (listingSort.key === 'level') return c.level;
    if (listingSort.key === 'tier') return c.tier;
    if (listingSort.key === 'content_type') return c.content_type;
    if (listingSort.key === 'sample_progress') return c.sample_progress;
    if (listingSort.key === 'status_approval') return c.client_approval;
    return 0;
  });
  const listingTotalPages = Math.ceil(filteredListing.length / PAGE_SIZE) || 1;
  const paginatedListing = filteredListing.slice(listingPage * PAGE_SIZE, (listingPage + 1) * PAGE_SIZE);

  // 3. Sampel
  let filteredSamples = samples.filter((addr: any) => {
    const cc = approvalList.find((c: any) => c.id === addr.campaign_creator_id);
    
    // Only approved creators
    if (cc?.approval !== 'approved' && cc?.client_approval !== 'approved') return false;

    const username = cc?.creators?.username || '';
    const resiStr = (editedSamples[addr.id]?.resi ?? addr.resi) || '';
    const prosesStr = (editedSamples[addr.id]?.proses ?? addr.proses) || 'Belum diproses';

    if (sampleSearch && !username.toLowerCase().includes(sampleSearch.toLowerCase()) && !resiStr.toLowerCase().includes(sampleSearch.toLowerCase())) return false;
    
    if (sampleStatusFilter === 'resi_belum' && resiStr.trim() !== '') return false;
    if (sampleStatusFilter === 'resi_sudah' && resiStr.trim() === '') return false;
    if (sampleStatusFilter !== 'all' && sampleStatusFilter !== 'resi_belum' && sampleStatusFilter !== 'resi_sudah') {
      if (prosesStr.toLowerCase() !== sampleStatusFilter.toLowerCase()) return false;
    }
    
    return true;
  });
  filteredSamples = genericSort(filteredSamples, sampleSort, (addr) => {
    const cc = approvalList.find((c: any) => c.id === addr.campaign_creator_id);
    if (sampleSort.key === 'username') return cc?.creators?.username;
    if (sampleSort.key === 'proses') return addr.proses;
    if (sampleSort.key === 'tanggal_kirim') return new Date(addr.tanggal_kirim || 0).getTime();
    if (sampleSort.key === 'resi') return addr.resi;
    return 0;
  });
  const sampleTotalPages = Math.ceil(filteredSamples.length / PAGE_SIZE) || 1;
  const paginatedSamples = filteredSamples.slice(samplePage * PAGE_SIZE, (samplePage + 1) * PAGE_SIZE);

  // 4. Live (based on Creators)
  const approvedCreatorsForLive = data.ccData.filter((cc: any) => 
    cc.approval === 'approved' || cc.client_approval === 'approved'
  );

  let filteredLive = approvedCreatorsForLive.filter((cc: any) => {
    if (liveSearch && !cc.creators?.username?.toLowerCase().includes(liveSearch.toLowerCase())) return false;
    return true;
  });
  // Calculate latest date, total sessions, and GMV for each creator for sorting
  filteredLive.forEach((cc: any) => {
      const username = cc.creators?.username;
      const creatorSchedules = schedules.filter((s: any) => s.campaign_creator_id === cc.id);
      const creatorLives = data.actualLives?.filter((l: any) => l.creator_username === username) || [];
      let latestTime = 0;
      let totalGmv = 0;
      creatorSchedules.forEach((s: any) => {
          const t = new Date(s.tanggal_live).getTime();
          if (t > latestTime) latestTime = t;
      });
      creatorLives.forEach((l: any) => {
          if (l.start_time) {
              const t = new Date(l.start_time).getTime();
              if (t > latestTime) latestTime = t;
          }
          totalGmv += (l.gmv || 0);
      });
      cc._latestLiveTime = latestTime;
      cc._totalLiveSessions = creatorLives.length;
      cc._totalLiveGmv = totalGmv;
  });

  if (liveFilterType === 'most_lives') {
      filteredLive.sort((a: any, b: any) => b._totalLiveSessions - a._totalLiveSessions);
  } else if (liveFilterType === 'highest_gmv') {
      filteredLive.sort((a: any, b: any) => b._totalLiveGmv - a._totalLiveGmv);
  } else if (!liveSort) {
      filteredLive.sort((a: any, b: any) => b._latestLiveTime - a._latestLiveTime);
  } else {
      filteredLive = genericSort(filteredLive, liveSort, (cc) => {
        if (liveSort.key === 'username') return cc.creators?.username;
        if (liveSort.key === 'tanggal_live') return cc._latestLiveTime;
        return 0;
      });
  }
  const liveTotalPages = Math.ceil(filteredLive.length / PAGE_SIZE) || 1;
  const paginatedLive = filteredLive.slice(livePage * PAGE_SIZE, (livePage + 1) * PAGE_SIZE);

  // 5. Video Processing
  const validCreatorUsernames = new Set(approvalList?.map((cc: any) => cc.creators?.username) || []);
  const validVideos = (videos || []).filter((v: any) => validCreatorUsernames.has(v.creator_username));
  
  // A. Creator View Processing
  let filteredVideo = validVideos.filter((v: any) => {
    if (videoSearch && !v.creator_username?.toLowerCase().includes(videoSearch.toLowerCase())) return false;
    return true;
  });
  
  if (!videoSort || videoSort.key === 'latest_post') {
      filteredVideo.sort((a: any, b: any) => {
          if (b.total_videos !== a.total_videos) return (b.total_videos || 0) - (a.total_videos || 0);
          return (b.total_views || 0) - (a.total_views || 0);
      });
  } else {
      filteredVideo = genericSort(filteredVideo, videoSort, (v) => {
        if (videoSort.key === 'username') return v.creator_username;
        if (videoSort.key === 'total_videos') return v.total_videos || 0;
        if (videoSort.key === 'total_views') return v.total_views || 0;
        if (videoSort.key === 'total_likes') return v.total_likes || 0;
        if (videoSort.key === 'total_gmv') return v.total_gmv || 0;
        return 0;
      });
  }
  const videoTotalPages = Math.ceil(filteredVideo.length / PAGE_SIZE) || 1;
  const paginatedVideo = filteredVideo.slice(videoPage * PAGE_SIZE, (videoPage + 1) * PAGE_SIZE);

  // B. Flat Video View Processing
  let flatVideos: any[] = [];
  validVideos.forEach((creatorGroup: any) => {
    if (creatorGroup.videos && Array.isArray(creatorGroup.videos)) {
      creatorGroup.videos.forEach((v: any) => {
        if (!v.content_uid && !v.link_video) return;
        flatVideos.push({
          ...v,
          creator_username: creatorGroup.creator_username
        });
      });
    }
  });

  if (videoSearch) {
    flatVideos = flatVideos.filter(v => v.creator_username?.toLowerCase().includes(videoSearch.toLowerCase()));
  }

  // Handle sorting for flat videos
  if (!videoSort || videoSort.key === 'latest_post') {
      flatVideos.sort((a, b) => {
          const timeA = a.post_time ? new Date(a.post_time).getTime() : 0;
          const timeB = b.post_time ? new Date(b.post_time).getTime() : 0;
          return timeB - timeA;
      });
  } else {
      flatVideos.sort((a, b) => {
         const multiplier = videoSort.direction === 'asc' ? 1 : -1;
         if (videoSort.key === 'views') return ((a.views || 0) - (b.views || 0)) * multiplier;
         if (videoSort.key === 'likes') return ((a.likes || 0) - (b.likes || 0)) * multiplier;
         if (videoSort.key === 'gmv') return ((a.gmv || 0) - (b.gmv || 0)) * multiplier;
         return 0;
      });
  }

  const flatVideoTotalPages = Math.ceil(flatVideos.length / PAGE_SIZE) || 1;
  const paginatedFlatVideo = flatVideos.slice(videoPage * PAGE_SIZE, (videoPage + 1) * PAGE_SIZE);

  return (
    <div className="w-full mx-auto p-4 md:p-8 space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.2)] text-white font-medium z-[100] flex items-center gap-3 animate-in slide-in-from-bottom-4 fade-in duration-300 ${toastMessage.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-red-600'}`}>
          {toastMessage.type === 'success' ? <CheckCircle className="w-5 h-5 opacity-90" /> : <XCircle className="w-5 h-5 opacity-90" />}
          <span className="text-sm">{toastMessage.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <Badge variant="outline" className="mb-2 border-blue-200 bg-blue-50 text-blue-700">Portal Brand Khusus</Badge>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{campaign.nama}</h1>
          <p className="text-slate-500 mt-1">
            Periode: {new Date(campaign.start_date).toLocaleDateString('id-ID')} - {new Date(campaign.end_date).toLocaleDateString('id-ID')}
          </p>
        </div>
        <div className="text-left md:text-right flex flex-col items-start md:items-end gap-2">
          <div>
            <p className="text-sm text-slate-500">Status</p>
            <Badge variant={campaign.status === 'aktif' ? 'success' : 'secondary'} className="uppercase mt-1 text-sm">
              {campaign.status}
            </Badge>
          </div>
          <button 
            onClick={handleExportExcel}
            disabled={isExporting}
            className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-medium rounded-lg hover:from-emerald-600 hover:to-green-700 transition-all shadow-sm hover:shadow-md ${isExporting ? 'opacity-80 cursor-not-allowed' : ''}`}
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isExporting ? 'Menyiapkan Data...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap space-x-2 border-b border-slate-200">
        <button
          className={`py-3 px-4 md:px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'performa' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('performa')}
        >
          <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4"/> Performa</div>
        </button>
        
        <button
          className={`py-3 px-4 md:px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'approval' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('approval')}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4"/> Listing Kreator
            {campaign.require_client_approval && approvalList.filter((cc: any) => cc.client_approval === 'pending').length > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full ml-1">
                {approvalList.filter((cc: any) => cc.client_approval === 'pending').length}
              </span>
            )}
          </div>
        </button>

        <button
          className={`py-3 px-4 md:px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'sampel' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('sampel')}
        >
          <div className="flex items-center gap-2"><Package className="w-4 h-4"/> Sampel & Resi</div>
        </button>
        <button
          className={`py-3 px-4 md:px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'live' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('live')}
        >
          <div className="flex items-center gap-2"><Calendar className="w-4 h-4"/> Jadwal Live</div>
        </button>
        <button
          className={`py-3 px-4 md:px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'video' as any ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('video' as any)}
        >
          <div className="flex items-center gap-2"><Video className="w-4 h-4"/> Video & Konten</div>
        </button>
      </div>

      {/* Tab Content */}
      <div className="pt-4">
        {activeTab === 'performa' && (
          <div className="space-y-[32px] animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center flex-wrap gap-[16px]">
              <div>
                <h2 className="text-[20px] font-bold">
                  {isAwareness ? "Performa Awareness Campaign" : "Performa Sales Campaign"}
                </h2>
                <p className="text-[13px] text-slate-500">Analitik pencapaian campaign secara <span className="font-bold text-green-600 border-b border-green-600">Real-Time</span>.</p>
              </div>
            </div>

            {data.monthlyStats && data.monthlyStats.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-bold mb-4">Performa Bulanan</h3>
                <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
                  {data.monthlyStats.map((m: any, idx: number) => {
                    const dateObj = new Date(m.month + '-01');
                    const monthName = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
                    
                    return (
                      <div key={idx} className="ccard bg-white border-line min-w-[320px] shrink-0 snap-start">
                        <div className="p-[20px]">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-bold text-slate-800 tracking-tight">{monthName}</h4>
                            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[11px] font-bold">MONTHLY</span>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            <div className="bg-slate-50 rounded-[10px] p-2 flex flex-col items-center justify-center text-center">
                              <span className="text-[10px] font-medium text-slate-500 mb-1">GMV Total</span>
                              <span className="font-bold text-slate-800 text-[11px]">
                                {formatCompactNumber(m.gmvTotal)}
                              </span>
                            </div>
                            <div className="bg-emerald-50 rounded-[10px] p-2 flex flex-col items-center justify-center text-center">
                              <span className="text-[10px] font-medium text-emerald-600 mb-1">Sales</span>
                              <span className="font-bold text-emerald-700 text-[11px]">
                                {formatCompactNumber(m.gmvOrganic)}
                              </span>
                            </div>
                            <div className="bg-violet-50 rounded-[10px] p-2 flex flex-col items-center justify-center text-center">
                              <span className="text-[10px] font-medium text-violet-600 mb-1">Ads</span>
                              <span className="font-bold text-violet-700 text-[11px]">
                                {formatCompactNumber(m.gmvAds)}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-slate-50 rounded-[10px] p-2 flex flex-col items-center justify-center text-center border border-slate-100">
                              <span className="text-[10px] font-medium text-slate-500 mb-1">Kreator w/ VT</span>
                              <span className="font-bold text-slate-800 text-[11px]">
                                {m.totalVideoCreators}
                              </span>
                            </div>
                            <div className="bg-slate-50 rounded-[10px] p-2 flex flex-col items-center justify-center text-center border border-slate-100">
                              <span className="text-[10px] font-medium text-slate-500 mb-1">VT</span>
                              <span className="font-bold text-slate-800 text-[11px]">
                                {m.totalVideos}
                              </span>
                            </div>
                            <div className="bg-slate-50 rounded-[10px] p-2 flex flex-col items-center justify-center text-center border border-slate-100">
                              <span className="text-[10px] font-medium text-slate-500 mb-1">Live</span>
                              <span className="font-bold text-slate-800 text-[11px]">
                                {m.totalLiveSessions}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-[24px]">
              {/* === SECTION: AWARENESS METRICS === */}
              <div className={`grid grid-cols-1 md:grid-cols-4 gap-[24px] ${!isAwareness ? 'order-2' : 'order-1'}`}>
                <div className={`ccard relative overflow-hidden md:col-span-2 ${isAwareness ? 'bg-gradient-to-br from-indigo-50 to-blue-100/50 border-indigo-100' : 'bg-white border-line'}`}>
                  <div className="p-[24px]">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className={`text-[13px] font-medium ${isAwareness ? 'text-indigo-800' : 'text-slate-500'}`}>Total Keseluruhan Views</p>
                        <h3 className={`text-[32px] font-bold mt-[8px] ${isAwareness ? 'text-indigo-900' : 'text-slate-800'}`}>{totalCampaignViews.toLocaleString()}</h3>
                        <p className={`text-[11px] font-semibold mt-[4px] ${isAwareness ? 'text-indigo-700/80' : 'text-slate-500'}`}>Dihitung dari {totalCampaignVideos} video unik</p>
                      </div>
                      <div className={`p-[16px] rounded-[12px] shadow-sm ${isAwareness ? 'bg-white text-indigo-600' : 'bg-slate-50 text-slate-500'}`}>
                        <Eye className="w-8 h-8" />
                      </div>
                    </div>
                    <div className={`mt-[24px] pt-[16px] border-t flex gap-[24px] ${isAwareness ? 'border-indigo-200/50' : 'border-line'}`}>
                      <div>
                        <p className={`text-[11px] font-medium ${isAwareness ? 'text-indigo-600' : 'text-slate-500'}`}>Total Likes</p>
                        <p className={`font-bold ${isAwareness ? 'text-indigo-900' : 'text-slate-800'}`}>{totalCampaignLikes.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className={`text-[11px] font-medium ${isAwareness ? 'text-indigo-600' : 'text-slate-500'}`}>Rata-rata Views / Video</p>
                        <p className={`font-bold ${isAwareness ? 'text-indigo-900' : 'text-slate-800'}`}>
                          {totalCampaignVideos > 0 ? Math.round(totalCampaignViews / totalCampaignVideos).toLocaleString() : 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ccard">
                  <div className="p-[24px]">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[13px] font-medium text-slate-500">Pencapaian Target Creator</p>
                        <h3 className="text-[24px] font-bold mt-[8px] text-slate-800 flex items-center gap-2">
                          {totalApprovedCreators} 
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">kreator approved</span>
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-[12px] mt-[8px]">
                          <span className="flex items-center gap-1.5 font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                            <Users className="w-3.5 h-3.5 text-blue-600" />
                            {metrics?.activeCreatorsCount || 0} Kreator Aktif (VT / Live)
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-500 text-[11px]">
                            {totalPendingCreators} pending
                          </span>
                        </div>
                      </div>
                      <div className="p-[8px] bg-orange-50 text-orange-600 rounded-[8px]"><Users className="w-5 h-5" /></div>
                    </div>
                    {targetCreator > 0 && (
                      <div className="mt-[16px] pt-[16px] border-t border-slate-100">
                        <div className="flex justify-between text-[11px] text-slate-500 mb-[4px] font-medium">
                          <span>Target Total Kreator: {targetCreator}</span>
                          <span>{percentCapaiCreator}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-[6px] flex overflow-hidden">
                          <div className="bg-orange-500 h-[6px] transition-all duration-1000" style={{ width: `${Math.min(percentCapaiCreator, 100)}%` }}></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="ccard">
                  <div className="p-[24px]">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[13px] font-medium text-slate-500">Pencapaian Target Video</p>
                        <h3 className="text-[24px] font-bold mt-[8px] text-slate-800">{totalApprovedVideos} <span className="text-[13px] text-slate-500 font-normal">video approved</span></h3>
                        <div className="flex items-center gap-3 text-[11px] mt-[4px] text-slate-500">
                          <span>{totalPendingVideos} video pending dari {pendingCreatorsWithVideosCount} kreator</span>
                        </div>
                        <p className="text-[11px] font-semibold text-slate-500 mt-[4px]">{totalCampaignLivestreams} <span className="font-normal">livestream</span></p>
                      </div>
                      <div className="p-[8px] bg-rose-50 text-rose-500 rounded-[8px]"><Video className="w-5 h-5" /></div>
                    </div>
                    {targetVideo > 0 && (
                      <div className="mt-[16px] pt-[16px] border-t border-slate-100">
                        <div className="flex justify-between text-[11px] text-slate-500 mb-[4px] font-medium">
                          <span>Target: {targetVideo} Video</span>
                          <span>{percentVideo}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-[6px] flex overflow-hidden">
                          <div className="bg-rose-500 h-[6px] transition-all duration-1000" style={{ width: `${Math.min(percentVideo, 100)}%` }}></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* === SECTION: SALES METRICS === */}
              <div className={`grid grid-cols-1 md:grid-cols-3 gap-[24px] ${isAwareness ? 'order-2' : 'order-1'}`}>
                <div className={`ccard relative overflow-hidden md:col-span-1 ${!isAwareness ? 'bg-gradient-to-br from-green-50 to-emerald-100/50 border-green-100 shadow-sm' : 'bg-white border-line'}`}>
                  <div className="p-[24px]">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className={`text-[13px] font-medium ${!isAwareness ? 'text-green-800' : 'text-slate-500'}`}>Total Achievement (All)</p>
                        <h3 className={`text-[24px] font-bold mt-[8px] ${!isAwareness ? 'text-green-900' : 'text-slate-800'}`}>Rp {formatCompactNumber(totalAllGmv)}</h3>
                        <p className={`text-[11px] font-semibold mt-[4px] ${!isAwareness ? 'text-green-700/80' : 'text-slate-500'}`}>Rp {totalAllGmv.toLocaleString()}</p>
                      </div>
                      <div className={`p-[12px] rounded-[12px] shadow-sm ${!isAwareness ? 'bg-white text-green-600' : 'bg-slate-50 text-slate-500'}`}>
                        <TrendingUp className="w-6 h-6" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ccard">
                  <div className="p-[24px]">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[13px] font-medium text-slate-500">GMV Organik</p>
                        <h3 className="text-[24px] font-bold mt-[8px] text-slate-800">Rp {formatCompactNumber(trackedOrganic)}</h3>
                        <p className="text-[11px] font-semibold text-slate-500 mt-[4px]">Rp {trackedOrganic.toLocaleString()}</p>
                      </div>
                      <div className="p-[8px] bg-blue-50 text-blue-600 rounded-[8px]"><Activity className="w-5 h-5" /></div>
                    </div>
                  </div>
                </div>

                <div className="ccard">
                  <div className="p-[24px]">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[13px] font-medium text-slate-500">GMV Ads</p>
                        <h3 className="text-[24px] font-bold mt-[8px] text-slate-800">Rp {formatCompactNumber(totalAdsGmv)}</h3>
                        <p className="text-[11px] font-semibold text-slate-500 mt-[4px]">Rp {totalAdsGmv.toLocaleString()}</p>
                      </div>
                      <div className="p-[8px] bg-purple-50 text-purple-600 rounded-[8px]"><BarChart3 className="w-5 h-5" /></div>
                    </div>
                  </div>
                </div>

                {/* <div className="ccard">
                  <div className="p-[24px]">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[13px] font-medium text-slate-500">Unattributed GMV (Gap)</p>
                        <h3 className="text-[24px] font-bold mt-[8px] text-red-600">Rp {formatCompactNumber(attributionGap)}</h3>
                        <p className="text-[11px] font-semibold text-red-500 mt-[4px]">Rp {attributionGap.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-500 mt-[2px]">{gapPercentage}% nyangkut di kreator Pending</p>
                      </div>
                      <div className="p-[8px] bg-red-50 text-red-500 rounded-[8px]"><Activity className="w-5 h-5" /></div>
                    </div>
                    <div className="mt-[16px] pt-[16px] border-t border-slate-100">
                      <div className="flex justify-between text-[11px] text-slate-500 mb-[4px] font-medium">
                        <span>Tracked (Approved): Rp {formatCompactNumber(trackedOrganic)}</span>
                        <span>{100 - gapPercentage}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-[6px] flex overflow-hidden">
                        <div className="bg-emerald-500 h-[6px] transition-all duration-1000" style={{ width: `${100 - gapPercentage}%` }}></div>
                        <div className="bg-red-400 h-[6px] transition-all duration-1000" style={{ width: `${gapPercentage}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div> */}
              </div>
            </div>
              
            {/* Total Item Sold + Top 5 Product ID */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-[24px]">
                {/* Total Item Sold Card */}
                <div className="bg-gradient-to-br from-amber-50 to-yellow-100/50 border border-amber-100 rounded-xl overflow-hidden p-[24px] shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[13px] font-medium text-amber-800">Total Item Sold</p>
                      <h3 className="text-[32px] font-bold mt-[8px] text-amber-900">{(totalItemsSold || 0).toLocaleString()} <span className="text-[16px] font-normal text-amber-700">pcs</span></h3>
                      <p className="text-[11px] text-amber-700/70 mt-[4px]">Total produk fisik terjual via link video</p>
                    </div>
                    <div className="p-[12px] bg-white text-amber-600 rounded-[12px] shadow-sm"><ShoppingCart className="w-6 h-6" /></div>
                  </div>
                  <div className="mt-[20px] pt-[14px] border-t border-amber-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-amber-800 font-medium">Conversion Rate: <strong className="font-bold text-amber-950">{metrics?.conversionRate ?? 0}%</strong></span>
                    <span className="text-amber-800 font-medium">Sales-to-Likes: <strong className="font-bold text-amber-950">{metrics?.salesToLikesRatio ?? 0}%</strong></span>
                  </div>
                </div>

                {/* Top 5 Product ID by GMV */}
                <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="border-b border-slate-200 bg-slate-50/50 p-[16px]">
                    <h3 className="font-bold flex items-center gap-[8px] text-slate-800">
                      <BarChart3 className="w-5 h-5 text-blue-600" /> Top 5 Product ID by GMV
                    </h3>
                    <p className="text-[12px] text-slate-500 mt-1">Produk dengan pencapaian GMV tertinggi di campaign ini</p>
                  </div>
                  <div className="overflow-x-auto">
                    <Table className="w-full text-[13px]">
                      <TableHeader className="bg-white border-b border-slate-200">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="py-[12px] w-8 text-center">#</TableHead>
                          <TableHead className="py-[12px]">Product ID</TableHead>
                          <TableHead className="py-[12px]">Nama Produk</TableHead>
                          <TableHead className="py-[12px] text-center">Items Sold</TableHead>
                          <TableHead className="py-[12px] text-right">GMV</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(salesPerProduct || []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-[24px] text-slate-500">Belum ada data penjualan produk.</TableCell>
                          </TableRow>
                        ) : (
                          (salesPerProduct || []).slice(0, 5).map((p: any, idx: number) => (
                            <TableRow key={p.product_id} className="transition-all duration-300 hover:bg-slate-50">
                              <TableCell className="text-center font-bold text-slate-400">{idx + 1}</TableCell>
                              <TableCell className="font-mono text-[12px] text-blue-600">{p.product_id}</TableCell>
                              <TableCell className="font-medium text-slate-700">{p.nama_produk}</TableCell>
                              <TableCell className="text-center font-bold">{(p.items_sold || 0).toLocaleString()} pcs</TableCell>
                              <TableCell className="text-right font-bold text-green-700">Rp {(p.gmv || 0).toLocaleString()}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              {/* === SECTION: PERFORMANCE METRICS (Average & Productivity) === */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-[24px]">
                <div className="bg-white border border-slate-200 rounded-xl p-[20px] shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[12px] font-medium text-slate-500">Revenue per Active Creator</p>
                      <h4 className="text-[22px] font-bold mt-[6px] text-slate-800">
                        Rp {(metrics?.revenuePerActiveCreator || 0).toLocaleString()}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-[2px]">
                        Rata-rata performa omzet per kreator aktif
                      </p>
                    </div>
                    <div className="p-[10px] bg-blue-50 text-blue-600 rounded-[10px]"><Users className="w-5 h-5" /></div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-[20px] shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[12px] font-medium text-slate-500">Revenue per Video</p>
                      <h4 className="text-[22px] font-bold mt-[6px] text-slate-800">
                        Rp {(metrics?.revenuePerVideo || 0).toLocaleString()}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-[2px]">
                        Rata-rata omzet per video ({totalApprovedVideos} video tayang)
                      </p>
                    </div>
                    <div className="p-[10px] bg-emerald-50 text-emerald-600 rounded-[10px]"><Video className="w-5 h-5" /></div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-[20px] shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[12px] font-medium text-slate-500">Like Engagement Rate (ER)</p>
                      <h4 className="text-[22px] font-bold mt-[6px] text-slate-800">
                        {metrics?.likeER ?? 0}%
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-[2px]">
                        Rasio likes per views (Total {totalCampaignLikes.toLocaleString()} likes)
                      </p>
                    </div>
                    <div className="p-[10px] bg-rose-50 text-rose-500 rounded-[10px]"><Activity className="w-5 h-5" /></div>
                  </div>
                </div>
              </div>

              {/* === SECTION: TOP 10 CREATOR PERFORMANCE LEADERBOARD === */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50/50 p-[16px] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="font-bold flex items-center gap-[8px] text-slate-800 text-[16px]">
                      🏆 Top 10 Creator Performance
                    </h3>
                    <p className="text-[12px] text-slate-500 mt-1">10 Kreator dengan performa terbaik berdasarkan 4 pilar utama</p>
                  </div>
                  
                  {/* Tab Filter 4 Pilar */}
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-[12px] font-medium">
                    <button
                      onClick={() => setTop10Tab('gmv')}
                      className={`px-3 py-1.5 rounded-md transition-all ${top10Tab === 'gmv' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Top GMV
                    </button>
                    <button
                      onClick={() => setTop10Tab('views')}
                      className={`px-3 py-1.5 rounded-md transition-all ${top10Tab === 'views' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Top Views
                    </button>
                    <button
                      onClick={() => setTop10Tab('er')}
                      className={`px-3 py-1.5 rounded-md transition-all ${top10Tab === 'er' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Top Like ER
                    </button>
                    <button
                      onClick={() => setTop10Tab('itemsSold')}
                      className={`px-3 py-1.5 rounded-md transition-all ${top10Tab === 'itemsSold' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Top Items Sold
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table className="w-full text-[13px]">
                    <TableHeader className="bg-white border-b border-slate-200">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="py-[12px] w-12 text-center">Rank</TableHead>
                        <TableHead className="py-[12px]">Creator</TableHead>
                        <TableHead className="py-[12px] text-center">Total VT</TableHead>
                        <TableHead className="py-[12px] text-center">Views</TableHead>
                        <TableHead className="py-[12px] text-center">Like ER</TableHead>
                        <TableHead className="py-[12px] text-center">Items Sold</TableHead>
                        <TableHead className="py-[12px] text-right">GMV Organik</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const currentList = top10Tab === 'gmv' ? top10Creators?.byGmv :
                                            top10Tab === 'views' ? top10Creators?.byViews :
                                            top10Tab === 'er' ? top10Creators?.byER :
                                            top10Creators?.byItemsSold;

                        if (!currentList || currentList.length === 0) {
                          return (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-[24px] text-slate-500">
                                Belum ada data kreator untuk kategori ini.
                              </TableCell>
                            </TableRow>
                          );
                        }

                        return currentList.map((c: any, idx: number) => {
                          const rankColors = [
                            'bg-amber-100 text-amber-800 border-amber-300 font-bold', // #1 Emas
                            'bg-slate-200 text-slate-800 border-slate-300 font-bold', // #2 Perak
                            'bg-orange-100 text-orange-800 border-orange-300 font-bold' // #3 Perunggu
                          ];
                          const badgeClass = idx < 3 ? rankColors[idx] : 'bg-slate-50 text-slate-600 border-slate-200';

                          return (
                            <TableRow key={c.id || idx} className="hover:bg-slate-50/80 transition-colors">
                              <TableCell className="text-center py-[12px]">
                                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[12px] border ${badgeClass}`}>
                                  {idx + 1}
                                </span>
                              </TableCell>
                              <TableCell className="py-[12px]">
                                <div className="flex flex-col">
                                  <a 
                                    href={c.link_account || `https://www.tiktok.com/@${c.username}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="font-bold text-blue-600 hover:underline flex items-center gap-1"
                                  >
                                    @{c.username}
                                    <ExternalLink className="w-3 h-3 text-slate-400" />
                                  </a>
                                  {c.nama_asli && <span className="text-[11px] text-slate-500">{c.nama_asli}</span>}
                                </div>
                              </TableCell>
                              <TableCell className="text-center py-[12px] font-semibold">{c.total_vt} VT</TableCell>
                              <TableCell className={`text-center py-[12px] ${top10Tab === 'views' ? 'font-bold text-indigo-600' : ''}`}>
                                {(c.views || 0).toLocaleString()}
                              </TableCell>
                              <TableCell className={`text-center py-[12px] ${top10Tab === 'er' ? 'font-bold text-rose-600' : ''}`}>
                                {c.er || 0}%
                              </TableCell>
                              <TableCell className={`text-center py-[12px] ${top10Tab === 'itemsSold' ? 'font-bold text-amber-700' : ''}`}>
                                {(c.items_sold || 0).toLocaleString()} pcs
                              </TableCell>
                              <TableCell className={`text-right py-[12px] ${top10Tab === 'gmv' ? 'font-bold text-emerald-700' : 'font-medium'}`}>
                                Rp {(c.gmv || 0).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* === SECTION: WINNING CONCEPTS PERFORMANCE & VT SHOWCASE === */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50/50 p-[16px]">
                  <h3 className="font-bold flex items-center gap-[8px] text-slate-800 text-[16px]">
                    💡 Winning Concept Performance & VT Showcase
                  </h3>
                  <p className="text-[12px] text-slate-500 mt-1">
                    Evaluasi performa master brief konsep konten, penjualan, serta tautan video TikTok langsung
                  </p>
                </div>

                <div className="p-[16px] space-y-4">
                  {(!winningConcepts || winningConcepts.length === 0) ? (
                    <div className="text-center py-8 text-slate-400 text-[13px]">
                      Belum ada master konsep yang dikaitkan ke video pada campaign ini.
                    </div>
                  ) : (
                    winningConcepts.map((item: any, idx: number) => {
                      const cNo = item.concept?.no_konsep || idx + 1;
                      const isExpanded = !!expandedConcepts[cNo];
                      const totalVtConcept = item.total_vt || 0;
                      const gmvConcept = item.total_gmv || 0;
                      const viewsConcept = item.total_views || 0;
                      const itemsSoldConcept = item.items_sold || 0;

                      return (
                        <div key={cNo} className="border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors">
                          <div 
                            onClick={() => toggleConceptExpand(cNo)}
                            className="p-4 bg-slate-50/70 hover:bg-slate-100/60 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                          >
                            <div className="flex items-start md:items-center gap-3">
                              <span className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold flex items-center justify-center text-sm shrink-0">
                                #{cNo}
                              </span>
                              <div>
                                <h4 className="font-bold text-slate-800 text-[14px]">
                                  {item.concept?.judul_konsep || `Konsep #${cNo}`}
                                </h4>
                                <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500">
                                  {item.concept?.tier && (
                                    <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                                      Tier: {item.concept.tier}
                                    </span>
                                  )}
                                  {item.concept?.nama_produk && (
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                      Produk: {item.concept.nama_produk}
                                    </span>
                                  )}
                                  <span>{totalVtConcept} VT Terkait</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 md:gap-6 flex-wrap">
                              <div className="text-left md:text-right">
                                <p className="text-[11px] text-slate-500">Views & Like ER</p>
                                <p className="text-[13px] font-bold text-slate-800">
                                  {viewsConcept.toLocaleString()} <span className="text-[11px] font-normal text-rose-600">({item.er ?? 0}%)</span>
                                </p>
                              </div>
                              <div className="text-left md:text-right">
                                <p className="text-[11px] text-slate-500">Items Sold</p>
                                <p className="text-[13px] font-bold text-amber-800">
                                  {itemsSoldConcept.toLocaleString()} pcs
                                </p>
                              </div>
                              <div className="text-left md:text-right">
                                <p className="text-[11px] text-slate-500">Total GMV</p>
                                <p className="text-[14px] font-bold text-emerald-700">
                                  Rp {gmvConcept.toLocaleString()}
                                </p>
                              </div>
                              <button className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[12px] font-medium flex items-center gap-1.5 text-slate-700 transition-colors shadow-sm">
                                {isExpanded ? (
                                  <>Tutup VT <ChevronUp className="w-3.5 h-3.5" /></>
                                ) : (
                                  <>Lihat VT ({item.videos?.length || 0}) <ChevronDown className="w-3.5 h-3.5" /></>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Accordion Content: Video Links */}
                          {isExpanded && (
                            <div className="p-4 bg-white border-t border-slate-200">
                              {(!item.videos || item.videos.length === 0) ? (
                                <p className="text-[12px] text-slate-400 py-2">Belum ada video TikTok dengan link untuk konsep ini.</p>
                              ) : (
                                <div className="space-y-2">
                                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                                    Daftar Video TikTok yang Memakai Konsep Ini:
                                  </p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {item.videos.map((vid: any, vIdx: number) => (
                                      <div 
                                        key={vid.id || vIdx}
                                        className="p-3 border border-slate-100 rounded-lg bg-slate-50/50 hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors"
                                      >
                                        <div className="min-w-0">
                                          <p className="text-[12px] font-bold text-slate-800 truncate">
                                            @{vid.creator_username}
                                          </p>
                                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                            <span>Views: {(vid.views || 0).toLocaleString()}</span>
                                            <span>•</span>
                                            <span className="text-emerald-700 font-semibold">GMV: Rp {(vid.gmv || 0).toLocaleString()}</span>
                                          </div>
                                        </div>
                                        <a
                                          href={vid.link_video}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="shrink-0 px-2.5 py-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 text-[11px] font-bold flex items-center gap-1 transition-colors"
                                        >
                                          Buka VT <ExternalLink className="w-3 h-3" />
                                        </a>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Table Performa Kreator */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50/50 p-[16px] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h3 className="font-bold flex items-center gap-[8px] text-slate-800">
                    Performa per Kreator (Approved)
                  </h3>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Cari username..." 
                      className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      value={performaSearch}
                      onChange={(e) => { setPerformaSearch(e.target.value); setPerformaPage(0); }}
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <Table className="w-full text-[13px] whitespace-nowrap">
                    <TableHeader className="bg-white border-b border-slate-200">
                      <TableRow className="hover:bg-transparent">
                        <SortableHeader label="Creator" sortKey="username" currentSort={performaSort} onSort={(k) => handleSort('performa', k)} />
                        <SortableHeader label="Total VT" sortKey="total_vt" currentSort={performaSort} onSort={(k) => handleSort('performa', k)} className="text-center" />
                        <SortableHeader label="Total Live" sortKey="total_live" currentSort={performaSort} onSort={(k) => handleSort('performa', k)} className="text-center" />
                        <SortableHeader label="Item Sold" sortKey="items_sold" currentSort={performaSort} onSort={(k) => handleSort('performa', k)} className="text-center" />
                        <SortableHeader label="Total GMV" sortKey="total_gmv" currentSort={performaSort} onSort={(k) => handleSort('performa', k)} className="text-right" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPerforma.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-[32px] text-slate-500">Belum ada data kreator yang sesuai.</TableCell>
                        </TableRow>
                      ) : (
                        paginatedPerforma.map((c: any) => {
                          const username = c.creators?.username || 'Unknown';
                          const totalVt = c.total_vt || 0;
                          const totalLive = c.total_livestreams || 0;
                          const itemsSold = c.items_sold || 0;
                          const gmvOrganic = c.gmv_organic || 0;
                          const gmvAds = c.gmv_ads || 0;
                          const totalGmv = gmvOrganic + gmvAds;

                          return (
                            <TableRow key={c.id} className="transition-all duration-300 hover:bg-slate-50">
                              <TableCell className="font-semibold text-blue-600">
                                @{username}
                              </TableCell>
                              <TableCell className="text-center font-medium">
                                {totalVt}
                              </TableCell>
                              <TableCell className="text-center font-medium text-rose-500">
                                {totalLive}
                              </TableCell>
                              <TableCell className="text-center font-bold">
                                {itemsSold} pcs
                              </TableCell>
                              <TableCell className="text-right font-bold text-slate-800">
                                Rp {totalGmv.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                {/* Pagination Performa */}
                {performaTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50">
                    <span className="text-xs text-slate-500">
                      Menampilkan {performaPage * PAGE_SIZE + 1}-{Math.min((performaPage + 1) * PAGE_SIZE, filteredPerforma.length)} dari {filteredPerforma.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setPerformaPage(p => Math.max(0, p - 1))}
                        disabled={performaPage === 0}
                        className="p-1 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5 text-slate-600" />
                      </button>
                      <span className="text-xs font-medium text-slate-700">Hal {performaPage + 1} / {performaTotalPages}</span>
                      <button 
                        onClick={() => setPerformaPage(p => Math.min(performaTotalPages - 1, p + 1))}
                        disabled={performaPage === performaTotalPages - 1}
                        className="p-1 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-slate-600" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
        )}

        {activeTab === 'approval' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <Card className="shadow-sm border-blue-200">
              <CardHeader className="bg-blue-50 border-b border-blue-100 rounded-t-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-blue-900">Daftar Listing Kreator</CardTitle>
                  <p className="text-sm text-blue-700 mt-1">
                    Berikut adalah daftar kreator yang diajukan untuk campaign ini. 
                    {campaign.require_client_approval && " Silakan tentukan apakah Anda setuju untuk bekerja sama dengan mereka."}
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-48">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Cari username..." 
                      className="w-full pl-9 pr-3 py-1.5 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      value={listingSearch}
                      onChange={(e) => { setListingSearch(e.target.value); setListingPage(0); }}
                    />
                  </div>
                  <div className="relative">
                    <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select 
                      className="pl-9 pr-8 py-1.5 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none bg-white transition-all cursor-pointer"
                      value={listingTypeFilter}
                      onChange={(e) => { setListingTypeFilter(e.target.value); setListingPage(0); }}
                    >
                      <option value="all">Semua Konten</option>
                      <option value="video">Video</option>
                      <option value="live">Live</option>
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-white">
                      <TableRow>
                        <SortableHeader label="Kreator" sortKey="username" currentSort={listingSort} onSort={(k) => handleSort('listing', k)} className="w-48" />
                        <SortableHeader label="Followers" sortKey="followers" currentSort={listingSort} onSort={(k) => handleSort('listing', k)} />
                        <SortableHeader label="Level" sortKey="level" currentSort={listingSort} onSort={(k) => handleSort('listing', k)} />
                        <SortableHeader label="Tier" sortKey="tier" currentSort={listingSort} onSort={(k) => handleSort('listing', k)} />
                        <SortableHeader label="Tipe Konten" sortKey="content_type" currentSort={listingSort} onSort={(k) => handleSort('listing', k)} />
                        <SortableHeader label="Progres Sampel" sortKey="sample_progress" currentSort={listingSort} onSort={(k) => handleSort('listing', k)} />
                        {campaign.require_client_approval && <SortableHeader label="Notes Klien" sortKey="notes_client" currentSort={listingSort} onSort={(k) => handleSort('listing', k)} className="w-48" />}
                        {campaign.require_client_approval && <SortableHeader label="Status Approval Client" sortKey="status_approval" currentSort={listingSort} onSort={(k) => handleSort('listing', k)} className="w-48 text-center" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedListing.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={campaign.require_client_approval ? 8 : 6} className="text-center py-8 text-slate-500">Belum ada kreator yang sesuai pencarian.</TableCell>
                        </TableRow>
                      ) : (
                        paginatedListing.map((cc: any) => (
                          <TableRow key={cc.id}>
                            <TableCell className="align-top">
                              <div className="font-semibold text-slate-900">@{cc.creators?.username}</div>
                            </TableCell>
                            <TableCell className="align-top text-sm">
                              {formatAbbreviated(cc.followers, false)}
                            </TableCell>
                            <TableCell className="align-top text-sm">
                              {cc.level || '-'}
                            </TableCell>
                            <TableCell className="align-top">
                              <Badge variant="outline" className="capitalize text-xs">{cc.tier || '-'}</Badge>
                            </TableCell>
                            <TableCell className="align-top text-sm">
                              {cc.content_type || '-'}
                            </TableCell>
                            <TableCell className="align-top text-sm">
                              {cc.sample_progress || 'Belum dikirim'}
                            </TableCell>
                            {campaign.require_client_approval && (
                              <TableCell className="align-top">
                                <div className="relative">
                                  <textarea
                                    className="w-full text-xs p-2 border rounded border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none min-h-[60px]"
                                    placeholder="Tulis notes (opsional)..."
                                    value={editedNotesClient[cc.id] !== undefined ? editedNotesClient[cc.id] : (cc.notes_client || '')}
                                    onChange={(e) => {
                                      setEditedNotesClient(prev => ({ ...prev, [cc.id]: e.target.value }));
                                      // Optional: Add debounce for auto-save if desired.
                                      // We'll use onBlur to save for simplicity and fewer requests.
                                    }}
                                    onBlur={(e) => {
                                      if (editedNotesClient[cc.id] !== undefined && editedNotesClient[cc.id] !== (cc.notes_client || '')) {
                                        handleNotesClientAutoSave(cc.id, e.target.value);
                                      }
                                    }}
                                  />
                                  {autoSavingNotes[cc.id] && (
                                    <div className="absolute right-2 bottom-2">
                                      <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            )}
                            {campaign.require_client_approval && (
                              <TableCell className="align-top text-center">
                                <div className="flex flex-col items-center justify-center gap-2">
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => handleApproval(cc.id, 'approved')}
                                      disabled={isApproving === cc.id || cc.client_approval === 'approved'}
                                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                                        cc.client_approval === 'approved' 
                                          ? 'bg-green-600 text-white cursor-default' 
                                          : 'bg-slate-100 hover:bg-green-100 text-slate-600 hover:text-green-700'
                                      }`}
                                    >
                                      SETUJUI
                                    </button>
                                    <button 
                                      onClick={() => handleApproval(cc.id, 'rejected')}
                                      disabled={isApproving === cc.id || cc.client_approval === 'rejected'}
                                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                                        cc.client_approval === 'rejected' 
                                          ? 'bg-red-600 text-white cursor-default' 
                                          : 'bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-700'
                                      }`}
                                    >
                                      TOLAK
                                    </button>
                                  </div>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {/* Pagination Listing */}
                {listingTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-blue-100 bg-blue-50/30 rounded-b-xl">
                    <span className="text-xs text-slate-500">
                      Menampilkan {listingPage * PAGE_SIZE + 1}-{Math.min((listingPage + 1) * PAGE_SIZE, filteredListing.length)} dari {filteredListing.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setListingPage(p => Math.max(0, p - 1))}
                        disabled={listingPage === 0}
                        className="p-1 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5 text-blue-700" />
                      </button>
                      <span className="text-xs font-medium text-slate-700">Hal {listingPage + 1} / {listingTotalPages}</span>
                      <button 
                        onClick={() => setListingPage(p => Math.min(listingTotalPages - 1, p + 1))}
                        disabled={listingPage === listingTotalPages - 1}
                        className="p-1 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-blue-700" />
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'sampel' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle>Status Pengiriman Sampel</CardTitle>
                  <p className="text-sm text-slate-500 mt-1">
                    Pantau resi dan status pengiriman produk ke kreator yang telah disetujui.
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-48">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Cari username/resi..." 
                      className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      value={sampleSearch}
                      onChange={(e) => { setSampleSearch(e.target.value); setSamplePage(0); }}
                    />
                  </div>
                  <div className="relative">
                    <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select 
                      className="pl-9 pr-8 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none bg-white transition-all cursor-pointer"
                      value={sampleStatusFilter}
                      onChange={(e) => { setSampleStatusFilter(e.target.value); setSamplePage(0); }}
                    >
                      <option value="all">Semua Status</option>
                      <option value="belum diproses">Belum diproses</option>
                      <option value="diproses">Diproses</option>
                      <option value="dikirim">Dikirim</option>
                      <option value="diterima">Diterima</option>
                      <option value="kendala">Kendala</option>
                      <option value="batal">Batal</option>
                      <option value="resi_belum">Resi Belum Diisi</option>
                      <option value="resi_sudah">Resi Sudah Diisi</option>
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto pb-4">
                  <Table className="w-full whitespace-nowrap text-[13px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="py-[16px] px-3 sticky left-0 z-20 bg-slate-50 min-w-[50px] max-w-[50px]">No</TableHead>
                        <TableHead className="py-[16px] px-3 sticky left-[50px] z-20 bg-slate-50 min-w-[150px] max-w-[150px]">Product</TableHead>
                        <SortableHeader label="Username" sortKey="username" currentSort={sampleSort} onSort={(k) => handleSort('sample', k)} className="px-3 sticky left-[200px] z-20 bg-slate-50 min-w-[150px] max-w-[150px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" />
                        <TableHead className="py-[16px] px-3">No Whatsapp</TableHead>
                        <TableHead className="py-[16px] px-3 min-w-[150px]">Nama Penerima</TableHead>
                        <TableHead className="py-[16px] px-3 min-w-[200px]">Nama Jalan</TableHead>
                        <TableHead className="py-[16px] px-3">Provinsi</TableHead>
                        <TableHead className="py-[16px] px-3">Kabupaten/Kota</TableHead>
                        <TableHead className="py-[16px] px-3">Kecamatan</TableHead>
                        <TableHead className="py-[16px] px-3">Kelurahan</TableHead>
                        <TableHead className="py-[16px] px-3">Kode Pos</TableHead>
                        <SortableHeader label="Proses" sortKey="proses" currentSort={sampleSort} onSort={(k) => handleSort('sample', k)} className="px-3 min-w-[120px]" />
                        <SortableHeader label="Tanggal Kirim" sortKey="tanggal_kirim" currentSort={sampleSort} onSort={(k) => handleSort('sample', k)} className="px-3" />
                        <SortableHeader label="Resi" sortKey="resi" currentSort={sampleSort} onSort={(k) => handleSort('sample', k)} className="px-3" />
                        <SortableHeader label="Ekspedisi" sortKey="ekspedisi" currentSort={sampleSort} onSort={(k) => handleSort('sample', k)} className="px-3" />
                        <TableHead className="py-[16px] px-3 min-w-[150px]">Notes</TableHead>
                        <TableHead className="py-[16px] px-3">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedSamples.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={16} className="text-center py-8 text-slate-500">Belum ada data pengiriman sampel yang sesuai.</TableCell>
                        </TableRow>
                      ) : (
                        paginatedSamples.map((addr: any, idx: number) => {
                          const cc = approvalList.find((c: any) => c.id === addr.campaign_creator_id);
                          const skuNames = (cc?.assigned_sku_ids || []).map((id: number) => {
                            const sku = skus?.find((s: any) => s.id === id);
                            return sku ? sku.nama_produk : '';
                          }).filter(Boolean);
                          const noWhatsapp = cc?.no_whatsapp || '-';

                          return (
                            <TableRow key={addr.id} className="hover:bg-slate-50/50 group">
                              <TableCell className="px-3 py-3 text-center sticky left-0 z-10 bg-white group-hover:bg-slate-50 transition-colors min-w-[50px] max-w-[50px]">{samplePage * PAGE_SIZE + idx + 1}</TableCell>
                              <TableCell className="px-3 py-3 whitespace-normal sticky left-[50px] z-10 bg-white group-hover:bg-slate-50 transition-colors min-w-[150px] max-w-[150px]">
                                <div className="flex flex-col gap-1 w-[150px]">
                                  {skuNames.length > 0 ? (
                                    skuNames.map((name: string, i: number) => (
                                      <span key={i} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[11px] px-2 py-0.5 rounded border border-blue-100">{name}</span>
                                    ))
                                  ) : (
                                    <span className="text-[11px] text-slate-400 italic">Belum dipilih</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="px-3 py-3 font-medium sticky left-[200px] z-10 bg-white group-hover:bg-slate-50 transition-colors min-w-[150px] max-w-[150px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">@{addr.creator_username}</TableCell>
                              <TableCell className="px-3 py-3">{noWhatsapp}</TableCell>
                              <TableCell className="px-3 py-3">{addr.nama_penerima || '-'}</TableCell>
                              <TableCell className="px-3 py-3 whitespace-normal">{addr.nama_jalan || '-'}</TableCell>
                              <TableCell className="px-3 py-3">{addr.provinsi || '-'}</TableCell>
                              <TableCell className="px-3 py-3">{addr.kabupaten_kota || '-'}</TableCell>
                              <TableCell className="px-3 py-3">{addr.kecamatan || '-'}</TableCell>
                              <TableCell className="px-3 py-3">{addr.kelurahan || '-'}</TableCell>
                              <TableCell className="px-3 py-3">{addr.kode_pos || '-'}</TableCell>
                              <TableCell className="px-3 py-3">
                                <select 
                                  className="w-full text-[12px] p-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white" 
                                  value={editedSamples[addr.id]?.proses ?? (addr.proses || 'Belum diproses')} 
                                  onChange={e => handleAutoSave(addr.id, 'proses', e.target.value)}
                                >
                                  <option value="Belum diproses">Belum diproses</option>
                                  <option value="Diproses">Diproses</option>
                                  <option value="Dikirim">Dikirim</option>
                                  <option value="Diterima">Diterima</option>
                                  <option value="Kendala [FUI]">Kendala [FUI]</option>
                                  <option value="Batal">Batal</option>
                                </select>
                              </TableCell>
                              <TableCell className="px-3 py-3">
                                {editedSamples[addr.id]?.proses === 'Dikirim' ? 'Akan set hari ini' : (addr.tanggal_kirim || '-')}
                              </TableCell>
                              <TableCell className="px-3 py-3 font-mono">
                                <div className="flex flex-col">
                                  <input 
                                    type="text" 
                                    className="w-full text-[12px] p-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white min-w-[120px]" 
                                    placeholder="Input resi..." 
                                    value={editedSamples[addr.id]?.resi ?? (addr.resi || '')} 
                                    onChange={e => handleQueueUpdate(addr.id, 'resi', e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                      }
                                    }}
                                    onBlur={e => handleAutoSave(addr.id, 'resi', e.target.value)} 
                                  />
                                  {addr.resi_updated_at && (
                                    <span className="text-[9px] text-slate-400 mt-1 leading-tight">
                                      Diupdate oleh {addr.resi_updated_by || 'Unknown'} <br/>
                                      {formatDateTimeShort(addr.resi_updated_at)}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="px-3 py-3">
                                <input 
                                  type="text" 
                                  className="w-full text-[12px] p-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white min-w-[100px]" 
                                  placeholder="Ekspedisi..." 
                                  value={editedSamples[addr.id]?.ekspedisi ?? (addr.ekspedisi || '')} 
                                  onChange={e => handleQueueUpdate(addr.id, 'ekspedisi', e.target.value)}
                                  onBlur={e => handleAutoSave(addr.id, 'ekspedisi', e.target.value)} 
                                />
                              </TableCell>
                              <TableCell className="px-3 py-3 whitespace-normal">
                                <input 
                                  type="text" 
                                  className="w-full text-[12px] p-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white min-w-[150px]" 
                                  placeholder="Notes..." 
                                  value={editedSamples[addr.id]?.notes ?? (addr.notes || '')} 
                                  onChange={e => handleQueueUpdate(addr.id, 'notes', e.target.value)}
                                  onBlur={e => handleAutoSave(addr.id, 'notes', e.target.value)} 
                                />
                              </TableCell>
                              <TableCell className="px-3 py-3 text-center">
                                {autoSavingItems[addr.id] ? (
                                  <span className="inline-flex items-center gap-1.5 px-[8px] py-[2px] border border-blue-200 rounded-[4px] text-[10px] font-semibold text-blue-600 uppercase bg-blue-50">
                                    <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
                                    Menyimpan...
                                  </span>
                                ) : (
                                  <span className="inline-block px-[8px] py-[2px] border border-slate-200 rounded-[4px] text-[10px] font-semibold text-slate-500 uppercase bg-slate-100">
                                    {cc?.client_approval === 'NOT_REQUIRED' ? 'APPROVED' : (cc?.client_approval || 'pending')}
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                {/* Pagination Sampel */}
                {sampleTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50 -mx-6 -mb-6 mt-4">
                    <span className="text-xs text-slate-500">
                      Menampilkan {samplePage * PAGE_SIZE + 1}-{Math.min((samplePage + 1) * PAGE_SIZE, filteredSamples.length)} dari {filteredSamples.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setSamplePage(p => Math.max(0, p - 1))}
                        disabled={samplePage === 0}
                        className="p-1 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5 text-slate-600" />
                      </button>
                      <span className="text-xs font-medium text-slate-700">Hal {samplePage + 1} / {sampleTotalPages}</span>
                      <button 
                        onClick={() => setSamplePage(p => Math.min(sampleTotalPages - 1, p + 1))}
                        disabled={samplePage === sampleTotalPages - 1}
                        className="p-1 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-slate-600" />
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'live' && (() => {
          const allLives: any[] = data.actualLives || [];

          // Pre-compute semua agregat dari full dataset (sama seperti internal dashboard)
          const cGmvMap    = new Map<string, number>();
          const cSessMap   = new Map<string, number>();
          const cViewsMap  = new Map<string, number>();
          const cLikesMap  = new Map<string, number>();
          allLives.forEach((l: any) => {
            const u = l.creator_username;
            if (u) {
              cGmvMap.set(u,   (cGmvMap.get(u)   || 0) + (Number(l.gmv)         || 0));
              cSessMap.set(u,  (cSessMap.get(u)   || 0) + 1);
              cViewsMap.set(u, (cViewsMap.get(u)  || 0) + (Number(l.video_views) || 0));
              cLikesMap.set(u, (cLikesMap.get(u)  || 0) + (Number(l.video_likes) || 0));
            }
          });

          const top5BySess = Array.from(cSessMap.entries()).sort((a,b) => b[1]-a[1]).slice(0,5)
            .map(([username, sessions]) => ({ username, sessions, gmv: cGmvMap.get(username)||0, views: cViewsMap.get(username)||0, likes: cLikesMap.get(username)||0 }));

          const top5ByGmv = Array.from(cGmvMap.entries()).sort((a,b) => b[1]-a[1]).slice(0,5)
            .map(([username, gmv]) => ({ username, gmv, sessions: cSessMap.get(username)||0, views: cViewsMap.get(username)||0, likes: cLikesMap.get(username)||0 }));

          const top5Sessions = [...allLives].filter((l:any) => (l.gmv||0) > 0).sort((a:any,b:any) => (b.gmv||0)-(a.gmv||0)).slice(0,5);

          const rankBadge = (i: number) => ({ 1:'🥇', 2:'🥈', 3:'🥉' }[i] ?? `#${i}`);
          const fmtRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

          return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">

            {/* ── Leaderboard ── */}
            {allLives.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Card 1: Top 5 Kreator — Live Terbanyak */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-[14px]">🏆 Top 5 Kreator — Live Terbanyak</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {top5BySess.length === 0 ? <p className="text-sm text-slate-500 italic">Belum ada data</p> : (
                      <ol className="space-y-3">
                        {top5BySess.map((c, idx) => {
                          const gpm = c.views > 0 ? c.gmv / c.views * 1000 : 0;
                          return (
                            <li key={c.username} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[14px] w-6 text-center shrink-0">{rankBadge(idx+1)}</span>
                                <span className="flex-1 text-[13px] font-semibold truncate">@{c.username}</span>
                                <span className="text-[13px] font-bold text-blue-600 shrink-0">{c.sessions} sesi</span>
                              </div>
                              <div className="ml-8 grid grid-cols-2 gap-x-2 text-[11px] text-slate-500">
                                <span>👁 {c.views.toLocaleString('id-ID')} views</span>
                                <span>❤️ {c.likes.toLocaleString('id-ID')} likes</span>
                                <span>💰 {fmtRp(c.gmv)}</span>
                                <span>📊 GPM {fmtRp(Math.round(gpm))}</span>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </CardContent>
                </Card>

                {/* Card 2: Top 5 Kreator — GMV Live Terbanyak */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-[14px]">💰 Top 5 Kreator — GMV Live Terbanyak</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {top5ByGmv.length === 0 ? <p className="text-sm text-slate-500 italic">Belum ada data GMV</p> : (
                      <ol className="space-y-3">
                        {top5ByGmv.map((c, idx) => {
                          const gpm = c.views > 0 ? c.gmv / c.views * 1000 : 0;
                          return (
                            <li key={c.username} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[14px] w-6 text-center shrink-0">{rankBadge(idx+1)}</span>
                                <span className="flex-1 text-[13px] font-semibold truncate">@{c.username}</span>
                                <span className="text-[13px] font-bold text-green-600 shrink-0">{fmtRp(c.gmv)}</span>
                              </div>
                              <div className="ml-8 grid grid-cols-2 gap-x-2 text-[11px] text-slate-500">
                                <span>🎬 {c.sessions} sesi</span>
                                <span>👁 {c.views.toLocaleString('id-ID')} views</span>
                                <span>❤️ {c.likes.toLocaleString('id-ID')} likes</span>
                                <span>📊 GPM {fmtRp(Math.round(gpm))}</span>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </CardContent>
                </Card>

                {/* Card 3: Top 5 Sesi Live — GMV Per Sesi */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-[14px]">🔥 Top 5 Sesi Live — GMV Per Sesi</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {top5Sessions.length === 0 ? <p className="text-sm text-slate-500 italic">Belum ada data GMV</p> : (
                      <ol className="space-y-3">
                        {top5Sessions.map((live: any, idx: number) => {
                          const views = Number(live.video_views)||0;
                          const likes = Number(live.video_likes)||0;
                          const gmv   = Number(live.gmv)||0;
                          const gpm   = views > 0 ? gmv / views * 1000 : 0;
                          return (
                            <li key={live.content_uid||idx} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[14px] w-6 text-center shrink-0">{rankBadge(idx+1)}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] font-semibold truncate">@{live.creator_username}</div>
                                  <div className="text-[11px] text-slate-400">{live.start_time ? new Date(live.start_time).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}) : '—'}{live.duration_str ? ` · ${live.duration_str}` : ''}</div>
                                </div>
                                <span className="text-[13px] font-bold text-green-600 shrink-0">{fmtRp(gmv)}</span>
                              </div>
                              <div className="ml-8 grid grid-cols-2 gap-x-2 text-[11px] text-slate-500">
                                <span>👁 {views.toLocaleString('id-ID')} views</span>
                                <span>❤️ {likes.toLocaleString('id-ID')} likes</span>
                                <span>📊 GPM {fmtRp(Math.round(gpm))}</span>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </CardContent>
                </Card>

              </div>
            )}

            {/* ── Jadwal Table ── */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle>Jadwal Live Kreator</CardTitle>
                  <p className="text-sm text-slate-500 mt-1">Jadwal sesi live streaming yang telah disepakati.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                  <select 
                    className="w-full sm:w-auto px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={liveFilterType}
                    onChange={(e) => { setLiveFilterType(e.target.value); setLivePage(0); }}
                  >
                    <option value="all">Semua</option>
                    <option value="most_lives">Live Terbanyak</option>
                    <option value="highest_gmv">GMV Tertinggi</option>
                  </select>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Cari username..." 
                      className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      value={liveSearch}
                      onChange={(e) => { setLiveSearch(e.target.value); setLivePage(0); }}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <SortableHeader label="Kreator" sortKey="username" currentSort={liveSort} onSort={(k) => handleSort('live', k)} className="w-48" />
                        <SortableHeader label="Tanggal Live" sortKey="tanggal_live" currentSort={liveSort} onSort={(k) => handleSort('live', k)} />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLive.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center py-8 text-slate-500">Belum ada jadwal live yang sesuai pencarian.</TableCell>
                        </TableRow>
                      ) : (
                        paginatedLive.map((cc: any) => {
                          const username = cc.creators?.username;
                          const creatorSchedules = schedules.filter((s: any) => s.campaign_creator_id === cc.id);
                          const creatorLives = data.actualLives?.filter((l: any) => l.creator_username === username) || [];
                          
                          const allDates = new Set<string>();
                          creatorSchedules.forEach((s: any) => allDates.add(new Date(s.tanggal_live).toISOString().substring(0, 10)));
                          creatorLives.forEach((l: any) => {
                              if (l.start_time) allDates.add(new Date(l.start_time).toISOString().substring(0, 10));
                          });
                          const sortedDates = Array.from(allDates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

                          return (
                            <TableRow key={cc.id}>
                              <TableCell className="align-top">
                                <div className="font-semibold text-slate-800">@{username}</div>
                              </TableCell>
                              <TableCell className="align-top">
                                {sortedDates.length === 0 ? (
                                    <span className="text-sm text-slate-500 italic">Belum ada jadwal atau sesi live.</span>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                            <div className="text-sm">
                                                <span className="text-slate-500">Total Sesi Live:</span>
                                                <span className="ml-2 font-bold text-slate-800">{cc._totalLiveSessions || 0}</span>
                                            </div>
                                            <div className="text-sm">
                                                <span className="text-slate-500">Total GMV:</span>
                                                <span className="ml-2 font-bold text-green-600">{fmtRp(cc._totalLiveGmv || 0)}</span>
                                            </div>
                                            <div className="text-sm">
                                                <span className="text-slate-500">Total Views:</span>
                                                <span className="ml-2 font-bold text-slate-800">{creatorLives.reduce((acc: number, l: any) => acc + (l.video_views || 0), 0).toLocaleString('id-ID')}</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                            {sortedDates.map(dateStr => {
                                                const schedule = creatorSchedules.find((s: any) => new Date(s.tanggal_live).toISOString().substring(0, 10) === dateStr);
                                            const livesOnDate = creatorLives.filter((l: any) => l.start_time && l.start_time.startsWith(dateStr));
                                            
                                            const totalViews = sumNum(livesOnDate, (l: any) => l.video_views);
                                            const campaignGmv = sumNum(livesOnDate, (l: any) => l.gmv);
                                            
                                            const isScheduled = !!schedule;
                                            const isDone = livesOnDate.length > 0;
                                            const todayDate = new Date().toISOString().substring(0, 10);
                                            const isPast = dateStr < todayDate;
                                            
                                            let bgColor = 'bg-blue-50 border-blue-200';
                                            let textColor = 'text-blue-800';
                                            let icon = <Calendar className="w-5 h-5 text-blue-500" />;
                                            let statusText = 'Menunggu pelaksanaan Live...';
                                            
                                            if (isScheduled && isDone) {
                                                bgColor = 'bg-green-50 border-green-200';
                                                textColor = 'text-green-800';
                                                icon = <CheckCircle2 className="w-5 h-5 text-green-600" />;
                                                statusText = 'Live sesuai jadwal.';
                                            } else if (isScheduled && !isDone) {
                                                if (isPast) {
                                                    bgColor = 'bg-red-50 border-red-200';
                                                    textColor = 'text-red-800';
                                                    icon = <XCircle className="w-5 h-5 text-red-500" />;
                                                    statusText = 'Kreator tidak melakukan Live pada jadwal ini (Tidak ada data terdeteksi).';
                                                }
                                            } else if (!isScheduled && isDone) {
                                                bgColor = 'bg-yellow-50 border-yellow-200';
                                                textColor = 'text-yellow-800';
                                                icon = <CheckCircle2 className="w-5 h-5 text-yellow-600" />;
                                                statusText = 'Live tambahan (Di luar jadwal).';
                                            }
                                            
                                            return (
                                                <div key={dateStr} className={`flex items-start gap-3 p-3 rounded-lg border ${bgColor}`}>
                                                  <div className="mt-0.5">
                                                    {icon}
                                                  </div>
                                                  <div className="flex-1">
                                                    <div className={`text-[14px] font-semibold ${textColor}`}>
                                                      {new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </div>
                                                    <div className={`mt-1 text-sm italic ${textColor} opacity-80`}>
                                                        {statusText}
                                                    </div>
                                                    
                                                    {isDone && (
                                                      <div className="mt-3 space-y-2">
                                                          {livesOnDate.map((live: any, idx: number) => {
                                                              const views = live.video_views || 0;
                                                              const likes = live.video_likes || 0;
                                                              const gmv = live.gmv || 0;
                                                              const orders = live.orders || 0;
                                                              const gpm = views > 0 ? (gmv / views * 1000).toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '0';

                                                              return (
                                                                  <div key={idx} className="bg-white/60 p-2 rounded text-sm text-slate-700 border border-black/5">
                                                                      <div className="flex justify-between items-center font-medium mb-2">
                                                                          <span>Sesi #{idx + 1} {live.duration_str ? `(${live.duration_str})` : ''}</span>
                                                                          <span className="text-xs text-slate-500">ID: {live.content_uid}</span>
                                                                      </div>
                                                                      <div className="grid grid-cols-3 gap-2 text-xs">
                                                                          <div>
                                                                              <div className="opacity-70 mb-0.5">Views</div>
                                                                              <div className="font-semibold">{views.toLocaleString('id-ID')}</div>
                                                                          </div>
                                                                          <div>
                                                                              <div className="opacity-70 mb-0.5">Likes</div>
                                                                              <div className="font-semibold">{likes.toLocaleString('id-ID')}</div>
                                                                          </div>
                                                                          <div>
                                                                              <div className="opacity-70 mb-0.5">Durasi</div>
                                                                              <div className="font-semibold">{live.duration_str || '—'}</div>
                                                                          </div>
                                                                          <div>
                                                                              <div className="opacity-70 mb-0.5">Orders</div>
                                                                              <div className="font-semibold">{orders.toLocaleString('id-ID')}</div>
                                                                          </div>
                                                                          <div>
                                                                              <div className="opacity-70 mb-0.5">GMV</div>
                                                                              <div className="font-semibold text-green-700">Rp {gmv.toLocaleString('id-ID')}</div>
                                                                          </div>
                                                                          <div>
                                                                              <div className="opacity-70 mb-0.5">GPM (per Ribu Views)</div>
                                                                              <div className="font-semibold text-purple-700">Rp {gpm}</div>
                                                                          </div>
                                                                      </div>
                                                                  </div>
                                                              );
                                                          })}
                                                          {livesOnDate.length > 1 && (
                                                              <div className="mt-2 pt-2 border-t border-black/10 flex justify-between font-semibold text-sm">
                                                                  <span>Total Harian:</span>
                                                                  <div className="flex gap-4">
                                                                      <span>{totalViews.toLocaleString('id-ID')} Views</span>
                                                                      <span>Rp {campaignGmv.toLocaleString('id-ID')}</span>
                                                                  </div>
                                                              </div>
                                                          )}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    </div>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                {/* Pagination Live */}
                {liveTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50 mt-4 -mx-6 -mb-6">
                    <span className="text-xs text-slate-500">
                      Menampilkan {livePage * PAGE_SIZE + 1}-{Math.min((livePage + 1) * PAGE_SIZE, filteredLive.length)} dari {filteredLive.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setLivePage(p => Math.max(0, p - 1))}
                        disabled={livePage === 0}
                        className="p-1 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5 text-slate-600" />
                      </button>
                      <span className="text-xs font-medium text-slate-700">Hal {livePage + 1} / {liveTotalPages}</span>
                      <button 
                        onClick={() => setLivePage(p => Math.min(liveTotalPages - 1, p + 1))}
                        disabled={livePage === liveTotalPages - 1}
                        className="p-1 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-slate-600" />
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          );
        })()}

        {activeTab === 'video' as any && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <Card className="shadow-sm border-blue-200">
              <CardHeader className="bg-blue-50 border-b border-blue-100 rounded-t-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-blue-900">Daftar Video Konten</CardTitle>
                  <p className="text-sm text-blue-700 mt-1">
                    Berikut adalah daftar video TikTok yang telah dibuat dan diposting oleh kreator.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <div className="bg-white p-1 rounded-md flex border border-blue-200">
                    <button 
                      onClick={() => { setVideoFilterView('creator'); setVideoSort(null); setVideoPage(0); }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded ${videoFilterView === 'creator' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Per Kreator
                    </button>
                    <button 
                      onClick={() => { setVideoFilterView('video'); setVideoSort({ key: 'latest_post', direction: 'desc' }); setVideoPage(0); }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded ${videoFilterView === 'video' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Semua Video
                    </button>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Cari username..." 
                      className="w-full pl-9 pr-3 py-1.5 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      value={videoSearch}
                      onChange={(e) => { setVideoSearch(e.target.value); setVideoPage(0); }}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className={`overflow-x-auto ${isVideoFiltering ? 'opacity-50 transition-opacity' : 'transition-opacity'}`}>
                  {videoFilterView === 'creator' ? (
                    <Table>
                      <TableHeader className="bg-white">
                        <TableRow>
                          <TableHead className="w-16 text-center">No</TableHead>
                          <SortableHeader label="Kreator" sortKey="username" currentSort={videoSort} onSort={(k) => handleSort('video', k)} className="w-48" />
                          <SortableHeader label="Total Video" sortKey="total_videos" currentSort={videoSort} onSort={(k) => handleSort('video', k)} className="w-32 text-center" />
                          <SortableHeader label="Total Views" sortKey="total_views" currentSort={videoSort} onSort={(k) => handleSort('video', k)} className="text-right" />
                          <SortableHeader label="Total Likes" sortKey="total_likes" currentSort={videoSort} onSort={(k) => handleSort('video', k)} className="text-right" />
                          <SortableHeader label="Total Sales GMV" sortKey="total_gmv" currentSort={videoSort} onSort={(k) => handleSort('video', k)} className="text-right" />
                          <TableHead className="w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedVideo.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-slate-500">Belum ada video yang sesuai pencarian.</TableCell>
                          </TableRow>
                        ) : (
                          paginatedVideo.map((creatorGroup: any, index: number) => (
                            <React.Fragment key={creatorGroup.creator_username || index}>
                              <TableRow 
                                className="hover:bg-slate-50 transition-colors cursor-pointer group"
                                onClick={() => setExpandedVideos(prev => ({...prev, [creatorGroup.creator_username]: !prev[creatorGroup.creator_username]}))}
                              >
                                <TableCell className="text-center font-medium text-slate-500">{videoPage * PAGE_SIZE + index + 1}</TableCell>
                                <TableCell>
                                  <a 
                                    href={`https://www.tiktok.com/@${creatorGroup.creator_username}`} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="font-bold text-blue-600 hover:text-blue-800 hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    @{creatorGroup.creator_username}
                                  </a>
                                </TableCell>
                                <TableCell className="text-center font-semibold text-slate-700">
                                  {creatorGroup.total_videos} Video
                                </TableCell>
                                <TableCell className="text-right font-medium text-slate-700">{creatorGroup.total_views > 0 ? creatorGroup.total_views.toLocaleString() : '-'}</TableCell>
                                <TableCell className="text-right font-medium text-slate-700">{creatorGroup.total_likes > 0 ? creatorGroup.total_likes.toLocaleString() : '-'}</TableCell>
                                <TableCell className="text-right font-bold text-green-700">
                                  Rp {creatorGroup.total_gmv.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-center">
                                  {expandedVideos[creatorGroup.creator_username] ? (
                                    <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-blue-500 mx-auto" />
                                  ) : (
                                    <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-blue-500 mx-auto" />
                                  )}
                                </TableCell>
                              </TableRow>
                              {expandedVideos[creatorGroup.creator_username] && (
                                <TableRow className="bg-slate-50/50">
                                  <TableCell colSpan={7} className="p-0 border-b-2 border-slate-200">
                                    <div className="px-16 py-4">
                                      <Table className="w-full text-sm bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                        <TableHeader className="bg-slate-100/50">
                                          <TableRow>
                                            <TableHead className="w-12 text-center text-slate-500">No</TableHead>
                                            <TableHead>Tanggal Posting</TableHead>
                                            <TableHead>Link Video</TableHead>
                                            <TableHead className="text-right text-slate-500">Views</TableHead>
                                            <TableHead className="text-right text-slate-500">Likes</TableHead>
                                            <TableHead className="text-right text-slate-500">Sales GMV</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {creatorGroup.videos
                                            .sort((a: any, b: any) => {
                                              const timeA = a.post_time ? new Date(a.post_time).getTime() : 0;
                                              const timeB = b.post_time ? new Date(b.post_time).getTime() : 0;
                                              return timeB - timeA;
                                            })
                                            .map((v: any, vIdx: number) => (
                                            <TableRow key={v.id || vIdx}>
                                              <TableCell className="text-center text-slate-400">{vIdx + 1}</TableCell>
                                              <TableCell className="font-medium text-slate-600 whitespace-nowrap">
                                                {v.post_time ? new Date(v.post_time).toLocaleString('id-ID', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '-'}
                                              </TableCell>
                                              <TableCell>
                                                {v.link_video ? (
                                                  <div className="flex items-center gap-3">
                                                    <a href={v.link_video} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 font-medium">
                                                      <Video className="w-4 h-4" /> Nonton
                                                    </a>
                                                    <a href={v.link_video} target="_blank" rel="noreferrer" className="bg-slate-100 hover:bg-slate-200 p-1.5 rounded-md transition-colors" title="Buka di tab baru">
                                                      <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                                                    </a>
                                                  </div>
                                                ) : (
                                                  <span className="text-slate-400 italic">Belum ada link</span>
                                                )}
                                                {v.isAuto && (
                                                  <span className="inline-block mt-1 bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold">Auto Tracked</span>
                                                )}
                                              </TableCell>
                                              <TableCell className="text-right font-medium text-slate-600">{v.views > 0 ? v.views.toLocaleString() : '-'}</TableCell>
                                              <TableCell className="text-right font-medium text-slate-600">{v.likes > 0 ? v.likes.toLocaleString() : '-'}</TableCell>
                                              <TableCell className="text-right font-semibold text-green-700">Rp {(v.gmv || 0).toLocaleString()}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  ) : (
                    <Table>
                      <TableHeader className="bg-white">
                        <TableRow>
                          <TableHead className="w-16 text-center">No</TableHead>
                          <TableHead className="w-48">Kreator</TableHead>
                          <SortableHeader label="Tanggal Posting" sortKey="latest_post" currentSort={videoSort} onSort={(k) => handleSort('video', k)} />
                          <TableHead>Link Video</TableHead>
                          <SortableHeader label="Views" sortKey="views" currentSort={videoSort} onSort={(k) => handleSort('video', k)} className="text-right" />
                          <SortableHeader label="Likes" sortKey="likes" currentSort={videoSort} onSort={(k) => handleSort('video', k)} className="text-right" />
                          <SortableHeader label="Sales GMV" sortKey="gmv" currentSort={videoSort} onSort={(k) => handleSort('video', k)} className="text-right" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedFlatVideo.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-slate-500">Belum ada video yang sesuai pencarian.</TableCell>
                          </TableRow>
                        ) : (
                          paginatedFlatVideo.map((v: any, index: number) => (
                            <TableRow key={v.id || index} className="hover:bg-slate-50 transition-colors">
                              <TableCell className="text-center font-medium text-slate-500">{videoPage * PAGE_SIZE + index + 1}</TableCell>
                              <TableCell>
                                <a 
                                  href={`https://www.tiktok.com/@${v.creator_username}`} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="font-bold text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  @{v.creator_username}
                                </a>
                              </TableCell>
                              <TableCell className="font-medium text-slate-600 whitespace-nowrap">
                                {v.post_time ? new Date(v.post_time).toLocaleString('id-ID', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '-'}
                              </TableCell>
                              <TableCell>
                                {v.link_video ? (
                                  <div className="flex items-center gap-3">
                                    <a href={v.link_video} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 font-medium">
                                      <Video className="w-4 h-4" /> Nonton
                                    </a>
                                    <a href={v.link_video} target="_blank" rel="noreferrer" className="bg-slate-100 hover:bg-slate-200 p-1.5 rounded-md transition-colors" title="Buka di tab baru">
                                      <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                                    </a>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic">Belum ada link</span>
                                )}
                                {v.isAuto && (
                                  <span className="inline-block mt-1 bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold">Auto Tracked</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-medium text-slate-700">{v.views > 0 ? v.views.toLocaleString() : '-'}</TableCell>
                              <TableCell className="text-right font-medium text-slate-700">{v.likes > 0 ? v.likes.toLocaleString() : '-'}</TableCell>
                              <TableCell className="text-right font-bold text-green-700">Rp {(v.gmv || 0).toLocaleString()}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  )}
                </div>
                {/* Pagination Video */}
                {(videoFilterView === 'creator' ? videoTotalPages : flatVideoTotalPages) > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-blue-100 bg-blue-50/30 rounded-b-xl">
                    <span className="text-xs text-slate-500">
                      Menampilkan {videoPage * PAGE_SIZE + 1}-{Math.min((videoPage + 1) * PAGE_SIZE, videoFilterView === 'creator' ? filteredVideo.length : flatVideos.length)} dari {videoFilterView === 'creator' ? filteredVideo.length : flatVideos.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setVideoPage(p => Math.max(0, p - 1))}
                        disabled={videoPage === 0}
                        className="p-1 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5 text-blue-700" />
                      </button>
                      <span className="text-xs font-medium text-slate-700">Hal {videoPage + 1} / {videoFilterView === 'creator' ? videoTotalPages : flatVideoTotalPages}</span>
                      <button 
                        onClick={() => setVideoPage(p => Math.min((videoFilterView === 'creator' ? videoTotalPages : flatVideoTotalPages) - 1, p + 1))}
                        disabled={videoPage === (videoFilterView === 'creator' ? videoTotalPages : flatVideoTotalPages) - 1}
                        className="p-1 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-blue-700" />
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
