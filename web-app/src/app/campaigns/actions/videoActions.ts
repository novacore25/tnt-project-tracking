'use server';

import { db } from '@/db';
import {
  campaigns,
  skus,
  campaignCreators,
  creators,
  videos,
  creatorContacts,
  organicVideos,
} from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { getCampaignVideoStats } from '@/lib/db-queries';

export async function getInternalVideoData(campaignId: number, searchKeyword: string = '') {
  try {
    // 1. Fetch Campaign
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign) return null;

    // 2. Fetch SKUs, Video Stats RPC, and Creators in parallel
    const [skusList, statsData, allCcs, allOrgVideos] = await Promise.all([
      db.select().from(skus).where(eq(skus.campaignId, campaignId)),
      getCampaignVideoStats(campaignId),
      db
        .select({
          id: campaignCreators.id,
          campaignId: campaignCreators.campaignId,
          creatorId: campaignCreators.creatorId,
          tier: campaignCreators.tier,
          price: campaignCreators.price,
          qtyVt: campaignCreators.qtyVt,
          approval: campaignCreators.approval,
          picAssist: campaignCreators.picAssist,
          notesManager: campaignCreators.notesManager,
          notesPic: campaignCreators.notesPic,
          notesClient: campaignCreators.notesClient,
          sampleProgress: campaignCreators.sampleProgress,
          creator: {
            id: creators.id,
            username: creators.username,
            namaAsli: creators.namaAsli,
          },
        })
        .from(campaignCreators)
        .innerJoin(creators, eq(campaignCreators.creatorId, creators.id))
        .where(
          sql`${campaignCreators.campaignId} = ${campaignId} AND ${campaignCreators.approval} = 'approved'`
        )
        .orderBy(desc(campaignCreators.id)),
      db
        .select({
          content_uid: organicVideos.videoId,
          publish_time: organicVideos.publishTime,
        })
        .from(organicVideos)
        .where(eq(organicVideos.campaignId, campaignId)),
    ]);

    // 3. Fetch all videos belonging to these creators
    const ccIds = allCcs.map((c) => c.id);
    const allVideosList =
      ccIds.length > 0
        ? await db
            .select()
            .from(videos)
            .where(sql`${videos.campaignCreatorId} IN (${sql.join(ccIds.map((id) => sql`${id}`), sql`, `)})`)
        : [];

    const statsList = Array.isArray(statsData) ? statsData : [];

    // Filter by search keyword if provided
    const filteredCcs = searchKeyword.trim()
      ? allCcs.filter((c) =>
          c.creator.username.toLowerCase().includes(searchKeyword.trim().toLowerCase())
        )
      : allCcs;

    // Group videos
    const videoMap = new Map<number, any[]>();
    allVideosList.forEach((v) => {
      if (!videoMap.has(v.campaignCreatorId)) videoMap.set(v.campaignCreatorId, []);
      videoMap.get(v.campaignCreatorId)!.push(v);
    });

    const result = filteredCcs.map((cc) => ({
      ...cc,
      creators: cc.creator,
      videos: videoMap.get(cc.id) || [],
    }));

    return {
      campaign,
      skus: skusList,
      creators: result,
      stats: statsList,
    };
  } catch (error: any) {
    console.error('Error in getInternalVideoData:', error);
    return null;
  }
}
