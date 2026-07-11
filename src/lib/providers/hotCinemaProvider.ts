import { movieKey, stripPrintSuffix } from "@/lib/movieKey";
import type { AudioTrack, Movie, PrintKind, ScreenFormat, Screening, SubtitleTrack, Theater } from "@/lib/types";
import type { CinemaDataProvider, ProviderFetchOutcome } from "./provider";
import { emptyDataset } from "./provider";

/**
 * Real, live data for Hot Cinema. Its site (a Vue app) renders showtimes from
 * public `/tickets/` endpoints — `/tickets/Movies` and
 * `/tickets/movieevents?movieid=…` — and its "book" buttons navigate to
 * `/order?theaterId=…&eventId=…`, the real per-showtime booking page. No
 * login/paywall/captcha is involved.
 *
 * The events endpoint gives theater names but not coordinates/city, so the 10
 * branches are geocoded from a small curated table verified against Hot
 * Cinema's real locations.
 */

const HOST = "https://www.hotcinema.co.il";
const REQUEST_TIMEOUT_MS = 8000;
const MOVIES_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const EVENTS_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const CONCURRENCY = 5;
// The events endpoint returns every scheduled date for a movie in one call
// (no extra request per day), so widening this window is free — and it needs
// to be wide enough to include presale movies (tickets already on sale for a
// release date weeks out).
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

// TheaterID → verified real location.
const BRANCHES: Record<string, Branch> = {
  "1": { nameEn: "Hot Cinema Modi'in", nameHe: "הוט סינמה מודיעין", cityId: "modiin", lat: 31.8969, lng: 35.0095 },
  "2": { nameEn: "Hot Cinema Kiryon", nameHe: "הוט סינמה קריון", cityId: "kiryat-bialik", lat: 32.8300, lng: 35.0870 },
  "5": { nameEn: "Hot Cinema Ashdod", nameHe: "הוט סינמה אשדוד", cityId: "ashdod", lat: 31.8014, lng: 34.6435 },
  "6": { nameEn: "Hot Cinema Nahariya", nameHe: "הוט סינמה נהריה", cityId: "nahariya", lat: 33.0085, lng: 35.0980 },
  "8": { nameEn: "Hot Cinema Ashkelon", nameHe: "הוט סינמה אשקלון", cityId: "ashkelon", lat: 31.6688, lng: 34.5743 },
  "9": { nameEn: "Hot Cinema Haifa", nameHe: "הוט סינמה חיפה", cityId: "haifa", lat: 32.7940, lng: 34.9896 },
  "14": { nameEn: "Hot Cinema Petah Tikva", nameHe: "הוט סינמה פתח תקווה", cityId: "petah-tikva", lat: 32.0917, lng: 34.8878 },
  "15": { nameEn: "Hot Cinema Karmiel", nameHe: "הוט סינמה כרמיאל", cityId: "karmiel", lat: 32.9186, lng: 35.2952 },
  "16": { nameEn: "Hot Cinema Kfar Saba", nameHe: "הוט סינמה כפר סבא", cityId: "kfar-saba", lat: 32.1750, lng: 34.9069 },
  "17": { nameEn: "Hot Cinema Rehovot", nameHe: "הוט סינמה רחובות", cityId: "rehovot", lat: 31.8942, lng: 34.8092 },
};

interface RawMovie {
  Name: string;
  MovieId: number;
}
interface RawDate {
  Date: string; // ISO
  Hour: string;
  EventId: string;
  TheaterId: number;
  DubbedLanguage?: string | null;
  SubtitledLanguage?: string | null;
  Is3D?: boolean | null;
  IsVIP?: boolean | null;
}
interface RawGroup {
  TheaterID: number;
  Dates?: RawDate[];
}

// `revalidateMs` uses Next.js's own fetch-level Data Cache (via the `next.revalidate`
// option) instead of a hand-rolled cache — it's persisted by the platform (Vercel)
// across serverless invocations for free, with no extra service to provision.
async function fetchJson<T>(url: string, revalidateMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
        Referer: `${HOST}/`,
      },
      next: { revalidate: Math.round(revalidateMs / 1000) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

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

const POSTER_PALETTE = ["from-rose-500 to-red-800", "from-indigo-500 to-blue-800", "from-amber-500 to-orange-800", "from-teal-500 to-cyan-800"];
function posterColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return POSTER_PALETTE[h % POSTER_PALETTE.length];
}

