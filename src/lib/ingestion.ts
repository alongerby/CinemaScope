import type { CinemaDataProvider, FetchDatasetOptions } from "@/lib/providers/provider";
import { buildImportResult, emptyDataset } from "@/lib/providers/provider";
import { QuickbookProvider, RAV_HEN_CONFIG, YES_PLANET_CONFIG } from "@/lib/providers/quickbookProvider";
import { CinemaCityProvider } from "@/lib/providers/cinemaCityProvider";
import { MovielandProvider } from "@/lib/providers/movielandProvider";
import { HotCinemaProvider } from "@/lib/providers/hotCinemaProvider";
import { ensureProviderStatus, recordProviderResult } from "@/lib/providerStatus";
import { validateMovie, validateScreening, validateTheater } from "@/lib/validation";
import type { Movie, NormalizedDataset, ProviderImportResult, Screening, Theater } from "@/lib/types";

/**
 * Every data source is real, live, and pulled from the chain's own public
 * ticketing API. Providers run in priority order (lower first); their outputs
 * are merged and de-duplicated by id. Because the same film carries the same
 * movie id across providers (see movieKey.ts), a film playing at more than one
 * chain shows up once with its showtimes combined.
 *
 *   20  Yes Planet  (quickbook, tenant 10100)
 *   21  Rav-Hen     (quickbook, tenant 10104)
 *   30  Cinema City (/tickets API)
 *   40  Movieland   (/api/Events)
 *   45  Hot Cinema  (/tickets/movieevents)
 *
 * There is no demo/fabricated fallback: if a source is unreachable the app
 * shows real data from the others, never invented theaters or showtimes.
 */
function buildProviderRegistry(): CinemaDataProvider[] {
  return [
    new QuickbookProvider(YES_PLANET_CONFIG, 20),
    new QuickbookProvider(RAV_HEN_CONFIG, 21),
    new CinemaCityProvider(),
    new MovielandProvider(),
    new HotCinemaProvider(),
  ].sort((a, b) => a.priority - b.priority);
}

// Each provider already times out its individual HTTP requests, but
// Yes Planet/Rav-Hen make many of them sequentially (one per branch per day),
// so a provider's *overall* fetchDataset() has no cap. On a serverless host
// with a hard function execution limit (e.g. Netlify), one slow or
// half-blocked chain can eat the whole request budget and take everything
// after it down too. Cap each provider's total time so the run always
// finishes with whatever succeeded instead of stalling.
const PROVIDER_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export interface IngestionRunOutcome {
  dataset: NormalizedDataset;
  results: ProviderImportResult[];
  validationWarnings: string[];
}

/**
 * The same film can reach us from more than one chain with slightly different
 * completeness (e.g. only one provider supplies a poster or runtime). Rather
 * than keeping whichever provider happened to run first and silently dropping
 * the rest, fill in whatever the first-seen record is missing from later
 * duplicates — so a movie only ends up without a poster/runtime/genre if
 * *none* of the chains carrying it had that data.
 */
function fillMovieGaps(existing: Movie, incoming: Movie): void {
  if (!existing.posterUrl && incoming.posterUrl) existing.posterUrl = incoming.posterUrl;
  if (!existing.runtimeMinutes && incoming.runtimeMinutes) existing.runtimeMinutes = incoming.runtimeMinutes;
  if (existing.genre.length === 0 && incoming.genre.length > 0) {
    existing.genre = incoming.genre;
    existing.genreHe = incoming.genreHe;
  }
  if (!existing.synopsis && incoming.synopsis) existing.synopsis = incoming.synopsis;
  if (!existing.synopsisHe && incoming.synopsisHe) existing.synopsisHe = incoming.synopsisHe;
  if (!existing.trailerUrl && incoming.trailerUrl) existing.trailerUrl = incoming.trailerUrl;
  if (!existing.ageRating && incoming.ageRating) existing.ageRating = incoming.ageRating;
}

export async function runIngestion(options?: FetchDatasetOptions): Promise<IngestionRunOutcome> {
  const providers = buildProviderRegistry();
  const merged: NormalizedDataset = emptyDataset();
  const results: ProviderImportResult[] = [];
  const validationWarnings: string[] = [];

  const seenMovieIds = new Set<string>();
  const canonicalMovies = new Map<string, Movie>();
  const seenTheaterIds = new Set<string>();
  const seenScreeningKeys = new Set<string>();

  for (const provider of providers) {
    ensureProviderStatus(provider.id, provider.name, provider.sourceType, provider.priority);
    const startedAt = Date.now();

    if (!provider.isEnabled()) {
      const outcome = { dataset: emptyDataset(), warnings: [`${provider.name} disabled`], errors: [] };
      const result = buildImportResult(provider, outcome, startedAt, Date.now(), true);
      recordProviderResult(result);
      results.push(result);
      continue;
    }

    try {
      const outcome = await withTimeout(provider.fetchDataset(options), PROVIDER_TIMEOUT_MS, provider.name);

      const validMovies: Movie[] = [];
      for (const movie of outcome.dataset.movies) {
        const v = validateMovie(movie);
        validationWarnings.push(...v.warnings.map((w) => `[${provider.name}] ${w}`));
        if (!v.ok) {
          outcome.errors.push(...v.errors);
          continue;
        }
        if (seenMovieIds.has(movie.id)) {
          const existing = canonicalMovies.get(movie.id);
          if (existing) fillMovieGaps(existing, movie);
          continue;
        }
        seenMovieIds.add(movie.id);
        canonicalMovies.set(movie.id, movie);
        validMovies.push(movie);
      }

      const validTheaters: Theater[] = [];
      for (const theater of outcome.dataset.theaters) {
        if (seenTheaterIds.has(theater.id)) continue;
        const v = validateTheater(theater);
        validationWarnings.push(...v.warnings.map((w) => `[${provider.name}] ${w}`));
        if (!v.ok) {
          outcome.errors.push(...v.errors);
          continue;
        }
        seenTheaterIds.add(theater.id);
        validTheaters.push(theater);
      }

      const allMovieIds = new Set([...seenMovieIds, ...merged.movies.map((m) => m.id)]);
      const allTheaterIds = new Set([...seenTheaterIds, ...merged.theaters.map((t) => t.id)]);

      const validScreenings: Screening[] = [];
      for (const screening of outcome.dataset.screenings) {
        const v = validateScreening(screening, allMovieIds, allTheaterIds, seenScreeningKeys);
        validationWarnings.push(...v.warnings.map((w) => `[${provider.name}] ${w}`));
        if (!v.ok) {
          outcome.errors.push(...v.errors);
          continue;
        }
        validScreenings.push(screening);
      }

      merged.movies.push(...validMovies);
      merged.theaters.push(...validTheaters);
      merged.screenings.push(...validScreenings);

      const finishedAt = Date.now();
      const cleanedOutcome = {
        dataset: { movies: validMovies, theaters: validTheaters, screenings: validScreenings },
        warnings: outcome.warnings,
        errors: outcome.errors,
      };
      const result = buildImportResult(provider, cleanedOutcome, startedAt, finishedAt, outcome.errors.length === 0);
      recordProviderResult(result);
      results.push(result);
    } catch (err) {
      const finishedAt = Date.now();
      const outcome = { dataset: emptyDataset(), warnings: [], errors: [err instanceof Error ? err.message : String(err)] };
      const result = buildImportResult(provider, outcome, startedAt, finishedAt, false);
      recordProviderResult(result);
      results.push(result);
    }
  }

  return { dataset: merged, results, validationWarnings };
}
