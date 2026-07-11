import { movieKey, stripPrintSuffix } from "@/lib/movieKey";
import type { AudioTrack, Movie, PrintKind, ScreenFormat, Screening, SubtitleTrack, Theater } from "@/lib/types";
import type { CinemaDataProvider, ProviderFetchOutcome } from "./provider";
import { emptyDataset } from "./provider";

/**
 * Real, live data for Movieland. Its site (a Vue app) renders showtimes from a
 * single public JSON endpoint — `/api/Events` — which returns every now-playing
 * movie with full metadata (poster, genres, runtime, rating, trailer) and each
 * showtime's date/hall/format/language plus a real booking link on Movieland's
 * ticketing provider (`ecom.biggerpicture.ai/site/{theaterId}?code=...`). No
 * login/paywall/captcha is involved.
 *
 * The endpoint returns theater names but not coordinates/city, so the 6
 * branches are geocoded from a small curated table verified against
 * Movieland's real locations.
 */

const HOST = "https://www.movieland.co.il";
const REQUEST_TIMEOUT_MS = 8000;
const EVENTS_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
// /api/Events returns every scheduled date for a movie in one call (no extra
// request per day), so widening this window is free — and it needs to be wide
// enough to include presale movies (tickets already on sale for a release
// date weeks out, e.g. a new Spider-Man opening in ~3 weeks).
const DAY_WINDOW = 35;
// A plain browser UA, not a self-identifying bot string — needed because this
// endpoint 403s server-to-server requests from some cloud hosting IP ranges
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

// TheaterId → verified real location.
const BRANCHES: Record<string, Branch> = {
  "1290": { nameEn: "Movieland Karmiel", nameHe: "מובילנד כרמיאל", cityId: "karmiel", lat: 32.9186, lng: 35.3047 },
  "1291": { nameEn: "Movieland Haifa", nameHe: "מובילנד חיפה", cityId: "haifa", lat: 32.7940, lng: 35.0043 },
  "1292": { nameEn: "Movieland Netanya", nameHe: "מובילנד נתניה", cityId: "netanya", lat: 32.3025, lng: 34.8586 },
  "1293": { nameEn: "Movieland HaTzuk Tel Aviv", nameHe: 'מובילנד הצוק ת"א', cityId: "tel-aviv", lat: 32.1177, lng: 34.7955 },
  "1294": { nameEn: "Movieland Afula", nameHe: "מובילנד עפולה", cityId: "afula", lat: 32.6078, lng: 35.2897 },
  "1295": { nameEn: "Movieland Azrieli Tel Aviv", nameHe: 'מובילנד עזריאלי ת"א', cityId: "tel-aviv", lat: 32.0745, lng: 34.7918 },
};

interface RawDate {
  Date: string; // ISO "2026-07-08T10:30:00"
  Hour: string;
  EventId: string;
  TheaterId: number;
  TheaterName: string;
  Dubbed?: boolean | null;
  ThreeD?: boolean | null;
  IsVip?: boolean | null;
  HebrewSubs?: boolean | null;
  BookingNativeUrl?: string;
}
interface RawMovie {
  Name: string;
  Pic?: string;
  Genres?: string;
  LengthInMinutes?: string;
  MovieId: number;
  Trailer?: string | null;
  MovieRating?: string | number | null;
  ReleaseYear?: string | number | null;
  Dates?: RawDate[];
}

const POSTER_PALETTE = ["from-rose-500 to-red-800", "from-indigo-500 to-blue-800", "from-amber-500 to-orange-800", "from-teal-500 to-cyan-800"];
function posterColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return POSTER_PALETTE[h % POSTER_PALETTE.length];
}

function normalizeRating(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") return "";
  const s = String(raw);
  const m = s.match(/\d+/);
  if (m) return `${m[0]}+`;
  if (/כל|all|family|משפחה/i.test(s)) return "G";
  return "";
}

export class MovielandProvider implements CinemaDataProvider {
  id = "movieland-live";
  name = "Movieland (live)";
  sourceType = "scraped" as const;
  priority = 40;

  isEnabled(): boolean {
    return true;
  }

