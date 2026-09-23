"use server";

import { auth } from '@/auth';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

async function getAdminUser() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");

  const [profile] = await db.execute(sql`
    SELECT id, role FROM profiles WHERE LOWER(email) = ${session.user.email.toLowerCase()} LIMIT 1
  `) as any[];

  if (!profile || !['manager', 'executive'].includes(profile.role)) {
    throw new Error("Forbidden: Manager or Executive role required");
  }

  return { sessionUser: session.user, profileId: profile.id };
}

export async function approveUser(userId: string) {
  const { profileId } = await getAdminUser();

  await db.execute(sql`
    UPDATE profiles SET
      status = 'approved',
      approved_at = NOW(),
      approved_by = ${profileId}::uuid
    WHERE id = ${userId}::uuid
  `);

  revalidatePath('/manajemen-akun');
}

export async function rejectUser(userId: string) {
  await getAdminUser();
  
  await db.execute(sql`
    DELETE FROM profiles
    WHERE id = ${userId}::uuid AND status = 'pending'
  `);

  revalidatePath('/manajemen-akun');
}

export async function deactivateUser(userId: string) {
  await getAdminUser();
  
  await db.execute(sql`
    UPDATE profiles SET status = 'inactive'
    WHERE id = ${userId}::uuid
  `);

  revalidatePath('/manajemen-akun');
}

export async function changeUserRole(userId: string, newRole: string) {
  await getAdminUser();

  await db.execute(sql`
    UPDATE profiles SET role = ${newRole}
    WHERE id = ${userId}::uuid
  `);

  revalidatePath('/manajemen-akun');
}

export async function assignCampaignsToUser(userId: string, campaignIds: number[], allCampaigns: boolean) {
  const { profileId } = await getAdminUser();

  // Delete existing
  await db.execute(sql`DELETE FROM user_campaigns WHERE user_id = ${userId}::uuid`);

  if (allCampaigns) {
    await db.execute(sql`
      INSERT INTO user_campaigns (user_id, all_campaigns, assigned_by)
      VALUES (${userId}::uuid, true, ${profileId}::uuid)
    `);
  } else if (campaignIds.length > 0) {
    for (const cid of campaignIds) {
      await db.execute(sql`
        INSERT INTO user_campaigns (user_id, campaign_id, all_campaigns, assigned_by)
        VALUES (${userId}::uuid, ${Number(cid)}, false, ${profileId}::uuid)
      `);
    }
  }

  revalidatePath('/manajemen-akun');
}

export async function addWhitelistEmail(email: string, nama: string, role: string) {
  const { profileId } = await getAdminUser();

  try {
    await db.execute(sql`
      INSERT INTO whitelisted_emails (email, nama, role, added_by)
      VALUES (${email.trim().toLowerCase()}, ${nama.trim()}, ${role}, ${profileId}::uuid)
    `);
  } catch (error: any) {
    if (error.code === '23505' || String(error).includes('unique')) {
      throw new Error("Email ini sudah terdaftar di whitelist.");
    }
    throw new Error(error.message);
  }

  revalidatePath('/manajemen-akun');
}

export async function removeWhitelistEmail(id: number) {
  await getAdminUser();

  await db.execute(sql`
    DELETE FROM whitelisted_emails WHERE id = ${id}
  `);

  revalidatePath('/manajemen-akun');
}
