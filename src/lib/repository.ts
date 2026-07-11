import { runIngestion } from "@/lib/ingestion";
import { todayInIsrael } from "@/lib/datetime";
import type { Movie, NormalizedDataset, ProviderImportResult, Screening, Theater } from "@/lib/types";

export type { SearchFilters } from "@/lib/searchFilters";
export { applyFilters, sortByTime } from "@/lib/searchFilters";

/**
 * Single in-memory data layer the whole app reads from. The actual freshness
 * guarantee — "re-scrape each chain every 6-12h, don't hammer it on every
 * request" — lives in each provider's own `fetch()` calls, via Next.js's
 * fetch-level Data Cache (see the `next: { revalidate }` option in each
 * provider). That cache is what Vercel persists across serverless
 * invocations; this module doesn't need its own persisted snapshot on top of
 * it. What's here just avoids redoing the merge/dedupe pass (cheap, and
 * hits no network if the underlying fetches are still within their
 * revalidate window) on every single request within the same warm instance.
 */

const REUSE_WINDOW_MS = 1000 * 60; // re-merge at most once a minute per warm instance

let cachedDataset: NormalizedDataset | null = null;
let lastResults: ProviderImportResult[] = [];
let lastValidationWarnings: string[] = [];
let lastIngestedAt: number | null = null;
let inFlight: Promise<void> | null = null;

async function ensureFresh(options?: { forceFresh?: boolean }): Promise<void> {
  const stale = !cachedDataset || !lastIngestedAt || Date.now() - lastIngestedAt > REUSE_WINDOW_MS;
  if (!stale && !options?.forceFresh) return;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const outcome = await runIngestion(options);
    cachedDataset = outcome.dataset;
    lastResults = outcome.results;
    lastValidationWarnings = outcome.validationWarnings;
    lastIngestedAt = Date.now();
  })();

  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}

/** Forces an immediate full re-scrape, bypassing every provider's fetch cache too. Used by the admin "Refresh now" button and the cron route. */
export async function forceRefresh() {
  await ensureFresh({ forceFresh: true });
  return { results: lastResults, warnings: lastValidationWarnings, dataset: cachedDataset! };
}

export function getLastIngestionResults() {
  return lastResults;
}

export function getLastValidationWarnings() {
  return lastValidationWarnings;
}

export function getLastIngestedAt() {
  return lastIngestedAt;
}

async function dataset(): Promise<NormalizedDataset> {
  await ensureFresh();
  return cachedDataset!;
}

/** Screenings from today onward (Israel time) — past showtimes never reach the UI. */
async function upcomingScreenings(): Promise<Screening[]> {
  const today = todayInIsrael();
  return (await dataset()).screenings.filter((s) => s.date >= today);
}

export async function getAllMovies(): Promise<Movie[]> {
  return (await dataset()).movies;
}

/**
 * Movies with at least one *upcoming* showtime. A film whose run has ended
 * drops off the list, so nothing 404s when clicked and stale entries disappear.
 */
export async function getPlayingMovies(): Promise<Movie[]> {
  const ds = await dataset();
  const upcoming = await upcomingScreenings();
  const withScreenings = new Set(upcoming.map((s) => s.movieId));
  return ds.movies.filter((m) => withScreenings.has(m.id));
}

export async function getMovieById(id: string): Promise<Movie | undefined> {
  return (await dataset()).movies.find((m) => m.id === id);
}

export async function getAllTheaters(): Promise<Theater[]> {
  return (await dataset()).theaters;
}

export async function getTheaterById(id: string): Promise<Theater | undefined> {
  return (await dataset()).theaters.find((t) => t.id === id);
}

export async function getAllScreenings(): Promise<Screening[]> {
  return upcomingScreenings();
}
