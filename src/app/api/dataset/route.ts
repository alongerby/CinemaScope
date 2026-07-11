import { NextResponse } from "next/server";
import { getAllScreenings, getAllTheaters, getPlayingMovies } from "@/lib/repository";

// Without this, Next.js can statically render this route at BUILD time (it has
// no dynamic functions like cookies()/headers()) and freeze its response
// forever — defeating the provider-level fetch cache entirely. Forcing dynamic
// rendering means every request actually calls into repository.ts, which then
// applies its own (much cheaper) freshness check.
export const dynamic = "force-dynamic";

/**
 * Single endpoint the client fetches once per browser tab session (see
 * DataProvider.tsx). The real freshness guarantee lives one layer down, in
 * each provider's own `fetch()` calls (Next.js's Data Cache, persisted by
 * Vercel across invocations) — so this is cheap after the first real fetch,
 * even on a cold serverless instance. Moving the fetch here (instead of in
 * the root layout) also means a full page reload no longer re-serializes the
 * whole dataset through the React/RSC tree on every request; the client
 * fetches it once as plain JSON and keeps it in memory for the rest of the
 * session.
 */
export async function GET() {
  const [movies, allTheaters, screenings] = await Promise.all([getPlayingMovies(), getAllTheaters(), getAllScreenings()]);

  // Only theaters that actually have upcoming showtimes are worth shipping to the client.
  const activeTheaterIds = new Set(screenings.map((s) => s.theaterId));
  const theaters = allTheaters.filter((t) => activeTheaterIds.has(t.id));

  return NextResponse.json({ movies, theaters, screenings });
}
