import { runIngestion } from "@/lib/ingestion";
import { getCached, setCached } from "@/lib/cache";
import { todayInIsrael } from "@/lib/datetime";
import type { Movie, NormalizedDataset, ProviderImportResult, Screening, Theater } from "@/lib/types";

export type { SearchFilters } from "@/lib/searchFilters";
export { applyFilters, sortByTime } from "@/lib/searchFilters";

/**
 * Single in-memory data layer the whole app reads from, backed by a full
 * re-scrape/re-ingest cadence of once per day — matching the "daily scrape"
 * requirement rather than re-hitting live sources on every request. The
 * merged result is also persisted via `@/lib/cache` (Netlify Blobs in
 * production, a local `.cache/` file in dev) so a process restart — or, on
 * Netlify, the *next* serverless invocation, which is almost never the same
 * process — doesn't force an immediate re-scrape; it just picks up wherever
 * the last run left off. `/admin/import`'s "Refresh now" button and the
 * `/api/cron/refresh` route both bypass this TTL on demand — see
 * `src/instrumentation.ts` for the in-process scheduler that also calls it
 * automatically once a day while the server stays running (long-lived
 * processes only; a no-op on serverless).
 */

const INGESTION_TTL_MS = 1000 * 60 * 60 * 24;
const SNAPSHOT_CACHE_KEY = "daily-ingestion-snapshot";

interface Snapshot {
  dataset: NormalizedDataset;
  results: ProviderImportResult[];
  validationWarnings: string[];
  ingestedAt: number;
}

let cachedDataset: NormalizedDataset | null = null;
let lastResults: ProviderImportResult[] = [];
let lastValidationWarnings: string[] = [];
let lastIngestedAt: number | null = null;
let inFlight: Promise<void> | null = null;
let triedDiskLoad = false;

async function loadSnapshotIfFresh(): Promise<boolean> {
  if (triedDiskLoad) return false;
  triedDiskLoad = true;
  const snapshot = await getCached<Snapshot>(SNAPSHOT_CACHE_KEY, INGESTION_TTL_MS);
  if (!snapshot) return false;
  cachedDataset = snapshot.dataset;
  lastResults = snapshot.results;
  lastValidationWarnings = snapshot.validationWarnings;
  lastIngestedAt = snapshot.ingestedAt;
  return true;
}

async function ensureFresh(): Promise<void> {
  if (!cachedDataset) await loadSnapshotIfFresh();

  const stale = !cachedDataset || !lastIngestedAt || Date.now() - lastIngestedAt > INGESTION_TTL_MS;
  if (!stale) return;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const outcome = await runIngestion();
    cachedDataset = outcome.dataset;
    lastResults = outcome.results;
    lastValidationWarnings = outcome.validationWarnings;
    lastIngestedAt = Date.now();
    await setCached<Snapshot>(
      SNAPSHOT_CACHE_KEY,
      { dataset: cachedDataset, results: lastResults, validationWarnings: lastValidationWarnings, ingestedAt: lastIngestedAt },
      INGESTION_TTL_MS,
    );
  })();

  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}

/** Forces an immediate full re-ingestion, bypassing the daily TTL. Used by the admin "Refresh now" button and the cron route. */
export async function forceRefresh() {
  cachedDataset = null;
  lastIngestedAt = null;
  triedDiskLoad = true; // skip the snapshot on a forced refresh — we want a genuinely fresh run
  await ensureFresh();
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
