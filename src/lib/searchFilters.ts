import type { EnrichedScreening } from "@/lib/types";

/**
 * Minimal filter model for the "combine all cinemas" product: you pick which
 * theaters you care about and which day(s), and you get their showtimes. No
 * price, distance, format, or language filtering — deliberately minimalistic.
 * Pure functions with no server-only deps, so both server and client can use them.
 */

export interface SearchFilters {
  theaterIds?: string[]; // undefined / empty = all theaters
  dates?: string[]; // undefined / empty = all available days
  movieId?: string; // undefined = all movies
}

export function applyFilters(screenings: EnrichedScreening[], filters: SearchFilters): EnrichedScreening[] {
  return screenings.filter((s) => {
    if (filters.theaterIds && filters.theaterIds.length > 0 && !filters.theaterIds.includes(s.theaterId)) return false;
    if (filters.dates && filters.dates.length > 0 && !filters.dates.includes(s.date)) return false;
    if (filters.movieId && s.movieId !== filters.movieId) return false;
    return true;
  });
}

/** Chronological order — the only ordering the minimal UI needs. */
export function sortByTime(screenings: EnrichedScreening[]): EnrichedScreening[] {
  return [...screenings].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
