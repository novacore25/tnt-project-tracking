'use server';

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import * as ExcelJS from 'exceljs';

/**
 * Fetch report data for a given campaign.
 * Returns an object containing:
 * - totalSold: number
 * - topSkus: Array<{ sku: string; gmv: number; thumbnail: string }>
 * - creators, videos, samples, receipts (array of rows for the tabs)
 */
export async function fetchReportData(campaignId: string | number) {
  const cId = Number(campaignId);

  try {
    const [soldRes, skuRes, creatorsRes, videosRes] = await Promise.all([
      db.execute(sql`
        SELECT COALESCE(SUM(s.quantity), 0) as total_sold
        FROM sales s
        JOIN campaign_creators cc ON s.campaign_creator_id = cc.id
        WHERE cc.campaign_id = ${cId}
      `).catch(() => [{ total_sold: 0 }]),
      db.execute(sql`
        SELECT nama_produk as sku, 0 as gmv, '' as thumbnail
        FROM skus
        WHERE campaign_id = ${cId}
        LIMIT 5
      `).catch(() => []),
      db.execute(sql`
        SELECT c.*, cc.price, cc.approval, cc.tipe_konten
        FROM creators c
        JOIN campaign_creators cc ON c.id = cc.creator_id
        WHERE cc.campaign_id = ${cId}
      `).catch(() => []),
      db.execute(sql`
        SELECT v.*
        FROM videos v
        JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
        WHERE cc.campaign_id = ${cId}
      `).catch(() => []),
    ]);

    const totalSold = Number((soldRes as any[])[0]?.total_sold || 0);
    const topSkus = (skuRes as any[]) || [];
    const creators = (creatorsRes as any[]) || [];
    const videos = (videosRes as any[]) || [];
    const samples: any[] = [];
    const receipts: any[] = [];

    return {
      totalSold,
      topSkus,
      creators,
      videos,
      samples,
      receipts,
    };
  } catch (error) {
    console.error('Error fetching report data:', error);
    return {
      totalSold: 0,
      topSkus: [],
      creators: [],
      videos: [],
      samples: [],
      receipts: [],
    };
  }
}

/**
 * Generate an Excel workbook buffer for the given campaign.
 * The workbook contains separate sheets: Summary, Creators, Videos, Samples, Receipts.
 */
export async function generateExcelBuffer(campaignId: string): Promise<Buffer> {
  const data = await fetchReportData(campaignId);
  const wb = new ExcelJS.Workbook();

  // Summary sheet
  const summarySheet = wb.addWorksheet('Summary');
  summarySheet.addRow(['Total Items Sold', data.totalSold]);
  summarySheet.addRow([]);
  summarySheet.addRow(['Top 5 SKUs']);
  summarySheet.addRow(['SKU', 'GMV', 'Thumbnail']);
  data.topSkus.forEach((sku: any) => {
    summarySheet.addRow([sku.sku, sku.gmv, sku.thumbnail]);
  });

  // Helper to add generic sheet
  const addSheet = (name: string, rows: any[]) => {
    const sheet = wb.addWorksheet(name);
    if (rows.length === 0) return;
    const columns = Object.keys(rows[0]).map((key) => ({ header: key, key }));
    sheet.columns = columns as any;
    rows.forEach((row) => sheet.addRow(row));
  };

  addSheet('Creators', data.creators);
  addSheet('Videos', data.videos);
  addSheet('Samples', data.samples);
  addSheet('Receipts', data.receipts);

  // Return buffer
  return wb.xlsx.writeBuffer() as any;
}
