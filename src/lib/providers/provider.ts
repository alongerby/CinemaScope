import type { NormalizedDataset, ProviderImportResult, SourceType } from "@/lib/types";

/**
 * Every data source in the app — demo seed, free public API, or website
 * scraper — implements this interface. The ingestion pipeline (see
 * `src/lib/ingestion.ts`) calls providers in priority order and merges their
 * normalized output into one dataset. Swapping/adding a real data source
 * later means writing a new class that implements this interface; nothing
 * else in the app needs to change.
 */
export interface FetchDatasetOptions {
  /** Bypass Next.js's fetch-level Data Cache and hit the live source, ignoring the provider's normal TTL. Used by the admin "Refresh now" button and the cron route. */
  forceFresh?: boolean;
}

export interface CinemaDataProvider {
  id: string;
  name: string;
  sourceType: SourceType;
  /** Lower runs first. Live/free APIs should be lowest, demo fallback highest. */
  priority: number;
  isEnabled(): boolean;
  fetchDataset(options?: FetchDatasetOptions): Promise<ProviderFetchOutcome>;
}

export interface ProviderFetchOutcome {
  dataset: NormalizedDataset;
  warnings: string[];
  errors: string[];
}

export function emptyDataset(): NormalizedDataset {
  return { movies: [], theaters: [], screenings: [] };
}

export function buildImportResult(
  provider: Pick<CinemaDataProvider, "id" | "name" | "sourceType">,
  outcome: ProviderFetchOutcome,
  startedAt: number,
  finishedAt: number,
  success: boolean,
): ProviderImportResult {
  return {
    providerId: provider.id,
    providerName: provider.name,
    sourceType: provider.sourceType,
    success,
    moviesImported: outcome.dataset.movies.length,
    theatersImported: outcome.dataset.theaters.length,
    screeningsImported: outcome.dataset.screenings.length,
    warnings: outcome.warnings,
    errors: outcome.errors,
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date(finishedAt).toISOString(),
    durationMs: finishedAt - startedAt,
  };
}
