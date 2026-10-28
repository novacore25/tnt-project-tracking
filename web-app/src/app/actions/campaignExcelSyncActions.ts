"use server";

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { requireUser } from "@/lib/guards";
import { revalidatePath } from "next/cache";

/**
 * Mengambil seluruh data satu campaign arsip (Thick & Thin Media / data lama)
 * untuk diexport ke format Excel multi-sheet.
 * KHUSUS untuk tabel archive_* (Thick & Thin Media). Menolak jika campaign operasional TNT.
 */
export async function exportCampaignFullDataAction(campaignId: number) {
  await requireUser();

  try {
    // 1. Cek apakah ini campaign arsip (Thick & Thin Media)
    const [archiveCamp] = (await db.execute(sql`
      SELECT * FROM archive_campaigns WHERE id = ${campaignId} LIMIT 1
    `).catch(() => [])) as any[];

    if (!archiveCamp) {
      return {
        success: false,
        error: "Fitur Excel Sync ini khusus untuk campaign arsip Thick & Thin Media (data lama).",
      };
    }

    const [ccRows, vidRows, salesRows, adsRows] = await Promise.all([
      db.execute(sql`
        SELECT 
          id, campaign_id, creator_id, username, nama_asli, link_account,
          approval, content_type, tier, qty_vt, qty_live, price, created_at
        FROM archive_campaign_creators
        WHERE campaign_id = ${campaignId}
        ORDER BY id ASC
      `).catch(() => []) as Promise<any[]>,
      db.execute(sql`
        SELECT 
          v.id, v.campaign_creator_id, v.urutan, v.link_video, v.link_draft,
          v.concept, v.vt_approval, cc.username as creator_username
        FROM archive_videos v
        JOIN archive_campaign_creators cc ON v.campaign_creator_id = cc.id
        WHERE cc.campaign_id = ${campaignId}
        ORDER BY v.id ASC
      `).catch(() => []) as Promise<any[]>,
      db.execute(sql`
        SELECT 
          id, campaign_id, creator_username, content_uid, content_type,
          gmv, quantity, price, tanggal, order_id
        FROM archive_sales
        WHERE campaign_id = ${campaignId}
        ORDER BY tanggal ASC, id ASC
      `).catch(() => []) as Promise<any[]>,
      db.execute(sql`
        SELECT 
          id, campaign_id, creator_id, creator_username, campaign_ads_name,
          ad_id, ad_name, cost_usd, gross_revenue_usd, kurs, tanggal
        FROM archive_ads_performance
        WHERE campaign_id = ${campaignId}
        ORDER BY tanggal ASC, id ASC
      `).catch(() => []) as Promise<any[]>,
    ]);

    return {
      success: true,
      isArchive: true,
      campaign: archiveCamp,
      creators: (ccRows as any[]) || [],
      videos: (vidRows as any[]) || [],
      sales: (salesRows as any[]) || [],
      ads: (adsRows as any[]) || [],
    };
  } catch (error: any) {
    console.error("Error in exportCampaignFullDataAction:", error);
    return { success: false, error: error.message || "Gagal mengambil data export arsip." };
  }
}

/**
 * Mengimpor dan memperbarui kembali data campaign arsip dari file Excel yang telah diedit oleh tim.
 * KHUSUS untuk tabel archive_* (Thick & Thin Media / data lama).
 * Seluruh data disimpan terisolasi di:
 * 1. archive_campaigns
 * 2. archive_campaign_creators
 * 3. archive_videos
 * 4. archive_sales
 * 5. archive_ads_performance
 *
 * Menolak jika campaign bukan campaign arsip.
 */
