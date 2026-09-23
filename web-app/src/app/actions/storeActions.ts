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
    const rows = (await db.execute(sql`
      SELECT id, nama, email, avatar_url, role, brand_id, status FROM profiles WHERE LOWER(email) = ${email} LIMIT 1
    `).catch(() => [])) as any[];

    let profile = rows[0];

    // Auto-create profile if authenticated session exists but profiles row is missing
    if (!profile) {
      const whitelistRows = (await db.execute(sql`
        SELECT * FROM whitelisted_emails WHERE LOWER(email) = ${email} LIMIT 1
      `).catch(() => [])) as any[];
      const whitelist = whitelistRows[0];

      let role = whitelist?.role;
      if (!role) {
        if (email === 'hibban25nzl@gmail.com' || email.includes('admin') || email.includes('executive')) {
          role = 'executive';
        } else {
          role = 'staff';
        }
      }
      const brandId = whitelist?.brand_id ?? null;
      const isValidUuid = (val?: any): boolean => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
      const newId = isValidUuid((session.user as any).id) ? (session.user as any).id : crypto.randomUUID();
      const fullName = session.user.name || email.split('@')[0];
      const avatarUrl = session.user.image || '';

      await db.execute(sql`
        INSERT INTO profiles (id, email, nama, avatar_url, role, brand_id, status)
        VALUES (${newId}, ${email}, ${fullName}, ${avatarUrl}, ${role}, ${brandId}, 'active')
        ON CONFLICT (email) DO UPDATE SET
          nama = EXCLUDED.nama,
          avatar_url = EXCLUDED.avatar_url,
          role = EXCLUDED.role
      `).catch(() => {});

      const createdRows = (await db.execute(sql`
        SELECT id, nama, email, avatar_url, role, brand_id, status FROM profiles WHERE LOWER(email) = ${email} LIMIT 1
      `).catch(() => [])) as any[];
      profile = createdRows[0];
    }

    const isValidUuid = (val?: any): boolean => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
    const validProfileId = profile?.id ? String(profile.id) : (isValidUuid((session.user as any).id) ? (session.user as any).id : null);

    const userProfile = {
      id: validProfileId,
      nama: profile?.nama || session.user.name || email.split('@')[0],
      email: profile?.email || email,
      avatar_url: profile?.avatar_url || session.user.image || null,
      role: profile?.role || (email === 'hibban25nzl@gmail.com' ? 'executive' : 'staff'),
      status: profile?.status || 'active'
    };

    const targetUserId = validProfileId || (session.user as any).id;
    const userCampaignsRes = (targetUserId && isValidUuid(targetUserId)) ? await db.execute(sql`
      SELECT campaign_id, all_campaigns FROM user_campaigns WHERE user_id = ${String(targetUserId)}::uuid
    `).catch((err) => {
      console.error('Error fetching user_campaigns in getAuthProfileAction:', err);
      return [];
    }) : [];

    return {
      profile: userProfile,
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
      db.execute(sql`SELECT * FROM brands ORDER BY id ASC`).catch(() => []),
      db.execute(sql`SELECT * FROM campaigns ORDER BY id DESC`).catch(() => []),
      db.execute(sql`SELECT * FROM niches ORDER BY id ASC`).catch(() => []),
      db.execute(sql`SELECT * FROM skus ORDER BY id DESC`).catch(() => []),
      db.execute(sql`SELECT id, full_name as nama, email, avatar_url, role, status FROM profiles`).catch(() => []),
      db.execute(sql`SELECT * FROM ad_name_mapping ORDER BY id DESC`).catch(() => []),
      db.execute(sql`SELECT * FROM public.vw_campaign_summary`).catch(() => []),
    ]);

    return {
      brands: (allBrands as any[]) || [],
      campaigns: (allCampaigns as any[]) || [],
      niches: (allNiches as any[]) || [],
      skus: (allSkus as any[]) || [],
      profiles: (allProfiles as any[]) || [],
      ad_name_mapping: (allAdNameMapping as any[]) || [],
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
    const [newCampaign] = await db.execute(sql`
      INSERT INTO campaigns (
        brand_id, nama, tipe_campaign, persiapan_14hari, start_date, end_date,
        target_gmv, target_video, target_creator,
        target_creator_nano, target_creator_micro, target_creator_macro, target_creator_mega,
        target_creator_live, target_creator_live_nano, target_creator_live_micro, target_creator_live_macro, target_creator_live_mega,
        target_views, budget_creator_plafon, budget_ads_plafon,
        vsa_gmv_max, pic, assist, file_concept_url, status, campaign_group, require_client_approval
      ) VALUES (
        ${data.brand_id}, ${data.nama}, ${data.tipe_campaign}, ${data.persiapan_14hari || null}, ${data.start_date}, ${data.end_date},
        ${data.target_gmv ? Number(data.target_gmv) : null}, ${data.target_video ? Number(data.target_video) : null}, ${data.target_creator ? Number(data.target_creator) : null},
        ${data.target_creator_nano ? Number(data.target_creator_nano) : 0}, ${data.target_creator_micro ? Number(data.target_creator_micro) : 0}, ${data.target_creator_macro ? Number(data.target_creator_macro) : 0}, ${data.target_creator_mega ? Number(data.target_creator_mega) : 0},
        ${data.target_creator_live ? Number(data.target_creator_live) : null}, ${data.target_creator_live_nano ? Number(data.target_creator_live_nano) : 0}, ${data.target_creator_live_micro ? Number(data.target_creator_live_micro) : 0}, ${data.target_creator_live_macro ? Number(data.target_creator_live_macro) : 0}, ${data.target_creator_live_mega ? Number(data.target_creator_live_mega) : 0},
        ${data.target_views ? Number(data.target_views) : null}, ${Number(data.budget_creator_plafon || 0)}, ${Number(data.budget_ads_plafon || 0)},
        ${data.vsa_gmv_max ? Number(data.vsa_gmv_max) : null}, ${data.pic || null}, ${data.assist || null}, ${data.file_concept_url || null}, ${data.status || 'aktif'}, ${data.campaign_group || 'Tim Campaign'}, ${data.require_client_approval || false}
      )
      RETURNING *
    `) as any[];

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
    await db.execute(sql`
      UPDATE campaigns SET
        nama = COALESCE(${data.nama !== undefined ? data.nama : null}, nama),
        brand_id = COALESCE(${data.brand_id !== undefined ? data.brand_id : null}, brand_id),
        tipe_campaign = COALESCE(${data.tipe_campaign !== undefined ? data.tipe_campaign : null}, tipe_campaign),
        campaign_group = COALESCE(${data.campaign_group !== undefined ? data.campaign_group : null}, campaign_group),
        start_date = COALESCE(${data.start_date !== undefined ? data.start_date : null}, start_date),
        end_date = COALESCE(${data.end_date !== undefined ? data.end_date : null}, end_date),
        target_gmv = ${data.target_gmv !== undefined ? (data.target_gmv ? Number(data.target_gmv) : null) : sql`target_gmv`},
        target_video = ${data.target_video !== undefined ? (data.target_video ? Number(data.target_video) : null) : sql`target_video`},
        target_creator = ${data.target_creator !== undefined ? (data.target_creator ? Number(data.target_creator) : null) : sql`target_creator`},
        target_creator_nano = ${data.target_creator_nano !== undefined ? Number(data.target_creator_nano) : sql`target_creator_nano`},
        target_creator_micro = ${data.target_creator_micro !== undefined ? Number(data.target_creator_micro) : sql`target_creator_micro`},
        target_creator_macro = ${data.target_creator_macro !== undefined ? Number(data.target_creator_macro) : sql`target_creator_macro`},
        target_creator_mega = ${data.target_creator_mega !== undefined ? Number(data.target_creator_mega) : sql`target_creator_mega`},
        target_creator_live = ${data.target_creator_live !== undefined ? (data.target_creator_live ? Number(data.target_creator_live) : null) : sql`target_creator_live`},
        target_views = ${data.target_views !== undefined ? (data.target_views ? Number(data.target_views) : null) : sql`target_views`},
        budget_creator_plafon = ${data.budget_creator_plafon !== undefined ? Number(data.budget_creator_plafon) : sql`budget_creator_plafon`},
        budget_ads_plafon = ${data.budget_ads_plafon !== undefined ? Number(data.budget_ads_plafon) : sql`budget_ads_plafon`},
        require_client_approval = ${data.require_client_approval !== undefined ? data.require_client_approval : sql`require_client_approval`},
        status = COALESCE(${data.status !== undefined ? data.status : null}, status),
        pic = ${data.pic !== undefined ? data.pic : sql`pic`},
        assist = ${data.assist !== undefined ? data.assist : sql`assist`}
      WHERE id = ${id}
    `);

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
    await db.execute(sql`DELETE FROM campaigns WHERE id = ${id}`);
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
    const [newBrand] = await db.execute(sql`
      INSERT INTO brands (nama, status)
      VALUES (${data.nama}, ${data.status || 'aktif'})
      RETURNING *
    `) as any[];

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
    const [newSku] = await db.execute(sql`
      INSERT INTO skus (campaign_id, nama_produk, product_id, komisi, link)
      VALUES (${data.campaign_id}, ${data.nama_produk}, ${data.product_id || null}, ${data.komisi ? String(data.komisi) : null}, ${data.link || null})
      RETURNING *
    `) as any[];

    revalidatePath(`/campaigns/${data.campaign_id}/sku`);
    return { success: true, data: newSku };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteSkuAction(id: number, campaignId?: number) {
  try {
    await db.execute(sql`DELETE FROM skus WHERE id = ${id}`);
    if (campaignId) revalidatePath(`/campaigns/${campaignId}/sku`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
