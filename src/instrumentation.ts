/**
 * Runs once when the Next.js server process starts (see
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation).
 * Used here to schedule the daily data refresh in-process, so a long-running
 * `next start` server re-scrapes automatically without needing an external
 * cron job. This is a convenience, not the primary mechanism — a real
 * deployment (serverless, or restarted often) should rely on the external
 * `/api/cron/refresh` route on an OS-level or hosted schedule instead, since
 * an in-process timer only fires while this exact process stays alive. See
 * README "Daily scrape scheduling" for both options.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const CHECK_INTERVAL_MS = 1000 * 60 * 60; // check hourly, only acts once genuinely stale
  const DAILY_MS = 1000 * 60 * 60 * 24;

  const { getLastIngestedAt, forceRefresh } = await import("@/lib/repository");

  setInterval(() => {
    const lastIngestedAt = getLastIngestedAt();
    const stale = !lastIngestedAt || Date.now() - lastIngestedAt > DAILY_MS;
    if (stale) {
      forceRefresh().catch((err) => {
        console.error("[daily-scheduler] scheduled refresh failed:", err);
      });
    }
  }, CHECK_INTERVAL_MS);
}
