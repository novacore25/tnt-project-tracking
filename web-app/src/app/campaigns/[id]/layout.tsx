"use client";

import { useDatabaseStore } from "@/store/useDatabaseStore";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { cn } from "@/utils/cn";
import { Settings2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import { CampaignFilterProvider, useCampaignFilter } from "@/providers/CampaignFilterProvider";
import { Search } from "lucide-react";

export default function CampaignLayout({ children }: { children: React.ReactNode }) {
  return (
    <CampaignFilterContextWrapper>
      {children}
    </CampaignFilterContextWrapper>
  );
}

function CampaignFilterContextWrapper({ children }: { children: React.ReactNode }) {
  const { id } = useParams();
  const campaignId = Number(id);
  const { campaigns, updateCampaign } = useDatabaseStore();
  const campaign = campaigns.find(c => c.id === campaignId);

  const handleSaveFilter = async (type: any, usernames: string) => {
    if (!campaignId) return;
    await updateCampaign(campaignId, {
      creator_filter_type: type,
      creator_filter_usernames: usernames
    });
  };

  return (
    <CampaignFilterProvider 
      initialFilterType={(campaign?.creator_filter_type as any) || 'none'}
      initialFilterUsernames={campaign?.creator_filter_usernames || ''}
      onSaveFilter={handleSaveFilter}
    >
      <CampaignLayoutInner>{children}</CampaignLayoutInner>
    </CampaignFilterProvider>
  );
}

function CampaignLayoutInner({ children }: { children: React.ReactNode }) {
  const { id } = useParams();
  const pathname = usePathname();
  const campaignId = Number(id);
  const { appliedFilterType, setFilterType, appliedFilterUsernames, setFilterUsernames, setIsFilterModalOpen } = useCampaignFilter();
  
  const { campaigns, brands, updateCampaign } = useDatabaseStore();
  const campaign = campaigns.find(c => c.id === campaignId);
  const brand = brands.find(b => b.id === campaign?.brand_id);

  const tabs = [
    { name: 'Konsep', href: `/campaigns/${campaignId}/concepts`, disabled: false },
    { name: 'Listing & Seleksi', href: `/campaigns/${campaignId}/listing`, disabled: false },
    { name: 'Video & VT', href: `/campaigns/${campaignId}/video`, disabled: false },
    { name: 'Live Stream', href: `/campaigns/${campaignId}/livestream`, disabled: false },
    { name: 'Performa', href: `/campaigns/${campaignId}/performa`, disabled: false },
    { name: 'Harian (Daily)', href: `/campaigns/${campaignId}/daily`, disabled: false },
    { name: 'Keuangan', href: `/campaigns/${campaignId}/keuangan`, disabled: false },
    { name: 'Sampel & Alamat', href: `/campaigns/${campaignId}/alamat`, disabled: false },
    { name: 'Jadwal Live', href: `/campaigns/${campaignId}/live`, disabled: false },
    { name: 'Produk', href: `/campaigns/${campaignId}/sku`, disabled: false },
  ];

  const portalLink = typeof window !== 'undefined' ? `${window.location.origin}/portal/${campaign?.id || campaignId}` : `/portal/${campaign?.id || campaignId}`;
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [formData, setFormData] = useState({
    nama: '',
    tipe_campaign: 'sales',
    start_date: '',
    end_date: '',
    target_gmv: '',
    target_video: '',
    target_creator: '',
    target_creator_mega: '',
    target_creator_live: '',
    target_creator_live_nano: '',
    target_creator_live_micro: '',
    target_creator_live_macro: '',
    target_creator_live_mega: '',
    target_views: '',
    budget_creator_plafon: '',
    budget_ads_plafon: '',
    require_client_approval: false,
    pin: '',
    tiktok_campaign_ids: '',
    status: 'aktif'
  });

  useEffect(() => {
    if (campaign && isSettingsOpen) {
      setFormData({
        nama: campaign.nama || '',
        tipe_campaign: campaign.tipe_campaign || 'sales',
        start_date: campaign.start_date || '',
        end_date: campaign.end_date || '',
        target_gmv: campaign.target_gmv?.toString() || '',
        target_video: campaign.target_video?.toString() || '',
        target_creator: campaign.target_creator?.toString() || '',
        target_creator_nano: campaign.target_creator_nano?.toString() || '',
        target_creator_micro: campaign.target_creator_micro?.toString() || '',
        target_creator_macro: campaign.target_creator_macro?.toString() || '',
        target_creator_mega: campaign.target_creator_mega?.toString() || '',
        target_creator_live: campaign.target_creator_live?.toString() || '',
        target_creator_live_nano: campaign.target_creator_live_nano?.toString() || '',
        target_creator_live_micro: campaign.target_creator_live_micro?.toString() || '',
        target_creator_live_macro: campaign.target_creator_live_macro?.toString() || '',
        target_creator_live_mega: campaign.target_creator_live_mega?.toString() || '',
        target_views: campaign.target_views?.toString() || '',
        budget_creator_plafon: campaign.budget_creator_plafon?.toString() || '',
        budget_ads_plafon: campaign.budget_ads_plafon?.toString() || '',
        require_client_approval: campaign.require_client_approval || false,
        pin: campaign.pin || '',
        tiktok_campaign_ids: Array.isArray(campaign.tiktok_campaign_ids) ? campaign.tiktok_campaign_ids.join(', ') : (typeof campaign.tiktok_campaign_ids === 'string' ? campaign.tiktok_campaign_ids : ''),
        status: (campaign as any).status || 'aktif'
      });
    }
  }, [campaign, isSettingsOpen]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateCampaign(campaignId, {
      nama: formData.nama,
      tipe_campaign: formData.tipe_campaign as any,
      start_date: formData.start_date,
      end_date: formData.end_date,
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
      pin: formData.pin,
      tiktok_campaign_ids: formData.tiktok_campaign_ids ? formData.tiktok_campaign_ids.split(',').map(id => id.trim()).filter(id => id) : [],
      status: formData.status as 'aktif' | 'selesai'
    });
    setIsSettingsOpen(false);
  };

  if (!campaign) return <div className="p-8">Campaign tidak ditemukan.</div>;

  return (
    <div className="space-y-[32px]">
      <div className="flex justify-between items-end flex-wrap gap-[16px]">
        <div>
          <div className="flex items-center gap-[10px] mb-[8px]">
            <span className="badge b-neutral">{brand?.nama}</span>
            <span className={`badge ${campaign.tipe_campaign === 'sales' ? 'b-sales' : campaign.tipe_campaign === 'gmv_awareness' ? 'b-warning' : 'b-awareness'} uppercase`}>
              {campaign.tipe_campaign.replace('_', ' + ')}
            </span>
          </div>
          <div className="flex items-center gap-[12px]">
            <h1 className="text-[28px] font-extrabold tracking-tight">{campaign.nama}</h1>
            
            {/* GLOBAL FILTER BUTTON */}
            <button 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${appliedFilterType !== 'none' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}
              onClick={() => {
                setFilterType(appliedFilterType === 'none' ? 'exclude' : appliedFilterType);
                setFilterUsernames(appliedFilterUsernames.join('\n'));
                setIsFilterModalOpen(true);
              }}
            >
              <Search className="w-4 h-4" />
              Creator Filter {appliedFilterType !== 'none' && '(Active)'}
            </button>

            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <button className="p-[8px] text-text-soft hover:text-text rounded-md hover:bg-p50 transition-colors">
                  <Settings2 className="w-5 h-5" />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Pengaturan & Detail Campaign</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleUpdate} className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nama Campaign</label>
                      <input required type="text" className="input" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} />
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
                      <label className="text-sm font-medium">Wajib Client Approval?</label>
                      <select required className="select" value={formData.require_client_approval ? 'true' : 'false'} onChange={e => setFormData({...formData, require_client_approval: e.target.value === 'true'})}>
                        <option value="false">Tidak (Langsung Jalan)</option>
                        <option value="true">Ya (Wajib di-Approve Client)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">PIN Akses Klien</label>
                      <input required type="text" className="input font-mono" value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} placeholder="Contoh: 1234" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Status Campaign</label>
                      <select required className="select" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                        <option value="aktif">Sedang Berjalan (Aktif)</option>
                        <option value="selesai">Selesai</option>
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
                    <div className="space-y-2 col-span-2">
                      <label className="text-sm font-medium">TikTok Campaign IDs <span className="text-slate-400 font-normal">(Pisahkan dengan koma jika lebih dari satu)</span></label>
                      <input type="text" className="input font-mono" value={formData.tiktok_campaign_ids} onChange={e => setFormData({...formData, tiktok_campaign_ids: e.target.value})} placeholder="Contoh: 7584662142017324821, 7598383205545068296" />
                      <p className="text-xs text-slate-500">ID ini digunakan untuk mendeteksi data penjualan secara otomatis pada saat upload file organik.</p>
                    </div>
                  </div>
                  <div className="border-t border-line pt-[16px] mt-[16px]">
                    <h4 className="font-bold mb-[12px] text-[12px] text-text-soft uppercase">Target & Plafon Budget</h4>
                    <div className="grid grid-cols-2 gap-[16px]">
                      <div className="space-y-[6px]">
                        <label className="text-sm font-medium">Target GMV (Rp)</label>
                        <input type="number" min="0" className="input" value={formData.target_gmv} onChange={e => setFormData({...formData, target_gmv: e.target.value})} />
                      </div>
                      <div className="space-y-[6px]">
                        <label className="text-sm font-medium">Target Video (Pcs)</label>
                        <input type="number" min="0" className="input" value={formData.target_video} onChange={e => setFormData({...formData, target_video: e.target.value})} />
                      </div>
                      <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-[16px] space-y-[12px]">
                        <h5 className="font-semibold text-sm text-text">Detail Target Kreator (Umum/Video)</h5>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-[12px]">
                          <div className="space-y-[6px]">
                            <label className="text-xs font-medium text-text-soft">Total</label>
                            <input type="number" min="0" className="input text-sm" value={formData.target_creator} onChange={e => setFormData({...formData, target_creator: e.target.value})} />
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
                      <div className="space-y-[6px]">
                        <label className="text-sm font-medium">Target Views</label>
                        <input type="number" min="0" className="input" value={formData.target_views} onChange={e => setFormData({...formData, target_views: e.target.value})} />
                      </div>
                      <div className="space-y-[6px]">
                        <label className="text-sm font-medium">Budget Kreator Plafon (Rp)</label>
                        <input required type="number" min="0" className="input" value={formData.budget_creator_plafon} onChange={e => setFormData({...formData, budget_creator_plafon: e.target.value})} />
                      </div>
                      <div className="space-y-[6px]">
                        <label className="text-sm font-medium">Budget Ads Plafon (Rp)</label>
                        <input required type="number" min="0" className="input" value={formData.budget_ads_plafon} onChange={e => setFormData({...formData, budget_ads_plafon: e.target.value})} />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end pt-4 gap-[10px]">
                    <button type="button" className="btn btn-outline" onClick={() => setIsSettingsOpen(false)}>Batal</button>
                    <button type="submit" className="btn btn-primary">Simpan Perubahan</button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        <div className="text-right p-[12px] bg-p50 border border-p100 rounded-[12px]">
          <p className="text-[11px] text-p300 font-bold mb-[6px] uppercase tracking-wider">Akses Portal Klien</p>
          <div className="flex gap-[16px] text-[13px] items-center">
            <div>
              <span className="text-text-soft">Link: </span>
              <a href={portalLink} target="_blank" rel="noreferrer" className="font-semibold text-p400 hover:underline">/portal/{campaign.id}</a>
            </div>
            <div>
              <span className="text-text-soft">PIN: </span>
              <span className="font-mono font-bold bg-white px-[8px] py-[4px] rounded border border-line">{campaign.pin || '1234'}</span>
            </div>
          </div>
        </div>
      </div>

      {(campaign as any).end_date && (campaign as any).status !== 'selesai' && (() => {
         const endDate = new Date((campaign as any).end_date);
         endDate.setHours(0, 0, 0, 0);
         const today = new Date();
         today.setHours(0, 0, 0, 0);
         const diffDays = Math.round((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
         const countdownText = diffDays > 0 ? `(H-${diffDays})` : diffDays < 0 ? `(H+${Math.abs(diffDays)})` : `(Hari ini)`;
         
         return (
           <div className="mb-[24px] p-[12px] bg-amber-50 border border-amber-200 rounded-[8px] flex items-start gap-[12px]">
             <div className="text-amber-500 mt-[2px]">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
             </div>
             <p className="text-[13px] text-amber-700 font-medium">
               <span className="font-bold">Pengingat:</span> Campaign ini di-setting berakhir pada {new Date((campaign as any).end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} <span className="font-bold text-amber-900">{countdownText}</span>. Sistem akan terus merekap data harian hingga status campaign diubah menjadi "Selesai".
             </p>
           </div>
         );
      })()}

      {(campaign as any).end_date && (campaign as any).status === 'selesai' && (
         <div className="mb-[24px] p-[12px] bg-emerald-50 border border-emerald-200 rounded-[8px] flex items-start gap-[12px]">
           <div className="text-emerald-500 mt-[2px]">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
           </div>
           <p className="text-[13px] text-emerald-700 font-medium">
             <span className="font-bold">Campaign Selesai:</span> Campaign ini telah diselesaikan pada {new Date((campaign as any).end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.
           </p>
         </div>
      )}

      <div className="border-b border-line overflow-x-auto">
        <nav className="-mb-px flex space-x-[32px] min-w-max">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.name}
                href={tab.disabled ? '#' : tab.href}
                prefetch={true}
                className={cn(
                  "whitespace-nowrap py-[16px] px-[4px] border-b-[2px] font-semibold text-[14px] transition-colors",
                  isActive
                    ? "border-p300 text-p300"
                    : tab.disabled
                      ? "border-transparent text-[#cbd5e1] cursor-not-allowed"
                      : "border-transparent text-text-soft hover:text-text hover:border-line"
                )}
                onClick={(e) => {
                  if (tab.disabled) {
                    e.preventDefault();
                    alert('Tab ini akan tersedia pada Fase berikutnya.');
                  }
                }}
              >
                {tab.name} {tab.disabled && <span className="ml-[6px] text-[10px] bg-line text-text-mute px-[6px] py-[2px] rounded-full">Fase 2</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="pt-[8px]">
        {children}
      </div>
    </div>
  );
}
