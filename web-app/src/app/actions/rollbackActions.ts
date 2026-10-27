"use server";

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { requireRole } from '@/lib/guards';
import { revalidatePath } from 'next/cache';

/**
 * Mendapatkan ringkasan jumlah data Company Lain (company = 'OTHER') saat ini.
 * Khusus role executive.
 */
export async function getCompanyLainStatsAction() {
  await requireRole('executive');

  const [stats] = (await db.execute(sql`
    SELECT 
      COUNT(DISTINCT c.id) as campaign_count,
      COUNT(DISTINCT cc.id) as creator_count,
      COUNT(DISTINCT v.id) as video_count
    FROM campaigns c
    LEFT JOIN campaign_creators cc ON c.id = cc.campaign_id
    LEFT JOIN videos v ON cc.id = v.campaign_creator_id
    WHERE c.company = 'OTHER'
  `)) as any[];

  return {
    campaignCount: Number(stats?.campaign_count || 0),
    creatorCount: Number(stats?.creator_count || 0),
    videoCount: Number(stats?.video_count || 0),
  };
}

/**
 * Rollback seluruh data Company Lain (company = 'OTHER').
 * Menghapus campaign dan secara CASCADE membersihkan:
 * - campaign_creators
 * - videos
 * - sales
 * - ads_performance
 * - daily_performance
 * 
 * GUARD: Hanya role executive yang boleh mengeksekusi ini.
 * Data TNT (company = 'TNT') terjamin aman 100%.
 */
export async function rollbackCompanyLainAction() {
  await requireRole('executive');

  try {
    const deletedCampaigns = (await db.execute(sql`
      DELETE FROM campaigns 
      WHERE company = 'OTHER'
      RETURNING id, nama
    `)) as any[];

    revalidatePath('/campaigns');
    revalidatePath('/ads-report');

    return {
      success: true,
      deletedCount: deletedCampaigns.length,
      deletedCampaigns: deletedCampaigns.map((c: any) => ({ id: c.id, nama: c.nama })),
    };
  } catch (error: any) {
    console.error('Error during rollbackCompanyLainAction:', error);
    return {
      success: false,
      error: error.message || 'Gagal melakukan rollback data.',
    };
  }
}