export async function importCampaignFullDataAction(
  campaignId: number,
  payload: {
    campaign?: {
      nama?: string;
      status?: string;
      tipe_campaign?: string;
      start_date?: string;
      end_date?: string;
      target_gmv?: number;
      target_video?: number;
      target_creator?: number;
      budget_creator_plafon?: number;
      budget_ads_plafon?: number;
    };
    creators?: Array<{
      username: string;
      nama_asli?: string;
      link_account?: string;
      approval?: string;
      content_type?: string;
      tier?: string;
      price?: number;
      qty_vt?: number;
      qty_live?: number;
    }>;
    videos?: Array<{
      creator_username: string;
      urutan?: number;
      link_video?: string;
      link_draft?: string;
      concept?: string;
      vt_approval?: string;
    }>;
    sales?: Array<{
      tanggal?: string;
      creator_username: string;
      gmv: number;
      quantity?: number;
      content_type?: string;
      order_id?: string;
    }>;
    ads?: Array<{
      tanggal?: string;
      creator_username?: string;
      campaign_ads_name?: string;
      ad_id: string;
      ad_name?: string;
      cost_usd?: number;
      gross_revenue_usd?: number;
      kurs?: number;
    }>;
    modeSales?: 'append' | 'replace';
    modeAds?: 'append' | 'replace';
  }
) {
  await requireUser();

  try {
    // 1. Cek apakah ini benar-benar campaign arsip (archive_campaigns)
    const [archiveCamp] = (await db.execute(sql`
      SELECT id FROM archive_campaigns WHERE id = ${campaignId} LIMIT 1
    `).catch(() => [])) as any[];

    if (!archiveCamp) {
      return {
        success: false,
        error: "Operasi ditolak: Fitur Excel Sync ini khusus untuk campaign arsip Thick & Thin Media (data lama).",
      };
    }

    const result = await db.transaction(async (tx) => {
      let updatedCreatorsCount = 0;
      let updatedVideosCount = 0;
      let updatedSalesCount = 0;
      let updatedAdsCount = 0;

      // ============================================================
      // A. UPDATE METADATA CAMPAIGN ARSIP
      // ============================================================
      if (payload.campaign) {
        const c = payload.campaign;
        await tx.execute(sql`
          UPDATE archive_campaigns SET
            nama = COALESCE(${c.nama || null}, nama),
            status = COALESCE(${c.status || null}, status),
            tipe_campaign = COALESCE(${c.tipe_campaign || null}, tipe_campaign),
            start_date = CASE WHEN ${c.start_date || null} IS NOT NULL THEN ${c.start_date}::date ELSE start_date END,
            end_date = CASE WHEN ${c.end_date || null} IS NOT NULL THEN ${c.end_date}::date ELSE end_date END,
            target_gmv = CASE WHEN ${c.target_gmv !== undefined && c.target_gmv !== null} THEN ${Number(c.target_gmv)} ELSE target_gmv END,
            target_video = CASE WHEN ${c.target_video !== undefined && c.target_video !== null} THEN ${Number(c.target_video)} ELSE target_video END,
            target_creator = CASE WHEN ${c.target_creator !== undefined && c.target_creator !== null} THEN ${Number(c.target_creator)} ELSE target_creator END,
            budget_creator_plafon = CASE WHEN ${c.budget_creator_plafon !== undefined && c.budget_creator_plafon !== null} THEN ${Number(c.budget_creator_plafon)} ELSE budget_creator_plafon END,
            budget_ads_plafon = CASE WHEN ${c.budget_ads_plafon !== undefined && c.budget_ads_plafon !== null} THEN ${Number(c.budget_ads_plafon)} ELSE budget_ads_plafon END
          WHERE id = ${campaignId}
        `);
      }

      // ============================================================
      // B. UPSERT CREATORS ARSIP
      // ============================================================
      const creatorCcIdMap = new Map<string, number>();

      if (payload.creators && payload.creators.length > 0) {
        for (const cr of payload.creators) {
          const rawU = (cr.username || '').toLowerCase().trim().replace(/^@/, '');
          if (!rawU) continue;

          // Cek apakah kreator sudah ada di archive_campaign_creators
          const [existingCc] = (await tx.execute(sql`
            SELECT id FROM archive_campaign_creators 
            WHERE campaign_id = ${campaignId} AND LOWER(username) = ${rawU}
            LIMIT 1
          `)) as any[];

          if (existingCc) {
            await tx.execute(sql`
              UPDATE archive_campaign_creators SET
                nama_asli = COALESCE(${cr.nama_asli || null}, nama_asli),
                link_account = COALESCE(${cr.link_account || null}, link_account),
                approval = COALESCE(${cr.approval || null}, approval),
                content_type = COALESCE(${cr.content_type || null}, content_type),
                tier = COALESCE(${cr.tier || null}, tier),
                price = CASE WHEN ${cr.price !== undefined && cr.price !== null} THEN ${Number(cr.price)} ELSE price END,
                qty_vt = CASE WHEN ${cr.qty_vt !== undefined && cr.qty_vt !== null} THEN ${Number(cr.qty_vt)} ELSE qty_vt END,
                qty_live = CASE WHEN ${cr.qty_live !== undefined && cr.qty_live !== null} THEN ${Number(cr.qty_live)} ELSE qty_live END
              WHERE id = ${existingCc.id}
            `);
            creatorCcIdMap.set(rawU, existingCc.id);
          } else {
            const [newCc] = (await tx.execute(sql`
              INSERT INTO archive_campaign_creators (
                campaign_id, username, nama_asli, link_account, approval, content_type, tier, price, qty_vt, qty_live
              ) VALUES (
                ${campaignId}, ${rawU}, ${cr.nama_asli || null}, ${cr.link_account || `https://www.tiktok.com/@${rawU}`},
                ${cr.approval || 'approved'}, ${cr.content_type || 'video'}, ${cr.tier || 'nano'},
                ${Number(cr.price || 0)}, ${Number(cr.qty_vt || 1)}, ${Number(cr.qty_live || 0)}
              )
              RETURNING id
            `)) as any[];
            if (newCc) creatorCcIdMap.set(rawU, newCc.id);
          }
          updatedCreatorsCount++;
        }
      }

      // Pastikan creatorCcIdMap terisi untuk kreator lama jika tidak ada di payload creators
      if (creatorCcIdMap.size === 0) {
        const ccs = (await tx.execute(sql`
          SELECT id, LOWER(username) as username FROM archive_campaign_creators WHERE campaign_id = ${campaignId}
        `)) as any[];
        for (const c of ccs) creatorCcIdMap.set(c.username, c.id);
      }

      // ============================================================
      // C. UPSERT VIDEOS ARSIP
      // ============================================================
      if (payload.videos && payload.videos.length > 0) {
        for (const v of payload.videos) {
          const rawU = (v.creator_username || '').toLowerCase().trim().replace(/^@/, '');
          const ccId = creatorCcIdMap.get(rawU);
          if (!ccId) continue;

          const cleanLink = (v.link_video || '').trim();
          const cleanDraft = (v.link_draft || '').trim();
          const urutan = Number(v.urutan || 1);
          const concept = (v.concept || '').trim() || null;
          const vtApproval = (v.vt_approval || 'approved').trim();

          const [exVid] = (await tx.execute(sql`
            SELECT id FROM archive_videos
            WHERE campaign_creator_id = ${ccId}
              AND (${cleanLink ? sql`link_video = ${cleanLink}` : sql`urutan = ${urutan}`})
            LIMIT 1
          `)) as any[];

          if (exVid) {
            await tx.execute(sql`
              UPDATE archive_videos SET
                link_video = COALESCE(${cleanLink || null}, link_video),
                link_draft = COALESCE(${cleanDraft || null}, link_draft),
                concept = COALESCE(${concept || null}, concept),
                vt_approval = COALESCE(${vtApproval || null}, vt_approval),
                urutan = ${urutan}
              WHERE id = ${exVid.id}
            `);
          } else if (cleanLink || cleanDraft) {
            await tx.execute(sql`
              INSERT INTO archive_videos (
                campaign_creator_id, urutan, link_video, link_draft, concept, vt_approval
              ) VALUES (
                ${ccId}, ${urutan}, ${cleanLink || null}, ${cleanDraft || null}, ${concept || null}, ${vtApproval}
              )
            `);
          }
          updatedVideosCount++;
        }
      }

      // ============================================================
      // D. UPSERT / REPLACE SALES ORGANIK ARSIP
      // ============================================================
      if (payload.sales && payload.sales.length > 0) {
        if (payload.modeSales === 'replace') {
          await tx.execute(sql`DELETE FROM archive_sales WHERE campaign_id = ${campaignId}`);
        }

        for (const s of payload.sales) {
          const rawU = (s.creator_username || '').toLowerCase().trim().replace(/^@/, '');
          const gmv = Number(s.gmv || 0);
          if (gmv <= 0 && !s.order_id) continue;

          const tanggal = s.tanggal ? s.tanggal.substring(0, 10) : '2024-01-01';
          const qty = Number(s.quantity || 1);
          const cType = (s.content_type || 'video').toLowerCase();
          const orderId = s.order_id || `IMP_${campaignId}_${rawU}_${Date.now()}_${Math.floor(Math.random()*1000)}`;

          await tx.execute(sql`
            INSERT INTO archive_sales (
              campaign_id, creator_username, gmv, quantity, price, content_type, tanggal, order_id
            ) VALUES (
              ${campaignId}, ${rawU}, ${gmv}, ${qty}, ${qty > 0 ? Math.round(gmv / qty) : gmv},
              ${cType}, ${tanggal}::date, ${orderId}
            )
          `);
          updatedSalesCount++;
        }
      }

      // ============================================================
      // E. UPSERT / REPLACE ADS PERFORMANCE ARSIP
      // ============================================================
      if (payload.ads && payload.ads.length > 0) {
        if (payload.modeAds === 'replace') {
          await tx.execute(sql`DELETE FROM archive_ads_performance WHERE campaign_id = ${campaignId}`);
        }

        for (const a of payload.ads) {
          const adId = (a.ad_id || '').trim();
          if (!adId) continue;

          const rawU = (a.creator_username || '').toLowerCase().trim().replace(/^@/, '');
          const tanggal = a.tanggal ? a.tanggal.substring(0, 10) : '2024-01-01';
          const costUsd = Number(a.cost_usd || 0);
          const revUsd = Number(a.gross_revenue_usd || 0);
          const kurs = Number(a.kurs || 16000);
          const adName = a.ad_name || `Ad_${adId}`;
          const campAdsName = a.campaign_ads_name || `Campaign_Ads_${campaignId}`;

          await tx.execute(sql`
            INSERT INTO archive_ads_performance (
              campaign_id, creator_username, campaign_ads_name, ad_id, ad_name,
              cost_usd, gross_revenue_usd, kurs, tanggal
            ) VALUES (
              ${campaignId}, ${rawU || null}, ${campAdsName}, ${adId}, ${adName},
              ${costUsd}, ${revUsd}, ${kurs}, ${tanggal}::date
            )
          `);
          updatedAdsCount++;
        }
      }

      return {
        updatedCreatorsCount,
        updatedVideosCount,
        updatedSalesCount,
        updatedAdsCount,
      };
    });

    revalidatePath(`/campaigns`);
    revalidatePath(`/campaigns/${campaignId}/performa`);
    revalidatePath(`/campaigns/${campaignId}/video`);
    revalidatePath(`/campaigns/${campaignId}/listing`);
    revalidatePath(`/campaigns/${campaignId}/daily`);
    revalidatePath(`/ads-report`);

    return {
      success: true,
      isArchive: true,
      counts: result,
    };
  } catch (error: any) {
    console.error("Error in importCampaignFullDataAction:", error);
    return {
      success: false,
      error: error.message || "Gagal mengimpor data arsip campaign.",
    };
  }
}
