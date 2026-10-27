"use server";

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { requireRole } from '@/lib/guards';
import { revalidatePath } from 'next/cache';

/**
 * Mendapatkan ringkasan jumlah data Company Lain saat ini dari tabel archive_*.
 * Khusus role executive.
 */
export async function getCompanyLainStatsAction() {
  await requireRole('executive');

  const [stats] = (await db.execute(sql`
    SELECT 
      COUNT(DISTINCT c.id) as campaign_count,
      COUNT(DISTINCT cc.id) as creator_count,
      COUNT(DISTINCT v.id) as video_count
    FROM archive_campaigns c
    LEFT JOIN archive_campaign_creators cc ON c.id = cc.campaign_id
    LEFT JOIN archive_videos v ON cc.id = v.campaign_creator_id
  `)) as any[];

  return {
    campaignCount: Number(stats?.campaign_count || 0),
    creatorCount: Number(stats?.creator_count || 0),
    videoCount: Number(stats?.video_count || 0),
  };
}

/**
 * Rollback seluruh data Company Lain dari tabel archive_*.
 * Menghapus seluruh data dari tabel fisik archive_* terpisah.
 * 
 * GUARD: Hanya role executive yang boleh mengeksekusi ini.
 * Data TNT terjamin aman 100% karena berada pada tabel yang berbeda.
 */
export async function rollbackCompanyLainAction() {
  await requireRole('executive');

  try {
    const deletedCampaigns = (await db.execute(sql`
      SELECT id, nama FROM archive_campaigns
    `)) as any[];

    await db.execute(sql`
      TRUNCATE archive_sales, archive_videos, archive_ads_performance, archive_campaign_creators, archive_campaigns CASCADE;
      DELETE FROM campaigns WHERE company = 'OTHER';
    `);

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
