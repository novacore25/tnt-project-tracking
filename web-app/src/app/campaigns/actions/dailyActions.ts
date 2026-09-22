'use server';

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { fetchDailyPerformancePageDataAction } from '@/app/actions/campaignPageActions';

export async function getDailyData(campaignId: number) {
  try {
    const res = await fetchDailyPerformancePageDataAction(campaignId);
    if (!res.success || !res.campaign) return null;

    return {
      campaign: res.campaign,
      skus: res.skus,
      campaignCreators: res.campaignCreators,
      videos: res.videos,
      ads: res.ads,
      sales: res.sales,
      organicVideos: res.organicVideos,
    };
  } catch (error: any) {
    console.error('Error in getDailyData:', error);
    return null;
  }
}
