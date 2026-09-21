import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  // NextAuth v5 handles OAuth directly at /api/auth/callback/google.
  // Legacy /auth/callback redirects to home.
  return NextResponse.redirect(`${origin}/`);
}
