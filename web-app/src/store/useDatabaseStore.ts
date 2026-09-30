import { create } from 'zustand';
import { getInitialStoreData, createCampaignAction, updateCampaignAction, deleteCampaignAction, createBrandAction, createSkuAction, deleteSkuAction } from '@/app/actions/storeActions';
import {
  addAuditLogAction, addCreatorFullAction, updateCreatorAction, addCreatorSnapshotAction,
  updateCreatorContactAction, updateCreatorNichesAction, addCreatorNoteAction,
  addCampaignCreatorAction, updateCampaignCreatorAction, deleteCampaignCreatorAction,
  addVideoAction, updateVideoApprovalAction, updateCreatorPaymentAction,
  addAdsSpendAction, updateAdsSpendAction, fetchCreatorAddressesAction, updateCreatorAddressAction,
  fetchLiveSchedulesAction, addLiveScheduleAction, deleteLiveScheduleAction,
  updateBrandAction, addNicheAction, updateNicheAction,
  addDailyPerformanceAction, updateDailyPerformanceAction, updateSkuAction
} from '@/app/actions/databaseActions';
import { DatabaseSchema, Creator, CreatorSnapshot, CreatorContact, CampaignCreator, Video, AuditLog, CreatorNote, CreatorPayment, AdsSpend, CreatorAddress, LiveSchedule, DailyPerformance, OrganicVideo } from '@/types/database';

type DatabaseState = DatabaseSchema & {
  isLoading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
  
  // Actions for Creator Pool
  addCreatorFull: (
    creator: Omit<Creator, 'id' | 'created_at'>,
    snapshot?: Omit<CreatorSnapshot, 'id' | 'created_at' | 'creator_id'>,
    contact?: string,
    nicheIds?: number[]
  ) => Promise<void>;
  updateCreator: (id: number, updates: Partial<Creator>) => Promise<void>;
  addCreatorSnapshot: (snapshot: Omit<CreatorSnapshot, 'id' | 'created_at'>) => Promise<void>;
  updateCreatorContact: (creatorId: number, newNomor: string) => Promise<void>;
  addCreatorNote: (note: Omit<CreatorNote, 'id' | 'created_at'>) => Promise<void>;
  updateCreatorNiches: (creatorId: number, nicheIds: number[]) => Promise<void>;
  
  // Actions for Campaigns
  addCampaign: (campaign: Omit<DatabaseSchema['campaigns'][0], 'id' | 'created_at'>) => Promise<DatabaseSchema['campaigns'][0] | null>;
  updateCampaign: (id: number, updates: Partial<DatabaseSchema['campaigns'][0]>) => Promise<void>;
  deleteCampaign: (id: number) => Promise<void>;
  
  // Actions for Campaign Listing
  addCampaignCreator: (cc: Omit<CampaignCreator, 'id' | 'created_at'>) => Promise<{ success: boolean; error?: string; data?: any; missing?: string[] }>;
  updateCampaignCreator: (id: number, updates: Partial<CampaignCreator>, changedBy: string) => Promise<void>;
  deleteCampaignCreator: (id: number) => Promise<void>;
  addVideo: (video: Omit<Video, 'id' | 'created_at'>) => Promise<void>;
  updateVideoApproval: (id: number, approval: Video['vt_approval'], changedBy: string) => Promise<void>;
  
  // Budgeting Actions
  fetchCreatorPayments: (campaignId: number) => Promise<void>;
  updateCreatorPayment: (id: number | null, payment: Partial<CreatorPayment>) => Promise<CreatorPayment | null>;
  fetchAdsSpends: (campaignId: number) => Promise<void>;
  addAdsSpend: (spend: Omit<AdsSpend, 'id' | 'created_at'>) => Promise<AdsSpend | null>;
  updateAdsSpend: (id: number, spend: Partial<AdsSpend>) => Promise<AdsSpend | null>;

  // Operations Actions
  fetchCreatorAddresses: (campaignId: number) => Promise<void>;
  updateCreatorAddress: (id: number | null, address: Partial<CreatorAddress>) => Promise<CreatorAddress | null>;
  fetchLiveSchedules: (campaignId: number) => Promise<void>;
  addLiveSchedule: (schedule: Omit<LiveSchedule, 'id' | 'created_at'>) => Promise<LiveSchedule | null>;
  deleteLiveSchedule: (id: number) => Promise<void>;
  // Settings Actions
  addBrand: (brand: Omit<DatabaseSchema['brands'][0], 'id' | 'created_at'>) => Promise<DatabaseSchema['brands'][0] | null>;
  updateBrand: (id: number, updates: Partial<DatabaseSchema['brands'][0]>) => Promise<void>;
  addNiche: (niche: Omit<DatabaseSchema['niches'][0], 'id'>) => Promise<void>;
  updateNiche: (id: number, updates: Partial<DatabaseSchema['niches'][0]>) => Promise<void>;

  // Daily Performance Actions
  addDailyPerformance: (record: Omit<DailyPerformance, 'id' | 'created_at'>) => Promise<void>;
  updateDailyPerformance: (id: number, updates: Partial<DailyPerformance>) => Promise<void>;

  // SKU Actions
  addSku: (sku: Omit<DatabaseSchema['skus'][0], 'id'>) => Promise<void>;
  updateSku: (id: number, updates: Partial<DatabaseSchema['skus'][0]>) => Promise<void>;
  deleteSku: (id: number) => Promise<void>;
  
  profiles: any[]; // Add profiles for RBAC tracking

  // Audit Actions
  addAuditLog: (log: Omit<AuditLog, 'id' | 'created_at'>) => Promise<void>;

  // Realtime
  applyRealtimeUpdate: (table: keyof DatabaseState, payload: any) => void;
};

