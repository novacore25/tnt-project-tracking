"use client";

import { useDatabaseStore } from "@/store/useDatabaseStore";
import { getCreatorType, getLatestSnapshot, computeCampaignGMV, computeHighestVideoGMV, getJenisKerjasama } from "@/utils/computed";
import { useDraftLocalStorage } from "@/hooks/useDraftLocalStorage";
import { formatAbbreviated } from "@/utils/formatters";




import { ArrowLeft, UserPlus, Phone, CreditCard, Activity, ArrowUpDown, ChevronDown, ChevronRight, Edit, Save, Plus, X, Trash2, Check, Video, TrendingUp, DollarSign, Calendar, Users, Briefcase, ExternalLink, ArrowRight, TrendingDown } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, ReactNode, useEffect, useRef, useCallback, useMemo } from "react";
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import { Edit2 } from "lucide-react";
import { fetchCreatorProfile } from "@/app/actions/creatorActions";

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
  
  const tier = mergedProfile.tier || 'Unknown';
  
  const activeContact = localData?.contacts?.find((c: any) => c.status === 'aktif');
  
  const displayNiches = localData?.creatorNiches
    ?.sort((a: any, b: any) => a.peringkat - b.peringkat)
    ?.map((cn: any) => niches.find(n => n.id === cn.niche_id)?.nama)
    ?.filter(Boolean) || [];

  const notes = localData?.notes?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || [];
  
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

  let trackRecords = (localData?.ccs || [])
    .map((cc: any) => {
      const campaign = campaigns.find(c => c.id === cc.campaign_id);
      
      const campaignSales = localData?.sales?.filter((s: any) => {
        if (s.campaign_id !== cc.campaign_id) return false;
        if (!campaign) return true;
        const dateStr = s.tanggal ? s.tanggal.substring(0, 10) : '';
        if (campaign.start_date && dateStr < campaign.start_date) return false;
        if (campaign.end_date && dateStr > campaign.end_date) return false;
        return true;
      }) || [];
      const gmv = campaignSales.reduce((sum: number, s: any) => sum + (s.gmv || 0), 0);

      const manualVideos = localData?.videos?.filter((v: any) => v.campaign_creator_id === cc.id) || [];
      const uniqueVideoIds = new Set<string>();
      let totalVtCount = manualVideos.length;
      campaignSales.forEach((s: any) => {
        let vid = s.content_uid;
        if (vid && vid.startsWith('video_')) {
          const parts = vid.split('_');
          if (parts.length >= 2) vid = parts[1];
        }
        
        if (vid && !uniqueVideoIds.has(vid)) {
          uniqueVideoIds.add(vid);
          // Check if already in manual videos (either as content_uid or vt_code)
          if (!manualVideos.some((v: any) => v.content_uid === vid || v.vt_code === vid || v.content_uid === s.content_uid)) {
            totalVtCount++;
          }
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

  const [videoLink, setVideoLink] = useState('');
  const [activeCcId, setActiveCcId] = useState<number | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);

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
      alert("Gagal update profil: " + e.message);
    }
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
      const payload = {
        creator_id: creatorId,
        label: addressForm.label,
        nama_penerima: addressForm.nama_penerima,
        alamat_jalan: addressForm.alamat_jalan,
        kecamatan: addressForm.kecamatan,
        kota: addressForm.kota,
        provinsi: addressForm.provinsi,
        kodepos: addressForm.kodepos
      };

      if (addressForm.id) {
        await supabase.from('creator_address_book').update(payload).eq('id', addressForm.id);
      } else {
        await supabase.from('creator_address_book').insert(payload);
      }

      // refresh address book
      const { data } = await supabase.from('creator_address_book').select('*').eq('creator_id', creatorId).order('id', { ascending: false });
      setLocalData(prev => prev ? { ...prev, addressBook: data || [] } : null);
      
      setAddressOpen(false);
    } catch (err: any) {
      alert("Gagal update alamat: " + e.message);
    }
  };

  const handleDeleteAddress = async (id: number) => {
    if(!confirm('Yakin hapus alamat ini?')) return;
    await supabase.from('creator_address_book').delete().eq('id', id);
    const { data } = await supabase.from('creator_address_book').select('*').eq('creator_id', creatorId).order('id', { ascending: false });
    setLocalData(prev => prev ? { ...prev, addressBook: data || [] } : null);
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
    const { data: newNotes } = await supabase.from('creator_notes').select('*').eq('creator_id', creatorId);
    if (newNotes) {
      setLocalData(prev => prev ? { ...prev, notes: newNotes } : prev);
    }

    setNoteOpen(false);
    clearNoteDraft();
  };

  const handleTarikCampaign = async () => {
    if(!campForm.campaign_id) return;
    await addCampaignCreator({
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
    alert('Berhasil ditarik ke Campaign!');
    setCampOpen(false);
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
            <p className="text-slate-500">{creator.nama_asli || 'Nama asli belum diisi'}</p>
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
                <button className="btn btn-primary w-full" onClick={handleTarikCampaign} disabled={!campForm.campaign_id}>Tambahkan ke Listing</button>
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
                  <p className="font-bold text-lg">{mergedProfile.ratecard === 0 ? 'Barter' : (mergedProfile.ratecard ? `Rp ${mergedProfile.ratecard.toLocaleString()}` : '-')}</p>
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
                      return (
                        <div key={cc.id} className="flex justify-between items-center text-sm p-2 border border-slate-100 rounded-lg bg-slate-50">
                          <span className="font-medium text-slate-700">{campaign?.nama || `Campaign #${cc.campaign_id}`}</span>
                          <span className="font-bold text-slate-900">
                            {cc.price === 0 ? 'Barter' : (cc.price ? `Rp ${Number(cc.price).toLocaleString()}` : 'Belum Set')}
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
                      const campaignSales = localData?.sales?.filter((s: any) => s.campaign_id === tr.campaign_id) || [];
                      const combinedVideos = [...manualVideos];
                      const uniqueVideoIds2 = new Set<string>();
                      campaignSales.forEach((s: any) => {
                          let vid = s.content_uid;
                          if (vid && vid.startsWith('video_')) {
                            const parts = vid.split('_');
                            if (parts.length >= 2) vid = parts[1];
                          }

                          if (vid && !uniqueVideoIds2.has(vid)) {
                              uniqueVideoIds2.add(vid);
                              // Check if already in manual videos
                              if (!manualVideos.some((v: any) => v.content_uid === vid || v.vt_code === vid || v.content_uid === s.content_uid)) {
                                  combinedVideos.push({
                                     id: `auto-${vid}`,
                                     content_uid: vid, // Use the true video ID
                                     link_video: `https://www.tiktok.com/@${localData?.creator?.username}/video/${vid}`,
                                     urutan: combinedVideos.length + 1,
                                     campaign_creator_id: tr.id
                                  });
                              }
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
                          <td className="py-[12px] px-[16px]">Rp {tr.price.toLocaleString()}</td>
                          <td className="py-[12px] px-[16px] text-right font-medium text-slate-700">
                            {tr.nominal_pelunasan ? `Rp ${tr.nominal_pelunasan.toLocaleString()}` : '-'}
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
                            {tr.gmv > 0 ? `Rp ${tr.gmv.toLocaleString()}` : '-'}
                          </td>
                          <td className="py-[12px] px-[16px] text-right font-medium text-emerald-600">
                            {tr.highestVideoGmv > 0 ? `Rp ${tr.highestVideoGmv.toLocaleString()}` : '-'}
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
                                      const videoSales = localData?.sales?.filter((s: any) => {
                                        if (!s.content_uid || !v.content_uid) return false;
                                        // True video ID could be exactly the content_uid, or embedded inside it like video_ID_PRODUCTID
                                        return s.content_uid === v.content_uid || s.content_uid.includes(v.content_uid);
                                      }) || [];
                                      const organicGmv = videoSales.reduce((sum, row) => sum + row.gmv, 0);
                                      const itemsSold = videoSales.reduce((sum, row) => sum + (row.quantity || 0), 0);
                                      const maxViews = videoSales.length > 0 ? Math.max(...videoSales.map((s: any) => Number(s.raw_data?.['Video views'] || 0))) : 0;
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
                                        const costIdr = ad.cost_usd * ad.kurs;
                                        const revenueIdr = ad.gross_revenue_usd * ad.kurs;
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
                                
                                const totalItemsSold = products.reduce((sum: number, p: any) => sum + (p.items_sold || 0), 0);
                                const totalGmv = products.reduce((sum: number, p: any) => sum + (p.gmv || 0), 0);

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
                                const totalItemsSold = videoSales.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0);
                                
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
            
                  const totalGmvTab = sales.reduce((sum: number, s: any) => sum + (s.gmv || 0), 0);
            
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
