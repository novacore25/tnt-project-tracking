import { db, sqlClient } from '@/db';
import { sql } from 'drizzle-orm';

/**
 * Panggil RPC get_campaign_creator_performance(p_campaign_id)
 */
export async function getCampaignCreatorPerformance(campaignId: number) {
  const result = await db.execute(
    sql`SELECT public.get_campaign_creator_performance(${campaignId}) AS data`
  );
  return result[0]?.data ?? [];
}

/**
 * Panggil RPC get_campaign_daily_stats(p_campaign_id)
 */
export async function getCampaignDailyStats(campaignId: number) {
  const result = await db.execute(
    sql`SELECT public.get_campaign_daily_stats(${campaignId}) AS data`
  );
  return result[0]?.data ?? [];
}

/**
 * Panggil RPC get_campaign_video_stats(p_campaign_id)
 */
export async function getCampaignVideoStats(campaignId: number) {
  const result = await db.execute(
    sql`SELECT public.get_campaign_video_stats(${campaignId}) AS data`
  );
  return result[0]?.data ?? [];
}

/**
 * Panggil RPC get_campaign_sales_stats(p_campaign_id)
 */
export async function getCampaignSalesStats(campaignId: number) {
  const result = await db.execute(
    sql`SELECT * FROM public.get_campaign_sales_stats(${campaignId})`
  );
  return result;
}

/**
 * Panggil RPC get_campaign_top_skus(p_campaign_id)
 */
export async function getCampaignTopSkus(campaignId: number) {
  const result = await db.execute(
    sql`SELECT * FROM public.get_campaign_top_skus(${campaignId})`
  );
  return result;
}

/**
 * Panggil RPC get_performance_summary_v2
 */
export async function getPerformanceSummaryV2(
  campaignId: number,
  filterType?: string | null,
  filterValues?: string[] | null
) {
  const result = await db.execute(
    sql`SELECT * FROM public.get_performance_summary_v2(
      ${campaignId},
      ${filterType || null},
      ${filterValues ? sql`ARRAY[${sql.join(filterValues.map((v) => sql`${v}`), sql`, `)}]` : null}
    )`
  );
  return result[0] ?? null;
}

/**
 * Panggil RPC rpc_get_payment_batches
 */
export async function getPaymentBatchesRpc(
  campaignId?: number | null,
  statusIn?: string[] | null
) {
  const result = await db.execute(
    sql`SELECT public.rpc_get_payment_batches(
      ${campaignId || null},
      ${statusIn ? sql`ARRAY[${sql.join(statusIn.map((s) => sql`${s}`), sql`, `)}]` : null}
    ) AS data`
  );
  return result[0]?.data ?? [];
}