  async fetchDataset(): Promise<ProviderFetchOutcome> {
    const warnings: string[] = [];
    const errors: string[] = [];

    let rawMovies: RawMovie[];
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(`${HOST}/api/Events`, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "User-Agent": USER_AGENT,
            "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
            Referer: `${HOST}/`,
          },
          // Next.js's own fetch-level Data Cache (persisted by the platform —
          // Vercel — across serverless invocations for free) instead of a
          // hand-rolled cache.
          next: { revalidate: Math.round(EVENTS_CACHE_TTL_MS / 1000) },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        rawMovies = (await res.json()) as RawMovie[];
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      errors.push(`Movieland: failed to fetch events (${err instanceof Error ? err.message : String(err)}).`);
      return { dataset: emptyDataset(), warnings, errors };
    }

    const windowDates = new Set(Array.from({ length: DAY_WINDOW }, (_, i) => new Date(Date.now() + i * 86_400_000).toISOString().slice(0, 10)));

    const moviesById = new Map<string, Movie>();
    const usedTheaterIds = new Set<string>();
    const unknownBranches = new Set<string>();
    const screenings: Screening[] = [];

    for (const movie of rawMovies) {
      const dates = (movie.Dates ?? []).filter((d) => windowDates.has(d.Date.slice(0, 10)));
      if (dates.length === 0) continue;

      const cleanName = stripPrintSuffix(movie.Name);
      const id = movieKey(cleanName);

      if (!moviesById.has(id)) {
        const genresHe = (movie.Genres ?? "")
          .split(/[,،]/)
          .map((g) => g.trim())
          .filter(Boolean);
        moviesById.set(id, {
          id,
          title: cleanName,
          titleHe: cleanName,
          genre: [],
          genreHe: genresHe,
          runtimeMinutes: Number(movie.LengthInMinutes) || 0,
          ageRating: normalizeRating(movie.MovieRating),
          synopsis: "",
          synopsisHe: "",
          posterColor: posterColor(id),
          posterUrl: movie.Pic ? `${HOST}/images/${encodeURIComponent(movie.Pic)}` : undefined,
          releaseYear: Number(movie.ReleaseYear) || new Date().getFullYear(),
          familyFriendly: /משפחה|לכל המשפחה/.test(movie.Genres ?? ""),
          trailerUrl: movie.Trailer ?? undefined,
          popularityScore: 55,
          originalLanguage: "other",
          sourceType: "scraped",
        });
      }

      for (const d of dates) {
        const branchKey = String(d.TheaterId);
        const branch = BRANCHES[branchKey];
        if (!branch) {
          unknownBranches.add(`${branchKey} (${d.TheaterName})`);
          continue;
        }
        usedTheaterIds.add(branchKey);

        const format: ScreenFormat = d.ThreeD ? "3D" : d.IsVip ? "VIP" : "2D";
        let audio: AudioTrack | undefined;
        let subtitles: SubtitleTrack | undefined;
        let printKind: PrintKind | undefined;
        if (d.Dubbed) {
          audio = "hebrew";
          subtitles = d.HebrewSubs ? "hebrew" : "none";
          printKind = "dubbed";
        } else if (d.HebrewSubs) {
          subtitles = "hebrew";
          printKind = "subtitled";
        }

        screenings.push({
          id: `movieland-${d.EventId}`,
          movieId: id,
          theaterId: `movieland-${branchKey}`,
          chainId: "movieland",
          date: d.Date.slice(0, 10),
          time: d.Hour || d.Date.slice(11, 16),
          format,
          audio,
          subtitles,
          printKind,
          bookingUrl: d.BookingNativeUrl ?? `${HOST}/movie/${movie.MovieId}`,
          sourceType: "scraped",
          lastUpdated: new Date().toISOString(),
        });
      }
    }

    if (unknownBranches.size > 0) warnings.push(`Movieland: unmapped branch(es) skipped: ${[...unknownBranches].join(", ")}.`);

    const theaters: Theater[] = [...usedTheaterIds].map((key) => {
      const b = BRANCHES[key];
      return {
        id: `movieland-${key}`,
        name: b.nameEn,
        nameHe: b.nameHe,
        chainId: "movieland",
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
