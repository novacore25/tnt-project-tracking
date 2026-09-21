'use server';

import { db } from '@/db';
import { campaigns, skus } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCampaignDailyStats } from '@/lib/db-queries';

export async function getDailyData(campaignId: number) {
  try {
    const [campaignRes, skusList, dailyStats] = await Promise.all([
      db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1),
      db.select().from(skus).where(eq(skus.campaignId, campaignId)),
      getCampaignDailyStats(campaignId),
    ]);

    const campaign = campaignRes[0];
    if (!campaign) return null;

    return {
      campaign,
      skus: skusList,
      daily: Array.isArray(dailyStats) ? dailyStats : [],
    };
  } catch (error: any) {
    console.error('Error in getDailyData:', error);
    return null;
  }
}
