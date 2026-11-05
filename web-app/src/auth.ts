import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

// Ensure hardcoded sslip.io does not force cross-domain redirects on custom domain
if (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.includes('sslip.io')) {
  delete process.env.NEXTAUTH_URL;
}
if (process.env.AUTH_URL && process.env.AUTH_URL.includes('sslip.io')) {
  delete process.env.AUTH_URL;
}

/**
 * Ambil kredensial dari environment, dan GAGAL KERAS kalau tidak ada.
 *
 * SEBELUMNYA file ini punya nilai cadangan literal, misalnya:
 *   secret: process.env.AUTH_SECRET || 'b864a7f0...'
 *
 * Itu berbahaya karena repo ini sudah public. Kode yang bisa dibaca siapa
 * pun bukan lagi secret: siapa pun yang membacanya bisa membuat cookie
 * session palsu dan menyamar sebagai user tanpa password.
 *
 * Yang lebih buruk, pola `||` itu fail-open: kalau environment variable
 * lupa diset, aplikasi tidak error - diam-diam memakai secret yang
 * sudah terekspos. Tidak ada yang ingat, tidak ada yang menyadari.
 *
 * Sekarang kalau kredensial hilang, aplikasi berhenti dengan pesan yang
 * jelas. Lebih baik tidak jalan daripada jalan dengan kunci yang publik.
 */
function requiredEnv(primary: string, ...alternatives: string[]): string {
  const names = [primary, ...alternatives];
  const value = names.map((n) => process.env[n]).find(Boolean);

  if (!value) {
    throw new Error(
      `[auth] ${primary} belum diset di environment.\n` +
        `Set di Coolify -> Application -> Environment Variables, lalu redeploy.\n` +
        `Alternatif yang diterima: ${names.join(', ')}\n` +
        `Jangan pernah menuliskan nilai cadangan di kode ini - repository ini public.`
    );
  }

  return value;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: requiredEnv('AUTH_SECRET', 'NEXTAUTH_SECRET'),
  trustHost: true,
  providers: [
    Google({
      clientId: requiredEnv('AUTH_GOOGLE_ID', 'GOOGLE_CLIENT_ID'),
      clientSecret: requiredEnv('AUTH_GOOGLE_SECRET', 'GOOGLE_CLIENT_SECRET'),
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const email = user.email.toLowerCase();

      try {
        const [whitelist] = (await db.execute(sql`
          SELECT * FROM whitelisted_emails WHERE LOWER(email) = ${email} LIMIT 1
        `).catch(() => [])) as any[];

        const [existingProfile] = (await db.execute(sql`
          SELECT * FROM profiles WHERE LOWER(email) = ${email} LIMIT 1
        `).catch(() => [])) as any[];

        // Blokir jika akun sudah di-nonaktifkan oleh admin/manager
        if (existingProfile && existingProfile.status === 'inactive') {
          console.warn(`[AUTH] Blocked inactive user login attempt: ${email}`);
          return false;
        }

        // Tentukan role: Whitelist -> Profil DB -> Default 'anggota'
        let role = whitelist?.role || existingProfile?.role;
        if (!role) {
          if (email === 'hibban25nzl@gmail.com') {
            role = 'executive';
          } else {
            role = 'anggota';
          }
        }

        // Tentukan status: Whitelist selalu 'approved', existing ikut DB, user baru default 'pending'
        let status = existingProfile?.status;
        if (whitelist) {
          status = 'approved';
        } else if (!status) {
          status = (email === 'hibban25nzl@gmail.com') ? 'approved' : 'pending';
        }

        const brandId = whitelist?.brand_id ?? existingProfile?.brand_id ?? null;
        const fullName = user.name || existingProfile?.nama || email.split('@')[0];
        const avatarUrl = user.image || existingProfile?.avatar_url || '';

        if (existingProfile) {
          await db.execute(sql`
            UPDATE profiles SET
              nama = ${fullName},
              avatar_url = ${avatarUrl},
              role = ${role},
              status = ${status},
              brand_id = ${brandId}
            WHERE LOWER(email) = ${email}
          `).catch((err) => console.error('Error updating existing profile:', err));
        } else {
          const isValidUuid = (val?: any): boolean => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
          const newId = isValidUuid(user.id) ? user.id : crypto.randomUUID();
          await db.execute(sql`
            INSERT INTO profiles (id, email, nama, avatar_url, role, brand_id, status)
            VALUES (${newId}::uuid, ${email}, ${fullName}, ${avatarUrl}, ${role}, ${brandId}, ${status})
            ON CONFLICT (email) DO UPDATE SET
              nama = EXCLUDED.nama,
              avatar_url = EXCLUDED.avatar_url,
              role = EXCLUDED.role,
              status = EXCLUDED.status
          `).catch((err) => console.error('Error inserting new profile:', err));
        }

        return true;
      } catch (err) {
        console.error('Error during signIn callback:', err);
        return false;
      }
    },
    async jwt({ token, user }) {
      if (user?.email || token?.email) {
        const email = (user?.email || (token?.email as string)).toLowerCase();
        try {
          const [profile] = (await db.execute(sql`
            SELECT id, nama, email, avatar_url, role, status, brand_id FROM profiles WHERE LOWER(email) = ${email} LIMIT 1
          `).catch(() => [])) as any[];

          if (profile) {
            token.id = profile.id;
            token.role = profile.role;
            token.status = profile.status;
            token.brandId = profile.brand_id;
            token.name = profile.nama || token.name;
            token.picture = profile.avatar_url || token.picture;
          } else if (email === 'hibban25nzl@gmail.com') {
            token.role = 'executive';
            token.status = 'approved';
          } else {
            token.role = 'anggota';
            token.status = 'pending';
          }
        } catch (err) {
          console.error('Error fetching profile in jwt callback:', err);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role || (session.user.email === 'hibban25nzl@gmail.com' ? 'executive' : 'anggota');
        (session.user as any).status = token.status || 'pending';
        (session.user as any).brandId = token.brandId || null;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
});
