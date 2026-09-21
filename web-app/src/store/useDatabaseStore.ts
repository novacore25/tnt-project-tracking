import { create } from 'zustand';
import { createClient } from '@/utils/supabase/client';
import { getInitialStoreData, createCampaignAction, updateCampaignAction, deleteCampaignAction, createBrandAction, createSkuAction, deleteSkuAction } from '@/app/actions/storeActions';
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
  addCampaignCreator: (cc: Omit<CampaignCreator, 'id' | 'created_at'>) => Promise<void>;
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

const supabase = createClient();

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
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          finalUserId = session.user.id;
          if (!finalUserName) {
            const profile = get().profiles.find(p => p.id === session.user.id);
            finalUserName = profile?.nama || session.user.email;
          }
        }
      }

      const { data, error } = await supabase.from('audit_logs').insert({
        ...log,
        user_id: finalUserId,
        user_name: finalUserName
      }).select().single();
      
      if (!error && data) {
        set(state => ({
          audit_logs: [data, ...state.audit_logs].slice(0, 500) // Keep latest 500 in memory
        }));
      }
    } catch (err) {
      console.error("Error adding audit log", err);
    }
  },

  addCreatorFull: async (creator, snapshot, contact, nicheIds) => {
    try {
      // Insert Creator
      const { data: cData, error: cErr } = await supabase.from('creators').insert(creator).select().single();
      if (cErr || !cData) throw cErr;
      
      const newCreatorId = cData.id;
      set({ creators: [...get().creators, cData] });

      // Insert Snapshot
      if (snapshot) {
        const { data: sData } = await supabase.from('creator_snapshots').insert({
          ...snapshot,
          creator_id: newCreatorId
        }).select().single();
        if (sData) set({ creator_snapshots: [...get().creator_snapshots, sData] });
      }

      // Insert Contact
      if (contact) {
        const { data: ctData } = await supabase.from('creator_contacts').insert({
          creator_id: newCreatorId,
          nomor: contact,
          status: 'aktif',
          tanggal_mulai: new Date().toISOString().split('T')[0]
        }).select().single();
        if (ctData) set({ creator_contacts: [...get().creator_contacts, ctData] });
      }

      // Insert Niches
      if (nicheIds && nicheIds.length > 0) {
        const nicheRows = nicheIds.map((nId, idx) => ({
          creator_id: newCreatorId,
          niche_id: nId,
          peringkat: idx + 1
        }));
        const { data: nData } = await supabase.from('creator_niches').insert(nicheRows).select();
        if (nData) set({ creator_niches: [...get().creator_niches, ...nData] });
      }
    } catch (err) {
      console.error('Error adding creator full:', err);
      throw err;
    }
  },

  updateCreator: async (id, updates) => {
    // Ambil data lama untuk audit
    const oldData = get().creators.find(c => c.id === id);
    const { data, error } = await supabase.from('creators').update(updates).eq('id', id).select().single();
    if (!error && data) {
      set(state => ({
        creators: state.creators.map(c => c.id === id ? { ...c, ...data } : c)
      }));
      // Record Audit
      if (oldData) {
        get().addAuditLog({
          user_id: null,
          user_name: null, // Will be auto-filled by addAuditLog via session
          action: 'UPDATE',
          table_name: 'creators',
          record_id: id.toString(),
          old_data: oldData,
          new_data: data,
          description: `Update Profil Kreator: ${data.username}`
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

    if (sameDateSnapshot) {
      // UPDATE the existing snapshot row in-place rather than inserting a duplicate
      const updatePayload: any = {};
      if (snapshot.followers !== undefined) updatePayload.followers = snapshot.followers;
      if (snapshot.level !== undefined) updatePayload.level = snapshot.level;
      if (snapshot.gmv_30d !== undefined) updatePayload.gmv_30d = snapshot.gmv_30d;
      if (snapshot.gmv_30d_video !== undefined) updatePayload.gmv_30d_video = snapshot.gmv_30d_video;
      if (snapshot.gmv_30d_live !== undefined) updatePayload.gmv_30d_live = snapshot.gmv_30d_live;
      if (snapshot.tier !== undefined) updatePayload.tier = snapshot.tier;
      if (snapshot.audience_age !== undefined) updatePayload.audience_age = snapshot.audience_age;
      if (snapshot.ratecard !== undefined) updatePayload.ratecard = snapshot.ratecard;
      if (snapshot.updated_by !== undefined) updatePayload.updated_by = snapshot.updated_by;

      // Check if anything actually changed
      const hasChange = Object.keys(updatePayload).some(k => (updatePayload as any)[k] !== (sameDateSnapshot as any)[k]);
      if (!hasChange) {
        console.log("Snapshot identical to existing same-date snapshot, skipping update.");
        return;
      }

      const { data, error } = await supabase.from('creator_snapshots')
        .update(updatePayload)
        .eq('id', sameDateSnapshot.id)
        .select()
        .single();
      
      if (error) throw error;
      if (data) {
        set({ creator_snapshots: get().creator_snapshots.map(s => s.id === sameDateSnapshot.id ? data : s) });
      }
      return;
    }

    // No same-date snapshot found — deduplication check against latest snapshot
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

    const { data, error } = await supabase.from('creator_snapshots').insert(snapshot).select().single();
    if (error) {
      throw error;
    }
    if (data) {
      set({ creator_snapshots: [...get().creator_snapshots, data] });
    }
  },

  updateCreatorContact: async (creatorId, newNomor) => {
    try {
      const activeContacts = get().creator_contacts.filter(c => c.creator_id === creatorId && c.status === 'aktif');
      
      // Check if the new number is already in archive
      const { data: existingArchived } = await supabase.from('creator_contacts')
        .select('*')
        .eq('creator_id', creatorId)
        .eq('nomor', newNomor)
        .single();
      
      const today = new Date().toISOString().split('T')[0];

      // Archive all current active contacts
      for (const ac of activeContacts) {
        await supabase.from('creator_contacts').update({
          status: 'arsip',
          tanggal_diganti: today
        }).eq('id', ac.id);
        
        set(state => ({
          creator_contacts: state.creator_contacts.map(c => c.id === ac.id ? { ...c, status: 'arsip', tanggal_diganti: today } : c)
        }));
      }

      if (existingArchived) {
        // Upsert / Reactivate old number
        const { data: reactivated } = await supabase.from('creator_contacts').update({
          status: 'aktif',
          tanggal_mulai: today,
          tanggal_diganti: null
        }).eq('id', existingArchived.id).select().single();
        
        if (reactivated) {
          set(state => ({
            creator_contacts: state.creator_contacts.map(c => c.id === reactivated.id ? reactivated : c)
          }));
        }
      } else {
        // Insert new active number
        const { data: inserted } = await supabase.from('creator_contacts').insert({
          creator_id: creatorId,
          nomor: newNomor,
          status: 'aktif',
          tanggal_mulai: today
        }).select().single();
        
        if (inserted) {
          set(state => ({
            creator_contacts: [...state.creator_contacts, inserted]
          }));
        }
      }
    } catch (err) {
      console.error("Error updating contact:", err);
    }
  },

  updateCreatorNiches: async (creatorId, nicheIds) => {
    try {
      // Delete old niches
      await supabase.from('creator_niches').delete().eq('creator_id', creatorId);
      
      if (nicheIds.length > 0) {
        const rows = nicheIds.map((nId, idx) => ({
          creator_id: creatorId,
          niche_id: nId,
          peringkat: idx + 1
        }));
        const { data } = await supabase.from('creator_niches').insert(rows).select();
        set(state => ({
          creator_niches: [...state.creator_niches.filter(cn => cn.creator_id !== creatorId), ...(data || [])]
        }));
      } else {
        set(state => ({
          creator_niches: state.creator_niches.filter(cn => cn.creator_id !== creatorId)
        }));
      }
    } catch (err) {
      console.error(err);
    }
  },

  addCreatorNote: async (note) => {
    const { data, error } = await supabase.from('creator_notes').insert(note).select().single();
    if (!error && data) {
      set({ creator_notes: [...get().creator_notes, data] });
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
    const { data, error } = await supabase.from('campaign_creators').insert(cc).select().single();
    if (!error && data) {
      set({ campaign_creators: [...get().campaign_creators, data] });
    }
  },

  updateCampaignCreator: async (id, updates, changedBy) => {
    // Ambil data lama untuk audit
    const oldData = get().campaign_creators.find(c => c.id === id);
    const { error } = await supabase.from('campaign_creators').update(updates).eq('id', id);
    if (error) {
      console.error("Update Campaign Creator Error:", error);
      alert("Gagal update data: " + error.message);
      return;
    }
    if (!error) {
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
    }
  },

  deleteCampaignCreator: async (id) => {
    const { error } = await supabase.from('campaign_creators').delete().eq('id', id);
    if (!error) {
      set((state) => ({
        campaign_creators: state.campaign_creators.filter(c => c.id !== id)
      }));
    }
  },

  addVideo: async (video) => {
    const { data, error } = await supabase.from('videos').insert(video).select().single();
    if (!error && data) {
      set({ videos: [...get().videos, data] });
    }
  },

  updateVideoApproval: async (id, approval, changedBy) => {
    const { error } = await supabase.from('videos').update({ vt_approval: approval }).eq('id', id);
    if (!error) {
      set((state) => ({
        videos: state.videos.map(v => v.id === id ? { ...v, vt_approval: approval } : v)
      }));
    }
  },

  updateCreatorPayment: async (id, payment) => {
    try {
      if (id) {
        const { data, error } = await supabase.from('creator_payments').update(payment).eq('id', id).select().single();
        if (error) throw error;
        set((state) => ({
          creator_payments: state.creator_payments.map(p => p.id === id ? { ...p, ...data } : p)
        }));
        
        // sync status_bayar to campaign_creators backwards compatibility
        if (payment.status_bayar && data.campaign_creator_id) {
          let syncStatus = 'belum';
          if (payment.status_bayar === 'pay_off') syncStatus = 'lunas';
          else if (payment.status_bayar === 'half_paid') syncStatus = 'sebagian';
          await supabase.from('campaign_creators').update({ status_bayar: syncStatus }).eq('id', data.campaign_creator_id);
          set((state) => ({
            campaign_creators: state.campaign_creators.map(c => c.id === data.campaign_creator_id ? { ...c, status_bayar: syncStatus as any } : c)
          }));
        }
        return data;
      } else if (payment.campaign_creator_id) {
        const cc = get().campaign_creators.find(c => c.id === payment.campaign_creator_id);
        const { data, error } = await supabase.from('creator_payments').insert({
          campaign_creator_id: payment.campaign_creator_id,
          rate_card: cc?.price || 0,
          ...payment
        }).select().single();
        
        if (error) throw error;
        set({ creator_payments: [...get().creator_payments, data] });

        if (payment.status_bayar) {
          let syncStatus = 'belum';
          if (payment.status_bayar === 'pay_off') syncStatus = 'lunas';
          else if (payment.status_bayar === 'half_paid') syncStatus = 'sebagian';
          await supabase.from('campaign_creators').update({ status_bayar: syncStatus }).eq('id', payment.campaign_creator_id);
          set((state) => ({
            campaign_creators: state.campaign_creators.map(c => c.id === payment.campaign_creator_id ? { ...c, status_bayar: syncStatus as any } : c)
          }));
        }
        return data;
      }
      return null;
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  addAdsSpend: async (spend) => {
    try {
      const { data, error } = await supabase.from('ads_spends').insert(spend).select().single();
      if (!error && data) {
        set({ ads_spends: [...get().ads_spends, data] });
        return data;
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
      const { data, error } = await supabase.from('ads_spends').update(spend).eq('id', id).select().single();
      if (!error && data) {
        set((state) => ({
          ads_spends: state.ads_spends.map(s => s.id === id ? { ...s, ...data } : s)
        }));
        return data;
      }
      return null;
    } catch {
      return null;
    }
  },

  fetchCreatorAddresses: async (campaignId) => {
    set({ isLoading: true, error: null });
    try {
      const { data: campaignCreators } = await supabase
        .from('campaign_creators')
        .select('id')
        .eq('campaign_id', campaignId);
      
      const ccIds = campaignCreators?.map(cc => cc.id) || [];
      
      if (ccIds.length > 0) {
        const { data, error } = await supabase
          .from('creator_addresses')
          .select('*')
          .in('campaign_creator_id', ccIds);
        
        if (error) throw error;
        set({ creator_addresses: data || [], isLoading: false });
      } else {
        set({ creator_addresses: [], isLoading: false });
      }
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  updateCreatorAddress: async (id, address) => {
    try {
      const payload = { ...address };
      delete (payload as any).campaign_creators;

      if (id) {
        const { data, error } = await supabase
          .from('creator_addresses')
          .update(payload)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        set(state => ({
          creator_addresses: state.creator_addresses.map(a => a.id === id ? data : a)
        }));
        return data;
      } else {
        const { data, error } = await supabase
          .from('creator_addresses')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        set(state => ({
          creator_addresses: [...state.creator_addresses, data]
        }));
        return data;
      }
    } catch (err: any) {
      console.error(err);
      return null;
    }
  },

  fetchLiveSchedules: async (campaignId) => {
    set({ isLoading: true, error: null });
    try {
      const { data: campaignCreators } = await supabase
        .from('campaign_creators')
        .select('id')
        .eq('campaign_id', campaignId);
      
      const ccIds = campaignCreators?.map(cc => cc.id) || [];
      
      if (ccIds.length > 0) {
        const { data, error } = await supabase
          .from('live_schedules')
          .select('*')
          .in('campaign_creator_id', ccIds)
          .order('tanggal_live', { ascending: true });
        
        if (error) throw error;
        set({ live_schedules: data || [], isLoading: false });
      } else {
        set({ live_schedules: [], isLoading: false });
      }
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  addLiveSchedule: async (schedule) => {
    try {
      const { data, error } = await supabase
        .from('live_schedules')
        .insert([schedule])
        .select()
        .single();
      if (error) throw error;
      set(state => ({
        live_schedules: [...state.live_schedules, data].sort((a, b) => new Date(a.tanggal_live).getTime() - new Date(b.tanggal_live).getTime())
      }));
      return data;
    } catch (err: any) {
      console.error(err);
      return null;
    }
  },

  deleteLiveSchedule: async (id) => {
    try {
      const { error } = await supabase.from('live_schedules').delete().eq('id', id);
      if (error) throw error;
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
    const { error } = await supabase.from('brands').update(updates).eq('id', id);
    if (!error) {
      set((state) => ({
        brands: state.brands.map((b) => (b.id === id ? { ...b, ...updates } : b)),
      }));
    }
  },

  addNiche: async (niche) => {
    const { data, error } = await supabase.from('niches').insert(niche).select().single();
    if (!error && data) {
      set((state) => ({ niches: [...state.niches, data] }));
    }
  },

  updateNiche: async (id, updates) => {
    const { error } = await supabase.from('niches').update(updates).eq('id', id);
    if (!error) {
      set((state) => ({
        niches: state.niches.map((n) => (n.id === id ? { ...n, ...updates } : n)),
      }));
    }
  },

  addDailyPerformance: async (record) => {
    const { data, error } = await supabase.from('daily_performance').insert(record).select().single();
    if (!error && data) {
      set((state) => ({ daily_performance: [...state.daily_performance, data] }));
    } else if (error) {
      throw error;
    }
  },

  updateDailyPerformance: async (id, updates) => {
    const { data, error } = await supabase.from('daily_performance').update(updates).eq('id', id).select().single();
    if (!error && data) {
      set((state) => ({
        daily_performance: state.daily_performance.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      }));
    } else if (error) {
      throw error;
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
    const { data, error } = await supabase.from('skus').update(updates).eq('id', id).select().single();
    if (error) throw error;
    if (data) {
      set((state) => ({
        skus: state.skus.map((s) => (s.id === id ? data : s)),
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
