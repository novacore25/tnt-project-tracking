import { NextRequest, NextResponse } from "next/server";
import { runTikTokAutoSync } from "@/lib/tiktokAutoSync";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const campaignId = body.campaignId ? Number(body.campaignId) : undefined;

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
