import { runIngestion } from "@/lib/ingestion";
import { todayInIsrael } from "@/lib/datetime";
import type { Movie, NormalizedDataset, ProviderImportResult, Screening, Theater } from "@/lib/types";

export type { SearchFilters } from "@/lib/searchFilters";
export { applyFilters, sortByTime } from "@/lib/searchFilters";

/**
 * Single in-memory data layer the whole app reads from.
 *
 * If `DATASET_MIRROR_URL` is set, freshness is someone else's problem: a
 * trusted residential machine runs the full ingestion pipeline on a schedule
 * (see scripts/scrapeAll.ts) and publishes the merged result as one JSON
 * file, and this module just fetches that file instead of ever calling a
 * provider directly. That's what makes Movieland (and, in general, any
 * chain's bot-protection/IP-reputation gate) a non-issue in production — the
 * deployed app never talks to the chains at all.
 *
 * Without that env var (e.g. local dev), it falls back to running the live
 * ingestion pipeline itself, same as before — each provider's own `fetch()`
 * calls carry Next.js's fetch-level Data Cache (`next: { revalidate }`), so
 * that path is still reasonably fast on repeat requests.
 *
 * Either way, this module keeps a short in-memory reuse window on top, just
 * to avoid redoing the (cheap) merge/dedupe pass — or an extra mirror fetch —
 * on every single request within the same warm instance.
 */

const REUSE_WINDOW_MS = 1000 * 60 * 10; // re-merge at most once per 10 minutes per warm instance
const DATASET_MIRROR_URL = process.env.DATASET_MIRROR_URL;
const MIRROR_REVALIDATE_MS = 1000 * 60 * 60; // the mirror only changes once a day; an hour-scale revalidate is plenty fresh

interface MirroredDataset {
  dataset: NormalizedDataset;
  results: ProviderImportResult[];
  validationWarnings: string[];
  generatedAt: string;
}

function isMirroredDataset(value: unknown): value is MirroredDataset {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Boolean(v.dataset && typeof v.dataset === "object" && Array.isArray((v.dataset as NormalizedDataset).movies));
}

async function fetchMirror(forceFresh?: boolean): Promise<MirroredDataset> {
  const res = await fetch(DATASET_MIRROR_URL!, forceFresh ? { cache: "no-store" } : { next: { revalidate: Math.round(MIRROR_REVALIDATE_MS / 1000) } });
  if (!res.ok) throw new Error(`Dataset mirror returned HTTP ${res.status}`);
  const parsed: unknown = await res.json();
  if (!isMirroredDataset(parsed)) throw new Error("Dataset mirror returned an unexpected shape");
  return parsed;
}

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
    if (DATASET_MIRROR_URL) {
      const mirrored = await fetchMirror(options?.forceFresh);
      cachedDataset = mirrored.dataset;
      lastResults = mirrored.results;
      lastValidationWarnings = mirrored.validationWarnings;
      lastIngestedAt = Date.parse(mirrored.generatedAt) || Date.now();
    } else {
      const outcome = await runIngestion(options);
      cachedDataset = outcome.dataset;
      lastResults = outcome.results;
      lastValidationWarnings = outcome.validationWarnings;
      lastIngestedAt = Date.now();
    }
  })();

  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}

/**
 * Forces an immediate refresh, bypassing the reuse window. With
 * `DATASET_MIRROR_URL` set, this re-fetches the mirror (bypassing its cache
 * too) rather than live-scraping from wherever the app happens to be
 * deployed — the mirror is the source of truth in that mode. Used by the
 * admin "Refresh now" button and the cron route.
 */
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
