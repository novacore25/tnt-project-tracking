import { handlers } from '@/auth';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'campaign.tntkreatif.com';
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  process.env.AUTH_URL = `${proto}://${host}`;
  process.env.NEXTAUTH_URL = `${proto}://${host}`;
  return handlers.GET(req);
}

export async function POST(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'campaign.tntkreatif.com';
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  process.env.AUTH_URL = `${proto}://${host}`;
  process.env.NEXTAUTH_URL = `${proto}://${host}`;
  return handlers.POST(req);
}
