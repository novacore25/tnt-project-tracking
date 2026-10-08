import { NextRequest, NextResponse } from "next/server";
import { runTikTokAutoSync, SCHEDULED_SYNC_DAYS_BACK } from "@/lib/tiktokAutoSync";
import { requireUserOrError } from "@/lib/guards";

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
    // Route ini hanya pemicu manual - scheduler otomatis ada di
    // instrumentation.ts, jadi sama-sama wajib login.
    const denied = await requireUserOrError();
    if (denied) return NextResponse.json({ error: denied.message }, { status: denied.status || 401 });

    const { db } = await import('@/db');
    const { sql } = await import('drizzle-orm');
    const authRows: any = await db.execute(sql`
      SELECT is_scheduler_paused FROM tiktok_authorizations WHERE status = 'active' ORDER BY id DESC LIMIT 1
    `);
    if (authRows && authRows[0]?.is_scheduler_paused) {
      return NextResponse.json({ 
        success: false, 
        message: 'Auto-sync scheduler sedang di-PAUSE oleh pengguna untuk melindungi tabel raw. Aktifkan kembali di menu Sinkronisasi TikTok jika ingin melanjutkan.' 
      }, { status: 400 });
    }

    console.log("[TikTok Cron] Triggering scheduled auto-sync...");
    const result = await runTikTokAutoSync({ triggerType: 'cron', daysBack: SCHEDULED_SYNC_DAYS_BACK });

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error: any) {
    console.error("[TikTok Cron Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
