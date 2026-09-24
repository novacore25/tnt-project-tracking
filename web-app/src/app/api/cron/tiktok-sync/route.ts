import { NextRequest, NextResponse } from "next/server";
import { runTikTokAutoSync } from "@/lib/tiktokAutoSync";

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Up to 60 seconds execution

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

async function handleCron(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Optional secret check if CRON_SECRET is configured
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const urlSecret = req.nextUrl.searchParams.get("secret");
      if (urlSecret !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized: Invalid CRON_SECRET" }, { status: 401 });
      }
    }

    console.log("[TikTok Cron] Triggering scheduled auto-sync...");
    const result = await runTikTokAutoSync({ triggerType: 'cron' });

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error: any) {
    console.error("[TikTok Cron Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
