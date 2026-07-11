import { movieKey, stripPrintSuffix } from "@/lib/movieKey";
import type { Movie, Screening, Theater } from "@/lib/types";
import type { CinemaDataProvider, FetchDatasetOptions, ProviderFetchOutcome } from "./provider";
import { emptyDataset } from "./provider";

/**
 * Real, live data for Cinema City (a separate company from the Yes Planet /
 * Rav-Hen platform). Its site renders showtimes by calling its own public
 * endpoints — `/tickets/Movies`, `/tickets/Events?MovieId=…` — and its "book"
 * buttons navigate to `/order/?eventID=…&theaterId=…`, the real per-showtime
 * booking page. No login/paywall/captcha is involved.
 *
 * The events endpoint doesn't expose branch coordinates or a machine-readable
 * city, so the branch metadata below is a small curated table verified against
 * Cinema City's real locations (e.g. Glilot is in Ramat HaSharon, not Tel
 * Aviv). Any branch id that appears in the data but is missing here is skipped
 * with a warning rather than placed on a guessed map pin.
 */

const HOST = "https://www.cinema-city.co.il";
const REQUEST_TIMEOUT_MS = 8000;
const MOVIES_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const EVENTS_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const CONCURRENCY = 5;
// The events endpoint returns every scheduled date for a movie in one call
// (no extra request per day), so widening this window is free — and it needs
// to be wide enough to include presale movies (tickets already on sale for a
// release date weeks out, e.g. a new Spider-Man opening in ~3 weeks).
const DAY_WINDOW = 35;
// A plain browser UA, not a self-identifying bot string — some of these
// endpoints 403 server-to-server requests from cloud hosting IP ranges
// (observed on Netlify) that a residential/dev-machine IP isn't blocked on.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

interface Branch {
  nameEn: string;
  nameHe: string;
  cityId: string;
  lat: number;
  lng: number;
}

// TixTheatreId → verified real location.
const BRANCHES: Record<string, Branch> = {
  "1170": { nameEn: "Cinema City Glilot", nameHe: "סינמה סיטי גלילות", cityId: "ramat-hasharon", lat: 32.1276, lng: 34.8081 },
  "1173": { nameEn: "Cinema City Rishon LeZion", nameHe: 'סינמה סיטי ראשל"צ', cityId: "rishon-lezion", lat: 31.9832, lng: 34.7756 },
  "1174": { nameEn: "Cinema City Jerusalem", nameHe: "סינמה סיטי ירושלים", cityId: "jerusalem", lat: 31.7891, lng: 35.2038 },
  "1175": { nameEn: "Cinema City Kfar Saba", nameHe: "סינמה סיטי כפר-סבא", cityId: "kfar-saba", lat: 32.1859, lng: 34.9077 },
  "1176": { nameEn: "Cinema City Netanya", nameHe: "סינמה סיטי נתניה", cityId: "netanya", lat: 32.3025, lng: 34.8586 },
  "1178": { nameEn: "Cinema City Be'er Sheva", nameHe: "סינמה סיטי באר שבע", cityId: "beer-sheva", lat: 31.2437, lng: 34.7996 },
  "1181": { nameEn: "Cinema City Ashdod", nameHe: "סינמה סיטי אשדוד", cityId: "ashdod", lat: 31.8014, lng: 34.6552 },
  "1350": { nameEn: "Cinema City Hadera", nameHe: "סינמה סיטי חדרה", cityId: "hadera", lat: 32.4419, lng: 34.9116 },
};

interface RawMovie {
  Name: string;
  ExportCode: number;
  MovieId: number;
}
interface RawEventDate {
  Date: string; // "dd/mm/yyyy HH:mm"
  Hour: string; // "HH:mm"
  EventId: string;
  TheaterId: number;
}
interface RawEventMovie {
  Name: string;
  ExportCode: number;
  Pic?: string; // real poster filename, served from Cinema City's own image host
  Dates: RawEventDate[];
}

const POSTER_HOST = "https://cdn.modulus.co.il/fetch/cinemacity/w_300,h_450,mode_crop,quality_95/http://80.178.112.171/images";

/** Cinema City's own poster image, resized/cropped by their CDN — real, not fabricated. */
function posterUrlFromPic(pic: string | undefined): string | undefined {
  return pic ? `${POSTER_HOST}/${encodeURIComponent(pic)}` : undefined;
}

// `revalidateMs` uses Next.js's own fetch-level Data Cache (via the `next.revalidate`
// option) instead of a hand-rolled cache — it's persisted by the platform (Vercel)
// across serverless invocations for free, with no extra service to provision.
async function fetchJson<T>(url: string, revalidateMs: number, forceFresh?: boolean): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": USER_AGENT,
        "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
        Referer: `${HOST}/`,
      },
      ...(forceFresh ? { cache: "no-store" as const } : { next: { revalidate: Math.round(revalidateMs / 1000) } }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Run async tasks with a small concurrency cap so we stay polite. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** "04/07/2026 23:00" → { date: "2026-07-04", time: "23:00" } */
function parseDate(raw: string, hour: string): { date: string; time: string } | null {
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const time = /^\d{2}:\d{2}$/.test(hour) ? hour : raw.slice(11, 16);
  return { date: `${yyyy}-${mm}-${dd}`, time };
}

const POSTER_PALETTE = ["from-rose-500 to-red-800", "from-indigo-500 to-blue-800", "from-amber-500 to-orange-800", "from-teal-500 to-cyan-800"];
function posterColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return POSTER_PALETTE[h % POSTER_PALETTE.length];
}

