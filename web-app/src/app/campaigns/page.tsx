"use client";

import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Trash2, Archive, CheckCircle2, Activity, Lock, Plus, Search } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

export default function CampaignsPage() {
  const { campaigns, brands, addCampaign, addBrand } = useDatabaseStore();
  const { profile } = useAuth();
  const isManager = profile?.role === 'manager' || profile?.role === 'executive';
  const [isOpen, setIsOpen] = useState(false);
  const [isAddingNewBrand, setIsAddingNewBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [statusFilter, setStatusFilter] = useState<'aktif' | 'selesai' | 'arsip'>('aktif');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        isOpen // Jangan auto focus jika modal terbuka
      ) {
        return;
      }
      
      // Fokus jika tombol yang ditekan adalah karakter
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);
  const [formData, setFormData] = useState({
    nama: '', brand_id: '', tipe_campaign: 'sales', campaign_group: 'Tim Campaign', start_date: '', end_date: '',
    target_gmv: '',
    target_video: '',
    target_creator: '',
    target_creator_nano: '',
    target_creator_micro: '',
    target_creator_macro: '',
    target_creator_mega: '',
    target_creator_live: '',
    target_creator_live_nano: '',
    target_creator_live_micro: '',
    target_creator_live_macro: '',
    target_creator_live_mega: '',
    target_views: '',
    budget_creator_plafon: '', budget_ads_plafon: '', require_client_approval: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManager) return;

    const isDuplicate = campaigns.some(c => c.nama.toLowerCase() === formData.nama.toLowerCase());
    if (isDuplicate) {
      alert(`❌ Nama campaign "${formData.nama}" sudah ada!`);
      return;
    }
    
    let finalBrandId = Number(formData.brand_id);
    
    if (isAddingNewBrand && newBrandName.trim()) {
      const newBrand = await addBrand({ nama: newBrandName.trim(), status: 'aktif' });
      if (newBrand) {
        finalBrandId = newBrand.id;
      } else {
        alert("Gagal membuat brand baru");
        return;
      }
    } else if (!finalBrandId) {
      alert("Pilih brand atau buat brand baru!");
      return;
    }

    await addCampaign({
      nama: formData.nama, brand_id: finalBrandId, tipe_campaign: formData.tipe_campaign as any,
      start_date: formData.start_date, end_date: formData.end_date,
      target_gmv: formData.target_gmv ? Number(formData.target_gmv) : null,
      target_video: formData.target_video ? Number(formData.target_video) : null,
      target_creator: formData.target_creator ? Number(formData.target_creator) : null,
      target_creator_nano: formData.target_creator_nano ? Number(formData.target_creator_nano) : 0,
      target_creator_micro: formData.target_creator_micro ? Number(formData.target_creator_micro) : 0,
      target_creator_macro: formData.target_creator_macro ? Number(formData.target_creator_macro) : 0,
      target_creator_mega: formData.target_creator_mega ? Number(formData.target_creator_mega) : 0,
      target_creator_live: formData.target_creator_live ? Number(formData.target_creator_live) : null,
      target_creator_live_nano: formData.target_creator_live_nano ? Number(formData.target_creator_live_nano) : 0,
      target_creator_live_micro: formData.target_creator_live_micro ? Number(formData.target_creator_live_micro) : 0,
      target_creator_live_macro: formData.target_creator_live_macro ? Number(formData.target_creator_live_macro) : 0,
      target_creator_live_mega: formData.target_creator_live_mega ? Number(formData.target_creator_live_mega) : 0,
      target_views: formData.target_views ? Number(formData.target_views) : null,
      budget_creator_plafon: Number(formData.budget_creator_plafon || 0),
      budget_ads_plafon: Number(formData.budget_ads_plafon || 0),
      require_client_approval: formData.require_client_approval,
      campaign_group: formData.campaign_group || 'Tim Campaign',
      persiapan_14hari: null, vsa_gmv_max: null, pic: null, assist: null, file_concept_url: null, status: 'aktif', pin: null
    });
    setIsOpen(false);
    setIsAddingNewBrand(false);
    setNewBrandName('');
    setFormData({ nama: '', brand_id: '', tipe_campaign: 'sales', campaign_group: 'Tim Campaign', start_date: '', end_date: '', target_gmv: '', target_video: '', target_creator: '', target_creator_nano: '', target_creator_micro: '', target_creator_macro: '', target_creator_mega: '', target_views: '', budget_creator_plafon: '', budget_ads_plafon: '', require_client_approval: false });
  };

  return (
    <div className="space-y-[32px]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-[16px]">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight mb-[4px]">Campaigns</h1>
          <p className="text-[14px] text-text-soft">Pilih campaign untuk melihat detail dan mengelola creator.</p>
        </div>
        <div className="flex items-center gap-[12px] w-full md:w-auto">
          <div className="relative w-full md:w-[300px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              className="input pl-10 w-full"
              placeholder="Cari campaign..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {isManager && (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <button className="btn btn-primary shrink-0">
                  <Plus className="ico" /> Tambah
                </button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Tambah Campaign Baru</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nama Campaign</label>
                    <input required type="text" className="input" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} placeholder="Contoh: Ramadhan Mega Sale" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Brand</label>
                    {!isAddingNewBrand ? (
                      <select required className="select" value={formData.brand_id} onChange={e => {
                        if (e.target.value === 'new') {
                          setIsAddingNewBrand(true);
                          setFormData({...formData, brand_id: ''});
                        } else {
                          setFormData({...formData, brand_id: e.target.value});
                        }
                      }}>
                        <option value="">Pilih Brand...</option>
                        {brands.filter(b => b.status === 'aktif').map(b => (
                          <option key={b.id} value={b.id}>{b.nama}</option>
                        ))}
                        <option value="new" className="font-bold text-p300">+ Tambah Brand Baru</option>
                      </select>
                    ) : (
                      <div className="flex gap-2">
                        <input required type="text" className="input" value={newBrandName} onChange={e => setNewBrandName(e.target.value)} placeholder="Nama Brand Baru" />
                        <button type="button" className="btn btn-outline" onClick={() => setIsAddingNewBrand(false)}>Batal</button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipe Campaign</label>
                    <select required className="select" value={formData.tipe_campaign} onChange={e => setFormData({...formData, tipe_campaign: e.target.value})}>
                      <option value="sales">Sales (Fokus GMV)</option>
                      <option value="awareness">Awareness (Fokus Views)</option>
                      <option value="gmv_awareness">GMV + AWARENESS</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Grup Tim</label>
                    <select required className="select" value={formData.campaign_group} onChange={e => setFormData({...formData, campaign_group: e.target.value})}>
                      <option value="Tim Campaign">Tim Campaign</option>
                      <option value="Tim MCN">Tim MCN</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Wajib Client Approval?</label>
                    <select required className="select" value={formData.require_client_approval ? 'true' : 'false'} onChange={e => setFormData({...formData, require_client_approval: e.target.value === 'true'})}>
                      <option value="false">Tidak (Langsung Jalan)</option>
                      <option value="true">Ya (Wajib di-Approve Client)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Start Date</label>
                    <input required type="date" className="input" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">End Date</label>
                    <input required type="date" className="input" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
                  </div>
                </div>
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-bold mb-3 text-[12px] text-text-soft uppercase">Target & Plafon Budget</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Target GMV (Rp)</label>
                      <input type="number" min="0" className="input" value={formData.target_gmv} onChange={e => setFormData({...formData, target_gmv: e.target.value})} placeholder="Opsional" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Target Video (Pcs)</label>
                      <input type="number" min="0" className="input" value={formData.target_video} onChange={e => setFormData({...formData, target_video: e.target.value})} placeholder="Opsional" />
                    </div>
                    <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-[16px] space-y-[12px]">
                      <h5 className="font-semibold text-sm text-text">Detail Target Kreator (Umum/Video)</h5>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-[12px]">
                        <div className="space-y-[6px]">
                          <label className="text-xs font-medium text-text-soft">Total</label>
                          <input type="number" min="0" className="input text-sm" value={formData.target_creator} onChange={e => setFormData({...formData, target_creator: e.target.value})} placeholder="Opsional" />
                        </div>
                        <div className="space-y-[6px]">
                          <label className="text-xs font-medium text-text-soft">Nano</label>
                          <input type="number" min="0" className="input text-sm" value={formData.target_creator_nano || ''} onChange={e => setFormData({...formData, target_creator_nano: e.target.value})} />
                        </div>
                        <div className="space-y-[6px]">
                          <label className="text-xs font-medium text-text-soft">Micro</label>
                          <input type="number" min="0" className="input text-sm" value={formData.target_creator_micro || ''} onChange={e => setFormData({...formData, target_creator_micro: e.target.value})} />
                        </div>
                        <div className="space-y-[6px]">
                          <label className="text-xs font-medium text-text-soft">Macro</label>
                          <input type="number" min="0" className="input text-sm" value={formData.target_creator_macro || ''} onChange={e => setFormData({...formData, target_creator_macro: e.target.value})} />
                        </div>
                        <div className="space-y-[6px]">
                          <label className="text-xs font-medium text-text-soft">Mega</label>
                          <input type="number" min="0" className="input text-sm" value={formData.target_creator_mega || ''} onChange={e => setFormData({...formData, target_creator_mega: e.target.value})} />
                        </div>
                      </div>
                    </div>

                    {/* NEW LIVE TARGET BLOCK */}
                    <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-[16px] space-y-[12px]">
                      <h5 className="font-semibold text-sm text-text">Detail Target Creator Live</h5>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-[12px]">
                        <div className="space-y-[6px]">
                          <label className="text-xs font-medium text-text-soft">Total Live</label>
                          <input type="number" min="0" className="input text-sm" value={formData.target_creator_live || ''} onChange={e => setFormData({...formData, target_creator_live: e.target.value})} />
                        </div>
                        <div className="space-y-[6px]">
                          <label className="text-xs font-medium text-text-soft">Nano Live</label>
                          <input type="number" min="0" className="input text-sm" value={formData.target_creator_live_nano || ''} onChange={e => setFormData({...formData, target_creator_live_nano: e.target.value})} />
                        </div>
                        <div className="space-y-[6px]">
                          <label className="text-xs font-medium text-text-soft">Micro Live</label>
                          <input type="number" min="0" className="input text-sm" value={formData.target_creator_live_micro || ''} onChange={e => setFormData({...formData, target_creator_live_micro: e.target.value})} />
                        </div>
                        <div className="space-y-[6px]">
                          <label className="text-xs font-medium text-text-soft">Macro Live</label>
                          <input type="number" min="0" className="input text-sm" value={formData.target_creator_live_macro || ''} onChange={e => setFormData({...formData, target_creator_live_macro: e.target.value})} />
                        </div>
                        <div className="space-y-[6px]">
                          <label className="text-xs font-medium text-text-soft">Mega Live</label>
                          <input type="number" min="0" className="input text-sm" value={formData.target_creator_live_mega || ''} onChange={e => setFormData({...formData, target_creator_live_mega: e.target.value})} />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Target Views</label>
                      <input type="number" min="0" className="input" value={formData.target_views} onChange={e => setFormData({...formData, target_views: e.target.value})} placeholder="Opsional" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Budget Kreator Plafon (Rp)</label>
                      <input required type="number" min="0" className="input" value={formData.budget_creator_plafon} onChange={e => setFormData({...formData, budget_creator_plafon: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Budget Ads Plafon (Rp)</label>
                      <input required type="number" min="0" className="input" value={formData.budget_ads_plafon} onChange={e => setFormData({...formData, budget_ads_plafon: e.target.value})} />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-4 gap-[10px]">
                  <button type="button" className="btn btn-outline" onClick={() => setIsOpen(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary">Buat Campaign</button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      {/* Group Filter Pills */}
      <div className="flex items-center gap-[8px]">
        {[
          { key: 'all', label: 'Semua Tim' },
          { key: 'Tim Campaign', label: 'Tim Campaign' },
          { key: 'Tim MCN', label: 'Tim MCN' },
        ].map(g => (
          <button
            key={g.key}
            onClick={() => setGroupFilter(g.key)}
            className={`px-[14px] py-[6px] rounded-full text-[13px] font-semibold transition-all ${
              groupFilter === g.key
                ? 'bg-p300 text-white shadow-sm'
                : 'bg-line text-text-soft hover:bg-p50 hover:text-p300'
            }`}
          >
            {g.label}
            <span className={`ml-[6px] text-[11px] px-[5px] py-[1px] rounded-full ${
              groupFilter === g.key ? 'bg-white/20 text-white' : 'bg-white text-text-soft'
            }`}>
              {campaigns.filter(c => c.status === statusFilter && (g.key === 'all' || (c.campaign_group || 'Tim Campaign') === g.key) && c.nama.toLowerCase().includes(searchQuery.toLowerCase())).length}
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-[8px] border-b border-line pb-0">
        {([
          { key: 'aktif', label: 'Aktif', icon: <Activity className="w-4 h-4" /> },
          { key: 'selesai', label: 'Selesai', icon: <CheckCircle2 className="w-4 h-4" /> },
          { key: 'arsip', label: 'Arsip', icon: <Archive className="w-4 h-4" /> },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`flex items-center gap-[6px] px-[16px] py-[10px] text-[14px] font-semibold border-b-[2px] transition-colors ${
              statusFilter === tab.key
                ? 'border-p300 text-p300'
                : 'border-transparent text-text-soft hover:text-text'
            }`}
          >
            {tab.icon} {tab.label}
            <span className={`ml-[4px] text-[11px] px-[6px] py-[2px] rounded-full ${
              statusFilter === tab.key ? 'bg-p50 text-p300' : 'bg-line text-text-soft'
            }`}>
              {campaigns.filter(c => c.status === tab.key && (groupFilter === 'all' || (c.campaign_group || 'Tim Campaign') === groupFilter) && c.nama.toLowerCase().includes(searchQuery.toLowerCase())).length}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-[16px] md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {campaigns.filter(c => c.status === statusFilter && (groupFilter === 'all' || (c.campaign_group || 'Tim Campaign') === groupFilter) && c.nama.toLowerCase().includes(searchQuery.toLowerCase())).map(campaign => {
          const brand = brands.find(b => b.id === campaign.brand_id);
          return <CampaignCardItem key={campaign.id} campaign={campaign} brand={brand} isManager={isManager} />;
        })}
      </div>
    </div>
  );
}

function CampaignCardItem({ campaign, brand, isManager }: { campaign: any, brand: any, isManager: boolean }) {
  const { updateCampaign, deleteCampaign, campaigns } = useDatabaseStore();
  const { canEditCampaign } = useAuth();
  const hasAccess = canEditCampaign(campaign.id);
  const [isExpanded, setIsExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    nama: campaign.nama, tipe_campaign: campaign.tipe_campaign, status: campaign.status,
    campaign_group: campaign.campaign_group || 'Tim Campaign',
    start_date: campaign.start_date, end_date: campaign.end_date,
    target_gmv: campaign.target_gmv || '', target_video: campaign.target_video || '',
    target_creator: campaign.target_creator || '', target_views: campaign.target_views || '',
    budget_creator_plafon: campaign.budget_creator_plafon || '', budget_ads_plafon: campaign.budget_ads_plafon || '',
    require_client_approval: campaign.require_client_approval || false
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManager) return;
    setSaving(true);
    const isDuplicate = campaigns.some(c => c.id !== campaign.id && c.nama.toLowerCase() === formData.nama.toLowerCase());
    if (isDuplicate) {
      alert(`❌ Nama campaign "${formData.nama}" sudah dipakai campaign lain!`);
      setSaving(false);
      return;
    }
    await updateCampaign(campaign.id, {
      nama: formData.nama, tipe_campaign: formData.tipe_campaign as any, status: formData.status as any,
      start_date: formData.start_date, end_date: formData.end_date,
      target_gmv: formData.target_gmv ? Number(formData.target_gmv) : null,
      target_video: formData.target_video ? Number(formData.target_video) : null,
      target_creator: formData.target_creator ? Number(formData.target_creator) : null,
      target_creator_nano: formData.target_creator_nano ? Number(formData.target_creator_nano) : 0,
      target_creator_micro: formData.target_creator_micro ? Number(formData.target_creator_micro) : 0,
      target_creator_macro: formData.target_creator_macro ? Number(formData.target_creator_macro) : 0,
      target_creator_mega: formData.target_creator_mega ? Number(formData.target_creator_mega) : 0,
      target_views: formData.target_views ? Number(formData.target_views) : null,
      budget_creator_plafon: Number(formData.budget_creator_plafon || 0), budget_ads_plafon: Number(formData.budget_ads_plafon || 0),
      require_client_approval: formData.require_client_approval,
      campaign_group: formData.campaign_group || 'Tim Campaign'
    });
    setSaving(false);
    setIsExpanded(false);
  };

  const handleDelete = async () => {
    if (!isManager) return;
    const step1 = confirm(`⚠️ Anda yakin ingin MENGHAPUS campaign "${campaign.nama}"?\n\nSEMUA data terkait akan ikut terhapus:\n• Daftar kreator di campaign ini\n• Data video & VT\n• Data performa & GMV\n• Data sampel & alamat pengiriman\n• Jadwal Live\n• Data keuangan (Rate Card & Pelunasan)\n\nAksi ini TIDAK BISA dibatalkan!`);
    if (!step1) return;
    const step2 = confirm(`🚨 KONFIRMASI AKHIR\n\nKetuk OK untuk benar-benar menghapus "${campaign.nama}" beserta seluruh datanya secara permanen.`);
    if (!step2) return;
    setIsDeleting(true);
    try {
      await deleteCampaign(campaign.id);
    } catch (err: any) {
      alert('Gagal menghapus campaign. Mungkin ada data yang masih terkait di database.');
      setIsDeleting(false);
    }
  };

  return (
    <div className={`campcard flex flex-col justify-between ${!hasAccess ? 'opacity-80 grayscale-[20%]' : ''}`}>
      <div className="cbody flex flex-col h-full relative group">
        <Link href={`/campaigns/${campaign.id}/listing`} className="block flex-1 cursor-pointer">
          {!hasAccess && (
            <div className="absolute top-0 right-0 flex items-center gap-[4px] bg-slate-100 text-slate-500 text-[10px] px-[8px] py-[4px] rounded-[16px] font-semibold">
              <Lock className="w-3 h-3" /> Read Only
            </div>
          )}
          <div className="ceyebrow">{brand?.nama || 'Tanpa Brand'}</div>
          <div className="ctitle max-w-[90%] group-hover:text-p300 transition-colors">{campaign.nama}</div>
          <div className="flex items-center gap-[6px] mt-[6px] flex-wrap">
            <span className={`badge ${campaign.tipe_campaign === 'sales' ? 'b-sales' : campaign.tipe_campaign === 'gmv_awareness' ? 'b-warning' : 'b-awareness'}`}>
              {campaign.tipe_campaign.replace('_', ' + ')}
            </span>
            {(campaign.campaign_group || 'Tim Campaign') === 'Tim MCN' && (
              <span className="inline-flex items-center px-[8px] py-[2px] rounded-full text-[10px] font-bold bg-violet-100 text-violet-700">MCN</span>
            )}
          </div>

          
          <div className="flex-grow"></div>
          
          <div className="mt-[24px]">
            <div className="crow">
              <span className="k">Status</span>
              <span className={`v badge ${campaign.status === 'aktif' ? 'b-pending' : 'b-neutral'}`}>{campaign.status}</span>
            </div>
            <div className="crow">
              <span className="k">Periode</span>
              <span className="v font-semibold">
                {new Date(campaign.start_date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })} - {new Date(campaign.end_date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            {Number(campaign.target_gmv) > 0 && (
              <div className="crow">
                <span className="k">Target GMV</span>
                <span className="v text-g300">Rp {Number(campaign.target_gmv).toLocaleString()}</span>
              </div>
            )}
            {Number(campaign.target_video) > 0 && (
              <div className="crow">
                <span className="k">Target Video</span>
                <span className="v">{Number(campaign.target_video).toLocaleString()} Pcs</span>
              </div>
            )}
            {Number(campaign.target_creator) > 0 && (
              <div className="crow">
                <span className="k">Target Kreator</span>
                <span className="v">{Number(campaign.target_creator).toLocaleString()} Org</span>
              </div>
            )}
            {Number(campaign.budget_creator_plafon) > 0 && (
              <div className="crow">
                <span className="k">Budget Creator</span>
                <span className="v text-o300">Rp {Number(campaign.budget_creator_plafon).toLocaleString()}</span>
              </div>
            )}
            {Number(campaign.budget_ads_plafon) > 0 && (
              <div className="crow">
                <span className="k">Budget Ads</span>
                <span className="v text-o300">Rp {Number(campaign.budget_ads_plafon).toLocaleString()}</span>
              </div>
            )}
          </div>
        </Link>
      </div>

      {isManager && (
        <div className="mt-[20px] pt-[16px] border-t border-line">
          <button 
            onClick={(e) => { e.preventDefault(); setIsExpanded(!isExpanded); }} 
            className="w-full text-center py-[8px] text-[12px] font-bold text-text-soft hover:text-p300 flex justify-center items-center gap-[6px] transition-colors bg-[#f8fafc] rounded-md"
          >
            {isExpanded ? "Tutup Pengaturan" : "Pengaturan Target & Plafon"}
            <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
          </button>
          
          {isExpanded && (
            <div className="pt-[16px] mt-[16px] border-t border-line">
              <form onSubmit={handleSave} className="space-y-[12px]">
                <div className="space-y-[6px]">
                  <label className="text-[12px] font-semibold text-text-soft">Nama Campaign</label>
                  <input required type="text" className="input !p-[8px] !text-[13px]" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} />
                </div>
                
                <div className="grid grid-cols-2 gap-[10px]">
                  <div className="space-y-[6px]">
                    <label className="text-[12px] font-semibold text-text-soft">Status</label>
                    <select required className="select !p-[8px] !text-[13px]" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                      <option value="aktif">Aktif</option>
                      <option value="selesai">Selesai</option>
                      <option value="arsip">Arsip</option>
                    </select>
                  </div>
                  <div className="space-y-[6px]">
                    <label className="text-[12px] font-semibold text-text-soft">Tipe</label>
                    <select required className="select !p-[8px] !text-[13px]" value={formData.tipe_campaign} onChange={e => setFormData({...formData, tipe_campaign: e.target.value})}>
                      <option value="sales">Sales</option>
                      <option value="awareness">Awareness</option>
                      <option value="gmv_awareness">GMV + AWARENESS</option>
                    </select>
                  </div>
                  <div className="space-y-[6px]">
                    <label className="text-[12px] font-semibold text-text-soft">Grup Tim</label>
                    <select required className="select !p-[8px] !text-[13px]" value={formData.campaign_group} onChange={e => setFormData({...formData, campaign_group: e.target.value})}>
                      <option value="Tim Campaign">Tim Campaign</option>
                      <option value="Tim MCN">Tim MCN</option>
                    </select>
                  </div>
                  <div className="space-y-[6px]">
                    <label className="text-[12px] font-semibold text-text-soft">Start Date</label>
                    <input required type="date" className="input !p-[8px] !text-[13px]" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
                  </div>
                  <div className="space-y-[6px]">
                    <label className="text-[12px] font-semibold text-text-soft">End Date</label>
                    <input required type="date" className="input !p-[8px] !text-[13px]" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
                  </div>
                </div>

                <div className="pt-[16px] border-t border-line space-y-[12px]">
                  <div className="grid grid-cols-2 gap-[10px]">
                    <div>
                      <label className="block text-[12px] font-semibold text-text-soft mb-[6px]">Target GMV</label>
                      <input type="number" min="0" className="input !p-[8px] !text-[13px]" value={formData.target_gmv} onChange={e => setFormData({...formData, target_gmv: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-text-soft mb-[6px]">Target Video</label>
                      <input type="number" min="0" className="input !p-[8px] !text-[13px]" value={formData.target_video} onChange={e => setFormData({...formData, target_video: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-text-soft mb-[6px]">Target Kreator</label>
                      <input type="number" min="0" className="input !p-[8px] !text-[13px]" value={formData.target_creator} onChange={e => setFormData({...formData, target_creator: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-text-soft mb-[6px]">Target Views</label>
                      <input type="number" min="0" className="input !p-[8px] !text-[13px]" value={formData.target_views} onChange={e => setFormData({...formData, target_views: e.target.value})} />
                    </div>
                    <div className="space-y-[6px]">
                      <label className="text-[12px] font-semibold text-text-soft">Client Approval</label>
                      <select className="select !p-[8px] !text-[13px]" value={formData.require_client_approval ? 'true' : 'false'} onChange={e => setFormData({...formData, require_client_approval: e.target.value === 'true'})}>
                        <option value="false">Tidak</option>
                        <option value="true">Ya</option>
                      </select>
                    </div>
                    <div className="col-span-2 space-y-[6px]">
                      <label className="text-[12px] font-semibold text-text-soft">Plafon Kreator</label>
                      <input type="number" min="0" className="input !p-[8px] !text-[13px]" value={formData.budget_creator_plafon} onChange={e => setFormData({...formData, budget_creator_plafon: e.target.value})} />
                    </div>
                    <div className="col-span-2 space-y-[6px]">
                      <label className="text-[12px] font-semibold text-text-soft">Plafon Ads</label>
                      <input type="number" min="0" className="input !p-[8px] !text-[13px]" value={formData.budget_ads_plafon} onChange={e => setFormData({...formData, budget_ads_plafon: e.target.value})} />
                    </div>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary w-full justify-center" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </button>
              </form>

              <div className="mt-[24px] pt-[16px] border-t border-red-100">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-full flex items-center justify-center gap-[8px] px-[12px] py-[8px] text-[12px] font-bold text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isDeleting ? 'Menghapus...' : 'Hapus Campaign Ini'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
