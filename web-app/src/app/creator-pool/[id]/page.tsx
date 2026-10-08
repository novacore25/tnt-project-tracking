"use client";

import { useDatabaseStore } from "@/store/useDatabaseStore";
import { getCreatorType, getLatestSnapshot, computeCampaignGMV, computeHighestVideoGMV, getJenisKerjasama, sumNum, toNum, normalizeKurs } from "@/utils/computed";
import { useDraftLocalStorage } from "@/hooks/useDraftLocalStorage";
import { formatAbbreviated } from "@/utils/formatters";




import { ArrowLeft, UserPlus, Phone, CreditCard, Activity, ArrowUpDown, ChevronDown, ChevronRight, Edit, Save, Plus, X, Trash2, Check, Video, TrendingUp, DollarSign, Calendar, Users, Briefcase, ExternalLink, ArrowRight, TrendingDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, ReactNode, useEffect, useRef, useCallback, useMemo } from "react";
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Edit2 } from "lucide-react";
import { 
  fetchCreatorProfile, 
  addCreatorAliasAction, 
  removeCreatorAliasAction, 
  setPrimaryCreatorAliasAction,
  addCreatorPicContactAction,
  deleteCreatorPicContactAction,
  addCreatorIdentityAction,
  deleteCreatorIdentityAction,
  addCreatorContractAction,
  deleteCreatorContractAction,
  addCreatorBankAccountAction,
  deleteCreatorBankAccountAction
} from "@/app/actions/creatorActions";
import { saveCreatorAddressBookAction, deleteCreatorAddressBookAction, fetchCreatorNotesAction } from "@/app/actions/databaseActions";
import { useAuth } from "@/providers/AuthProvider";

