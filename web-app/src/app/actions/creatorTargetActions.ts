'use server';

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
  return session.user;
}

export async function addScrapeTargetsAction(params: {
  usernames: string[];
  campaignId?: number | null;
  campaignName?: string | null;
}) {
  const user = await requireUser();
  const { usernames, campaignId = null, campaignName = null } = params;
  if (!Array.isArray(usernames) || usernames.length === 0) {
    return { success: false, error: 'Daftar username kosong.' };
  }

  const cleanUsernames = Array.from(
    new Set(
      usernames
        .map((u) => String(u).trim().toLowerCase().replace(/^@/, ''))
        .filter(Boolean)
    )
  );

  const requestedBy = user.name || user.email || 'user';

  for (const u of cleanUsernames) {
    await db.execute(sql`
      INSERT INTO creator_scrape_targets (username, campaign_id, campaign_name, status, requested_by, updated_at)
      VALUES (${u}, ${campaignId}, ${campaignName}, 'pending', ${requestedBy}, now())
      ON CONFLICT (LOWER(TRIM(username)))
      DO UPDATE SET
        campaign_id = COALESCE(EXCLUDED.campaign_id, creator_scrape_targets.campaign_id),
        campaign_name = COALESCE(EXCLUDED.campaign_name, creator_scrape_targets.campaign_name),
        status = 'pending',
        requested_by = EXCLUDED.requested_by,
        updated_at = now()
    `);
  }

  revalidatePath('/creator-pool');
  return { success: true, count: cleanUsernames.length };
}

export async function fetchPendingScrapeTargetsAction() {
  const rows = await db.execute(sql`
    SELECT id, username, campaign_id, campaign_name, status, requested_by, created_at
    FROM creator_scrape_targets
    WHERE status = 'pending'
    ORDER BY id ASC
  `).catch(() => []);

  return (rows as unknown as any[]) || [];
}

export async function markScrapeTargetCompletedAction(username: string) {
  const clean = String(username).trim().toLowerCase().replace(/^@/, '');
  await db.execute(sql`
    UPDATE creator_scrape_targets
    SET status = 'completed', updated_at = now()
    WHERE LOWER(TRIM(username)) = ${clean}
  `).catch(() => {});
  return { success: true };
}

export async function clearScrapeTargetsAction() {
  await requireUser();
  await db.execute(sql`DELETE FROM creator_scrape_targets`);
  revalidatePath('/creator-pool');
  return { success: true };
}
