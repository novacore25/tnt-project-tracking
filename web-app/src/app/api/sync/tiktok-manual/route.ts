import { NextRequest, NextResponse } from "next/server";
import { runTikTokAutoSync } from "@/lib/tiktokAutoSync";
import { requireUserOrError } from "@/lib/guards";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const denied = await requireUserOrError();
    if (denied) return NextResponse.json({ error: denied.message }, { status: denied.status || 401 });

    const { db } = await import('@/db');
    const { sql } = await import('drizzle-orm');
    const authRows: any = await db.execute(sql`
      SELECT is_scheduler_paused FROM tiktok_authorizations WHERE status = 'active' ORDER BY id DESC LIMIT 1
    `);
    if (authRows && authRows[0]?.is_scheduler_paused) {
      return NextResponse.json({ 
        error: 'Sinkronisasi manual ditolak karena sistem sedang di-PAUSE. Aktifkan kembali jadwal terlebih dahulu jika memang berniat menarik data.' 
      }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const campaignId = body.campaignId ? Number(body.campaignId) : undefined;
    const daysBack = body.daysBack ? Number(body.daysBack) : undefined;
    const startDate = body.startDate ? String(body.startDate) : undefined;
    const endDate = body.endDate ? String(body.endDate) : undefined;
    const month = body.month ? String(body.month) : undefined;

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const sendEvent = async (data: any) => {
      try {
        await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      } catch (e) {
        // client disconnected
      }
    };

    // Run async sync in background writing to stream
    (async () => {
      try {
        const result = await runTikTokAutoSync({
          campaignId,
          daysBack,
          startDate,
          endDate,
          month,
          triggerType: 'manual',
          onProgress: (progress) => {
            sendEvent({ type: 'progress', ...progress });
          }
        });

        await sendEvent({ type: 'complete', result });
      } catch (err: any) {
        await sendEvent({ type: 'error', message: err.message });
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      }
    });
  } catch (error: any) {
    console.error("[TikTok Manual Sync Route Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
