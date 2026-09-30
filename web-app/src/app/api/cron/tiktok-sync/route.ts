import { NextRequest, NextResponse } from "next/server";
import { runTikTokAutoSync } from "@/lib/tiktokAutoSync";

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Up to 60 seconds execution

/**
 * Rentang sync untuk cron terjadwal.
 *
 * Nilai ini yang dipakai tiap 4 jam, jadi dampaknya besar: 90 hari berarti
 * ~11.900 order per run, 7 hari berarti order 7 hari terakhir saja.
 * Order yang lebih lama dari itu tidak hilang - hanya tidak di-refresh ulang,
 * dan setiap 7 hari tetap akan tercakup.
 */
const CRON_DAYS_BACK = 7;

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
    // Cron hanya menarik 7 hari terakhir, bukan default 90 hari.
    //
    // Alasannya: order yang sudah ter-upsert tidak berubah kalau ditarik ulang,
    // sedangkan menarik 90 hari 4x sehari berarti sekitar 47.600 upsert per hari
    // untuk data yang benar-benar baru hanya 1 hari. Tarik terlalu banyak juga
    // mempercepat kena rate limit TikTok, dan sejak kode ini ditambah status
    // 'partial', rate limit yang kena akan terlihat di halaman Sinkronisasi.
    // TikTok sendiri menyarankan sinkronisasi inkremental harian dengan
    // overlap kecil.
    //
    // Sync manual (/api/sync/tiktok-manual) tetap memakai rentang penuh
    // (default 90 hari) untuk kebutuhan backfill.
    const result = await runTikTokAutoSync({ triggerType: 'cron', daysBack: CRON_DAYS_BACK });

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error: any) {
    console.error("[TikTok Cron Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