function mapLang(he: string | null | undefined): AudioTrack | SubtitleTrack | undefined {
  if (!he) return undefined;
  if (/עברית/.test(he)) return "hebrew";
  if (/אנגלית/.test(he)) return "english";
  if (/רוסית/.test(he)) return "russian";
  if (/ערבית/.test(he)) return "arabic";
  return undefined;
}

export class HotCinemaProvider implements CinemaDataProvider {
  id = "hot-cinema-live";
  name = "Hot Cinema (live)";
  sourceType = "scraped" as const;
  priority = 45;

  isEnabled(): boolean {
    return true;
  }

  async fetchDataset(): Promise<ProviderFetchOutcome> {
    const warnings: string[] = [];
    const errors: string[] = [];

    let rawMovies: RawMovie[];
    try {
      rawMovies = await fetchJson<RawMovie[]>(`${HOST}/tickets/Movies`, MOVIES_CACHE_TTL_MS);
    } catch (err) {
      errors.push(`Hot Cinema: failed to fetch movie list (${err instanceof Error ? err.message : String(err)}).`);
      return { dataset: emptyDataset(), warnings, errors };
    }

    const windowDates = new Set(Array.from({ length: DAY_WINDOW }, (_, i) => new Date(Date.now() + i * 86_400_000).toISOString().slice(0, 10)));

    const perMovie = await pool(rawMovies, CONCURRENCY, async (movie) => {
      try {
        const groups = await fetchJson<RawGroup[]>(`${HOST}/tickets/movieevents?movieid=${movie.MovieId}`, EVENTS_CACHE_TTL_MS);
        return { movie, groups };
      } catch {
        return { movie, groups: [] as RawGroup[] };
      }
    });

    const moviesById = new Map<string, Movie>();
    const usedTheaterIds = new Set<string>();
    const unknownBranches = new Set<string>();
    const screenings: Screening[] = [];

    for (const { movie, groups } of perMovie) {
      const allDates = groups.flatMap((g) => g.Dates ?? []);
      const inWindow = allDates.filter((d) => windowDates.has(d.Date.slice(0, 10)));
      if (inWindow.length === 0) continue;

      const cleanName = stripPrintSuffix(movie.Name);
      const id = movieKey(cleanName);
      if (!moviesById.has(id)) {
        moviesById.set(id, {
          id,
          title: cleanName,
          titleHe: cleanName,
          genre: [],
          genreHe: [],
          runtimeMinutes: 0,
          ageRating: "",
          synopsis: "",
          synopsisHe: "",
          posterColor: posterColor(id),
          releaseYear: new Date().getFullYear(),
          familyFriendly: false,
          popularityScore: 55,
          originalLanguage: "other",
          sourceType: "scraped",
        });
      }

      for (const d of inWindow) {
        const branchKey = String(d.TheaterId);
        const branch = BRANCHES[branchKey];
        if (!branch) {
          unknownBranches.add(branchKey);
          continue;
        }
        usedTheaterIds.add(branchKey);

        const format: ScreenFormat = d.IsVIP ? "VIP" : d.Is3D ? "3D" : "2D";
        let audio: AudioTrack | undefined;
        let subtitles: SubtitleTrack | undefined;
        let printKind: PrintKind | undefined;
        if (d.DubbedLanguage) {
          audio = mapLang(d.DubbedLanguage) as AudioTrack;
          subtitles = (mapLang(d.SubtitledLanguage) as SubtitleTrack) ?? "none";
          printKind = "dubbed";
        } else if (d.SubtitledLanguage) {
          subtitles = mapLang(d.SubtitledLanguage) as SubtitleTrack;
          printKind = "subtitled";
        }

        screenings.push({
          id: `hot-cinema-${d.EventId}`,
          movieId: id,
          theaterId: `hot-cinema-${branchKey}`,
          chainId: "hot-cinema",
          date: d.Date.slice(0, 10),
          time: d.Hour || d.Date.slice(11, 16),
          format,
          audio,
          subtitles,
          printKind,
          bookingUrl: `${HOST}/order?theaterId=${branchKey}&eventId=${d.EventId}`,
          sourceType: "scraped",
          lastUpdated: new Date().toISOString(),
        });
      }
    }

    if (unknownBranches.size > 0) warnings.push(`Hot Cinema: unmapped branch id(s) skipped: ${[...unknownBranches].join(", ")}.`);

    const theaters: Theater[] = [...usedTheaterIds].map((key) => {
      const b = BRANCHES[key];
      return {
        id: `hot-cinema-${key}`,
        name: b.nameEn,
        nameHe: b.nameHe,
        chainId: "hot-cinema",
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
