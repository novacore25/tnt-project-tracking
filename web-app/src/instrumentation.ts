/**
 * Next.js Instrumentation Hook
 * Automatically runs once on Node.js server startup.
 * Provides built-in background scheduler with self-healing catch-up for TikTok Shop OpenAPI auto-sync
 * (Scheduled Slots: 07:00 WIB, 12:00 WIB, 15:00 WIB, 18:00 WIB)
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Initializing built-in TikTok auto-sync scheduler with self-healing catch-up...');

    const SCHEDULE_HOURS_WIB = [7, 12, 15, 18];
    let isRunning = false;
    let lastCheckedSlot = '';

    /**
     * Get the most recent expected schedule slot timestamp in UTC
     */
    const getLatestExpectedSlotTime = (now: Date) => {
      // WIB is UTC + 7
      const nowWib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
      const curHour = nowWib.getUTCHours();

      // Find highest schedule hour <= curHour
      const passedHoursToday = SCHEDULE_HOURS_WIB.filter(h => h <= curHour);

      if (passedHoursToday.length > 0) {
        const latestHour = Math.max(...passedHoursToday);
        const slotWib = new Date(nowWib);
        slotWib.setUTCHours(latestHour, 0, 0, 0);
        const slotUtc = new Date(slotWib.getTime() - 7 * 60 * 60 * 1000);
        return {
          slotUtc,
          slotHourWIB: latestHour,
          slotKey: `${slotWib.toISOString().split('T')[0]}_${latestHour}`
        };
      } else {
        // Before 07:00 WIB today -> latest slot was yesterday 18:00 WIB
        const yesterdayWib = new Date(nowWib.getTime() - 24 * 60 * 60 * 1000);
        yesterdayWib.setUTCHours(18, 0, 0, 0);
        const slotUtc = new Date(yesterdayWib.getTime() - 7 * 60 * 60 * 1000);
        return {
          slotUtc,
          slotHourWIB: 18,
          slotKey: `${yesterdayWib.toISOString().split('T')[0]}_18`
        };
      }
    };

    const checkAndRunSync = async () => {
      if (isRunning) return;

      try {
        const now = new Date();
        const { slotUtc, slotHourWIB, slotKey } = getLatestExpectedSlotTime(now);

        // If we already verified and synced this slot in this runtime session, skip
        if (lastCheckedSlot === slotKey) {
          return;
        }

        // Check last_synced_at from database
        const { db } = await import('@/db');
        const { sql } = await import('drizzle-orm');

        let lastSyncedAt: Date | null = null;
        try {
          const rows: any = await db.execute(sql`
            SELECT last_synced_at 
            FROM tiktok_authorizations 
            WHERE status = 'active' 
            ORDER BY id DESC 
            LIMIT 1
          `);
          if (rows && rows.length > 0 && rows[0].last_synced_at) {
            lastSyncedAt = new Date(rows[0].last_synced_at);
          }
        } catch (dbErr) {
          console.warn('[AutoSync Scheduler] Could not query last_synced_at:', dbErr);
        }

        // Determine if latest slot was missed:
        // If lastSyncedAt is null OR was before the latest expected slot time (with 2 minutes buffer)
        const isMissed = !lastSyncedAt || lastSyncedAt.getTime() < (slotUtc.getTime() - 2 * 60 * 1000);

        if (isMissed) {
          isRunning = true;
          lastCheckedSlot = slotKey;

          const nowWib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
          console.log(`[AutoSync Scheduler] 🚀 Triggering TikTok Sync for slot ${slotHourWIB}:00 WIB (Slot: ${slotKey}). Current WIB: ${nowWib.getUTCHours()}:${nowWib.getUTCMinutes().toString().padStart(2, '0')}. Last synced: ${lastSyncedAt ? lastSyncedAt.toISOString() : 'never'}...`);

          const { runTikTokAutoSync, SCHEDULED_SYNC_DAYS_BACK } = await import('@/lib/tiktokAutoSync');
          // Rentang dijadwalkan, bukan default 90 hari. Tanpa ini scheduler ini
          // menarik 90 hari penuh setiap 4 jam.
          const result = await runTikTokAutoSync({ triggerType: 'cron', daysBack: SCHEDULED_SYNC_DAYS_BACK });

          console.log(`[AutoSync Scheduler] ✅ Sync completed: ${result.success ? 'SUCCESS' : result.partial ? 'PARTIAL' : 'FAILED'} (Sales: ${result.salesUpserted}, Videos: ${result.videosUpserted}, Duration: ${result.durationMs}ms)${result.partial ? ' - ada bagian yang gagal, data belum lengkap' : ''}`);
        } else {
          // Already synced for this slot
          lastCheckedSlot = slotKey;
        }
      } catch (err: any) {
        console.error('[AutoSync Scheduler Error]:', err);
      } finally {
        isRunning = false;
      }
    };

    // Check 5 seconds after server startup
    setTimeout(() => {
      checkAndRunSync();
    }, 5000);

    // Periodic check every 1 minute
    setInterval(() => {
      checkAndRunSync();
    }, 60 * 1000);

    console.log('[Instrumentation] TikTok auto-sync self-healing scheduler active (07:00, 12:00, 15:00, 18:00 WIB with missed-slot catch-up).');
  }
}
