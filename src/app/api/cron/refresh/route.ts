import { NextRequest, NextResponse } from "next/server";
import { forceRefresh } from "@/lib/repository";

/**
 * External trigger for the daily data refresh — the production-correct way
 * to run this on a schedule, since it works regardless of whether the
 * server process stays alive (unlike the in-process scheduler in
 * src/instrumentation.ts). Point any scheduler at this URL once a day:
 *
 *   - Windows Task Scheduler: run `curl -X POST http://localhost:3000/api/cron/refresh`
 *   - Linux/macOS cron:       0 4 * * * curl -X POST https://your-domain/api/cron/refresh
 *   - Hosted cron (e.g. a platform's scheduled functions / GitHub Actions schedule)
 *
 * If CRON_SECRET is set in the environment, callers must send it as
 * `Authorization: Bearer <secret>` (or `?secret=<secret>`) or they get a 401.
 * Unset by default so the MVP requires no configuration to run locally.
 */
function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;

  const header = req.headers.get("authorization");
  if (header === `Bearer ${expected}`) return true;

  const querySecret = req.nextUrl.searchParams.get("secret");
  return querySecret === expected;
}

async function handleRefresh(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const { results } = await forceRefresh();

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    providers: results.map((r) => ({
      id: r.providerId,
      success: r.success,
      movies: r.moviesImported,
      theaters: r.theatersImported,
      screenings: r.screeningsImported,
      errors: r.errors,
    })),
  });
}

export async function POST(req: NextRequest) {
  return handleRefresh(req);
}

export async function GET(req: NextRequest) {
  return handleRefresh(req);
}
