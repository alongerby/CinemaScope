import { getChainById } from "@/lib/data/chains";
import { getCityById } from "@/lib/data/cities";
import type { EnrichedScreening, Movie, Screening, Theater } from "@/lib/types";

/**
 * Joins raw screenings (already fetched server-side and passed as plain props)
 * with static reference data (movie / theater / chain / city) for UI use.
 * No server-only deps, so it's safe to import from "use client" components.
 */
export function enrichScreeningsClient(screenings: Screening[], movies: Movie[], theaters: Theater[]): EnrichedScreening[] {
  const movieMap = new Map(movies.map((m) => [m.id, m]));
  const theaterMap = new Map(theaters.map((t) => [t.id, t]));

  const enriched: EnrichedScreening[] = [];
  for (const s of screenings) {
    const movie = movieMap.get(s.movieId);
    const theater = theaterMap.get(s.theaterId);
    const chain = getChainById(s.chainId);
    if (!movie || !theater || !chain) continue;
    // Fall back to a city synthesized from the theater's own data, so a branch
    // in a city not in the static list is never silently dropped.
    const city =
      getCityById(theater.cityId) ??
      (theater.cityNameHe
        ? { id: theater.cityId, name: theater.cityNameHe, nameHe: theater.cityNameHe, lat: theater.lat, lng: theater.lng, region: "" }
        : undefined);
    if (!city) continue;

    enriched.push({ ...s, movie, theater, chain, city });
  }
  return enriched;
}
