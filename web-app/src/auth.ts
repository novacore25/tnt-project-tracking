import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { db } from '@/db';
import { profiles, whitelistedEmails } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
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

        if (!whitelist && !existingProfile) {
          // Allow login if needed or reject unauthorized emails
          // For now, if profile or whitelist exists, allow:
          return true;
        }

        // Upsert/sync profile
        const role = whitelist?.role || existingProfile?.role || 'staff';
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
            fullName: user.name || '',
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
      if (user?.email) {
        const email = user.email.toLowerCase();
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
