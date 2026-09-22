import React from "react";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import ImportVideoClient from "./ImportVideoClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ImportVideoPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params;
  const campaignId = Number(resolvedParams.id);

  if (isNaN(campaignId)) {
    return <div className="p-8 text-center text-red-500 font-bold">Campaign ID tidak valid</div>;
  }

  // Fetch campaign info
  const campaignRows = (await db.execute(sql`
    SELECT id, title, nama_campaign, status FROM campaigns WHERE id = ${campaignId} LIMIT 1
  `).catch(() => [])) as any[];

  if (!campaignRows || campaignRows.length === 0) {
    return <div className="p-8 text-center text-slate-500">Campaign tidak ditemukan.</div>;
  }

  const campaign = campaignRows[0];
  const campaignName = campaign.nama_campaign || campaign.title || `Campaign #${campaignId}`;

  // Fetch active SKUs for this campaign
  const skusList = (await db.execute(sql`
    SELECT id, nama_produk, kode_sku FROM skus WHERE campaign_id = ${campaignId} ORDER BY id ASC
  `).catch(() => [])) as any[];

  return (
    <ImportVideoClient
      campaignId={campaignId}
      campaignName={campaignName}
      skus={skusList || []}
    />
  );
}
