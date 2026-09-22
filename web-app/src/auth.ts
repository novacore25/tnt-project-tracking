import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret:
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'b864a7f051e793e2b2fbcd76c382f7e2d93e2a0b1f3c8e4d6a5c7e9b0d2f4a6c',
  trustHost: true,
  providers: [
    Google({
      clientId:
        process.env.AUTH_GOOGLE_ID ||
        process.env.GOOGLE_CLIENT_ID ||
        '400463190439-5vtqank19facea6skccetajcf8nkvtgo.apps.googleusercontent.com',
      clientSecret:
        process.env.AUTH_GOOGLE_SECRET ||
        process.env.GOOGLE_CLIENT_SECRET ||
        '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',
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

        let role = whitelist?.role || existingProfile?.role;
        if (!role) {
          if (email === 'hibban25nzl@gmail.com' || email.includes('admin') || email.includes('executive')) {
            role = 'executive';
          } else {
            role = 'staff';
          }
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
              brand_id = ${brandId},
              updated_at = NOW()
            WHERE LOWER(email) = ${email}
          `).catch(() => {});
          const isValidUuid = (val?: any): boolean => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
          const newId = isValidUuid(user.id) ? user.id : crypto.randomUUID();
          await db.execute(sql`
            INSERT INTO profiles (id, email, nama, avatar_url, role, brand_id, status)
            VALUES (${newId}, ${email}, ${fullName}, ${avatarUrl}, ${role}, ${brandId}, 'active')
            ON CONFLICT (email) DO UPDATE SET
              nama = EXCLUDED.nama,
              avatar_url = EXCLUDED.avatar_url,
              role = EXCLUDED.role,
              updated_at = NOW()
          `).catch(() => {});
        }

        return true;
      } catch (err) {
        console.error('Error during signIn callback:', err);
        return true;
      }
    },
    async jwt({ token, user }) {
      if (user?.email || token?.email) {
        const email = (user?.email || (token?.email as string)).toLowerCase();
        try {
          const [profile] = (await db.execute(sql`
            SELECT id, nama, email, avatar_url, role, brand_id FROM profiles WHERE LOWER(email) = ${email} LIMIT 1
          `).catch(() => [])) as any[];

          if (profile) {
            token.id = profile.id;
            token.role = profile.role;
            token.brandId = profile.brand_id;
            token.name = profile.nama || token.name;
            token.picture = profile.avatar_url || token.picture;
          } else if (email === 'hibban25nzl@gmail.com') {
            token.role = 'executive';
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
        (session.user as any).role = token.role || (session.user.email === 'hibban25nzl@gmail.com' ? 'executive' : 'staff');
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
