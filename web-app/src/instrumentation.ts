/**
 * Next.js Instrumentation Hook
 * Automatically runs once on Node.js server startup.
 * Provides built-in background scheduler for TikTok Shop OpenAPI auto-sync
 * (07:00 WIB, 12:00 WIB, 15:00 WIB, 18:00 WIB)
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Initializing built-in TikTok auto-sync scheduler...');

    const SCHEDULE_HOURS_WIB = [7, 12, 15, 18];
    let lastRunDateHour = '';
    let isRunning = false;

    const checkAndRunSync = async (forceCatchUp = false) => {
      if (isRunning) return;

      try {
        const now = new Date();
        // WIB is UTC+7
        const wibTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
        const currentHourWIB = wibTime.getUTCHours();
        const currentMinuteWIB = wibTime.getUTCMinutes();
        const dateStr = wibTime.toISOString().split('T')[0];
        const slotKey = `${dateStr}_${currentHourWIB}`;

        const isScheduledHour = SCHEDULE_HOURS_WIB.includes(currentHourWIB);
        // Allow trigger in the first 10 minutes of the scheduled hour
        const isScheduledWindow = isScheduledHour && currentMinuteWIB <= 15;

        const shouldRun = (isScheduledWindow && lastRunDateHour !== slotKey) || forceCatchUp;

        if (shouldRun) {
          isRunning = true;
          lastRunDateHour = slotKey;
          console.log(`[AutoSync Scheduler] Running scheduled TikTok Sync at ${currentHourWIB}:${currentMinuteWIB.toString().padStart(2, '0')} WIB (Slot: ${slotKey})...`);

          const { runTikTokAutoSync } = await import('@/lib/tiktokAutoSync');
          const result = await runTikTokAutoSync({ triggerType: 'cron' });

          console.log(`[AutoSync Scheduler] Sync completed with status: ${result.success ? 'SUCCESS' : 'FAILED'} (Sales: ${result.salesUpserted}, Videos: ${result.videosUpserted})`);
        }
      } catch (err: any) {
        console.error('[AutoSync Scheduler Error]:', err);
      } finally {
        isRunning = false;
      }
    };

    // Initial check after 10 seconds of server startup
    setTimeout(() => {
      checkAndRunSync(false);
    }, 10000);

    // Periodic check every 1 minute
    setInterval(() => {
      checkAndRunSync(false);
    }, 60 * 1000);

    console.log('[Instrumentation] TikTok auto-sync scheduler registered (Active slots: 07:00, 12:00, 15:00, 18:00 WIB).');
  }
}
