'use server';

import { db } from '@/db';
import { campaigns, skus, campaignCreators, creators, sales } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getCampaignLiveStats } from '@/lib/db-queries';

export async function getLivestreamData(campaignId: number) {
  try {
    const [campaignRes, skusData, rpcLives, ccData] = await Promise.all([
      db
        .select({
          id: campaigns.id,
          nama: campaigns.nama,
          brandId: campaigns.brandId,
          startDate: campaigns.startDate,
          endDate: campaigns.endDate,
        })
        .from(campaigns)
        .where(eq(campaigns.id, campaignId))
        .limit(1),
      db.select({ productId: skus.productId }).from(skus).where(eq(skus.campaignId, campaignId)),
      getCampaignLiveStats(campaignId).catch(() => []),
      db
        .select({
          id: campaignCreators.id,
          approval: campaignCreators.approval,
          creators: {
            username: creators.username,
            nama_asli: creators.namaAsli,
          },
        })
        .from(campaignCreators)
        .innerJoin(creators, eq(campaignCreators.creatorId, creators.id))
        .where(eq(campaignCreators.campaignId, campaignId)),
    ]);

    const campaign = campaignRes[0];
    if (!campaign) return null;

    const skuSet = new Set(skusData.map((s) => s.productId).filter(Boolean));
    const hasSkus = skuSet.size > 0;

    if (!hasSkus) {
      return {
        campaign,
        creators: ccData || [],
        salesData: [],
        liveMetrics: [],
        liveStats: [],
      };
    }

    // Fetch live sales
    const salesData = await db
      .select({
        creator_username: sales.creatorUsername,
        content_uid: sales.contentUid,
        quantity: sales.quantity,
        gmv: sales.grossSale,
        tanggal: sql<string>`TO_CHAR(${sales.orderTime}, 'YYYY-MM-DD')`,
        product_id: sales.productId,
      })
      .from(sales)
      .where(
        sql`${sales.campaignId} = ${campaignId} AND (${sales.creatorType} ILIKE '%live%' OR ${sales.creatorType} ILIKE '%livestream%')`
      );

    return {
      campaign,
      creators: ccData || [],
      salesData: salesData || [],
      liveMetrics: [],
      liveStats: Array.isArray(rpcLives) ? rpcLives : [],
    };
  } catch (error: any) {
    console.error('Error in getLivestreamData:', error);
    return null;
  }
}