export default function CreatorProfilePage() {
  const { id } = useParams();
  const creatorId = Number(id);
  const { profile } = useAuth();
  const { 
    niches, 
    campaigns,
    skus,
    addCreatorSnapshot,
    updateCreatorContact,
    updateCreator,
    addCreatorNote,
    addCampaignCreator,
  } = useDatabaseStore();

  const [isLoading, setIsLoading] = useState(true);
  const [localData, setLocalData] = useState<{
    creator: any;
    snapshots: any[];
    contacts: any[];
    creatorNiches: any[];
    notes: any[];
    ccs: any[];
    videos: any[];
    sales: any[];
    ads: any[];
    addressBook: any[];
    auditLogs: any[];
    liveSessions: any[];
    liveProducts: any[];
    organicVideos: any[];
    aliases?: any[];
    picContacts?: any[];
    identities?: any[];
    contracts?: any[];
    bankAccounts?: any[];
  } | null>(null);

  const fetchCreatorData = useCallback(async () => {
    if (!creatorId) return;
    setIsLoading(true);
    try {
      const data = await fetchCreatorProfile(creatorId);
      setLocalData(data);
    } catch (err) {
      console.error("Error fetching creator data:", err);
      setLocalData(null);
    } finally {
      setIsLoading(false);
    }
  }, [creatorId]);

  useEffect(() => {
    fetchCreatorData();
  }, [fetchCreatorData]);

  // Derived states based on localData
  const creator = localData?.creator;
  const snapshots = localData?.snapshots?.sort((a: any, b: any) => {
    const timeDiff = new Date(b.tanggal_update || 0).getTime() - new Date(a.tanggal_update || 0).getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.id - a.id;
  }) || [];
  const latestSnapshot = snapshots[0] || null;
  const mergedProfile = snapshots.reduce((acc, curr) => ({
    followers: acc.followers ?? curr.followers,
    tier: acc.tier ?? curr.tier,
    audience_age: acc.audience_age ?? curr.audience_age,
    level: acc.level ?? curr.level,
    ratecard: acc.ratecard ?? curr.ratecard,
    gmv_30d: acc.gmv_30d ?? curr.gmv_30d,
  }), { followers: null, tier: null, audience_age: null, level: null, ratecard: null, gmv_30d: null } as any);

  const latestCampaignPrice = useMemo(() => {
    if (!localData?.ccs || localData.ccs.length === 0) return null;
    const sortedCcs = [...localData.ccs].sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    const found = sortedCcs.find((c: any) => c.price !== null && c.price !== undefined);
    return found ? toNum(found.price) : null;
  }, [localData?.ccs]);

  const effectiveRatecard = mergedProfile.ratecard != null ? toNum(mergedProfile.ratecard) : latestCampaignPrice;
  
  const tier = mergedProfile.tier || 'Unknown';
  
  const activeContact = localData?.contacts?.find((c: any) => c.status === 'aktif');
  
  const displayNiches = localData?.creatorNiches
    ?.sort((a: any, b: any) => a.peringkat - b.peringkat)
    ?.map((cn: any) => niches.find(n => n.id === cn.niche_id)?.nama)
    ?.filter(Boolean) || [];

  const notes = localData?.notes?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || [];
  
  const nonPrimaryAliases = useMemo(() => {
    const list = Array.isArray(localData?.aliases) ? localData.aliases : [];
    const activeUsername = (creator?.username || '').toLowerCase();
    return list.filter((a: any) => {
      const aliasName = (a?.alias_username || '').toLowerCase();
      return Boolean(aliasName && aliasName !== activeUsername && !a?.is_primary);
    });
  }, [localData?.aliases, creator?.username]);

  // States
  const [tiktokEmbedOpen, setTiktokEmbedOpen] = useState(true);
  const tiktokRef = useRef<HTMLDivElement>(null);

  // Load TikTok embed script when accordion is open
  useEffect(() => {
    if (!tiktokEmbedOpen || !creator?.username) return;
    // Remove old script if any to force re-render
    const existingScript = document.querySelector('script[src="https://www.tiktok.com/embed.js"]');
    if (existingScript) existingScript.remove();
    // Small delay to let DOM render the blockquote first
    const timer = setTimeout(() => {
      const script = document.createElement('script');
      script.src = 'https://www.tiktok.com/embed.js';
      script.async = true;
      document.body.appendChild(script);
    }, 100);
    return () => clearTimeout(timer);
  }, [tiktokEmbedOpen, creator?.username]);

  const [sortField, setSortField] = useState<'gmv' | 'highestVideoGmv' | 'campaign_name' | 'price'>('gmv');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [videoSortField, setVideoSortField] = useState<'urutan' | 'views' | 'sold' | 'gmv'>('urutan');
  const [videoSortOrder, setVideoSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleVideoSort = (field: 'urutan' | 'views' | 'sold' | 'gmv') => {
    if (videoSortField === field) {
      setVideoSortOrder(videoSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setVideoSortField(field);
      setVideoSortOrder('desc'); // default high to low for metrics
    }
  };

  // Peta product_id -> campaign_id. Wajib dipakai karena sebagian besar baris
  // `sales` punya campaign_id NULL; keterkaitannya ke campaign hanya bisa
  // dibaca lewat product_id yang terdaftar di `skus`.
  const skuCampaignMap = new Map<string, number>();
  skus?.forEach(s => {
    if (s.product_id) skuCampaignMap.set(String(s.product_id), s.campaign_id);
  });

  let trackRecords = (localData?.ccs || [])
    .map((cc: any) => {
      const campaign = campaigns.find(c => c.id === cc.campaign_id);

      const campaignSales = localData?.sales?.filter((s: any) => {
        // Cocok lewat campaign_id ATAU lewat SKU. Versi lama hanya memakai
        // campaign_id, sehingga GMV yang terhubung via SKU hilang semua.
        const pId = s.product_id || s.raw_data?.['Product ID'];
        const mappedCid = pId != null ? skuCampaignMap.get(String(pId)) : undefined;
        if (s.campaign_id !== cc.campaign_id && mappedCid !== cc.campaign_id) return false;
        if (!campaign) return true;
        const dateStr = s.tanggal ? s.tanggal.substring(0, 10) : '';
        if (campaign.start_date && dateStr < campaign.start_date) return false;
        if (campaign.end_date && dateStr > campaign.end_date) return false;
        return true;
      }) || [];
      const gmv = sumNum(campaignSales, (s: any) => s.gmv);

      const manualVideos = localData?.videos?.filter((v: any) => v.campaign_creator_id === cc.id) || [];
      const uniqueVideoIds = new Set<string>();
      manualVideos.forEach((v: any) => {
        if (v.content_uid) {
          const cleanUid = String(v.content_uid).replace(/^video_/, '').trim();
          if (cleanUid) uniqueVideoIds.add(cleanUid);
        }
        if (v.link_video) {
          const m = String(v.link_video).match(/video\/(\d+)/i);
          if (m) uniqueVideoIds.add(m[1]);
        }
      });
      let totalVtCount = manualVideos.length;

      campaignSales.forEach((s: any) => {
        let vid = s.content_uid ? String(s.content_uid).replace(/^video_/, '').trim() : '';
        if (vid && vid !== '-' && !uniqueVideoIds.has(vid)) {
          uniqueVideoIds.add(vid);
          totalVtCount++;
        }
      });

      // Kumpulkan video organik non-live milik campaign ini
      const campaignOrganicVideos = localData?.organicVideos?.filter((ov: any) => {
        const cType = String(ov.content_type || '').toLowerCase();
        if (cType === 'live' || cType === 'livestream') return false;
        if (!ov.content_uid || ov.content_uid === '-' || ov.content_uid.trim() === '') return false;
        const pId = ov.product_id;
        const mappedCid = pId != null ? skuCampaignMap.get(String(pId)) : undefined;
        return ov.campaign_id === cc.campaign_id || mappedCid === cc.campaign_id;
      }) || [];

      campaignOrganicVideos.forEach((ov: any) => {
        let vid = ov.content_uid ? String(ov.content_uid).replace(/^video_/, '').trim() : '';
        if (vid && vid !== '-' && !uniqueVideoIds.has(vid)) {
          uniqueVideoIds.add(vid);
          totalVtCount++;
        }
      });

      return {
        ...cc,
        campaign_name: campaign?.nama || 'Unknown',
        gmv: gmv,
        highestVideoGmv: computeHighestVideoGMV(cc, localData?.videos || [], localData?.sales || []),
        jenis_kerjasama: getJenisKerjasama(cc.price),
        totalVtCount
      };
    });

  trackRecords = trackRecords.sort((a, b) => {
    let comparison = 0;
    if (sortField === 'gmv') comparison = a.gmv - b.gmv;
    else if (sortField === 'highestVideoGmv') comparison = a.highestVideoGmv - b.highestVideoGmv;
    else if (sortField === 'price') comparison = a.price - b.price;
    else if (sortField === 'campaign_name') comparison = a.campaign_name.localeCompare(b.campaign_name);
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const { groupedSales, groupedLive, groupedVideos } = useMemo(() => {
    const gSales: Record<string, any[]> = { 'lainnya': [] };
    const gLive: Record<string, any[]> = { 'lainnya': [] };
    const gVideos: Record<string, any[]> = { 'lainnya': [] };

    const skuMap: Record<string, number> = {};
    skus?.forEach(s => {
      if (s.product_id) skuMap[s.product_id] = s.campaign_id;
    });

    trackRecords.forEach(tr => {
      const cid = tr.campaign_id.toString();
      gSales[cid] = [];
      gLive[cid] = [];
      gVideos[cid] = [];
    });

    localData?.sales?.forEach(sale => {
      const pId = sale.product_id || sale.raw_data?.['Product ID'];
      const mappedCid = (pId && skuMap[pId]) ? skuMap[pId].toString() : null;
      if (mappedCid && gSales[mappedCid] !== undefined) {
        const campaign = campaigns.find(c => c.id.toString() === mappedCid);
        const dateStr = sale.tanggal ? sale.tanggal.substring(0, 10) : '';
        if (campaign?.start_date && dateStr < campaign.start_date) return;
        if (campaign?.end_date && dateStr > campaign.end_date) return;
        gSales[mappedCid].push(sale);
      } else {
        gSales['lainnya'].push(sale);
      }
    });

    localData?.liveSessions?.forEach(session => {
      const products = localData?.liveProducts?.filter(p => p.livestream_room_id === session.livestream_room_id) || [];
      const campaignIds = new Set<string>();
      products.forEach(p => {
        const pId = p.product_id;
        if (pId && skuMap[pId]) campaignIds.add(skuMap[pId].toString());
      });

      if (campaignIds.size === 0) {
        gLive['lainnya'].push(session);
      } else {
        campaignIds.forEach(cid => {
          if (gLive[cid] !== undefined) gLive[cid].push(session);
          else gLive['lainnya'].push(session); 
        });
      }
    });

    localData?.organicVideos?.forEach(video => {
      const videoSales = localData?.sales?.filter((s: any) => s.content_uid === video.content_uid) || [];
      const campaignIds = new Set<string>();

      videoSales.forEach(s => {
        const pId = s.product_id || s.raw_data?.['Product ID'];
        if (pId && skuMap[pId]) campaignIds.add(skuMap[pId].toString());
      });

      const manualVid = localData?.videos?.find((v: any) => v.content_uid === video.content_uid);
      if (manualVid) {
        const cc = localData?.ccs?.find((c: any) => c.id === manualVid.campaign_creator_id);
        if (cc) campaignIds.add(cc.campaign_id.toString());
      }

      if (video.campaign_id) {
        campaignIds.add(video.campaign_id.toString());
      }
      const vidPid = video.product_id;
      if (vidPid && skuMap[vidPid]) {
        campaignIds.add(skuMap[vidPid].toString());
      }

      if (campaignIds.size === 0) {
        gVideos['lainnya'].push(video);
      } else {
        campaignIds.forEach(cid => {
          if (gVideos[cid] !== undefined) gVideos[cid].push(video);
          else gVideos['lainnya'].push(video); 
        });
      }
    });

    return { groupedSales: gSales, groupedLive: gLive, groupedVideos: gVideos };
  }, [localData, trackRecords, skus]);

  const campaignTabsList = [
    ...trackRecords.map(tr => ({ id: tr.campaign_id.toString(), name: tr.campaign_name })),
    { id: 'lainnya', name: 'Lainnya / Tidak Masuk Campaign' }
  ];

  const [expandedCampaignTabs, setExpandedCampaignTabs] = useState<Record<string, boolean>>({});
  const toggleCampaignTab = (cid: string) => {
    setExpandedCampaignTabs(prev => ({ ...prev, [cid]: !prev[cid] }));
  };

  const [snapForm, setSnapForm] = useState({ audience_age: '', level: '', gmv_30d: '', followers: '', tier: '', ratecard: '' });
  const [snapOpen, setSnapOpen] = useState(false);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<number, boolean>>({});
  
  const [activeHistoryTab, setActiveHistoryTab] = useState<'campaign' | 'live' | 'video' | 'sales'>('campaign');
  const [expandedLiveSessions, setExpandedLiveSessions] = useState<Record<string, boolean>>({});

  const toggleLiveSession = (roomId: string) => {
    setExpandedLiveSessions(prev => ({ ...prev, [roomId]: !prev[roomId] }));
  };

  const toggleCampaign = (id: number) => {
    setExpandedCampaigns(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const [contactForm, setContactForm] = useState('');
  const [contactOpen, setContactOpen] = useState(false);

  const [rekForm, setRekForm] = useState({ rekening: '', nama_asli: '' });
  const [rekOpen, setRekOpen] = useState(false);

  const [noteForm, setNoteForm, clearNoteDraft] = useDraftLocalStorage(`draft_note_creator_${creatorId}`, { isi: '', penulis: '' });
  const [noteOpen, setNoteOpen] = useState(false);

  const [nicheForm, setNicheForm] = useState<number[]>([]);
  const [nicheOpen, setNicheOpen] = useState(false);
  
  const [addressOpen, setAddressOpen] = useState(false);
  const [addressForm, setAddressForm] = useState({
    id: null as number | null,
    label: '',
    nama_penerima: '',
    alamat_jalan: '',
    kecamatan: '',
    kota: '',
    provinsi: '',
    kodepos: ''
  });

  const [campForm, setCampForm] = useState({ campaign_id: '', price: 0, qty_vt: 1 });
  const [campOpen, setCampOpen] = useState(false);
  const [tarikBusy, setTarikBusy] = useState(false);
  // Notice setelah tarik ke campaign: data mana yang masih perlu dilengkapi.
  const [tarikNotice, setTarikNotice] = useState<{ campaignId: number; campaignName: string; missing: string[] } | null>(null);

  const [videoLink, setVideoLink] = useState('');
  const [activeCcId, setActiveCcId] = useState<number | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);

  const [aliasModalOpen, setAliasModalOpen] = useState(false);
  const [newAliasInput, setNewAliasInput] = useState('');
  const [newAliasNotes, setNewAliasNotes] = useState('');
  const [aliasBusy, setAliasBusy] = useState(false);

  const [picContactOpen, setPicContactOpen] = useState(false);
  const [picContactForm, setPicContactForm] = useState({ namaPic: '', nomorWa: '', isPrimary: false });

  const [identityOpen, setIdentityOpen] = useState(false);
  const [identityForm, setIdentityForm] = useState({ nik: '', namaKtp: '', alamatKtp: '', linkKtp: '', isPrimary: false });

  const [bankAccountOpen, setBankAccountOpen] = useState(false);
  const [bankAccountForm, setBankAccountForm] = useState({ bankName: '', accountNumber: '', accountHolder: '', isPrimary: false });

  const [contractOpen, setContractOpen] = useState(false);
  const [contractForm, setContractForm] = useState({ judulKontrak: '', linkKontrak: '', campaignId: undefined as number | undefined });

  if (isLoading) return <div className="p-8 text-center text-slate-500">Memuat data kreator...</div>;
  if (!creator) return <div className="p-8 text-center">Creator tidak ditemukan.</div>;

  const handleUpdateSnapshot = async () => {
    try {
      await addCreatorSnapshot({
        creator_id: creatorId,
        tanggal_update: new Date().toISOString().split('T')[0],
        audience_age: snapForm.audience_age || null,
        followers: snapForm.followers ? parseInt(snapForm.followers) : null,
        tier: snapForm.tier || null,
        level: snapForm.level ? parseInt(snapForm.level) : null,
        ratecard: snapForm.ratecard ? parseInt(snapForm.ratecard) : (snapForm.ratecard === '0' ? 0 : null),
        gmv_30d: snapForm.gmv_30d ? parseInt(snapForm.gmv_30d) : null,
        updated_by: profile?.nama || null
      } as any);

      setSnapOpen(false);
      window.location.reload();
      setSnapForm({ audience_age: '', level: '', gmv_30d: '', followers: '', tier: '', ratecard: '' });
    } catch (err: any) {
      alert("Gagal update profil: " + err.message);
    }
  };

  const handleAddAlias = async () => {
    if (!creatorId || !newAliasInput.trim() || aliasBusy) return;
    setAliasBusy(true);
    try {
      const res = await addCreatorAliasAction({
        creatorId,
        aliasUsername: newAliasInput.trim(),
        notes: newAliasNotes.trim() || undefined,
      });
      if (!res.success) {
        alert(res.error || 'Gagal menambahkan alias.');
      } else {
        alert(res.message || 'Alias berhasil ditambahkan.');
        setNewAliasInput('');
        setNewAliasNotes('');
        await fetchCreatorData();
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + (err?.message || String(err)));
    } finally {
      setAliasBusy(false);
    }
  };

  const handleRemoveAlias = async (aliasUsername: string) => {
    if (!confirm(`Yakin ingin menghapus alias @${aliasUsername}?`)) return;
    setAliasBusy(true);
    try {
      const res = await removeCreatorAliasAction({
        creatorId,
        aliasUsername,
      });
      if (!res.success) {
        alert(res.error || 'Gagal menghapus alias.');
      } else {
        await fetchCreatorData();
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + (err?.message || String(err)));
    } finally {
      setAliasBusy(false);
    }
  };

  const handleSetPrimaryAlias = async (aliasUsername: string) => {
    if (!confirm(`Yakin ingin mengubah username utama menjadi @${aliasUsername}?\n\nUsername master dan link akun TikTok akan diperbarui ke @${aliasUsername}. Username lama tetap tersimpan sebagai alias.`)) return;
    setAliasBusy(true);
    try {
      const res = await setPrimaryCreatorAliasAction({
        creatorId,
        aliasUsername,
      });
      if (!res.success) {
        alert(res.error || 'Gagal mengubah username utama.');
      } else {
        alert(res.message || 'Username utama berhasil diperbarui.');
        await fetchCreatorData();
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + (err?.message || String(err)));
    } finally {
      setAliasBusy(false);
    }
  };

  const handleAddPicContact = async () => {
    if (!picContactForm.namaPic.trim() || !picContactForm.nomorWa.trim()) {
      return alert("Nama PIC dan Nomor WA wajib diisi.");
    }
    const res = await addCreatorPicContactAction({
      creatorId,
      namaPic: picContactForm.namaPic.trim(),
      nomorWa: picContactForm.nomorWa.trim(),
      isPrimary: picContactForm.isPrimary
    });
    if (!res.success) return alert(res.error || "Gagal menyimpan kontak PIC.");
    setPicContactOpen(false);
    setPicContactForm({ namaPic: '', nomorWa: '', isPrimary: false });
    await fetchCreatorData();
  };

  const handleDeletePicContact = async (id: number) => {
    if (!confirm("Hapus kontak PIC ini?")) return;
    const res = await deleteCreatorPicContactAction(id, creatorId);
    if (!res.success) return alert(res.error || "Gagal menghapus kontak.");
    await fetchCreatorData();
  };

  const handleAddIdentity = async () => {
    if (!identityForm.nik.trim()) return alert("NIK wajib diisi.");
    const res = await addCreatorIdentityAction({
      creatorId,
      nik: identityForm.nik.trim(),
      namaKtp: identityForm.namaKtp.trim() || undefined,
      alamatKtp: identityForm.alamatKtp.trim() || undefined,
      linkKtp: identityForm.linkKtp.trim() || undefined,
      isPrimary: identityForm.isPrimary
    });
    if (!res.success) return alert(res.error || "Gagal menyimpan KTP.");
    setIdentityOpen(false);
    setIdentityForm({ nik: '', namaKtp: '', alamatKtp: '', linkKtp: '', isPrimary: false });
    await fetchCreatorData();
  };

  const handleDeleteIdentity = async (id: number) => {
    if (!confirm("Hapus identitas KTP ini?")) return;
    const res = await deleteCreatorIdentityAction(id, creatorId);
    if (!res.success) return alert(res.error || "Gagal menghapus identitas.");
    await fetchCreatorData();
  };

  const handleAddBankAccount = async () => {
    if (!bankAccountForm.bankName.trim() || !bankAccountForm.accountNumber.trim() || !bankAccountForm.accountHolder.trim()) {
      return alert("Bank, nomor rekening, dan nama pemilik rekening wajib diisi.");
    }
    const res = await addCreatorBankAccountAction({
      creatorId,
      bankName: bankAccountForm.bankName.trim(),
      accountNumber: bankAccountForm.accountNumber.trim(),
      accountHolder: bankAccountForm.accountHolder.trim(),
      isPrimary: bankAccountForm.isPrimary
    });
    if (!res.success) return alert(res.error || "Gagal menyimpan rekening.");
    setBankAccountOpen(false);
    setBankAccountForm({ bankName: '', accountNumber: '', accountHolder: '', isPrimary: false });
    await fetchCreatorData();
  };

  const handleDeleteBankAccount = async (id: number) => {
    if (!confirm("Hapus rekening bank ini?")) return;
    const res = await deleteCreatorBankAccountAction(id, creatorId);
    if (!res.success) return alert(res.error || "Gagal menghapus rekening.");
    await fetchCreatorData();
  };

  const handleAddContract = async () => {
    if (!contractForm.linkKontrak.trim()) return alert("Link kontrak GDrive wajib diisi.");
    const res = await addCreatorContractAction({
      creatorId,
      campaignId: contractForm.campaignId,
      judulKontrak: contractForm.judulKontrak.trim() || undefined,
      linkKontrak: contractForm.linkKontrak.trim()
    });
    if (!res.success) return alert(res.error || "Gagal menyimpan kontrak.");
    setContractOpen(false);
    setContractForm({ judulKontrak: '', linkKontrak: '', campaignId: undefined });
    await fetchCreatorData();
  };

  const handleDeleteContract = async (id: number) => {
    if (!confirm("Hapus dokumen kontrak ini?")) return;
    const res = await deleteCreatorContractAction(id, creatorId);
    if (!res.success) return alert(res.error || "Gagal menghapus kontrak.");
    await fetchCreatorData();
  };

  const handleUpdateContact = async () => {
    if(!contactForm) return;
    await updateCreatorContact(creatorId, contactForm);
    setContactOpen(false);
    setContactForm('');
  };

  const handleUpdateRekening = async () => {
    await updateCreator(creatorId, { rekening: rekForm.rekening, nama_asli: rekForm.nama_asli });
    setRekOpen(false);
  };

  const handleUpdateAddress = async () => {
    try {
      const payload: any = {
        id: addressForm.id,
        creator_id: creatorId,
        label: addressForm.label,
        nama_penerima: addressForm.nama_penerima,
        alamat_jalan: addressForm.alamat_jalan,
        kecamatan: addressForm.kecamatan,
        kota: addressForm.kota,
        provinsi: addressForm.provinsi,
        kodepos: addressForm.kodepos
      };

      const res = await saveCreatorAddressBookAction(payload);
      if (res.success) {
        setLocalData(prev => prev ? { 
          ...prev, 
          addressBook: payload.id 
            ? (prev.addressBook || []).map(a => a.id === payload.id ? res.data : a)
            : [res.data, ...(prev.addressBook || [])]
        } : null);
      }
      
      setAddressOpen(false);
    } catch (err: any) {
      alert("Gagal update alamat: " + err.message);
    }
  };

  const handleDeleteAddress = async (id: number) => {
    if(!confirm('Yakin hapus alamat ini?')) return;
    const res = await deleteCreatorAddressBookAction(id, creatorId);
    if (res.success) {
      setLocalData(prev => prev ? { ...prev, addressBook: res.data } : null);
    }
  };

  const handleUpdateNiche = async () => {
    await useDatabaseStore.getState().updateCreatorNiches(creatorId, nicheForm);
    setNicheOpen(false);
    window.location.reload();
  };

  const handleAddNote = async () => {
    if(!noteForm.isi) return;
    await addCreatorNote({
      creator_id: creatorId,
      isi: noteForm.isi,
      penulis: profile?.nama || 'System'
    });
    
    // Also re-fetch the notes so UI updates immediately
    const res = await fetchCreatorNotesAction(creatorId);
    if (res.success && res.data) {
      setLocalData(prev => prev ? { ...prev, notes: res.data } : prev);
    }

    setNoteOpen(false);
    clearNoteDraft();
  };

  const handleTarikCampaign = async () => {
    if (!campForm.campaign_id || tarikBusy) return;
    setTarikBusy(true);
    try {
      const campaignName = campaigns.find(c => String(c.id) === String(campForm.campaign_id))?.nama || '';

      const res: any = await addCampaignCreator({
        campaign_id: Number(campForm.campaign_id),
        creator_id: creatorId,
        assigned_sku_ids: null,
        tier: null,
        price: campForm.price,
        qty_vt: campForm.qty_vt,
        content_type: null,
        approval: 'pending',
        status_bayar: 'belum',
        pic_assist: profile?.nama || null,
        notes_manager: null,
        notes_pic: null,
        sample_progress: null,
        gmv_organic_legacy: null,
        gmv_ads_legacy: null,
        nominal_pelunasan: null,
        tgl_pembayaran: null,
        client_approval: 'pending',
        added_by: profile?.id || null,
        approved_by: null,
        approved_at: null,
        not_approved_by: null,
        not_approved_at: null,
        payment_updated_by: null,
        payment_updated_at: null
      });

      // WAJIB dicek. Sebelumnya hasilnya diabaikan sehingga "Berhasil" tetap
      // muncul walau INSERT-nya gagal.
      if (!res?.success) {
        alert(`GAGAL menarik kreator ke campaign.\n\n${res?.error || 'Penyebab tidak diketahui.'}`);
        return;
      }

      setCampOpen(false);
      setCampForm({ campaign_id: '', price: 0, qty_vt: 1 });

      const missing: string[] = res.missing || [];
      if (missing.length > 0) {
        setTarikNotice({ campaignId: Number(campForm.campaign_id), campaignName, missing });
      } else {
        alert(`Berhasil menarik @${creator.username} ke campaign "${campaignName}".\n\nStatus: Pending, menunggu persetujuan manager.`);
      }
    } catch (err: any) {
      alert(`GAGAL menarik kreator ke campaign.\n\n${err?.message || 'Terjadi kesalahan.'}`);
    } finally {
      setTarikBusy(false);
    }
  };

  const handleAddVideo = async () => {
    if (!videoLink || !activeCcId) return;
    try {
      let content_uid = videoLink.trim();
      const match = videoLink.match(/video\/(\d+)/);
      if (match) {
        content_uid = match[1];
      } else if (!/^\d+$/.test(content_uid)) {
        alert("Link tidak valid.");
        return;
      }

      const username = creator.username.startsWith('@') ? creator.username : `@${creator.username}`;
      const longLink = `https://www.tiktok.com/${username}/video/${content_uid}`;

      await useDatabaseStore.getState().addVideo({
        campaign_creator_id: activeCcId,
        content_uid: content_uid,
        link_video: longLink,
        urutan: 1,
        vt_approval: 'pending',
        concept: null,
        sku_id: null
      });
      setVideoOpen(false);
      setVideoLink('');
      setActiveCcId(null);
    } catch (err: any) {
      alert("Gagal menyimpan video.");
    }
  };

  const handleSort = (field: 'gmv' | 'highestVideoGmv' | 'campaign_name' | 'price') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/creator-pool">
          <button className="btn btn-outline"><ArrowLeft className="w-4 h-4" /></button>
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-[90px] h-[90px] rounded-full overflow-hidden border-2 border-slate-200 bg-slate-100 flex-shrink-0 flex items-center justify-center">
            {creator.avatar_url ? (
              <img src={creator.avatar_url} alt={creator.username} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-4xl font-bold text-slate-400">{creator.username.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">@{creator.username}</h1>
              <span className="badge b-sales">{tier}</span>
              <a href={creator.link_account || `https://www.tiktok.com/@${creator.username}`} target="_blank" rel="noopener noreferrer" className="inline-block hover:opacity-80 transition-opacity">
                <img src="/logo-tiktok-landscape-button.svg" alt="TikTok" className="h-[36px]" />
              </a>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {nonPrimaryAliases.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
                  <span className="font-semibold text-slate-600">Username Sebelumnya:</span>
                  {nonPrimaryAliases.map((a: any, idx: number) => (
                    <span key={idx} className="bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded border border-slate-200" title={a.notes || undefined}>
                      @{a.alias_username}
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => setAliasModalOpen(true)}
                className="text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                title="Kelola riwayat username atau tambahkan alias baru"
              >
                <Users className="w-3 h-3" />
                Kelola Alias
              </button>
            </div>
            <p className="text-slate-500 mt-0.5">{creator.nama_asli || 'Nama asli belum diisi'}</p>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <Dialog open={snapOpen} onOpenChange={setSnapOpen}>
            <DialogTrigger asChild>
              <button className="btn btn-outline"><Activity className="w-4 h-4 mr-2" /> Update Data</button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Update Data Snapshot</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium">Followers</label>
                  <input 
                    type="number" 
                    value={snapForm.followers} 
                    onChange={e => {
                      const f = e.target.value;
                      let newTier = 'Nano';
                      const numF = (f !== '' && parseInt(f) !== 0) ? parseInt(f) : (mergedProfile.followers || 0);
                      if (numF < 10000) newTier = 'Nano';
                      else if (numF < 100000) newTier = 'Micro';
                      else if (numF < 1000000) newTier = 'Macro';
                      else newTier = 'Mega';
                      setSnapForm({...snapForm, followers: f, tier: newTier});
                    }} 
                    className="w-full p-2 border rounded" 
                    placeholder={mergedProfile.followers || ''} 
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Tier</label>
                  <input type="text" value={snapForm.tier} onChange={e=>setSnapForm({...snapForm, tier: e.target.value})} className="w-full p-2 border rounded bg-slate-100 cursor-not-allowed" placeholder={mergedProfile.tier || ''} disabled />
                  <p className="text-xs text-slate-500 mt-1">Tier dihitung otomatis berdasarkan Followers.</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Audience Age</label>
                  <input type="text" value={snapForm.audience_age} onChange={e=>setSnapForm({...snapForm, audience_age: e.target.value})} className="w-full p-2 border rounded" placeholder={mergedProfile.audience_age || ''} />
                </div>
                <div>
                  <label className="text-sm font-medium">Level Creator</label>
                  <input type="number" value={snapForm.level} onChange={e=>setSnapForm({...snapForm, level: e.target.value})} className="w-full p-2 border rounded" placeholder={mergedProfile.level || ''} />
                </div>
                <div>
                  <label className="text-sm font-medium">Ratecard</label>
                  <input type="number" value={snapForm.ratecard} onChange={e=>setSnapForm({...snapForm, ratecard: e.target.value})} className="w-full p-2 border rounded" placeholder={mergedProfile.ratecard?.toString() || ''} />
                  <p className="text-xs text-slate-500 mt-1">Isi 0 untuk Barter.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estimasi GMV 30 Hari Terakhir (Rp)</label>
                  <input type="number" value={snapForm.gmv_30d} onChange={e=>setSnapForm({...snapForm, gmv_30d: e.target.value})} className="w-full p-2 border rounded" placeholder={mergedProfile.gmv_30d?.toString() || '0'} />
                </div>
                <button className="btn btn-primary w-full" onClick={handleUpdateSnapshot}>Simpan Snapshot</button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={campOpen} onOpenChange={setCampOpen}>
            <DialogTrigger asChild>
              <button className="btn btn-primary"><UserPlus className="w-4 h-4 mr-2" /> Tarik ke Campaign</button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Tarik Creator ke Campaign</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pilih Campaign Aktif</label>
                  <select value={campForm.campaign_id} onChange={e=>setCampForm({...campForm, campaign_id: e.target.value})} className="w-full p-2 border rounded bg-white">
                    <option value="">-- Pilih Campaign --</option>
                    {campaigns.filter(c => c.status === 'aktif').map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Rate Card (0 = Barter)</label>
                    <input type="number" value={campForm.price} onChange={e=>setCampForm({...campForm, price: Number(e.target.value)})} className="w-full p-2 border rounded" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Qty Video</label>
                    <input type="number" value={campForm.qty_vt} onChange={e=>setCampForm({...campForm, qty_vt: Number(e.target.value)})} className="w-full p-2 border rounded" />
                  </div>
                </div>
                <button className="btn btn-primary w-full" onClick={handleTarikCampaign} disabled={!campForm.campaign_id || tarikBusy}>
                  {tarikBusy ? 'Menyimpan...' : 'Tambahkan ke Listing'}
                </button>
                {campForm.price === 0 && campForm.campaign_id ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                    Rate Card 0 berarti <strong>barter</strong>. Kalau bukan barter, isi rate cardnya dulu.
                  </p>
                ) : null}
              </div>
            </DialogContent>
          </Dialog>

          {/* Notice data yang masih perlu dilengkapi setelah ditarik ke campaign */}
          <Dialog open={!!tarikNotice} onOpenChange={(v) => { if (!v) setTarikNotice(null); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Kreator Berhasil Ditambahkan
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <p className="text-sm text-slate-600">
                  @{creator?.username} sudah masuk ke campaign <strong>{tarikNotice?.campaignName}</strong>{' '}
                  dengan status <strong>Pending</strong>, menunggu persetujuan manager.
                </p>

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Data berikut belum lengkap ({tarikNotice?.missing.length}):
                  </p>
                  <ul className="mt-2 space-y-1">
                    {tarikNotice?.missing.map((m) => (
                      <li key={m} className="text-sm text-amber-900 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-sm text-slate-700">
                  Silakan <strong>lengkapi data tersebut di menu Listing</strong> pada campaign
                  <strong> {tarikNotice?.campaignName}</strong>. Kreator dengan data belum lengkap tidak bisa
                  dipakai untuk perhitungan.
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setTarikNotice(null)}>Nanti Saja</Button>
                  <Link href={`/campaigns/${tarikNotice?.campaignId}/listing`}>
                    <Button className="flex items-center gap-2">
                      Buka Listing <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Dialog Kelola Username & Alias */}
          <Dialog open={aliasModalOpen} onOpenChange={setAliasModalOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  Kelola Username & Alias (@{creator?.username || ''})
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <p className="text-xs text-slate-500">
                  Jika kreator mengganti username TikTok, daftarkan username baru/lama di sini. Semua data penjualan, video, dan live dari seluruh alias akan otomatis terhubung ke profil ini.
                </p>

                {/* Daftar Alias Terdaftar */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Daftar Username Terdaftar
                  </label>
                  <div className="border rounded-lg divide-y max-h-56 overflow-y-auto bg-slate-50/50">
                    {/* Username Utama (Master) */}
                    <div className="p-2.5 flex items-center justify-between bg-white text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">@{creator?.username || ''}</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                          Utama (Aktif)
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">Akun Master</span>
                    </div>

                    {/* Alias-alias non-primary */}
                    {nonPrimaryAliases.map((a: any, idx: number) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between bg-white text-sm hover:bg-slate-50 transition-colors">
                        <div className="space-y-0.5 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700">@{a.alias_username}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 font-medium px-1.5 py-0.5 rounded border border-slate-200">
                              Alias
                            </span>
                          </div>
                          {a.notes && <p className="text-xs text-slate-500">{a.notes}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleSetPrimaryAlias(a.alias_username)}
                            disabled={aliasBusy}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition-colors"
                            title="Jadikan sebagai username utama"
                          >
                            Jadikan Utama
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveAlias(a.alias_username)}
                            disabled={aliasBusy}
                            className="text-xs text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition-colors"
                            title="Hapus alias ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {nonPrimaryAliases.length === 0 && (
                      <div className="p-3 text-center text-xs text-slate-400">
                        Belum ada username alias tambahan.
                      </div>
                    )}
                  </div>
                </div>

                {/* Form Tambah Alias Baru */}
                <div className="border-t pt-3 space-y-3">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Tambah Username Alias
                  </label>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-slate-600 font-medium">Username TikTok</label>
                      <div className="relative mt-1">
                        <span className="absolute left-2.5 top-2 text-sm text-slate-400 font-medium">@</span>
                        <input
                          type="text"
                          value={newAliasInput}
                          onChange={(e) => setNewAliasInput(e.target.value)}
                          placeholder="misal: snhabibah10"
                          className="w-full pl-7 pr-3 py-1.5 text-sm border rounded-md focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 font-medium">Catatan (Opsional)</label>
                      <input
                        type="text"
                        value={newAliasNotes}
                        onChange={(e) => setNewAliasNotes(e.target.value)}
                        placeholder="misal: Username lama sampai Maret 2026"
                        className="w-full mt-1 px-3 py-1.5 text-sm border rounded-md focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5 text-xs text-amber-800">
                    💡 <strong>Otomatis Menggabungkan:</strong> Jika username yang dimasukkan sudah terdaftar sebagai kreator terpisah di database (misal dari impor file lama), sistem akan <strong>otomatis menggabungkan (merge)</strong> data campaign, video, dan penjualannya ke akun ini.
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" onClick={() => setAliasModalOpen(false)}>
                      Tutup
                    </Button>
                    <Button
                      type="button"
                      onClick={handleAddAlias}
                      disabled={!newAliasInput.trim() || aliasBusy}
                      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      {aliasBusy ? 'Menyimpan...' : 'Simpan & Tautkan Alias'}
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* TikTok Profile Embed - Accordion */}
      <div className="ccard overflow-hidden">
        <button 
          onClick={() => setTiktokEmbedOpen(!tiktokEmbedOpen)}
          className="w-full flex items-center justify-between p-[16px] hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#25F4EE] via-[#FE2C55] to-[#000] flex items-center justify-center">
              <Video className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-[16px] text-text">Profil TikTok Live</h3>
              <p className="text-[12px] text-text-soft">Widget langsung dari TikTok • Data real-time</p>
            </div>
          </div>
          <ChevronDown className={`w-5 h-5 text-text-soft transition-transform duration-300 ${tiktokEmbedOpen ? 'rotate-180' : ''}`} />
        </button>
        {tiktokEmbedOpen && creator?.username && (
          <div className="border-t border-line p-[16px]" ref={tiktokRef}>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
              <span className="text-amber-600 text-[16px] mt-0.5">💡</span>
              <p className="text-[12px] text-amber-800 leading-relaxed">
                <strong>Reminder:</strong> Jangan lupa update data followers di tombol <strong>&quot;Update Data&quot;</strong> (pojok kanan atas) sesuai angka yang tampil di widget ini agar database kita selalu akurat.
              </p>
            </div>
            <div style={{ maxWidth: '100%' }} className="[&_iframe]:!max-w-full [&_.tiktok-embed]:!max-w-full">
              {(() => {
                const cleanUsername = creator.username.replace(/^@+/, '').trim();
                
                return (
                  <blockquote 
                    className="tiktok-embed" 
                    cite={`https://www.tiktok.com/@${cleanUsername}`}
                    data-unique-id={cleanUsername}
                    data-embed-type="creator"
                    style={{ maxWidth: '100%', minWidth: '288px', width: '100%' }}
                  >
                    <section>
                      <a target="_blank" href={`https://www.tiktok.com/@${cleanUsername}?refer=creator_embed`}>
                        @{cleanUsername}
                      </a>
                    </section>
                  </blockquote>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6">
          <div className="ccard">
            <div className="p-[16px] border-b border-line mb-[16px]">
              <h3 className="font-bold text-[16px]">Profil Utama</h3>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-center items-center text-center">
                  <div className="flex items-center text-slate-500 mb-1">
                    <Users className="w-4 h-4 mr-1" /> Followers
                  </div>
                  <p className="font-bold text-lg">{formatAbbreviated(mergedProfile.followers, false)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col justify-center items-center text-center">
                  <p className="text-sm text-slate-500 mb-1">Audience Age</p>
                  <p className="font-bold text-lg">{mergedProfile.audience_age || '-'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-center items-center text-center">
                  <p className="text-sm text-slate-500 mb-1">Level</p>
                  <p className="font-bold text-lg">{mergedProfile.level || '-'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-center items-center text-center">
                  <p className="text-sm text-slate-500 mb-1">Ratecard</p>
                  <p className="font-bold text-lg">
                    {effectiveRatecard === 0 ? 'Barter' : (effectiveRatecard ? `Rp ${Math.round(toNum(effectiveRatecard)).toLocaleString('id-ID')}` : '-')}
                  </p>
                  {mergedProfile.ratecard == null && latestCampaignPrice !== null && (
                    <span className="text-[10px] text-slate-400 mt-0.5">(Nego Terakhir)</span>
                  )}
                </div>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Riwayat Nego Campaign</p>
                {localData?.ccs && localData.ccs.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {localData.ccs
                      .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
                      .map((cc: any) => {
                      const campaign = campaigns.find(c => c.id === cc.campaign_id);
                      const priceNum = toNum(cc.price);
                      return (
                        <div key={cc.id} className="flex justify-between items-center text-sm p-2 border border-slate-100 rounded-lg bg-slate-50">
                          <span className="font-medium text-slate-700">{campaign?.nama || `Campaign #${cc.campaign_id}`}</span>
                          <span className="font-bold text-slate-900">
                            {priceNum === 0 ? 'Barter' : (priceNum > 0 ? `Rp ${Math.round(priceNum).toLocaleString('id-ID')}` : 'Belum Set')}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Belum ada histori campaign</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Niche</p>
                  <Dialog open={nicheOpen} onOpenChange={(v) => { 
                    setNicheOpen(v); 
                    if(v) setNicheForm(localData?.creatorNiches?.map((cn: any) => cn.niche_id) || []);
                  }}>
                    <DialogTrigger asChild>
                      <button className="btn btn-soft p-0 flex items-center justify-center h-5 w-5"><Edit2 className="h-3 w-3"/></button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Update Niche Kreator</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1">
                          {niches.map(niche => (
                            <label key={niche.id} className="flex items-center gap-2 text-sm p-2 border rounded cursor-pointer hover:bg-slate-50">
                              <input 
                                type="checkbox" 
                                checked={nicheForm.includes(niche.id)}
                                onChange={(e) => {
                                  if(e.target.checked) setNicheForm([...nicheForm, niche.id]);
                                  else setNicheForm(nicheForm.filter(id => id !== niche.id));
                                }}
                              />
                              {niche.nama}
                            </label>
                          ))}
                        </div>
                        <button className="btn btn-primary w-full" onClick={handleUpdateNiche}>Simpan Niche</button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="flex flex-wrap gap-2">
                  {displayNiches.length > 0 ? displayNiches.map((n, i) => (
                    <span className="badge b-neutral" key={i}>{n}</span>
                  )) : <p className="text-sm text-slate-400">Belum ada niche</p>}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">MCN / Agency</p>
                </div>
                <p className="text-sm font-medium">{creator.mcn || '-'}</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kontak Aktif</p>
                  <Dialog open={contactOpen} onOpenChange={setContactOpen}>
                    <DialogTrigger asChild>
                      <button className="btn btn-soft p-0 flex items-center justify-center h-5 w-5"><Edit2 className="h-3 w-3"/></button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Update Nomor WhatsApp</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label className="text-sm">Nomor Baru</label>
                          <input type="text" value={contactForm} onChange={e=>setContactForm(e.target.value)} className="w-full p-2 border rounded" placeholder="08..." />
                        </div>
                        <button className="btn btn-primary w-full" onClick={handleUpdateContact}>Simpan Kontak</button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                {activeContact ? (
                  <div className="flex items-center gap-2 text-sm p-2 border border-slate-200 rounded-lg">
                    <Phone className="w-4 h-4 text-green-600" />
                    <span>{activeContact.nomor}</span>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Belum ada kontak aktif</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rekening & Nama Asli</p>
                  <Dialog open={rekOpen} onOpenChange={(v) => { setRekOpen(v); if(v) setRekForm({ rekening: creator.rekening || '', nama_asli: creator.nama_asli || '' })}}>
                    <DialogTrigger asChild>
                      <button className="btn btn-soft p-0 flex items-center justify-center h-5 w-5"><Edit2 className="h-3 w-3"/></button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Update Rekening & Nama Asli</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label className="text-sm">Nama Asli</label>
                          <input type="text" value={rekForm.nama_asli} onChange={e=>setRekForm({...rekForm, nama_asli: e.target.value})} className="w-full p-2 border rounded" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm">Rekening</label>
                          <input type="text" value={rekForm.rekening} onChange={e=>setRekForm({...rekForm, rekening: e.target.value})} className="w-full p-2 border rounded" />
                        </div>
                        <button className="btn btn-primary w-full" onClick={handleUpdateRekening}>Simpan</button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="flex items-center gap-2 text-sm p-2 border border-slate-200 rounded-lg">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span>{creator.rekening || 'Belum diisi'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="ccard">
            <div className="p-[16px] border-b border-line mb-[16px] flex flex-row items-center justify-between pb-2">
              <h3 className="text-lg font-bold">Buku Alamat (Address Book)</h3>
              <Dialog open={addressOpen} onOpenChange={(v) => {
                setAddressOpen(v);
                if (v) {
                  setAddressForm({
                    id: null,
                    label: '',
                    nama_penerima: '',
                    alamat_jalan: '',
                    kecamatan: '',
                    kota: '',
                    provinsi: '',
                    kodepos: ''
                  });
                }
              }}>
                <DialogTrigger asChild>
                  <button className="btn btn-soft p-0 flex items-center justify-center h-6 w-6"><Edit2 className="h-3 w-3"/></button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{addressForm.id ? 'Edit Alamat' : 'Tambah Alamat Baru'}</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Label (Cth: Rumah, Kantor)</label>
                      <input type="text" value={addressForm.label} onChange={e=>setAddressForm({...addressForm, label: e.target.value})} className="w-full p-2 border rounded" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nama Penerima</label>
                      <input type="text" value={addressForm.nama_penerima} onChange={e=>setAddressForm({...addressForm, nama_penerima: e.target.value})} className="w-full p-2 border rounded" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Alamat Lengkap</label>
                      <textarea value={addressForm.alamat_jalan} onChange={e=>setAddressForm({...addressForm, alamat_jalan: e.target.value})} className="w-full p-2 border rounded h-20" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Kecamatan</label>
                        <input type="text" value={addressForm.kecamatan} onChange={e=>setAddressForm({...addressForm, kecamatan: e.target.value})} className="w-full p-2 border rounded" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Kota/Kabupaten</label>
                        <input type="text" value={addressForm.kota} onChange={e=>setAddressForm({...addressForm, kota: e.target.value})} className="w-full p-2 border rounded" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Provinsi</label>
                        <input type="text" value={addressForm.provinsi} onChange={e=>setAddressForm({...addressForm, provinsi: e.target.value})} className="w-full p-2 border rounded" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Kode Pos</label>
                        <input type="text" value={addressForm.kodepos} onChange={e=>setAddressForm({...addressForm, kodepos: e.target.value})} className="w-full p-2 border rounded" />
                      </div>
                    </div>
                    <button className="btn btn-primary w-full" onClick={handleUpdateAddress}>Simpan Alamat</button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-3 mt-2 max-h-80 overflow-y-auto">
              {localData?.addressBook?.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Belum ada alamat tersimpan.</p>
              ) : (
                localData?.addressBook?.map((book: any) => (
                  <div key={book.id} className="border border-slate-100 bg-slate-50 p-3 rounded-lg relative group">
                    <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                      <button className="btn btn-soft p-0 flex items-center justify-center h-5 w-5" onClick={() => {
                        setAddressForm({
                          id: book.id,
                          label: book.label || '',
                          nama_penerima: book.nama_penerima || '',
                          alamat_jalan: book.alamat_jalan || '',
                          kecamatan: book.kecamatan || '',
                          kota: book.kota || '',
                          provinsi: book.provinsi || '',
                          kodepos: book.kodepos || ''
                        });
                        setAddressOpen(true);
                      }}><Edit2 className="h-3 w-3"/></button>
                      <button className="btn btn-soft p-0 flex items-center justify-center h-5 w-5 text-red-500 hover:text-red-700" onClick={() => handleDeleteAddress(book.id)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge b-neutral text-[10px] bg-white">{book.label || 'Alamat'}</span>
                      {book.is_primary && <span className="badge b-neutral text-[10px] bg-blue-100 text-blue-700 border-none">Utama</span>}
                    </div>
                    <p className="text-sm font-semibold">{book.nama_penerima || creator?.nama_asli || creator?.username}</p>
                    <p className="text-xs text-slate-600 mt-1">{book.alamat_jalan}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{book.kecamatan}, {book.kota}, {book.provinsi} {book.kodepos}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card Data Legalitas & Administrasi */}
          <div className="ccard">
            <div className="p-[16px] border-b border-line mb-[16px]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Data Legalitas & Administrasi</h3>
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  Master Relasional
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Kontak PIC dealing, KTP, rekening transfer, dan kontrak kerjasama kreator.
              </p>
            </div>

            <div className="p-[16px] pt-0 space-y-6">
              {/* 1. Kontak WA PIC (Dealing) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                    <span>Kontak WA PIC (Dealing)</span>
                  </h4>
                  <Dialog open={picContactOpen} onOpenChange={setPicContactOpen}>
                    <DialogTrigger asChild>
                      <button className="btn btn-soft p-0 flex items-center justify-center h-6 w-6" title="Tambah Kontak PIC">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Tambah Kontak WA PIC</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Nama Kontak PIC</label>
                          <input 
                            type="text" 
                            placeholder="Contoh: Admin Sarah / PIC Budi" 
                            value={picContactForm.namaPic} 
                            onChange={e => setPicContactForm({ ...picContactForm, namaPic: e.target.value })} 
                            className="w-full p-2 border rounded" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Nomor WA Dealing</label>
                          <input 
                            type="text" 
                            placeholder="08xxxxxxxxxx" 
                            value={picContactForm.nomorWa} 
                            onChange={e => setPicContactForm({ ...picContactForm, nomorWa: e.target.value })} 
                            className="w-full p-2 border rounded" 
                          />
                        </div>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={picContactForm.isPrimary} 
                            onChange={e => setPicContactForm({ ...picContactForm, isPrimary: e.target.checked })} 
                          />
                          <span>Jadikan Kontak Utama</span>
                        </label>
                        <button className="btn btn-primary w-full" onClick={handleAddPicContact}>Simpan Kontak</button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-2">
                  {(localData?.picContacts || []).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Belum ada kontak PIC tersimpan.</p>
                  ) : (
                    (localData?.picContacts || []).map((p: any) => (
                      <div key={p.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <span>{p.nama_pic}</span>
                            {p.is_primary && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-bold">Utama</span>}
                          </div>
                          <div className="text-slate-500 font-mono mt-0.5">{p.nomor_wa}</div>
                        </div>
                        <button 
                          onClick={() => handleDeletePicContact(p.id)} 
                          className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                          title="Hapus Kontak"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 2. Identitas KTP */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Identitas KTP</span>
                  </h4>
                  <Dialog open={identityOpen} onOpenChange={setIdentityOpen}>
                    <DialogTrigger asChild>
                      <button className="btn btn-soft p-0 flex items-center justify-center h-6 w-6" title="Tambah KTP">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Tambah Identitas KTP</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">NIK (16 Digit)</label>
                          <input 
                            type="text" 
                            placeholder="320xxxxxxxxxxxxx" 
                            value={identityForm.nik} 
                            onChange={e => setIdentityForm({ ...identityForm, nik: e.target.value })} 
                            className="w-full p-2 border rounded" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Nama Sesuai KTP (Opsional)</label>
                          <input 
                            type="text" 
                            placeholder="Nama lengkap di KTP" 
                            value={identityForm.namaKtp} 
                            onChange={e => setIdentityForm({ ...identityForm, namaKtp: e.target.value })} 
                            className="w-full p-2 border rounded" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Link KTP (GDrive)</label>
                          <input 
                            type="text" 
                            placeholder="https://drive.google.com/..." 
                            value={identityForm.linkKtp} 
                            onChange={e => setIdentityForm({ ...identityForm, linkKtp: e.target.value })} 
                            className="w-full p-2 border rounded" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Alamat Sesuai KTP</label>
                          <textarea 
                            placeholder="Alamat lengkap di KTP" 
                            value={identityForm.alamatKtp} 
                            onChange={e => setIdentityForm({ ...identityForm, alamatKtp: e.target.value })} 
                            className="w-full p-2 border rounded h-16" 
                          />
                        </div>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={identityForm.isPrimary} 
                            onChange={e => setIdentityForm({ ...identityForm, isPrimary: e.target.checked })} 
                          />
                          <span>Jadikan KTP Utama</span>
                        </label>
                        <button className="btn btn-primary w-full" onClick={handleAddIdentity}>Simpan KTP</button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-2">
                  {(localData?.identities || []).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Belum ada identitas KTP tersimpan.</p>
                  ) : (
                    (localData?.identities || []).map((i: any) => (
                      <div key={i.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <span className="font-mono">{i.nik}</span>
                            {i.nama_ktp && <span className="text-slate-600">({i.nama_ktp})</span>}
                            {i.is_primary && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded font-bold">Utama</span>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {i.link_ktp && (
                              <a 
                                href={i.link_ktp.startsWith('http') ? i.link_ktp : `https://${i.link_ktp}`} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-blue-600 hover:underline flex items-center gap-0.5"
                              >
                                <span>GDrive</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                            <button 
                              onClick={() => handleDeleteIdentity(i.id)} 
                              className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                              title="Hapus KTP"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {i.alamat_ktp && <p className="text-slate-500 text-[11px] line-clamp-2">{i.alamat_ktp}</p>}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 3. Rekening Bank */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Rekening Transfer Bank</span>
                  </h4>
                  <Dialog open={bankAccountOpen} onOpenChange={setBankAccountOpen}>
                    <DialogTrigger asChild>
                      <button className="btn btn-soft p-0 flex items-center justify-center h-6 w-6" title="Tambah Rekening">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Tambah Rekening Bank</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Bank / E-Wallet</label>
                          <input 
                            type="text" 
                            placeholder="BCA / Mandiri / BRI / DANA" 
                            value={bankAccountForm.bankName} 
                            onChange={e => setBankAccountForm({ ...bankAccountForm, bankName: e.target.value })} 
                            className="w-full p-2 border rounded" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Nomor Rekening</label>
                          <input 
                            type="text" 
                            placeholder="1234567890" 
                            value={bankAccountForm.accountNumber} 
                            onChange={e => setBankAccountForm({ ...bankAccountForm, accountNumber: e.target.value })} 
                            className="w-full p-2 border rounded" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Nama Pemilik Rekening</label>
                          <input 
                            type="text" 
                            placeholder="Nama pemilik rekening sesuai buku tabungan" 
                            value={bankAccountForm.accountHolder} 
                            onChange={e => setBankAccountForm({ ...bankAccountForm, accountHolder: e.target.value })} 
                            className="w-full p-2 border rounded" 
                          />
                        </div>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={bankAccountForm.isPrimary} 
                            onChange={e => setBankAccountForm({ ...bankAccountForm, isPrimary: e.target.checked })} 
                          />
                          <span>Jadikan Rekening Utama</span>
                        </label>
                        <button className="btn btn-primary w-full" onClick={handleAddBankAccount}>Simpan Rekening</button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-2">
                  {(localData?.bankAccounts || []).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Belum ada rekening bank tersimpan.</p>
                  ) : (
                    (localData?.bankAccounts || []).map((b: any) => (
                      <div key={b.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <span>{b.bank_name}</span>
                            <span className="font-mono text-slate-600">({b.account_number})</span>
                            {b.is_primary && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded font-bold">Utama</span>}
                          </div>
                          <div className="text-slate-500 mt-0.5">a.n. {b.account_holder}</div>
                        </div>
                        <button 
                          onClick={() => handleDeleteBankAccount(b.id)} 
                          className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                          title="Hapus Rekening"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 4. Dokumen Kontrak Kerjasama */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-purple-600" />
                    <span>Dokumen Kontrak Kerjasama</span>
                  </h4>
                  <Dialog open={contractOpen} onOpenChange={setContractOpen}>
                    <DialogTrigger asChild>
                      <button className="btn btn-soft p-0 flex items-center justify-center h-6 w-6" title="Tambah Kontrak">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Tambah Kontrak Kerjasama</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Judul Kontrak / Keterangan</label>
                          <input 
                            type="text" 
                            placeholder="Contoh: Kontrak Campaign Glow Up 2026" 
                            value={contractForm.judulKontrak} 
                            onChange={e => setContractForm({ ...contractForm, judulKontrak: e.target.value })} 
                            className="w-full p-2 border rounded" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Link Kontrak GDrive</label>
                          <input 
                            type="text" 
                            placeholder="https://drive.google.com/file/d/..." 
                            value={contractForm.linkKontrak} 
                            onChange={e => setContractForm({ ...contractForm, linkKontrak: e.target.value })} 
                            className="w-full p-2 border rounded" 
                          />
                        </div>
                        <button className="btn btn-primary w-full" onClick={handleAddContract}>Simpan Kontrak</button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-2">
                  {(localData?.contracts || []).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Belum ada kontrak tersimpan.</p>
                  ) : (
                    (localData?.contracts || []).map((c: any) => (
                      <div key={c.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                        <div className="min-w-0 flex-1 mr-2">
                          <div className="font-semibold text-slate-800 truncate">
                            {c.judul_kontrak || 'Dokumen Kontrak'}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                            {c.campaign_nama && <span className="bg-slate-200/60 px-1.5 py-0.2 rounded text-[10px]">{c.campaign_nama}</span>}
                            <span>{new Date(c.created_at).toLocaleDateString('id-ID')}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a 
                            href={c.link_kontrak.startsWith('http') ? c.link_kontrak : `https://${c.link_kontrak}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-indigo-600 hover:underline flex items-center gap-0.5 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded"
                          >
                            <span>Buka</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <button 
                            onClick={() => handleDeleteContract(c.id)} 
                            className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                            title="Hapus Kontrak"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="ccard">
            <div className="p-[16px] border-b border-line mb-[16px] flex flex-row items-center justify-between">
              <h3 className="font-bold text-[16px]">Catatan Evaluasi</h3>
              <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
                <DialogTrigger asChild>
                  <button className="btn btn-soft">Tambah</button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Tambah Catatan Evaluasi</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <textarea value={noteForm.isi} onChange={e=>setNoteForm({...noteForm, isi: e.target.value})} className="w-full p-2 border rounded min-h-[100px]" placeholder="Isi catatan..."></textarea>
                    <button className="btn btn-primary w-full" onClick={handleAddNote} disabled={!noteForm.isi}>Simpan Catatan</button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div>
              {notes.length > 0 ? (
                <div className="space-y-4">
                  {notes.map(n => (
                    <div key={n.id} className="text-sm border-l-2 border-blue-500 pl-3 py-1">
                      <p className="text-slate-800">{n.isi}</p>
                      <p className="text-xs text-slate-400 mt-1">{n.penulis} • {new Date(n.created_at).toLocaleDateString('id-ID')}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">Belum ada catatan.</p>
              )}
            </div>
          </div>

          <div className="ccard">
            <div className="p-[16px] border-b border-line mb-[16px]">
              <h3 className="font-bold text-[16px]">History Update Profil Utama</h3>
            </div>
            <div>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                {localData?.auditLogs && localData.auditLogs.length > 0 ? (
                  localData.auditLogs.map((log: any) => (
                    <div key={log.id} className="text-sm border-l-2 border-indigo-500 pl-3 py-1 bg-slate-50 rounded-r-lg">
                      <p className="text-slate-800 font-medium">{log.description || 'Melakukan Update'}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Oleh: {log.user_name || 'System'} • {new Date(log.created_at).toLocaleString('id-ID')}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 text-center py-4">Belum ada riwayat update.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="ccard">
            <div className="border-b border-line mb-[16px] flex">
              <button 
                onClick={() => setActiveHistoryTab('campaign')}
                className={`py-[16px] px-[24px] font-bold text-[16px] border-b-2 transition-colors ${activeHistoryTab === 'campaign' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Rekam Jejak (Campaign History)
              </button>
              <button 
                onClick={() => setActiveHistoryTab('live')}
                className={`py-[16px] px-[24px] font-bold text-[16px] border-b-2 transition-colors ${activeHistoryTab === 'live' ? 'border-pink-600 text-pink-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Data Live Organik
              </button>
              <button 
                onClick={() => setActiveHistoryTab('video')}
                className={`py-[16px] px-[24px] font-bold text-[16px] border-b-2 transition-colors ${activeHistoryTab === 'video' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Data Video Organik
              </button>
              <button 
                onClick={() => setActiveHistoryTab('sales')}
                className={`py-[16px] px-[24px] font-bold text-[16px] border-b-2 transition-colors ${activeHistoryTab === 'sales' ? 'border-green-600 text-green-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Data Pesanan (Sales)
              </button>
            </div>
            
            {activeHistoryTab === 'campaign' && (
              <div>
              {trackRecords.length > 0 ? (
                <div className="tbl-wrap"><table className="w-full">
                  <thead className="border-b border-line bg-slate-50">
                    <tr className="border-b border-line hover:bg-slate-50/50">
                      <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('campaign_name')}>Campaign <ArrowUpDown className="w-3 h-3 inline ml-1"/></th>
                      <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft">Kerjasama</th>
                      <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('price')}>Rate/Price <ArrowUpDown className="w-3 h-3 inline ml-1"/></th>
                      <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft text-right">Pelunasan</th>
                      <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft">Status Bayar</th>
                      <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft text-center">Total VT</th>
                      <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft text-right cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('gmv')}>Total GMV Campaign <ArrowUpDown className="w-3 h-3 inline ml-1"/></th>
                      <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft text-right cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('highestVideoGmv')}>GMV Video Tertinggi <ArrowUpDown className="w-3 h-3 inline ml-1"/></th>
                      <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft">Approval</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trackRecords.map((tr, i) => {
                      const hasDetails = tr.approval === 'approved' || tr.totalVtCount > 0;
                      const isExpanded = expandedCampaigns[tr.id];
                      
                      const manualVideos = localData?.videos?.filter((v: any) => v.campaign_creator_id === tr.id) || [];
                      // Sama seperti perhitungan GMV di atas: campaign_id ATAU SKU.
                      const campaignSales = localData?.sales?.filter((s: any) => {
                        const pId = s.product_id || s.raw_data?.['Product ID'];
                        const mappedCid = pId != null ? skuCampaignMap.get(String(pId)) : undefined;
                        return s.campaign_id === tr.campaign_id || mappedCid === tr.campaign_id;
                      }) || [];
                      const campaignOrganicVideos = localData?.organicVideos?.filter((ov: any) => {
                        const cType = String(ov.content_type || '').toLowerCase();
                        if (cType === 'live' || cType === 'livestream') return false;
                        if (!ov.content_uid || ov.content_uid === '-' || ov.content_uid.trim() === '') return false;
                        const pId = ov.product_id;
                        const mappedCid = pId != null ? skuCampaignMap.get(String(pId)) : undefined;
                        return ov.campaign_id === tr.campaign_id || mappedCid === tr.campaign_id;
                      }) || [];

                      const combinedVideos = [...manualVideos];
                      const uniqueVideoIds2 = new Set<string>();
                      manualVideos.forEach((v: any) => {
                        if (v.content_uid) {
                          const cleanUid = String(v.content_uid).replace(/^video_/, '').trim();
                          if (cleanUid) uniqueVideoIds2.add(cleanUid);
                        }
                        if (v.link_video) {
                          const m = String(v.link_video).match(/video\/(\d+)/i);
                          if (m) uniqueVideoIds2.add(m[1]);
                        }
                      });

                      const creatorHandle = (localData?.creator?.username || '').replace(/^@/, '').trim();

                      campaignSales.forEach((s: any) => {
                          let vid = s.content_uid ? String(s.content_uid).replace(/^video_/, '').trim() : '';
                          if (vid && vid !== '-' && !uniqueVideoIds2.has(vid)) {
                              uniqueVideoIds2.add(vid);
                              combinedVideos.push({
                                 id: `auto-${vid}`,
                                 content_uid: vid,
                                 link_video: creatorHandle ? `https://www.tiktok.com/@${creatorHandle}/video/${vid}` : `https://www.tiktok.com/video/${vid}`,
                                 urutan: combinedVideos.length + 1,
                                 campaign_creator_id: tr.id
                              });
                          }
                      });

                      campaignOrganicVideos.forEach((ov: any) => {
                          let vid = ov.content_uid ? String(ov.content_uid).replace(/^video_/, '').trim() : '';
                          if (vid && vid !== '-' && !uniqueVideoIds2.has(vid)) {
                              uniqueVideoIds2.add(vid);
                              combinedVideos.push({
                                 id: `auto-${vid}`,
                                 content_uid: vid,
                                 link_video: creatorHandle ? `https://www.tiktok.com/@${creatorHandle}/video/${vid}` : `https://www.tiktok.com/video/${vid}`,
                                 urutan: combinedVideos.length + 1,
                                 campaign_creator_id: tr.id
                              });
                          }
                      });
                      
                      return (
                      <React.Fragment key={tr.id}>
                        <tr className={`border-b border-line ${i === 0 && tr.gmv > 0 && sortField === 'gmv' && sortOrder === 'desc' ? "bg-amber-50/50" : ""} ${hasDetails ? "cursor-pointer hover:bg-slate-50 transition-colors" : "hover:bg-slate-50/50"}`}
                          onClick={() => hasDetails && toggleCampaign(tr.id)}
                        >
                          <td className="py-[12px] px-[16px] font-medium flex items-center gap-2">
                            {hasDetails && (
                              <span className="text-slate-400">
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </span>
                            )}
                            {tr.campaign_name}
                          </td>
                          <td className="py-[12px] px-[16px] capitalize">{tr.jenis_kerjasama}</td>
                          <td className="py-[12px] px-[16px]">Rp {Math.round(toNum(tr.price)).toLocaleString('id-ID')}</td>
                          <td className="py-[12px] px-[16px] text-right font-medium text-slate-700">
                            {toNum(tr.nominal_pelunasan) > 0 ? `Rp ${Math.round(toNum(tr.nominal_pelunasan)).toLocaleString('id-ID')}` : '-'}
                          </td>
                          <td className="py-[12px] px-[16px]">
                            <span className="badge b-neutral">
                              {tr.status_bayar === 'lunas' ? 'Lunas' : tr.status_bayar === 'sebagian' ? 'Sebagian' : 'Belum'}
                            </span>
                          </td>
                          <td className="py-[12px] px-[16px] text-center font-medium">
                            {tr.totalVtCount || 0}
                          </td>
                          <td className="py-[12px] px-[16px] text-right font-semibold text-green-600">
                            {tr.gmv > 0 ? `Rp ${Math.round(toNum(tr.gmv)).toLocaleString('id-ID')}` : '-'}
                          </td>
                          <td className="py-[12px] px-[16px] text-right font-medium text-emerald-600">
                            {tr.highestVideoGmv > 0 ? `Rp ${Math.round(toNum(tr.highestVideoGmv)).toLocaleString('id-ID')}` : '-'}
                          </td>
                          <td className="py-[12px] px-[16px]">
                            <span className="badge b-neutral">
                              {tr.approval}
                            </span>
                          </td>
                        </tr>
                        {hasDetails && isExpanded && (
                          <tr className="border-b border-line hover:bg-slate-50/50">
                            <td className="py-[12px] px-[16px] bg-slate-50/50 p-4 border-b-2 border-slate-200" colSpan={9}>
                              <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
                                <div className="tbl-wrap"><table className="w-full text-sm">
                                  <thead className="border-b border-line bg-slate-50">
                                    <tr className="border-b border-line hover:bg-slate-50/50">
                                      <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft w-16 h-8 text-xs font-semibold uppercase tracking-wider text-slate-500 cursor-pointer select-none hover:bg-slate-200" onClick={() => handleVideoSort('urutan')}>Video <ArrowUpDown className="w-3 h-3 inline ml-1"/></th>
                                      <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft h-8 text-xs font-semibold uppercase tracking-wider text-slate-500">Link TikTok</th>
                                      <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft h-8 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 cursor-pointer select-none hover:bg-slate-200" onClick={() => handleVideoSort('views')}>Views <ArrowUpDown className="w-3 h-3 inline ml-1"/></th>
                                      <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft h-8 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 cursor-pointer select-none hover:bg-slate-200" onClick={() => handleVideoSort('sold')}>Item Sold <ArrowUpDown className="w-3 h-3 inline ml-1"/></th>
                                      <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft h-8 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 cursor-pointer select-none hover:bg-slate-200" onClick={() => handleVideoSort('gmv')}>Organic GMV <ArrowUpDown className="w-3 h-3 inline ml-1"/></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {combinedVideos.length === 0 ? (
                                      <tr className="border-b border-line hover:bg-slate-50/50"><td className="py-[12px] px-[16px] text-center text-slate-400 py-3 text-xs" colSpan={5}>Belum ada video/VT diunggah.</td></tr>
                                    ) : combinedVideos.map((v: any) => {
                                      const cleanVUid = String(v.content_uid || '').replace(/^video_/, '').trim();
                                      const videoSales = localData?.sales?.filter((s: any) => {
                                        if (!s.content_uid) return false;
                                        const sUid = String(s.content_uid).replace(/^video_/, '').trim();
                                        return sUid === cleanVUid || (cleanVUid && s.content_uid.includes(cleanVUid));
                                      }) || [];
                                      const organicGmv = sumNum(videoSales, (row: any) => row.gmv);
                                      const itemsSold = sumNum(videoSales, (row: any) => row.quantity);

                                      const matchingOrganic = localData?.organicVideos?.filter((ov: any) => {
                                        if (!ov.content_uid) return false;
                                        const ovUid = String(ov.content_uid).replace(/^video_/, '').trim();
                                        return ovUid === cleanVUid;
                                      }) || [];
                                      const organicViews = matchingOrganic.length > 0 ? Math.max(...matchingOrganic.map((ov: any) => Number(ov.video_views || 0))) : 0;
                                      const salesViews = videoSales.length > 0 ? Math.max(...videoSales.map((s: any) => Number(s.raw_data?.['Video views'] || 0))) : 0;
                                      const maxViews = Math.max(salesViews, organicViews);
                                      return { ...v, organicGmv, itemsSold, maxViews };
                                    }).sort((a: any, b: any) => {
                                      let diff = 0;
                                      if (videoSortField === 'urutan') diff = a.urutan - b.urutan;
                                      if (videoSortField === 'views') diff = a.maxViews - b.maxViews;
                                      if (videoSortField === 'sold') diff = a.itemsSold - b.itemsSold;
                                      if (videoSortField === 'gmv') diff = a.organicGmv - b.organicGmv;
                                      return videoSortOrder === 'asc' ? diff : -diff;
                                    }).map((v: any) => (
                                        <tr className="border-b border-line hover:bg-slate-50/50" key={v.id}>
                                          <td className="py-[12px] px-[16px] font-medium text-slate-700">VT {v.urutan}</td>
                                          <td className="py-[12px] px-[16px]">
                                            {v.link_video ? (
                                              <a href={v.link_video} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium">
                                                {v.link_video}
                                              </a>
                                            ) : <span className="text-slate-400 italic">Belum ada link</span>}
                                          </td>
                                          <td className="py-[12px] px-[16px] text-center font-bold text-slate-700">
                                            {v.maxViews > 0 ? v.maxViews.toLocaleString() : '-'}
                                          </td>
                                          <td className="py-[12px] px-[16px] text-center font-bold text-slate-700">
                                            {v.itemsSold} pcs
                                          </td>
                                          <td className="py-[12px] px-[16px] text-right font-bold text-green-700">
                                            {v.organicGmv > 0 ? `Rp ${v.organicGmv.toLocaleString()}` : '-'}
                                          </td>
                                        </tr>
                                    ))}
                                    <tr className="border-b border-line hover:bg-slate-50/50">
                                      <td className="py-[12px] px-[16px] p-0 border-t border-slate-200" colSpan={5}>
                                        <div className="bg-white hover:bg-slate-50 transition-colors">
                                          <Dialog open={videoOpen && activeCcId === tr.id} onOpenChange={(v) => { setVideoOpen(v); if(v) setActiveCcId(tr.id); else setActiveCcId(null); }}>
                                            <DialogTrigger asChild>
                                              <button className="w-full text-center text-xs font-semibold text-blue-600 py-2">
                                                + Tambah Link Video Manual
                                              </button>
                                            </DialogTrigger>
                                            <DialogContent>
                                              <DialogHeader><DialogTitle>Input Link Video</DialogTitle></DialogHeader>
                                              <div className="space-y-4 py-4">
                                                <div className="space-y-2">
                                                  <label className="text-sm font-medium">Link Panjang TikTok / Content ID</label>
                                                  <input 
                                                    type="text"
                                                    className="w-full p-2 border rounded"
                                                    placeholder="Contoh: https://www.tiktok.com/@user/video/12345" 
                                                    value={videoLink} 
                                                    onChange={e => setVideoLink(e.target.value)} 
                                                  />
                                                </div>
                                                <button className="btn btn-primary w-full" onClick={handleAddVideo}>Simpan Video</button>
                                              </div>
                                            </DialogContent>
                                          </Dialog>
                                        </div>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table></div>
                              </div>
                              {localData?.ads?.filter((a: any) => a.campaign_id === tr.campaign_id).length > 0 && (
                                <div className="mt-4 rounded-lg border border-indigo-200 overflow-hidden bg-indigo-50/30 shadow-sm">
                                  <div className="bg-indigo-100/50 px-4 py-2 border-b border-indigo-200 flex justify-between items-center">
                                    <h4 className="text-xs font-bold text-indigo-900 uppercase">Riwayat Ads Performance (TikTok)</h4>
                                  </div>
                                  <div className="tbl-wrap"><table className="w-full text-sm">
                                    <thead className="border-b border-line bg-indigo-50/50">
                                      <tr className="border-b border-line hover:bg-slate-50/50">
                                        <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft h-8 text-xs font-semibold text-slate-500">Ad Name / Ad ID</th>
                                        <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft h-8 text-right text-xs font-semibold text-slate-500">Cost (IDR)</th>
                                        <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft h-8 text-right text-xs font-semibold text-slate-500">Revenue (IDR)</th>
                                        <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft h-8 text-center text-xs font-semibold text-slate-500">ROAS</th>
                                        <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft h-8 text-center text-xs font-semibold text-slate-500">Purchases</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {localData?.ads?.filter((a: any) => a.campaign_id === tr.campaign_id).map((ad: any) => {
                                        const kurs = normalizeKurs(ad.kurs);
                                        const costIdr = (Number(ad.cost_usd) || 0) * kurs;
                                        const revenueIdr = (Number(ad.gross_revenue_usd) || 0) * kurs;
                                        const roas = costIdr > 0 ? (revenueIdr / costIdr).toFixed(2) : '-';
                                        return (
                                          <tr className="border-b border-line hover:bg-indigo-50" key={ad.id}>
                                            <td className="py-[12px] px-[16px]">
                                              <p className="font-medium text-slate-700 truncate max-w-[150px]" title={ad.ad_name}>{ad.ad_name}</p>
                                              <p className="font-mono text-[10px] text-slate-500">{ad.ad_id}</p>
                                            </td>
                                            <td className="py-[12px] px-[16px] text-right font-medium text-red-600">Rp {costIdr.toLocaleString()}</td>
                                            <td className="py-[12px] px-[16px] text-right font-bold text-emerald-600">Rp {revenueIdr.toLocaleString()}</td>
                                            <td className="py-[12px] px-[16px] text-center font-bold text-indigo-700">{roas}</td>
                                            <td className="py-[12px] px-[16px] text-center text-slate-600">{ad.purchases}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table></div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )})}
                  </tbody>
                </table></div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-6">Belum ada history campaign.</p>
              )}
            </div>
            )}

            {activeHistoryTab === 'live' && (
              <div className="space-y-4">
                {campaignTabsList.map(tab => {
                  const sessions = groupedLive[tab.id] || [];
                  if (sessions.length === 0) return null;
                  const isExpandedTab = expandedCampaignTabs[`live_${tab.id}`];

                  let totalGmvTab = 0;
                  sessions.forEach((session: any) => {
                    const products = localData?.liveProducts?.filter((p: any) => p.livestream_room_id === session.livestream_room_id) || [];
                    products.forEach(p => {
                      if (tab.id === 'lainnya') {
                        if (!p.product_id || !skus?.find(s => s.product_id === p.product_id)) totalGmvTab += p.gmv || 0;
                      } else {
                        if (p.product_id && skus?.find(s => s.product_id === p.product_id)?.campaign_id.toString() === tab.id) {
                          totalGmvTab += p.gmv || 0;
                        }
                      }
                    });
                  });

                  return (
                    <div key={tab.id} className="border border-line rounded-lg overflow-hidden">
                      <div 
                        className="bg-pink-50 p-4 flex justify-between items-center cursor-pointer hover:bg-pink-100 transition-colors"
                        onClick={() => toggleCampaignTab(`live_${tab.id}`)}
                      >
                        <h4 className="font-bold text-slate-700">{tab.name}</h4>
                        <div className="flex items-center gap-4 text-sm font-medium">
                          <span className="text-pink-600">Total GMV: Rp {totalGmvTab.toLocaleString('id-ID')}</span>
                          <span className="text-slate-500">{sessions.length} Sesi Live</span>
                          {isExpandedTab ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
                        </div>
                      </div>
                      {isExpandedTab && (
                        <div className="tbl-wrap">
                          <table className="w-full">
                            <thead className="border-b border-line bg-slate-50/50">
                              <tr>
                                <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft">Waktu Mulai</th>
                                <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft">Judul Live</th>
                                <th className="py-[12px] px-[16px] text-center font-semibold text-text-soft">Durasi</th>
                                <th className="py-[12px] px-[16px] text-right font-semibold text-text-soft">Views</th>
                                <th className="py-[12px] px-[16px] text-right font-semibold text-text-soft">Likes</th>
                                <th className="py-[12px] px-[16px] text-right font-semibold text-text-soft">CVR</th>
                                <th className="py-[12px] px-[16px] text-right font-semibold text-text-soft">RPM</th>
                                <th className="py-[12px] px-[16px] text-right font-semibold text-text-soft">Terjual</th>
                                <th className="py-[12px] px-[16px] text-right font-semibold text-text-soft">Total GMV</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sessions.map((session: any) => {
                                const isExpanded = expandedLiveSessions[session.livestream_room_id];
                                let products = localData?.liveProducts?.filter((p: any) => p.livestream_room_id === session.livestream_room_id) || [];
                                if (tab.id !== 'lainnya') {
                                  products = products.filter(p => p.product_id && skus?.find(s => s.product_id === p.product_id)?.campaign_id.toString() === tab.id);
                                } else {
                                  products = products.filter(p => !p.product_id || !skus?.find(s => s.product_id === p.product_id));
                                }
                                
                                const totalItemsSold = sumNum(products, (p: any) => p.items_sold);
                                const totalGmv = sumNum(products, (p: any) => p.gmv);

                                return (
                                  <React.Fragment key={session.livestream_room_id}>
                                    <tr className="border-b border-line hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => toggleLiveSession(session.livestream_room_id)}>
                                      <td className="py-[12px] px-[16px] text-sm">
                                        {session.start_time ? new Date(session.start_time).toLocaleString('id-ID') : '-'}
                                      </td>
                                      <td className="py-[12px] px-[16px] text-sm max-w-[200px] truncate" title={session.livestream_name || ''}>
                                        {session.livestream_name || 'Tidak ada judul'}
                                      </td>
                                      <td className="py-[12px] px-[16px] text-sm text-center text-slate-500">{session.duration_str || '-'}</td>
                                      <td className="py-[12px] px-[16px] text-sm text-right font-medium">{session.live_views?.toLocaleString('id-ID') || 0}</td>
                                      <td className="py-[12px] px-[16px] text-sm text-right font-medium">{session.live_likes?.toLocaleString('id-ID') || 0}</td>
                                      <td className="py-[12px] px-[16px] text-sm text-right font-medium text-orange-600">
                                        {session.live_views > 0 ? ((totalItemsSold / session.live_views) * 100).toFixed(2) + '%' : '-'}
                                      </td>
                                      <td className="py-[12px] px-[16px] text-sm text-right font-medium text-blue-600">
                                        {session.live_product_rpm ? `Rp ${session.live_product_rpm.toLocaleString('id-ID')}` : '-'}
                                      </td>
                                      <td className="py-[12px] px-[16px] text-sm text-right font-medium">{totalItemsSold}</td>
                                      <td className="py-[12px] px-[16px] text-sm text-right font-medium text-green-600">
                                        Rp {totalGmv.toLocaleString('id-ID')}
                                      </td>
                                    </tr>
                                    {isExpanded && (
                                      <tr className="bg-slate-50 border-b border-line">
                                        <td colSpan={9} className="p-4">
                                          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                            <h4 className="font-semibold text-sm mb-3">Rincian Produk Terjual</h4>
                                            {products.length > 0 ? (
                                              <div className="overflow-x-auto">
                                                <table className="w-full text-xs">
                                                  <thead className="border-b border-slate-200 text-slate-500">
                                                    <tr>
                                                      <th className="py-2 text-left">Nama Produk</th>
                                                      <th className="py-2 text-left">Toko</th>
                                                      <th className="py-2 text-center">Terjual</th>
                                                      <th className="py-2 text-right">GMV</th>
                                                      <th className="py-2 text-right">Est. Komisi</th>
                                                      <th className="py-2 text-right">Actual Komisi</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {products.map((p: any, idx: number) => (
                                                      <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                                        <td className="py-2 pr-2 max-w-[300px] truncate" title={p.product_name || ''}>{p.product_name || 'Unknown Product'}</td>
                                                        <td className="py-2 text-slate-600">{p.shop_name || '-'}</td>
                                                        <td className="py-2 text-center font-medium">{p.items_sold || 0}</td>
                                                        <td className="py-2 text-right text-green-600 font-medium">Rp {(p.gmv || 0).toLocaleString('id-ID')}</td>
                                                        <td className="py-2 text-right font-medium">Rp {(p.commission || 0).toLocaleString('id-ID')}</td>
                                                        <td className="py-2 text-right font-medium text-amber-600">{p.actual_commission ? `Rp ${p.actual_commission.toLocaleString('id-ID')}` : '-'}</td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              </div>
                                            ) : (
                                              <p className="text-xs text-slate-500">Tidak ada data produk dari campaign ini yang terjual di sesi ini.</p>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
                {(!localData?.liveSessions || localData.liveSessions.length === 0) && (
                  <p className="text-sm text-slate-400 text-center py-6">Belum ada data Live Organik.</p>
                )}
              </div>
            )}
            
            {activeHistoryTab === 'video' && (
              <div className="space-y-4">
                {campaignTabsList.map(tab => {
                  const videos = groupedVideos[tab.id] || [];
                  if (videos.length === 0) return null;
                  const isExpandedTab = expandedCampaignTabs[`video_${tab.id}`];

                  return (
                    <div key={tab.id} className="border border-line rounded-lg overflow-hidden">
                      <div 
                        className="bg-purple-50 p-4 flex justify-between items-center cursor-pointer hover:bg-purple-100 transition-colors"
                        onClick={() => toggleCampaignTab(`video_${tab.id}`)}
                      >
                        <h4 className="font-bold text-slate-700">{tab.name}</h4>
                        <div className="flex items-center gap-4 text-sm font-medium">
                          <span className="text-slate-500">{videos.length} Video</span>
                          {isExpandedTab ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
                        </div>
                      </div>
                      {isExpandedTab && (
                        <div className="tbl-wrap">
                          <table className="w-full">
                            <thead className="border-b border-line bg-slate-50/50">
                              <tr>
                                <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft">Waktu Post</th>
                                <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft">Video ID</th>
                                <th className="py-[12px] px-[16px] text-center font-semibold text-text-soft">Durasi</th>
                                <th className="py-[12px] px-[16px] text-right font-semibold text-text-soft">Views</th>
                                <th className="py-[12px] px-[16px] text-right font-semibold text-text-soft">Likes</th>
                                <th className="py-[12px] px-[16px] text-right font-semibold text-text-soft">CVR</th>
                                <th className="py-[12px] px-[16px] text-right font-semibold text-text-soft">RPM</th>
                              </tr>
                            </thead>
                            <tbody>
                              {videos.map((video: any) => {
                                let videoSales = localData?.sales?.filter((s: any) => s.content_uid === video.content_uid) || [];
                                if (tab.id !== 'lainnya') {
                                  videoSales = videoSales.filter(s => {
                                    const pId = s.product_id || s.raw_data?.['Product ID'];
                                    return pId && skus?.find(sk => sk.product_id === pId)?.campaign_id.toString() === tab.id;
                                  });
                                } else {
                                  videoSales = videoSales.filter(s => {
                                    const pId = s.product_id || s.raw_data?.['Product ID'];
                                    return !pId || !skus?.find(sk => sk.product_id === pId);
                                  });
                                }
                                const totalItemsSold = sumNum(videoSales, (s: any) => s.quantity);
                                
                                return (
                                  <tr key={video.id} className="border-b border-line hover:bg-slate-50">
                                    <td className="py-[12px] px-[16px] text-sm">{video.post_time ? new Date(video.post_time).toLocaleString('id-ID') : '-'}</td>
                                    <td className="py-[12px] px-[16px] text-sm font-medium text-slate-700">
                                      <a href={`https://www.tiktok.com/@${video.creator_username}/video/${video.content_uid}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                        {video.content_uid}
                                      </a>
                                    </td>
                                    <td className="py-[12px] px-[16px] text-sm text-center text-slate-500">{video.duration_str || '-'}</td>
                                    <td className="py-[12px] px-[16px] text-sm text-right font-medium">{video.video_views?.toLocaleString('id-ID') || 0}</td>
                                    <td className="py-[12px] px-[16px] text-sm text-right font-medium">{video.video_likes?.toLocaleString('id-ID') || 0}</td>
                                    <td className="py-[12px] px-[16px] text-sm text-right font-medium text-orange-600">
                                      {video.video_views > 0 ? ((totalItemsSold / video.video_views) * 100).toFixed(2) + '%' : '-'}
                                    </td>
                                    <td className="py-[12px] px-[16px] text-sm text-right font-medium text-blue-600">
                                      {video.video_product_rpm ? `Rp ${video.video_product_rpm.toLocaleString('id-ID')}` : '-'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
                {(!localData?.organicVideos || localData.organicVideos.length === 0) && (
                  <p className="text-sm text-slate-400 text-center py-6">Belum ada data Video Organik.</p>
                )}
              </div>
            )}

            {activeHistoryTab === 'sales' && (
              <div className="space-y-4">
                {campaignTabsList.map(tab => {
                  const sales = groupedSales[tab.id] || [];
                  if (sales.length === 0) return null;
                  const isExpandedTab = expandedCampaignTabs[`sales_${tab.id}`];
            
                  const totalGmvTab = sumNum(sales, (s: any) => s.gmv);
            
                  return (
                    <div key={tab.id} className="border border-line rounded-lg overflow-hidden">
                      <div 
                        className="bg-green-50 p-4 flex justify-between items-center cursor-pointer hover:bg-green-100 transition-colors"
                        onClick={() => toggleCampaignTab(`sales_${tab.id}`)}
                      >
                        <h4 className="font-bold text-slate-700">{tab.name}</h4>
                        <div className="flex items-center gap-4 text-sm font-medium">
                          <span className="text-green-600">Total GMV: Rp {totalGmvTab.toLocaleString('id-ID')}</span>
                          <span className="text-slate-500">{sales.length} Pesanan</span>
                          {isExpandedTab ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
                        </div>
                      </div>
                      {isExpandedTab && (
                        <div className="tbl-wrap">
                          <table className="w-full">
                            <thead className="border-b border-line bg-slate-50/50">
                              <tr>
                                <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft">Tanggal Pesanan</th>
                                <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft">Order ID</th>
                                <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft">Produk</th>
                                <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft">Attribution</th>
                                <th className="py-[12px] px-[16px] text-center font-semibold text-text-soft">Comm. Rate</th>
                                <th className="py-[12px] px-[16px] text-center font-semibold text-text-soft">Qty</th>
                                <th className="py-[12px] px-[16px] text-right font-semibold text-text-soft">Status</th>
                                <th className="py-[12px] px-[16px] text-right font-semibold text-text-soft">Total GMV</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sales.sort((a: any, b: any) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()).map((sale: any) => (
                                <tr key={sale.id} className="border-b border-line hover:bg-slate-50">
                                  <td className="py-[12px] px-[16px] text-sm">{sale.tanggal ? new Date(sale.tanggal).toLocaleString('id-ID') : '-'}</td>
                                  <td className="py-[12px] px-[16px] text-sm font-medium">{sale.order_id?.split('_')[0] || '-'}</td>
                                  <td className="py-[12px] px-[16px] text-sm max-w-[200px] truncate" title={sale.raw_data?.['Product Name'] || ''}>
                                    {sale.raw_data?.['Product Name'] || sale.product_id}
                                  </td>
                                  <td className="py-[12px] px-[16px] text-sm">
                                    <span className="badge b-neutral capitalize">{sale.attribution_type || sale.content_type || 'Unknown'}</span>
                                  </td>
                                  <td className="py-[12px] px-[16px] text-sm text-center font-medium text-purple-600">
                                    {sale.commission_rate || '-'}
                                  </td>
                                  <td className="py-[12px] px-[16px] text-sm text-center font-medium">{sale.quantity || 1}</td>
                                  <td className="py-[12px] px-[16px] text-sm text-right">
                                    {sale.is_refund ? (
                                      <span className="badge bg-red-100 text-red-600 border-none">Refund</span>
                                    ) : (
                                      <span className="badge bg-emerald-100 text-emerald-600 border-none">{sale.order_status || 'Completed'}</span>
                                    )}
                                  </td>
                                  <td className="py-[12px] px-[16px] text-sm text-right font-medium text-green-600">
                                    Rp {sale.gmv?.toLocaleString('id-ID')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
                {(!localData?.sales || localData.sales.length === 0) && (
                  <p className="text-sm text-slate-400 text-center py-6">Belum ada data Penjualan (Sales).</p>
                )}
              </div>
            )}
          </div>
          <div className="ccard">
            <div className="p-[16px] border-b border-line mb-[16px]">
              <h3 className="font-bold text-[16px]">Riwayat Snapshot (Pertumbuhan)</h3>
            </div>
            <div>
              <div className="tbl-wrap"><table className="w-full">
                <thead className="border-b border-line bg-slate-50">
                  <tr className="border-b border-line hover:bg-slate-50/50">
                    <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft">Tanggal</th>
                    <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft text-right">Followers</th>
                    <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft text-right">Tier</th>
                    <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft text-right">Audience Age</th>
                    <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft text-right">Level</th>
                    <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft text-right">Ratecard</th>
                    <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft text-right">GMV 30 Hari</th>
                    <th className="py-[12px] px-[16px] text-left font-semibold text-text-soft text-right">Diupdate Oleh</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map(s => (
                    <tr className="border-b border-line hover:bg-slate-50/50" key={s.id}>
                      <td className="py-[12px] px-[16px]">{new Date(s.tanggal_update).toLocaleDateString('id-ID')}</td>
                      <td className="py-[12px] px-[16px] text-right">{formatAbbreviated(s.followers, false)}</td>
                      <td className="py-[12px] px-[16px] text-right">{s.tier || '-'}</td>
                      <td className="py-[12px] px-[16px] text-right">{s.audience_age || '-'}</td>
                      <td className="py-[12px] px-[16px] text-right">{s.level || '-'}</td>
                      <td className="py-[12px] px-[16px] text-right">{s.ratecard === 0 ? 'Barter' : (s.ratecard ? `Rp ${s.ratecard.toLocaleString()}` : '-')}</td>
                      <td className="py-[12px] px-[16px] text-right">{formatAbbreviated(s.gmv_30d, true)}</td>
                      <td className="py-[12px] px-[16px] text-right text-slate-500">{s.updated_by || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
