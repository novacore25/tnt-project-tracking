import { auth } from '@/auth';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

// ================================================================
// SERVER-SIDE AUTH GUARDS
// ================================================================
// PENTANG: `canEditCampaign` di AuthProvider itu CLIENT-SIDE. Dia cuma
// menentukan apa yang displayed di layar. Properti di browser bisa
// diubah, jadi itu BUKAN lapisan otorisasi.
//
// Semua server action yang menulis ke database WAJIB lewat guard di
// file ini. Lihat AGENTS.md aturan #2.
//
// Template yang benar sudah ada di `manajemen-akun/actions.ts:8-21`
// (`getAdminUser`). File ini generalisasinya supaya tidak ditulis ulang
// di 45 tempat berbeda.
//
// CATATAN: `src/db/schema.ts` itu STALE (lihat AGENTS.md aturan #1).
// Tabel `user_campaigns` punya kolom `all_campaigns` dan `assigned_by`
// yang tidak ada di schema. Karena itu semua query di sini pakai SQL
// mentah, bukan drizzle schema — sama seperti sisa codebase.
// ================================================================

/** Role yang punya akses ke semua campaign tanpa perlu assignment. */
const GLOBAL_ROLES = ['admin', 'manager', 'finance', 'executive'];

export type GuardedUser = {
  id: string;
  email: string;
  role: string;
  status: string | null;
};

export class AuthError extends Error {
  readonly status: 401 | 403;

  constructor(message: string, status: 401 | 403) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

/**
 * Wajib login dan profilnya harus ada di tabel `profiles`.
 *
 * Sengaja TIDAK mengecek `profiles.status`: callback `signIn` di
 * `auth.ts` juga tidak memeriksanya, jadi menambahkan cek di sini bisa
 * mengunci user yang sekarang ini sah.
 */
export async function requireUser(): Promise<{ sessionUser: { email?: string | null; id?: string }; profile: GuardedUser }> {
  const session = await auth();

  if (!session?.user?.email) {
    throw new AuthError('Anda harus login.', 401);
  }

  const rows = (await db.execute(sql`
    SELECT id, email, role, status
    FROM profiles
    WHERE LOWER(email) = ${session.user.email.toLowerCase()}
    LIMIT 1
  `)) as unknown as GuardedUser[];

  const profile = rows[0];
  if (!profile) {
    throw new AuthError('Profil tidak ditemukan. Hubungi admin.', 403);
  }

  return { sessionUser: session.user, profile };
}

/**
 * Wajib punya salah satu role yang diberikan.
 *
 * Contoh:
 *   await requireRole('manager', 'executive');
 */
export async function requireRole(...roles: string[]) {
  const { sessionUser, profile } = await requireUser();

  if (!roles.includes(profile.role)) {
    throw new AuthError(
      `Akses ditolak. Butuh role: ${roles.join(' atau ')}.`,
      403
    );
  }

  return { sessionUser, profile };
}

/**
 * Wajib punya akses ke campaign tertentu.
 *
 * Meniru `canEditCampaign` dari AuthProvider, tapi di server:
 *   1. Role global (admin/manager/finance/executive) -> semua campaign
 *   2. `user_campaigns.all_campaigns = true`            -> semua campaign
 *   3. Ada baris `user_campaigns` untuk campaign ini     -> campaign ini saja
 *
 * `user_campaigns.user_id` adalah UUID yang cocok dengan `profiles.id`.
 * Kedua sisi di-cast ke text supaya aman kalau `profiles.id` pernah
 * berisi string non-UUID.
 */
export async function requireCampaignAccess(campaignId: number) {
  const { sessionUser, profile } = await requireUser();

  if (GLOBAL_ROLES.includes(profile.role)) {
    return { sessionUser, profile };
  }

  const rows = (await db.execute(sql`
    SELECT 1
    FROM user_campaigns
    WHERE user_id::text = ${profile.id}
      AND (all_campaigns = true OR campaign_id = ${campaignId})
    LIMIT 1
  `)) as unknown as unknown[];

  if (rows.length === 0) {
    throw new AuthError('Anda tidak punya akses ke campaign ini.', 403);
  }

  return { sessionUser, profile };
}

/**
 * Pembungkus untuk server action yang mengembalikan `{ success, error }`
 * alih-alih melempar exception.
 *
 * Pakai ini di setiap action yang sudah mengembalikan objek — supaya
 * bentuk respons ke UI tidak berubah.
 */
export async function withGuard<T>(
  guard: () => Promise<T>
): Promise<{ success: true; data: T } | { success: false; error: string; code: 401 | 403 }> {
  try {
    return { success: true, data: await guard() };
  } catch (err) {
    if (err instanceof AuthError) {
      return { success: false, error: err.message, code: err.status };
    }
    console.error('[guard] error tak terduga:', err);
    return { success: false, error: 'Terjadi kesalahan di server.', code: 403 };
  }
}