export const useDatabaseStore = create<DatabaseState>((set, get) => ({
  brands: [],
  campaigns: [],
  creators: [],
  creator_snapshots: [],
  creator_contacts: [],
  niches: [],
  creator_niches: [],
  creator_notes: [],
  creator_address_book: [],
  campaign_creators: [],
  videos: [],
  audit_logs: [],
  skus: [],
  vw_campaign_summary: [],
  payout_requests: [],
  payout_creator: [],
  creator_payments: [],
  ads_spends: [],
  creator_addresses: [],
  live_schedules: [],
  daily_performance: [],
  sales: [],
  ads_performance: [],
  ad_name_mapping: [],
  profiles: [],
  live_sessions: [],
  live_session_products: [],
  organic_videos: [],
  isLoading: false,
  error: null,

  applyRealtimeUpdate: (table, payload) => {
    set((state) => {
      const currentData = state[table] as any[];
      if (!Array.isArray(currentData)) return state;

      if (payload.eventType === 'INSERT') {
        // Only add if it doesn't exist
        if (!currentData.some(item => item.id === payload.new.id)) {
          return { [table]: [payload.new, ...currentData] } as any;
        }
      } else if (payload.eventType === 'UPDATE') {
        return {
          [table]: currentData.map(item => item.id === payload.new.id ? { ...item, ...payload.new } : item)
        } as any;
      } else if (payload.eventType === 'DELETE') {
        return {
          [table]: currentData.filter(item => item.id !== payload.old.id)
        } as any;
      }
      
      return state;
    });
  },

  fetchData: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await getInitialStoreData();
      set({
        brands: (data.brands as any[]) || [],
        campaigns: (data.campaigns as any[]) || [],
        creators: [],
        creator_snapshots: [],
        creator_contacts: [],
        niches: (data.niches as any[]) || [],
        creator_niches: [],
        creator_notes: [],
        campaign_creators: [],
        videos: [],
        audit_logs: [],
        skus: (data.skus as any[]) || [],
        vw_campaign_summary: (data.vw_campaign_summary as any[]) || [],
        profiles: (data.profiles as any[]) || [],
        daily_performance: [],
        payout_requests: [],
        payout_creator: [],
        creator_payments: [],
        ads_spends: [],
        creator_addresses: [],
        live_schedules: [],
        sales: [],
        ads_performance: [],
        ad_name_mapping: (data.ad_name_mapping as any[]) || [],
        isLoading: false,
      });
    } catch (err: any) {
      console.error("fetchData Error:", err);
      set({ error: err.message, isLoading: false });
    }
  },

  addAuditLog: async (log) => {
    try {
      let finalUserId = log.user_id;
      let finalUserName = log.user_name;

      if (!finalUserId || !finalUserName) {
        const profile = get().profiles.find(p => p.email === log.user_name);
        if (profile) {
          finalUserId = finalUserId || profile.id;
          finalUserName = finalUserName || profile.nama || profile.email;
        }
      }

      const res = await addAuditLogAction({
        ...log,
        user_id: finalUserId,
        user_name: finalUserName
      });

      if (res.success && res.data) {
        set(state => ({
          audit_logs: [res.data, ...state.audit_logs].slice(0, 500) // Keep latest 500 in memory
        }));
      }
    } catch (err) {
      console.error("Error adding audit log", err);
    }
  },

  addCreatorFull: async (creator, snapshot, contact, nicheIds) => {
    try {
      const res = await addCreatorFullAction(creator, snapshot, contact, nicheIds);
      if (!res.success) throw new Error(res.error);

      if (res.creator) set({ creators: [...get().creators, res.creator] });
      if (res.snapshot) set({ creator_snapshots: [...get().creator_snapshots, res.snapshot] });
      if (res.contact) set({ creator_contacts: [...get().creator_contacts, res.contact] });
      if (res.niches && res.niches.length > 0) set({ creator_niches: [...get().creator_niches, ...res.niches] });
    } catch (err) {
      console.error('Error adding creator full:', err);
      throw err;
    }
  },

  updateCreator: async (id, updates) => {
    // Ambil data lama untuk audit
    const oldData = get().creators.find(c => c.id === id);
    const res = await updateCreatorAction(id, updates);
    if (res.success && res.data) {
      set(state => ({
        creators: state.creators.map(c => c.id === id ? { ...c, ...res.data } : c)
      }));
      // Record Audit
      if (oldData) {
        get().addAuditLog({
          user_id: null,
          user_name: null,
          action: 'UPDATE',
          table_name: 'creators',
          record_id: id.toString(),
          old_data: oldData,
          new_data: res.data,
          description: `Update Profil Kreator: ${res.data.username}`
        });
      }
    }
  },

  addCreatorSnapshot: async (snapshot) => {
    // Check if there's an existing snapshot for the same creator on the same date
    // This handles edits from the listing page where we anchor to cc.created_at
    const snapshotDate = snapshot.tanggal_update ? new Date(snapshot.tanggal_update).toISOString().split('T')[0] : null;
    
    const sameDateSnapshot = snapshotDate ? get().creator_snapshots
      .filter(s => s.creator_id === snapshot.creator_id)
      .find(s => {
        const sDate = s.tanggal_update ? new Date(s.tanggal_update).toISOString().split('T')[0] : null;
        return sDate === snapshotDate;
      }) : null;

    // Client-side deduplication against latest snapshot (only for inserts)
    if (!sameDateSnapshot) {
      const latestExisting = get().creator_snapshots
        .filter(s => s.creator_id === snapshot.creator_id)
        .sort((a, b) => {
          const tDiff = new Date(b.tanggal_update || 0).getTime() - new Date(a.tanggal_update || 0).getTime();
          if (tDiff !== 0) return tDiff;
          return b.id - a.id;
        })[0];
      
      if (latestExisting) {
        if (latestExisting.audience_age === snapshot.audience_age && 
            latestExisting.level === snapshot.level && 
            latestExisting.gmv_30d === snapshot.gmv_30d &&
            latestExisting.gmv_30d_video === snapshot.gmv_30d_video &&
            latestExisting.gmv_30d_live === snapshot.gmv_30d_live &&
            latestExisting.followers === snapshot.followers &&
            latestExisting.tier === snapshot.tier) {
          console.log("Snapshot identical to latest, skipping insert.");
          return;
        }
      }
    }

    const res = await addCreatorSnapshotAction(snapshot);
    if (!res.success) throw new Error(res.error);
    
    if (res.data) {
      if (res.mode === 'updated') {
        set({ creator_snapshots: get().creator_snapshots.map(s => s.id === res.data.id ? res.data : s) });
      } else {
        set({ creator_snapshots: [...get().creator_snapshots, res.data] });
      }
    }
  },

  updateCreatorContact: async (creatorId, newNomor) => {
    try {
      const res = await updateCreatorContactAction(creatorId, newNomor);
      if (!res.success) throw new Error(res.error);
      
      // Update local state with all contacts for this creator
      if (res.allContacts) {
        set(state => ({
          creator_contacts: [
            ...state.creator_contacts.filter(c => c.creator_id !== creatorId),
            ...res.allContacts
          ]
        }));
      }
    } catch (err) {
      console.error("Error updating contact:", err);
    }
  },

  updateCreatorNiches: async (creatorId, nicheIds) => {
    try {
      const res = await updateCreatorNichesAction(creatorId, nicheIds);
      if (!res.success) throw new Error(res.error);
      
      set(state => ({
        creator_niches: [...state.creator_niches.filter(cn => cn.creator_id !== creatorId), ...(res.data || [])]
      }));
    } catch (err) {
      console.error(err);
    }
  },

  addCreatorNote: async (note) => {
    const res = await addCreatorNoteAction(note);
    if (res.success && res.data) {
      set({ creator_notes: [...get().creator_notes, res.data] });
    }
  },

  addCampaign: async (campaign) => {
    try {
      const res = await createCampaignAction(campaign);
      if (!res.success) throw new Error(res.error);
      if (res.data) {
        set({ campaigns: [...get().campaigns, res.data as any] });
        return res.data as any;
      }
      return null;
    } catch (err) {
      console.error('Error adding campaign:', err);
      throw err;
    }
  },

  updateCampaign: async (id, updates) => {
    const res = await updateCampaignAction(id, updates);
    if (res.success) {
      set((state) => ({
        campaigns: state.campaigns.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      }));
    }
  },

  deleteCampaign: async (id) => {
    const res = await deleteCampaignAction(id);
    if (res.success) {
      set((state) => ({
        campaigns: state.campaigns.filter((c) => c.id !== id),
        vw_campaign_summary: state.vw_campaign_summary.filter((c) => c.campaign_id !== id),
      }));
    } else {
      throw new Error(res.error);
    }
  },

  addCampaignCreator: async (cc) => {
    const res = await addCampaignCreatorAction(cc);
    if (res.success && res.data) {
      set({ campaign_creators: [...get().campaign_creators, res.data] });
      // Catat siapa yang menarik kreator ke campaign.
      get().addAuditLog({
        user_id: null,
        user_name: null,
        action: 'CREATE',
        table_name: 'campaign_creators',
        record_id: String(res.data.id),
        old_data: null,
        new_data: res.data,
        description: `Tambah kreator ke campaign #${cc.campaign_id}`
      });
    } else {
      console.error('Add Campaign Creator Error:', res.error);
    }
    // Kembalikan hasilnya ke pemanggil. Sebelumnya di sini hasil diabaikan,
    // sehingga UI tetap menampilkan "Berhasil" walau INSERT gagal.
    return res;
  },

  updateCampaignCreator: async (id, updates, changedBy) => {
    // Ambil data lama untuk audit
    const oldData = get().campaign_creators.find(c => c.id === id);
    const res = await updateCampaignCreatorAction(id, updates);
    if (res.success) {
      set((state) => ({
        campaign_creators: state.campaign_creators.map(c => c.id === id ? { ...c, ...updates } : c)
      }));
      // Record Audit
      if (oldData) {
        let desc = 'Update Campaign Creator';
        if (updates.approval && updates.approval !== oldData.approval) {
          desc = `Ubah status Approval menjadi ${updates.approval}`;
        } else if (updates.price !== undefined && updates.price !== oldData.price) {
          desc = `Ubah Rate Card menjadi ${updates.price}`;
        }
        
        get().addAuditLog({
          user_id: null,
          user_name: changedBy || null,
          action: 'UPDATE',
          table_name: 'campaign_creators',
          record_id: id.toString(),
          old_data: oldData,
          new_data: { ...oldData, ...updates },
          description: desc
        });
      }
    } else {
      console.error("Update Campaign Creator Error:", res.error);
      alert("Gagal update data: " + res.error);
    }
  },

  deleteCampaignCreator: async (id) => {
    const res = await deleteCampaignCreatorAction(id);
    if (res.success) {
      set((state) => ({
        campaign_creators: state.campaign_creators.filter(c => c.id !== id)
      }));
    }
  },

  addVideo: async (video) => {
    const res = await addVideoAction(video);
    if (res.success && res.data) {
      set({ videos: [...get().videos, res.data] });
    }
  },

  updateVideoApproval: async (id, approval, changedBy) => {
    const res = await updateVideoApprovalAction(id, approval as string);
    if (res.success) {
      set((state) => ({
        videos: state.videos.map(v => v.id === id ? { ...v, vt_approval: approval } : v)
      }));
    }
  },

  updateCreatorPayment: async (id, payment) => {
    try {
      const res = await updateCreatorPaymentAction(id, payment);
      if (!res.success) throw new Error(res.error);
      
      if (res.data) {
        if (id) {
          set((state) => ({
            creator_payments: state.creator_payments.map(p => p.id === id ? { ...p, ...res.data } : p)
          }));
        } else {
          set({ creator_payments: [...get().creator_payments, res.data] });
        }

        // Sync status_bayar to campaign_creators in local state
        if (payment.status_bayar && res.data.campaign_creator_id) {
          let syncStatus = 'belum';
          if (payment.status_bayar === 'pay_off') syncStatus = 'lunas';
          else if (payment.status_bayar === 'half_paid') syncStatus = 'sebagian';
          set((state) => ({
            campaign_creators: state.campaign_creators.map(c => c.id === res.data.campaign_creator_id ? { ...c, status_bayar: syncStatus as any } : c)
          }));
        }
        return res.data;
      }
      return null;
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  addAdsSpend: async (spend) => {
    try {
      const res = await addAdsSpendAction(spend);
      if (res.success && res.data) {
        set({ ads_spends: [...get().ads_spends, res.data] });
        return res.data;
      }
      return null;
    } catch (err) {
      return null;
    }
  },

  fetchCreatorPayments: async (campaignId) => {
    // Currently fetched in fetchData, left as stub
  },
  fetchAdsSpends: async (campaignId) => {
    // Currently fetched in fetchData, left as stub
  },
  updateAdsSpend: async (id, spend) => {
    try {
      const res = await updateAdsSpendAction(id, spend);
      if (res.success && res.data) {
        set((state) => ({
          ads_spends: state.ads_spends.map(s => s.id === id ? { ...s, ...res.data } : s)
        }));
        return res.data;
      }
      return null;
    } catch {
      return null;
    }
  },

  fetchCreatorAddresses: async (campaignId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetchCreatorAddressesAction(campaignId);
      set({ creator_addresses: res.data || [], isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  updateCreatorAddress: async (id, address) => {
    try {
      const res = await updateCreatorAddressAction(id, address);
      if (!res.success) throw new Error(res.error);
      
      if (res.data) {
        if (id) {
          set(state => ({
            creator_addresses: state.creator_addresses.map(a => a.id === id ? res.data : a)
          }));
        } else {
          set(state => ({
            creator_addresses: [...state.creator_addresses, res.data]
          }));
        }
        return res.data;
      }
      return null;
    } catch (err: any) {
      console.error(err);
      return null;
    }
  },

  fetchLiveSchedules: async (campaignId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetchLiveSchedulesAction(campaignId);
      set({ live_schedules: res.data || [], isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  addLiveSchedule: async (schedule) => {
    try {
      const res = await addLiveScheduleAction(schedule);
      if (!res.success) throw new Error(res.error);
      if (res.data) {
        set(state => ({
          live_schedules: [...state.live_schedules, res.data].sort((a, b) => new Date(a.tanggal_live).getTime() - new Date(b.tanggal_live).getTime())
        }));
        return res.data;
      }
      return null;
    } catch (err: any) {
      console.error(err);
      return null;
    }
  },

  deleteLiveSchedule: async (id) => {
    try {
      const res = await deleteLiveScheduleAction(id);
      if (!res.success) throw new Error(res.error);
      set(state => ({
        live_schedules: state.live_schedules.filter(l => l.id !== id)
      }));
    } catch (err: any) {
      console.error(err);
    }
  },

  addBrand: async (brand) => {
    const res = await createBrandAction(brand as any);
    if (res.success && res.data) {
      set((state) => ({ brands: [...state.brands, res.data as any] }));
      return res.data as any;
    }
    return null;
  },

  updateBrand: async (id, updates) => {
    const res = await updateBrandAction(id, updates);
    if (res.success) {
      set((state) => ({
        brands: state.brands.map((b) => (b.id === id ? { ...b, ...updates } : b)),
      }));
    }
  },

  addNiche: async (niche) => {
    const res = await addNicheAction(niche);
    if (res.success && res.data) {
      set((state) => ({ niches: [...state.niches, res.data] }));
    }
  },

  updateNiche: async (id, updates) => {
    const res = await updateNicheAction(id, updates);
    if (res.success) {
      set((state) => ({
        niches: state.niches.map((n) => (n.id === id ? { ...n, ...updates } : n)),
      }));
    }
  },

  addDailyPerformance: async (record) => {
    const res = await addDailyPerformanceAction(record);
    if (res.success && res.data) {
      set((state) => ({ daily_performance: [...state.daily_performance, res.data] }));
    } else if (!res.success) {
      throw new Error(res.error);
    }
  },

  updateDailyPerformance: async (id, updates) => {
    const res = await updateDailyPerformanceAction(id, updates);
    if (res.success && res.data) {
      set((state) => ({
        daily_performance: state.daily_performance.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      }));
    } else if (!res.success) {
      throw new Error(res.error);
    }
  },

  addSku: async (sku) => {
    const res = await createSkuAction(sku as any);
    if (!res.success) throw new Error(res.error);
    if (res.data) {
      set((state) => ({ skus: [...state.skus, res.data as any] }));
    }
  },

  updateSku: async (id, updates) => {
    const res = await updateSkuAction(id, updates);
    if (!res.success) throw new Error(res.error);
    if (res.data) {
      set((state) => ({
        skus: state.skus.map((s) => (s.id === id ? res.data : s)),
      }));
    }
  },

  deleteSku: async (id) => {
    const res = await deleteSkuAction(id);
    if (!res.success) throw new Error(res.error);
    set((state) => ({
      skus: state.skus.filter((s) => s.id !== id),
    }));
  },
}));
