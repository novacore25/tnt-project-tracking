'use server';

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function fetchInvoiceDataAction() {
  const [prRows, pcRows] = await Promise.all([
    db.execute(sql`SELECT * FROM payout_requests ORDER BY created_at DESC`).catch(() => []),
    db.execute(sql`SELECT * FROM payout_creator`).catch(() => []),
  ]);

  return {
    payout_requests: (prRows as unknown as any[]) || [],
    payout_creator: (pcRows as unknown as any[]) || [],
  };
}

export async function fetchInvoiceRincianAction(payoutId: number) {
  const rows = await db.execute(sql`
    SELECT 
      pc.*,
      cc.id as cc_id,
      cr.username as creator_username
    FROM payout_creator pc
    LEFT JOIN campaign_creators cc ON pc.campaign_creator_id = cc.id
    LEFT JOIN creators cr ON cc.creator_id = cr.id
    WHERE pc.payout_id = ${payoutId}
  `);

  return (rows as unknown as any[]) || [];
}

export async function approveInvoiceAction(
  reqId: number,
  type: string,
  rincian: Array<{ id: number; cc_id: number }>,
  statusBayar: Record<number, string>,
  buktiUrl: string
) {
  await db.execute(sql`UPDATE payout_requests SET status = 'approved' WHERE id = ${reqId}`);

  if (type === 'creator' && rincian && rincian.length > 0) {
    const today = new Date().toISOString().split('T')[0];
    for (const r of rincian) {
      await db.execute(sql`
        UPDATE payout_creator
        SET tanggal_transfer = ${today}, bukti_transfer_url = ${buktiUrl}
        WHERE id = ${r.id}
      `);

      if (statusBayar[r.id]) {
        await db.execute(sql`
          UPDATE campaign_creators
          SET status_bayar = ${statusBayar[r.id]}
          WHERE id = ${r.cc_id}
        `);
      }
    }
  }

  revalidatePath('/invoice');
}

export async function rejectInvoiceAction(reqId: number) {
  await db.execute(sql`UPDATE payout_requests SET status = 'rejected' WHERE id = ${reqId}`);
  revalidatePath('/invoice');
}
