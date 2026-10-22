import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  fetchPendingScrapeTargetsAction,
  addScrapeTargetsAction,
  markScrapeTargetCompletedAction,
  clearScrapeTargetsAction,
} from '@/app/actions/creatorTargetActions';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const targets = await fetchPendingScrapeTargetsAction();
    return NextResponse.json({ success: true, targets, count: targets.length });
  } catch (err: unknown) {
    console.error('GET /api/creator-staging/targets error:', err);
    return NextResponse.json({ success: false, error: 'Gagal mengambil antrean target.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (body.action === 'clear') {
      await clearScrapeTargetsAction();
      return NextResponse.json({ success: true, message: 'Antrean target berhasil dikosongkan.' });
    }

    if (body.action === 'complete' && body.username) {
      await markScrapeTargetCompletedAction(body.username);
      return NextResponse.json({ success: true });
    }

    const res = await addScrapeTargetsAction({
      usernames: body.usernames || [],
      campaignId: body.campaignId || null,
      campaignName: body.campaignName || null,
    });
    return NextResponse.json(res);
  } catch (err: unknown) {
    console.error('POST /api/creator-staging/targets error:', err);
    return NextResponse.json({ success: false, error: 'Gagal menyimpan antrean target.' }, { status: 500 });
  }
}
