"use server";

import { db, sqlInList } from '@/db';
import { sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { normalizeKurs } from '@/utils/computed';
import { requireUser, requireRole } from '@/lib/guards';

export async function getAdsReportData(params: {
  startDate?: string;
  endDate?: string;
  campaignId?: number | null;
  campaignAdsName?: string | null;
  searchQuery?: string;
  objectives?: string[];
  sortKey: string;
  sortDir: 'asc' | 'desc';
  company?: string;
}) {
  const { profile } = await requireUser();
  const isExecutive = profile?.role === 'executive';
  const effectiveCompany = isExecutive ? (params.company || 'TNT') : 'TNT';

  let rawAdsRows: any[] = [];
  let campaignsRows: any[] = [];
  let budgetRows: any[] = [];

  if (isExecutive && effectiveCompany === 'OTHER') {
    let adsQuery = sql`
      SELECT 
        ap.*,
        json_build_object('username', ap.creator_username) as creators
      FROM archive_ads_performance ap
      JOIN archive_campaigns c ON ap.campaign_id = c.id
    `;

    if (params.campaignAdsName) {
      adsQuery = sql`${adsQuery} WHERE ap.campaign_ads_name = ${params.campaignAdsName}`;
    }

    adsQuery = sql`${adsQuery} ORDER BY ap.tanggal DESC`;

    const [rawAds, camps, budgets] = await Promise.all([
      db.execute(adsQuery),
      db.execute(sql`SELECT id, nama, company FROM archive_campaigns ORDER BY nama ASC`),
      db.execute(sql`SELECT * FROM ads_allocations`)
    ]);
    rawAdsRows = (rawAds as any[]) || [];
    campaignsRows = (camps as any[]) || [];
    budgetRows = (budgets as any[]) || [];
  } else {
    let adsQuery = sql`
      SELECT 
        ap.*,
        json_build_object('username', cr.username) as creators
      FROM ads_performance ap
      LEFT JOIN creators cr ON ap.creator_id = cr.id
      LEFT JOIN campaigns c ON ap.campaign_id = c.id
      WHERE (c.company = 'TNT' OR c.company IS NULL)
    `;

    if (params.campaignAdsName) {
      adsQuery = sql`${adsQuery} AND ap.campaign_ads_name = ${params.campaignAdsName}`;
    }

    adsQuery = sql`${adsQuery} ORDER BY ap.tanggal DESC`;

    const [rawAds, camps, budgets] = await Promise.all([
      db.execute(adsQuery),
      db.execute(sql`SELECT id, nama, company FROM campaigns WHERE company = 'TNT' OR company IS NULL ORDER BY nama ASC`),
      db.execute(sql`SELECT * FROM ads_allocations`)
    ]);
    rawAdsRows = (rawAds as any[]) || [];
    campaignsRows = (camps as any[]) || [];
    budgetRows = (budgets as any[]) || [];
  }

  let rawAllData = ((rawAdsRows as unknown as any[]) || []).map(r => ({
    ...r,
    cost_usd: Number(r.cost_usd) || 0,
    gross_revenue_usd: Number(r.gross_revenue_usd) || 0,
    kurs: Number(r.kurs) || 16000,
    impressions: Number(r.impressions) || 0,
    clicks: Number(r.clicks) || 0,
    purchases: Number(r.purchases) || 0,
    product_page_views: Number(r.product_page_views) || 0,
    checkouts_initiated: Number(r.checkouts_initiated) || 0,
    items_purchased: Number(r.items_purchased) || 0,
  }));
  const campaignsData = (campaignsRows as unknown as any[]) || [];
  const budgetData = (budgetRows as unknown as any[]) || [];

  if (rawAllData.length === 0) {
    return { 
      summary: { totalSpend: 0, totalGmv: 0, totalImpressions: 0, roas: 0, cpm: 0 }, 
      filteredSummary: { totalSpend: 0, totalGmv: 0, totalImpressions: 0, roas: 0, cpm: 0 }, 
      data: [], 
      campaignBreakdown: { list: [], globalUnmappedCampaigns: 0 }, 
      budgetBalances: {} 
    };
  }

  // Filter by Objective (SALES vs AWARENESS)
  if (params.objectives && params.objectives.length > 0) {
    const isSalesSelected = params.objectives.some(o => o.toUpperCase() === 'SALES');
    const isAwarenessSelected = params.objectives.some(o => o.toUpperCase() === 'AWARENESS');

    const matchObjective = (r: any) => {
      const text = `${r.campaign_ads_name || ''} ${r.ad_name || ''}`.toLowerCase();
      const hasSalesKeyword = /sales|conv|purchase|belanja|vsa/i.test(text) || (Number(r.gross_revenue_usd) || 0) > 0 || (Number(r.purchases) || 0) > 0;
      const hasAwarenessKeyword = /awareness|traffic|reach|view|brand/i.test(text) || ((Number(r.gross_revenue_usd) || 0) === 0 && (Number(r.purchases) || 0) === 0 && (Number(r.impressions) || 0) > 0);

      if (isSalesSelected && isAwarenessSelected) {
        return hasSalesKeyword || hasAwarenessKeyword;
      }
      if (isSalesSelected) {
        return hasSalesKeyword;
      }
      if (isAwarenessSelected) {
        return hasAwarenessKeyword;
      }
      return true;
    };

    rawAllData = rawAllData.filter(matchObjective);
  }

  // Filter raw data by date in memory
  let rawFilteredData = rawAllData;
  if (params.startDate) {
    rawFilteredData = rawFilteredData.filter(r => r.tanggal >= params.startDate!);
  }
  if (params.endDate) {
    rawFilteredData = rawFilteredData.filter(r => r.tanggal <= params.endDate!);
  }

  // Helper key unik per iklan agar jika ad_id kosong tidak menimpa satu sama lain
  const getAdKey = (r: any) => r.ad_id || r.ad_name || `unknown-${r.id}`;

  // 2. Aggregate to find the latest record for each ad for summary calculations
  const allTimeLatestMap = new Map();
  for (const row of rawAllData) {
    const key = getAdKey(row);
    const existing = allTimeLatestMap.get(key);
    if (!existing || new Date(row.tanggal) > new Date(existing.tanggal)) {
      allTimeLatestMap.set(key, row);
    }
  }
  let allTimeLatestData = Array.from(allTimeLatestMap.values());

  // 4. Find Latest Before Start Date for Delta Calculation
  const latestBeforeMap = new Map();
  if (params.startDate) {
    for (const row of rawAllData) {
      if (row.tanggal < params.startDate) {
        const key = getAdKey(row);
        const existing = latestBeforeMap.get(key);
        if (!existing || new Date(row.tanggal) > new Date(existing.tanggal)) {
          latestBeforeMap.set(key, row);
        }
      }
    }
  }

  // 5. Aggregate to find the latest record for each ad WITHIN the filtered range
  const filteredLatestMap = new Map();
  for (const row of rawFilteredData) {
    const key = getAdKey(row);
    const existing = filteredLatestMap.get(key);
    if (!existing || new Date(row.tanggal) > new Date(existing.tanggal)) {
      filteredLatestMap.set(key, row);
    }
  }
  
  // Inject Delta values into the latest rows
  for (const row of rawFilteredData) {
    const key = getAdKey(row);
    const latestRow = filteredLatestMap.get(key);
    if (latestRow && latestRow.id === row.id) {
      const beforeRow = latestBeforeMap.get(key);
      if (beforeRow) {
        row.delta_cost_usd = Math.max(0, row.cost_usd - beforeRow.cost_usd);
        row.delta_gross_revenue_usd = Math.max(0, row.gross_revenue_usd - beforeRow.gross_revenue_usd);
        row.delta_impressions = Math.max(0, row.impressions - beforeRow.impressions);
        row.delta_clicks = Math.max(0, row.clicks - beforeRow.clicks);
        row.delta_product_page_views = Math.max(0, row.product_page_views - beforeRow.product_page_views);
        row.delta_checkouts_initiated = Math.max(0, row.checkouts_initiated - beforeRow.checkouts_initiated);
        row.delta_purchases = Math.max(0, row.purchases - beforeRow.purchases);
        row.delta_items_purchased = Math.max(0, row.items_purchased - beforeRow.items_purchased);
      } else {
        row.delta_cost_usd = row.cost_usd;
        row.delta_gross_revenue_usd = row.gross_revenue_usd;
        row.delta_impressions = row.impressions;
        row.delta_clicks = row.clicks;
        row.delta_product_page_views = row.product_page_views;
        row.delta_checkouts_initiated = row.checkouts_initiated;
        row.delta_purchases = row.purchases;
        row.delta_items_purchased = row.items_purchased;
      }
    }
  }

  let filteredLatestData = Array.from(filteredLatestMap.values());

  // We want the date-filtered records for the table
  let tableData = rawFilteredData;

  // 3. Apply Search Query Filter in memory to all collections (termasuk tableData!)
  if (params.searchQuery) {
    const q = params.searchQuery.toLowerCase();
    allTimeLatestData = allTimeLatestData.filter(r => 
      (r.ad_name && r.ad_name.toLowerCase().includes(q)) || 
      (r.ad_id && r.ad_id.toLowerCase().includes(q))
    );
    filteredLatestData = filteredLatestData.filter(r => 
      (r.ad_name && r.ad_name.toLowerCase().includes(q)) || 
      (r.ad_id && r.ad_id.toLowerCase().includes(q))
    );
    tableData = tableData.filter(r => 
      (r.ad_name && r.ad_name.toLowerCase().includes(q)) || 
      (r.ad_id && r.ad_id.toLowerCase().includes(q)) ||
      (r.creators?.username && r.creators.username.toLowerCase().includes(q)) ||
      (r.campaign_ads_name && r.campaign_ads_name.toLowerCase().includes(q))
    );
  }

  // Fetch campaigns to map names
  const campaignNames: Record<number, string> = {};
  campaignsData.forEach(c => {
    campaignNames[c.id] = c.nama;
  });

  // 4. Calculate Campaign Breakdown (using ALL-TIME campaigns matching search)
  const campaignBreakdown: Record<number, any> = {};
  let globalUnmappedCampaigns = 0;
  for (const ad of allTimeLatestData) {
    const kurs = normalizeKurs(ad.kurs);
    const cId = ad.campaign_id;
    if (!cId) {
       globalUnmappedCampaigns++;
       continue;
    }
    if (!campaignBreakdown[cId]) {
      campaignBreakdown[cId] = { name: campaignNames[cId] || 'Unknown Campaign', spend: 0, gmv: 0, gmv_usd: 0, impressions: 0, clicks: 0, purchases: 0, unmapped: 0, spend_usd: 0 };
    }
    const costUsd = Number(ad.cost_usd) || 0;
    const grossRevenueUsd = Number(ad.gross_revenue_usd) || 0;
    const impressions = Number(ad.impressions) || 0;
    const clicks = Number(ad.clicks) || 0;
    const purchases = Number(ad.purchases) || 0;

    campaignBreakdown[cId].spend += costUsd * kurs;
    campaignBreakdown[cId].spend_usd += costUsd;
    campaignBreakdown[cId].gmv += grossRevenueUsd * kurs;
    campaignBreakdown[cId].gmv_usd += grossRevenueUsd;
    campaignBreakdown[cId].impressions += impressions;
    campaignBreakdown[cId].clicks += clicks;
    campaignBreakdown[cId].purchases += purchases;
    if (!ad.creator_id || !ad.campaign_ads_name) {
      campaignBreakdown[cId].unmapped++;
    }
  }

  const list = Object.entries(campaignBreakdown).map(([id, data]: any) => ({ id: Number(id), ...data }));
  list.sort((a, b) => b.gmv - a.gmv);

  // 5. Apply Campaign ID filter for Table and Summary
  if (params.campaignId !== null && params.campaignId !== undefined) {
    tableData = tableData.filter(r => r.campaign_id === params.campaignId);
    allTimeLatestData = allTimeLatestData.filter(r => r.campaign_id === params.campaignId);
    filteredLatestData = filteredLatestData.filter(r => r.campaign_id === params.campaignId);
  }

  // 6. Calculate Summaries
  const calcSummary = (dataArr: any[], useDelta = false) => {
    let sumSpend = 0; let sumGmv = 0; let sumImpr = 0; let sumSpendUsd = 0;
    for (const ad of dataArr) {
      const kurs = normalizeKurs(ad.kurs);
      
      const cost = Number(useDelta && ad.delta_cost_usd !== undefined ? ad.delta_cost_usd : ad.cost_usd) || 0;
      const gmv = Number(useDelta && ad.delta_gross_revenue_usd !== undefined ? ad.delta_gross_revenue_usd : ad.gross_revenue_usd) || 0;
      const impr = Number(useDelta && ad.delta_impressions !== undefined ? ad.delta_impressions : ad.impressions) || 0;

      sumSpend += cost * kurs;
      sumSpendUsd += cost;
      sumGmv += gmv * kurs;
      sumImpr += impr;
    }
    return {
      totalSpend: sumSpend,
      totalSpendUsd: sumSpendUsd,
      totalGmv: sumGmv,
      totalImpressions: sumImpr,
      roas: sumSpend > 0 ? sumGmv / sumSpend : 0,
      cpm: sumImpr > 0 ? sumSpend / (sumImpr / 1000) : 0,
    };
  };

  const summary = calcSummary(allTimeLatestData, false);
  const filteredSummary = calcSummary(filteredLatestData, true);

  // 7. Sort Table Data
  tableData.sort((a, b) => {
    let valA = a[params.sortKey];
    let valB = b[params.sortKey];
    if (params.sortKey === 'tanggal') {
      valA = new Date(valA || 0).getTime(); valB = new Date(valB || 0).getTime();
    } else if (params.sortKey === 'creator_id') {
      valA = a.creators?.username || ''; valB = b.creators?.username || '';
    } else if (['cost_usd', 'gross_revenue_usd', 'kurs', 'impressions', 'clicks', 'purchases'].includes(params.sortKey)) {
      valA = Number(valA || 0); valB = Number(valB || 0);
    } else {
      valA = String(valA || ''); valB = String(valB || '');
    }
    if (valA < valB) return params.sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return params.sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // Calculate allocated budgets from `ads_allocations`
  const budgetBalances: Record<number, { allocated: number, remaining: number }> = {};
  
  if (budgetData) {
    list.forEach((camp: any) => {
      const campBudgets = budgetData.filter(b => b.campaign_id === camp.id);
      const allocated = campBudgets.reduce((sum, b) => sum + (Number(b.alokasi_usd) || 0), 0);
      const remaining = allocated - camp.spend_usd;
      budgetBalances[camp.id] = { allocated, remaining };
    });
  }

  return {
    summary,
    filteredSummary,
    campaignBreakdown: { list, globalUnmappedCampaigns },
    budgetBalances,
    data: tableData
  };
}

export async function updateAdPerformanceAction(params: {
  id?: number;
  adId?: string;
  updates: {
    campaign_id?: number | null;
    creator_id?: number | null;
    campaign_ads_name?: string | null;
    kurs?: number | null;
    tanggal?: string | null;
    ad_id?: string | null;
    ad_name?: string | null;
  };
  bulkByAdId?: boolean;
}) {
  await requireRole('admin', 'manager', 'executive');
  const { id, adId, updates, bulkByAdId } = params;

  if (bulkByAdId && adId) {
    await db.execute(sql`
      UPDATE ads_performance
      SET 
        campaign_id = ${updates.campaign_id !== undefined ? updates.campaign_id : sql`campaign_id`},
        creator_id = ${updates.creator_id !== undefined ? updates.creator_id : sql`creator_id`},
        campaign_ads_name = ${updates.campaign_ads_name !== undefined ? updates.campaign_ads_name : sql`campaign_ads_name`},
        ad_id = ${updates.ad_id !== undefined && updates.ad_id ? updates.ad_id : sql`ad_id`},
        ad_name = ${updates.ad_name !== undefined && updates.ad_name ? updates.ad_name : sql`ad_name`}
      WHERE ad_id = ${adId}
    `);
  } else if (id) {
    await db.execute(sql`
      UPDATE ads_performance
      SET 
        campaign_id = ${updates.campaign_id !== undefined ? updates.campaign_id : sql`campaign_id`},
        creator_id = ${updates.creator_id !== undefined ? updates.creator_id : sql`creator_id`},
        campaign_ads_name = ${updates.campaign_ads_name !== undefined ? updates.campaign_ads_name : sql`campaign_ads_name`},
        kurs = ${updates.kurs !== undefined && updates.kurs !== null ? Number(updates.kurs) : sql`kurs`},
        tanggal = ${updates.tanggal !== undefined && updates.tanggal ? sql`${updates.tanggal}::date` : sql`tanggal`},
        ad_id = ${updates.ad_id !== undefined && updates.ad_id ? updates.ad_id : sql`ad_id`},
        ad_name = ${updates.ad_name !== undefined && updates.ad_name ? updates.ad_name : sql`ad_name`}
      WHERE id = ${id}
    `);
  }

  // Simpan otomatis ke master ads_name_mappings jika creator_id di-set
  if (updates.creator_id) {
    try {
      let adNameToMap = updates.ad_name;
      if (!adNameToMap) {
        const row = (await db.execute(sql`
          SELECT ad_name FROM ads_performance WHERE ${bulkByAdId && adId ? sql`ad_id = ${adId}` : sql`id = ${id}`} LIMIT 1
        `)) as any[];
        if (row && row[0]?.ad_name) {
          adNameToMap = row[0].ad_name;
        }
      }

      if (adNameToMap) {
        await db.execute(sql`
          INSERT INTO ads_name_mappings (ad_name, creator_id, created_at)
          VALUES (${adNameToMap}, ${updates.creator_id}, now())
          ON CONFLICT (ad_name) DO UPDATE 
          SET creator_id = EXCLUDED.creator_id, created_at = now()
        `);
      }
    } catch (e) {
      // ignore mapping error if table not exists or constraint fails
    }
  }

  revalidatePath('/ads-report');
  return { success: true };
}

export async function deleteAdPerformanceAction(ids: number[]) {
  await requireRole('admin', 'manager', 'executive');
  if (!ids || ids.length === 0) return { success: true };
  await db.execute(sql`
    DELETE FROM ads_performance WHERE id IN ${sqlInList(ids)}
  `);
  revalidatePath('/ads-report');
  return { success: true };
}

export async function fetchAdsBudgetingDataAction() {
  await requireUser();
  const [topups, allocations, perf] = await Promise.all([
    db.execute(sql`SELECT * FROM ads_topups ORDER BY tanggal DESC`),
    db.execute(sql`SELECT * FROM ads_allocations ORDER BY tanggal DESC`),
    db.execute(sql`SELECT campaign_id, ad_id, tanggal, cost_usd, kurs FROM ads_performance`)
  ]);

  return {
    topups: (topups as unknown as any[]) || [],
    allocations: (allocations as unknown as any[]) || [],
    performance: (perf as unknown as any[]) || []
  };
}

export async function addAdsTopupAction(data: {
  tanggal: string;
  nominal_topup_idr: number;
  kurs: number;
  nominal_topup_usd: number;
  keterangan?: string;
}) {
  await requireRole('admin', 'manager', 'finance', 'executive');
  await db.execute(sql`
    INSERT INTO ads_topups (tanggal, nominal_idr, kurs_topup, nominal_usd, catatan)
    VALUES (${data.tanggal}, ${data.nominal_topup_idr}, ${data.kurs}, ${data.nominal_topup_usd}, ${data.keterangan || null})
  `);
  revalidatePath('/ads-report/budgeting-ads');
  return { success: true };
}

export async function deleteAdsTopupAction(id: number) {
  await requireRole('admin', 'manager', 'finance', 'executive');
  await db.execute(sql`DELETE FROM ads_allocations WHERE topup_id = ${id}`);
  await db.execute(sql`DELETE FROM ads_topups WHERE id = ${id}`);
  revalidatePath('/ads-report/budgeting-ads');
  return { success: true };
}

export async function addAdsAllocationAction(data: {
  tanggal: string;
  campaign_id: number;
  alokasi_usd: number;
  keterangan?: string;
  topup_id?: number | null;
  alokasi_idr?: number | null;
}) {
  await requireRole('admin', 'manager', 'finance', 'executive');
  await db.execute(sql`
    INSERT INTO ads_allocations (tanggal, campaign_id, alokasi_usd, catatan, topup_id, alokasi_idr)
    VALUES (${data.tanggal}, ${data.campaign_id}, ${data.alokasi_usd}, ${data.keterangan || null}, ${data.topup_id || null}, ${data.alokasi_idr || null})
  `);
  revalidatePath('/ads-report/budgeting-ads');
  return { success: true };
}

export async function deleteAdsAllocationAction(id: number) {
  await requireRole('admin', 'manager', 'finance', 'executive');
  await db.execute(sql`DELETE FROM ads_allocations WHERE id = ${id}`);
  revalidatePath('/ads-report/budgeting-ads');
  return { success: true };
}
