'use server';

import { db } from '@/db';
import {
  campaignCreators,
  creators,
  creatorSnapshots,
  creatorContacts,
  videos,
  campaignConcepts,
} from '@/db/schema';
import { eq, desc, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

/**
 * Mengambil seluruh data creator dalam satu campaign beserta snapshot, video, dan detailnya
 */
export async function getCampaignListingData(campaignId: number) {
  try {
    // 1. Ambil campaign creators + creator data
    const ccList = await db
      .select({
        id: campaignCreators.id,
        campaign_id: campaignCreators.campaignId,
        creator_id: campaignCreators.creatorId,
        tier: campaignCreators.tier,
        price: campaignCreators.price,
        qty_vt: campaignCreators.qtyVt,
        approval: campaignCreators.approval,
        pic_assist: campaignCreators.picAssist,
        notes_manager: campaignCreators.notesManager,
        notes_pic: campaignCreators.notesPic,
        notes_client: campaignCreators.notesClient,
        sample_progress: campaignCreators.sampleProgress,
        gmv_organic_legacy: campaignCreators.gmvOrganicLegacy,
        gmv_ads_legacy: campaignCreators.gmvAdsLegacy,
        rate_card: campaignCreators.rateCard,
        status_bayar: campaignCreators.statusBayar,
        pelunasan: campaignCreators.pelunasan,
        tgl_bayar: campaignCreators.tglBayar,
        slot_allocated: campaignCreators.slotAllocated,
        created_at: campaignCreators.createdAt,
        creator: {
          id: creators.id,
          username: creators.username,
          nama_asli: creators.namaAsli,
          link_account: creators.linkAccount,
          rekening: creators.rekening,
          bank_account_name: creators.bankAccountName,
          bank_account_number: creators.bankAccountNumber,
          bank_name: creators.bankName,
        },
      })
      .from(campaignCreators)
      .innerJoin(creators, eq(campaignCreators.creatorId, creators.id))
      .where(eq(campaignCreators.campaignId, campaignId))
      .orderBy(desc(campaignCreators.id));

    const creatorIds = ccList.map((cc) => cc.creator_id);
    const ccIds = ccList.map((cc) => cc.id);

    // 2. Ambil snapshots & videos secara paralel
    const [snapshotsList, videosList] = await Promise.all([
      creatorIds.length > 0
        ? db
            .select()
            .from(creatorSnapshots)
            .where(inArray(creatorSnapshots.creatorId, creatorIds))
            .orderBy(desc(creatorSnapshots.tanggalUpdate))
        : [],
      ccIds.length > 0
        ? db
            .select()
            .from(videos)
            .where(inArray(videos.campaignCreatorId, ccIds))
            .orderBy(videos.urutan)
        : [],
    ]);

    // Grouping
    const snapshotMap = new Map<number, any[]>();
    snapshotsList.forEach((s) => {
      if (!snapshotMap.has(s.creatorId)) snapshotMap.set(s.creatorId, []);
      snapshotMap.get(s.creatorId)!.push(s);
    });

    const videoMap = new Map<number, any[]>();
    videosList.forEach((v) => {
      if (!videoMap.has(v.campaignCreatorId)) videoMap.set(v.campaignCreatorId, []);
      videoMap.get(v.campaignCreatorId)!.push(v);
    });

    const result = ccList.map((cc) => ({
      ...cc,
      creators: {
        ...cc.creator,
        creator_snapshots: snapshotMap.get(cc.creator_id) || [],
      },
      videos: videoMap.get(cc.id) || [],
    }));

    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error in getCampaignListingData:', error);
    return { success: false, data: [], error: error.message };
  }
}

/**
 * Batch update Campaign Creators (Approval, Price, Qty VT, Notes, etc.)
 */
export async function batchUpdateCampaignCreatorsAction(
  updates: Array<{
    id: number;
    price?: number;
    qty_vt?: number;
    approval?: string;
    pic_assist?: string;
    notes_manager?: string;
    notes_pic?: string;
    sample_progress?: string;
    rate_card?: number;
  }>,
  campaignId?: number
) {
  try {
    await db.transaction(async (tx) => {
      for (const item of updates) {
        const setValues: any = {};
        if (item.price !== undefined) setValues.price = Number(item.price);
        if (item.qty_vt !== undefined) setValues.qtyVt = Number(item.qty_vt);
        if (item.approval !== undefined) setValues.approval = item.approval;
        if (item.pic_assist !== undefined) setValues.picAssist = item.pic_assist;
        if (item.notes_manager !== undefined) setValues.notesManager = item.notes_manager;
        if (item.notes_pic !== undefined) setValues.notesPic = item.notes_pic;
        if (item.sample_progress !== undefined) setValues.sampleProgress = item.sample_progress;
        if (item.rate_card !== undefined) setValues.rateCard = Number(item.rate_card);

        if (Object.keys(setValues).length > 0) {
          await tx
            .update(campaignCreators)
            .set(setValues)
            .where(eq(campaignCreators.id, item.id));
        }
      }
    });

    if (campaignId) revalidatePath(`/campaigns/${campaignId}/listing`);
    return { success: true };
  } catch (error: any) {
    console.error('Error in batchUpdateCampaignCreatorsAction:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Tambah Creator ke Campaign
 */
export async function addCreatorToCampaignAction(
  campaignId: number,
  creatorId: number,
  data: {
    price?: number;
    qty_vt?: number;
    tier?: string;
    approval?: string;
    pic_assist?: string;
  }
) {
  try {
    const [inserted] = await db
      .insert(campaignCreators)
      .values({
        campaignId,
        creatorId,
        price: Number(data.price || 0),
        qtyVt: Number(data.qty_vt || 1),
        tier: data.tier || null,
        approval: data.approval || 'pending',
        picAssist: data.pic_assist || null,
      })
      .returning();

    revalidatePath(`/campaigns/${campaignId}/listing`);
    return { success: true, data: inserted };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Hapus Creator dari Campaign
 */
export async function removeCreatorFromCampaignAction(
  campaignCreatorId: number,
  campaignId?: number
) {
  try {
    await db.delete(campaignCreators).where(eq(campaignCreators.id, campaignCreatorId));
    if (campaignId) revalidatePath(`/campaigns/${campaignId}/listing`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
