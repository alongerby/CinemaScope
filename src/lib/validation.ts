import type { Movie, Screening, Theater } from "@/lib/types";

/**
 * Defensive checks run against every record before it enters the merged
 * dataset. Providers (especially scrapers) produce messy data; this module
 * is the single choke point that keeps garbage out.
 */

export interface ValidationOutcome {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidTime(time: string): boolean {
  return TIME_RE.test(time);
}

export function isValidDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const d = new Date(`${date}T00:00:00`);
  return !Number.isNaN(d.getTime());
}

export function isSaneName(name: string | undefined | null): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 120) return false;
  // Must contain at least one letter of any script (Hebrew, Latin, Cyrillic, …)
  // — rejects names that are only punctuation/numbers, without dropping
  // legitimate Russian- or Arabic-language showings.
  return /\p{L}/u.test(trimmed);
}

export function isValidPrice(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= 500;
}

export function validateScreening(
  screening: Screening,
  knownMovieIds: Set<string>,
  knownTheaterIds: Set<string>,
  seenKeys: Set<string>,
): ValidationOutcome {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!knownMovieIds.has(screening.movieId)) errors.push(`Unknown movieId "${screening.movieId}"`);
  if (!knownTheaterIds.has(screening.theaterId)) errors.push(`Unknown theaterId "${screening.theaterId}"`);
  if (!isValidDate(screening.date)) errors.push(`Invalid date "${screening.date}"`);
  if (!isValidTime(screening.time)) errors.push(`Invalid time "${screening.time}"`);
  if (!screening.bookingUrl) warnings.push("Missing booking URL");

  // Collapse identical showtimes (e.g. the same film at the same minute in two
  // halls, where the source doesn't distinguish format). Expected, not an error.
  const dedupeKey = `${screening.theaterId}|${screening.movieId}|${screening.date}|${screening.time}|${screening.format ?? ""}`;
  if (seenKeys.has(dedupeKey)) {
    return { ok: false, errors, warnings };
  }
  seenKeys.add(dedupeKey);

  return { ok: errors.length === 0, errors, warnings };
}

export function validateMovie(movie: Movie): ValidationOutcome {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isSaneName(movie.titleHe) && !isSaneName(movie.title)) errors.push(`Malformed movie title "${movie.title}"`);
  if (movie.runtimeMinutes > 400) warnings.push(`Suspicious runtime ${movie.runtimeMinutes}min`);
  return { ok: errors.length === 0, errors, warnings };
}

export function validateTheater(theater: Theater): ValidationOutcome {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isSaneName(theater.name)) errors.push(`Malformed theater name "${theater.name}"`);
  if (!isSaneName(theater.address)) warnings.push(`Missing/short address for "${theater.name}"`);
  if (Math.abs(theater.lat) > 90 || Math.abs(theater.lng) > 180) errors.push(`Invalid coordinates for "${theater.name}"`);
  return { ok: errors.length === 0, errors, warnings };
}
