'use server';

import { db } from '@/db';
import { auth } from '@/auth';
import {
  brands,
  campaigns,
  niches,
  skus,
  profiles,
  adNameMapping,
  auditLogs,
  creatorNiches,
  creatorNotes,
} from '@/db/schema';
import { eq, desc, asc, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getAuthProfileAction() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { profile: null, userCampaigns: [] };
    }

    const email = session.user.email.toLowerCase();
    const [profile] = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
    if (!profile) return { profile: null, userCampaigns: [] };

    const userCampaignsRes = await db.execute(sql`
      SELECT campaign_id, all_campaigns FROM user_campaigns WHERE user_id = ${profile.id}
    `).catch(() => []);

    return {
      profile: {
        id: profile.id,
        nama: profile.fullName || session.user.name || '',
        email: profile.email,
        avatar_url: profile.avatarUrl || session.user.image || null,
        role: profile.role || 'staff',
        status: 'active'
      },
      userCampaigns: (userCampaignsRes as any[]) || []
    };
  } catch (err) {
    console.error('Error getting auth profile:', err);
    return { profile: null, userCampaigns: [] };
  }
}

/**
 * Mengambil data awal untuk dashboard & aplikasi via direct PostgreSQL pool
 */
export async function getInitialStoreData() {
  try {
    const [
      allBrands,
      allCampaigns,
      allNiches,
      allSkus,
      allProfiles,
      allAdNameMapping,
      campaignSummaryRes,
    ] = await Promise.all([
      db.select().from(brands).orderBy(asc(brands.id)),
      db.select().from(campaigns).orderBy(desc(campaigns.id)),
      db.select().from(niches).orderBy(asc(niches.id)),
      db.select().from(skus).orderBy(desc(skus.id)),
      db.select().from(profiles),
      db.select().from(adNameMapping),
      db.execute(sql`SELECT * FROM public.vw_campaign_summary`).catch(() => []),
    ]);

    return {
      brands: allBrands || [],
      campaigns: allCampaigns || [],
      niches: allNiches || [],
      skus: allSkus || [],
      profiles: allProfiles || [],
      ad_name_mapping: allAdNameMapping || [],
      vw_campaign_summary: (campaignSummaryRes as any[]) || [],
    };
  } catch (error: any) {
    console.error('Error in getInitialStoreData:', error);
    return {
      brands: [],
      campaigns: [],
      niches: [],
      skus: [],
      profiles: [],
      ad_name_mapping: [],
      vw_campaign_summary: [],
      error: error.message,
    };
  }
}

/**
 * Tambah Campaign Baru
 */
export async function createCampaignAction(data: any) {
  try {
    const [newCampaign] = await db
      .insert(campaigns)
      .values({
        brandId: data.brand_id,
        nama: data.nama,
        tipeCampaign: data.tipe_campaign,
        persiapan14hari: data.persiapan_14hari || null,
        startDate: data.start_date,
        endDate: data.end_date,
        targetGmv: data.target_gmv ? Number(data.target_gmv) : null,
        targetVideo: data.target_video ? Number(data.target_video) : null,
        targetCreator: data.target_creator ? Number(data.target_creator) : null,
        targetViews: data.target_views ? Number(data.target_views) : null,
        budgetCrewPlafon: Number(data.budget_creator_plafon || 0),
        budgetAdsPlafon: Number(data.budget_ads_plafon || 0),
        vsaGmvMax: data.vsa_gmv_max ? Number(data.vsa_gmv_max) : null,
        pic: data.pic || null,
        assist: data.assist || null,
        fileConceptUrl: data.file_concept_url || null,
        status: data.status || 'aktif',
      })
      .returning();

    revalidatePath('/');
    revalidatePath('/campaigns');
    return { success: true, data: newCampaign };
  } catch (error: any) {
    console.error('Error creating campaign:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update Campaign
 */
export async function updateCampaignAction(id: number, data: any) {
  try {
    const updateValues: any = {};
    if (data.nama !== undefined) updateValues.nama = data.nama;
    if (data.brand_id !== undefined) updateValues.brandId = data.brand_id;
    if (data.tipe_campaign !== undefined) updateValues.tipeCampaign = data.tipe_campaign;
    if (data.start_date !== undefined) updateValues.startDate = data.start_date;
    if (data.end_date !== undefined) updateValues.endDate = data.end_date;
    if (data.target_gmv !== undefined) updateValues.targetGmv = Number(data.target_gmv);
    if (data.target_video !== undefined) updateValues.targetVideo = Number(data.target_video);
    if (data.target_creator !== undefined) updateValues.targetCreator = Number(data.target_creator);
    if (data.budget_creator_plafon !== undefined)
      updateValues.budgetCrewPlafon = Number(data.budget_creator_plafon);
    if (data.budget_ads_plafon !== undefined)
      updateValues.budgetAdsPlafon = Number(data.budget_ads_plafon);
    if (data.status !== undefined) updateValues.status = data.status;
    if (data.pic !== undefined) updateValues.pic = data.pic;
    if (data.assist !== undefined) updateValues.assist = data.assist;

    await db.update(campaigns).set(updateValues).where(eq(campaigns.id, id));

    revalidatePath('/');
    revalidatePath('/campaigns');
    revalidatePath(`/campaigns/${id}`);
    return { success: true };
  } catch (error: any) {
    console.error('Error updating campaign:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete Campaign
 */
export async function deleteCampaignAction(id: number) {
  try {
    await db.delete(campaigns).where(eq(campaigns.id, id));
    revalidatePath('/');
    revalidatePath('/campaigns');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting campaign:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Brand Actions
 */
export async function createBrandAction(data: { nama: string; status?: string }) {
  try {
    const [newBrand] = await db
      .insert(brands)
      .values({
        nama: data.nama,
        status: data.status || 'aktif',
      })
      .returning();

    revalidatePath('/');
    return { success: true, data: newBrand };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * SKU Actions
 */
export async function createSkuAction(data: {
  campaign_id: number;
  nama_produk: string;
  product_id?: string;
  komisi?: string | number;
  link?: string;
}) {
  try {
    const [newSku] = await db
      .insert(skus)
      .values({
        campaignId: data.campaign_id,
        namaProduk: data.nama_produk,
        productId: data.product_id || null,
        komisi: data.komisi ? String(data.komisi) : null,
        link: data.link || null,
      })
      .returning();

    revalidatePath(`/campaigns/${data.campaign_id}/sku`);
    return { success: true, data: newSku };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteSkuAction(id: number, campaignId?: number) {
  try {
    await db.delete(skus).where(eq(skus.id, id));
    if (campaignId) revalidatePath(`/campaigns/${campaignId}/sku`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
