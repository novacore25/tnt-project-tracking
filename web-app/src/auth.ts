import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { db } from '@/db';
import { profiles, whitelistedEmails } from '@/db/schema';
import { eq } from 'drizzle-orm';

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
        // Check if email is in whitelisted_emails or profiles
        const [whitelist] = await db
          .select()
          .from(whitelistedEmails)
          .where(eq(whitelistedEmails.email, email))
          .limit(1);

        const [existingProfile] = await db
          .select()
          .from(profiles)
          .where(eq(profiles.email, email))
          .limit(1);

        // Determine default role: if whitelist specified, use it.
        // If known executive email or existing profile, use it; default to 'executive' for primary admin or 'staff'
        let role = whitelist?.role || existingProfile?.role;
        if (!role) {
          if (email === 'hibban25nzl@gmail.com' || email.includes('admin') || email.includes('executive')) {
            role = 'executive';
          } else {
            role = 'staff';
          }
        }
        const brandId = whitelist?.brandId ?? existingProfile?.brandId ?? null;

        if (existingProfile) {
          await db
            .update(profiles)
            .set({
              fullName: user.name || existingProfile.fullName,
              avatarUrl: user.image || existingProfile.avatarUrl,
              role,
              brandId,
              updatedAt: new Date(),
            })
            .where(eq(profiles.email, email));
        } else {
          await db.insert(profiles).values({
            id: user.id || crypto.randomUUID(),
            email,
            fullName: user.name || email.split('@')[0],
            avatarUrl: user.image || '',
            role,
            brandId,
          });
        }

        return true;
      } catch (err) {
        console.error('Error during signIn callback:', err);
        return true;
      }
    },
    async jwt({ token, user }) {
      if (user?.email || token?.email) {
        const email = (user?.email || token?.email as string).toLowerCase();
        try {
          const [profile] = await db
            .select()
            .from(profiles)
            .where(eq(profiles.email, email))
            .limit(1);

          if (profile) {
            token.id = profile.id;
            token.role = profile.role;
            token.brandId = profile.brandId;
            token.name = profile.fullName || token.name;
            token.picture = profile.avatarUrl || token.picture;
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
        (session.user as any).role = token.role || 'staff';
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
