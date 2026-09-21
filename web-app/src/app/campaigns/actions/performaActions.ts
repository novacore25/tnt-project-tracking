'use server';

import { db } from '@/db';
import {
  campaigns,
  skus,
  campaignCreators,
  creators,
  videos,
  sales,
  adsPerformance,
  organicVideos,
} from '@/db/schema';
import { eq, inArray, desc, sql } from 'drizzle-orm';
import {
  getCampaignCreatorPerformance,
  getPerformanceSummaryV2,
} from '@/lib/db-queries';

export async function getInternalPerformaData(campaignId: number) {
  try {
    // 1. Fetch metadata, skus, and summary via native RPC & Drizzle
    const [campaignRes, skusRes, creatorPerfRes, perfSummaryRes] = await Promise.all([
      db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1),
      db.select().from(skus).where(eq(skus.campaignId, campaignId)),
      getCampaignCreatorPerformance(campaignId),
      getPerformanceSummaryV2(campaignId),
    ]);

    const campaign = campaignRes[0];
    if (!campaign) return null;

    const rpcSummary = perfSummaryRes || null;
    const skuSet = new Set(skusRes.map((s) => s.productId).filter(Boolean));
    const hasSkus = skuSet.size > 0;

    // 2. Fetch creators, videos, sales, ads concurrently via direct connection pool
    const [allCcs, allVideos, allSales, allAds] = await Promise.all([
      db
        .select({
          id: campaignCreators.id,
          creator_id: campaignCreators.creatorId,
          approval: campaignCreators.approval,
          created_at: campaignCreators.createdAt,
          qty_vt: campaignCreators.qtyVt,
          qty_live: sql<number>`0`,
          creators: {
            id: creators.id,
            username: creators.username,
            nama_asli: creators.namaAsli,
            link_account: creators.linkAccount,
          },
        })
        .from(campaignCreators)
        .innerJoin(creators, eq(campaignCreators.creatorId, creators.id))
        .where(
          sql`${campaignCreators.campaignId} = ${campaignId} AND ${campaignCreators.approval} IN ('approved', 'pending', 'alternate')`
        ),
      db
        .select({
          id: videos.id,
          campaign_creator_id: videos.campaignCreatorId,
          content_uid: videos.contentUid,
          urutan: videos.urutan,
          concept: videos.concept,
          link_video: videos.link,
          views: videos.views,
          likes: videos.likes,
        })
        .from(videos)
        .innerJoin(campaignCreators, eq(videos.campaignCreatorId, campaignCreators.id))
        .where(eq(campaignCreators.campaignId, campaignId)),
      db
        .select({
          tanggal: sql<string>`TO_CHAR(${sales.orderTime}, 'YYYY-MM-DD')`,
          gmv: sales.grossSale,
          quantity: sales.quantity,
          creator_username: sales.creatorUsername,
          content_uid: sales.contentUid,
          content_type: sales.creatorType,
          product_id: sales.productId,
        })
        .from(sales)
        .where(eq(sales.campaignId, campaignId)),
      db
        .select()
        .from(adsPerformance)
        .where(eq(adsPerformance.campaignId, campaignId)),
    ]);

    // Group videos by campaign_creator_id
    const videosByCc = new Map<number, any[]>();
    allVideos.forEach((v) => {
      if (!videosByCc.has(v.campaign_creator_id)) videosByCc.set(v.campaign_creator_id, []);
      videosByCc.get(v.campaign_creator_id)!.push(v);
    });

    // 3. Compile Creator Summary
    const creatorPerformanceMap = new Map<number, any>();
    if (Array.isArray(creatorPerfRes)) {
      creatorPerfRes.forEach((c: any) => {
        creatorPerformanceMap.set(c.campaign_creator_id, c);
      });
    }

    const compiledCreators = allCcs.map((cc) => {
      const perf = creatorPerformanceMap.get(cc.id) || {};
      const vids = videosByCc.get(cc.id) || [];
      return {
        ...cc,
        videos: vids,
        total_views: perf.views || vids.reduce((a: number, b: any) => a + (Number(b.views) || 0), 0),
        total_likes: perf.likes || vids.reduce((a: number, b: any) => a + (Number(b.likes) || 0), 0),
        organic_gmv: Number(perf.organic_gmv || 0),
        ads_gmv: Number(perf.ads_gmv || 0),
        total_gmv: Number(perf.total_gmv || 0),
        items_sold: Number(perf.items_sold || 0),
      };
    });

    return {
      campaign,
      skus: skusRes,
      creators: compiledCreators,
      videos: allVideos,
      sales: allSales,
      ads: allAds,
      summary: rpcSummary,
    };
  } catch (error: any) {
    console.error('Error in getInternalPerformaData:', error);
    return null;
  }
}
