import { NextRequest, NextResponse } from "next/server";
import { runTikTokAutoSync } from "@/lib/tiktokAutoSync";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const campaignId = body.campaignId ? Number(body.campaignId) : undefined;

    const result = await runTikTokAutoSync({
      campaignId,
      triggerType: 'manual'
    });

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error: any) {
    console.error("[TikTok Manual Sync Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