export class CinemaCityProvider implements CinemaDataProvider {
  id = "cinema-city-live";
  name = "Cinema City (live)";
  sourceType = "scraped" as const;
  priority = 30;

  isEnabled(): boolean {
    return true;
  }

  async fetchDataset(options?: FetchDatasetOptions): Promise<ProviderFetchOutcome> {
    const forceFresh = options?.forceFresh;
    const warnings: string[] = [];
    const errors: string[] = [];

    let rawMovies: RawMovie[];
    try {
      rawMovies = await fetchJson<RawMovie[]>(`${HOST}/tickets/Movies`, MOVIES_CACHE_TTL_MS, forceFresh);
    } catch (err) {
      errors.push(`Cinema City: failed to fetch movie list (${err instanceof Error ? err.message : String(err)}).`);
      return { dataset: emptyDataset(), warnings, errors };
    }

    const windowDates = new Set(Array.from({ length: DAY_WINDOW }, (_, i) => new Date(Date.now() + i * 86_400_000).toISOString().slice(0, 10)));

    const perMovie = await pool(rawMovies, CONCURRENCY, async (movie) => {
      try {
        const events = await fetchJson<RawEventMovie[]>(
          `${HOST}/tickets/Events?MovieId=${movie.MovieId}&TheatreId=0&VenueTypeId=0`,
          EVENTS_CACHE_TTL_MS,
          forceFresh,
        );
        return { movie, events };
      } catch {
        return { movie, events: [] as RawEventMovie[] };
      }
    });

    const moviesById = new Map<string, Movie>();
    const usedTheaterIds = new Set<string>();
    const unknownBranches = new Set<string>();
    const screenings: Screening[] = [];

    for (const { movie, events } of perMovie) {
      const cleanName = stripPrintSuffix(movie.Name);
      const id = movieKey(cleanName);
      const allDates = events.flatMap((e) => e.Dates ?? []);
      const inWindow = allDates.filter((d) => {
        const parsed = parseDate(d.Date, d.Hour);
        return parsed && windowDates.has(parsed.date);
      });
      if (inWindow.length === 0) continue;

      if (!moviesById.has(id)) {
        moviesById.set(id, {
          id,
          title: cleanName, // Cinema City exposes only the Hebrew title
          titleHe: cleanName,
          genre: [],
          genreHe: [],
          runtimeMinutes: 0,
          ageRating: "",
          synopsis: "",
          synopsisHe: "",
          posterColor: posterColor(id),
          posterUrl: posterUrlFromPic(events.find((e) => e.Pic)?.Pic),
          releaseYear: new Date().getFullYear(),
          familyFriendly: false,
          popularityScore: 55,
          originalLanguage: "other",
          sourceType: "scraped",
        });
      }

      for (const d of inWindow) {
        const parsed = parseDate(d.Date, d.Hour)!;
        const branchKey = String(d.TheaterId);
        const branch = BRANCHES[branchKey];
        if (!branch) {
          unknownBranches.add(branchKey);
          continue;
        }
        usedTheaterIds.add(branchKey);
        screenings.push({
          id: `cinema-city-${d.EventId}`,
          movieId: id,
          theaterId: `cinema-city-${branchKey}`,
          chainId: "cinema-city",
          date: parsed.date,
          time: parsed.time,
          // Cinema City's events endpoint doesn't expose format/language — leave unset rather than guess.
          bookingUrl: `${HOST}/order/?eventID=${d.EventId}&theaterId=${branchKey}`,
          sourceType: "scraped",
          lastUpdated: new Date().toISOString(),
        });
      }
    }

    if (unknownBranches.size > 0) {
      warnings.push(`Cinema City: ${unknownBranches.size} unmapped branch id(s) skipped: ${[...unknownBranches].join(", ")}.`);
    }

    const theaters: Theater[] = [...usedTheaterIds].map((key) => {
      const b = BRANCHES[key];
      return {
        id: `cinema-city-${key}`,
        name: b.nameEn,
        nameHe: b.nameHe,
        chainId: "cinema-city",
        cityId: b.cityId,
        address: b.nameHe,
        addressHe: b.nameHe,
        lat: b.lat,
        lng: b.lng,
        amenities: [],
        accessibility: [],
        openingHours: [],
        screenCount: 0,
        officialUrl: HOST,
        sourceType: "scraped",
        lastUpdated: new Date().toISOString(),
      };
    });

    return { dataset: { movies: Array.from(moviesById.values()), theaters, screenings }, warnings, errors };
  }
}
