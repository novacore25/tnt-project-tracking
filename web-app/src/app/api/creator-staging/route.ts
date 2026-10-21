import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  fetchKnownCreatorUsernamesAction,
  upsertStagingCreatorsBatchAction,
  type StagingCreatorRecord,
} from '@/app/actions/creatorStagingActions';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await fetchKnownCreatorUsernamesAction();
    return NextResponse.json({ success: true, ...data });
  } catch (err: unknown) {
    console.error('GET /api/creator-staging error:', err);
    const message = err instanceof Error ? err.message : 'Gagal memuat Buku Catatan username.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as { items?: StagingCreatorRecord[] } | StagingCreatorRecord[];
    const items: StagingCreatorRecord[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.items)
      ? body.items
      : [];

    const result = await upsertStagingCreatorsBatchAction(items);
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('POST /api/creator-staging error:', err);
    const message = err instanceof Error ? err.message : 'Gagal menyimpan data ke Staging Creator.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
