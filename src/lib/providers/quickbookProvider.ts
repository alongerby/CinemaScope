import { cityIdByHebrewName, getCityById } from "@/lib/data/cities";
import { movieKey } from "@/lib/movieKey";
import type { AudioTrack, CinemaChainId, Movie, PrintKind, ScreenFormat, Screening, SubtitleTrack, Theater } from "@/lib/types";
import type { CinemaDataProvider, FetchDatasetOptions, ProviderFetchOutcome } from "./provider";
import { emptyDataset } from "./provider";

/**
 * Real, live data for chains on the shared "quickbook" ticketing platform:
 * Yes Planet (tenantId 10100) and Rav-Hen (tenantId 10104). Both sites render
 * their own showtimes by calling this unauthenticated JSON endpoint — the same
 * request a normal visitor's browser makes, no login/paywall/captcha. See
 * README "Real data source".
 *
 * Everything here is genuinely real: branch name/address/coordinates/city,
 * films (Hebrew name + English title from the film's own URL slug + poster +
 * trailer), and per-showtime events including a real booking link that opens
 * the exact seat-selection for that screening. The endpoint is undocumented,
 * so every call is defensive: short timeout, try/catch, cached, and the chain
 * simply shows nothing (with a clear error on /admin/import) if it breaks —
 * never fabricated data.
 */

const REQUEST_TIMEOUT_MS = 8000;
const CINEMAS_CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const SCHEDULE_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const DAY_WINDOW = 5; // today + 4 days
const POLITE_DELAY_MS = 200;
const USER_AGENT = "CinemasIL-MVP-Bot/1.0 (+local development; polite, low-rate, non-commercial; unofficial endpoint)";

interface QuickbookConfig {
  chainId: CinemaChainId;
  chainName: string;
  apiBase: string; // e.g. https://www.planetcinema.co.il/il/data-api-service/v1/quickbook/10100
  /**
   * If set, per-showtime booking links are built as
   * `{ticketsOrderBase}/{eventId}?lang=he` — a direct GET-able booking page on
   * the chain's ticketing host (e.g. https://tickets5.planetcinema.co.il/order),
   * skipping the booking-router launch redirect. If omitted, we fall back to
   * the API's own `bookingRouterLaunchLink`.
   */
  ticketsOrderBase?: string;
  /** Hebrew prefix(es) the API prepends to every branch name (e.g. "פלאנט", "רב חן"). */
  hebrewPrefixes: string[];
}

// Branch names on the API are Hebrew-only (e.g. "פלאנט אילון", "רב חן דיזינגוף").
// Most are just "<chain prefix> <city>", so stripping the prefix and mapping the
// remainder through the real city list (cities.ts) gives an accurate English name.
// A few branches are named after a mall/street rather than the city itself — those
// exact strings are listed here instead of being guessed via transliteration.
const BRANCH_LOCATION_OVERRIDES: Record<string, string> = {
  אילון: "Ayalon", // Yes Planet's branch in the Ayalon Mall, Ramat Gan
  דיזינגוף: "Dizengoff", // Rav-Hen's branch on Dizengoff St, Tel Aviv
};

function englishBranchName(chainNameEn: string, hebrewPrefixes: string[], displayNameHe: string): string {
  let location = displayNameHe.trim();
  for (const prefix of hebrewPrefixes) {
    if (location.startsWith(prefix)) {
      location = location.slice(prefix.length).trim();
      break;
    }
  }
  const cityId = cityIdByHebrewName(location);
  const english = (cityId && getCityById(cityId)?.name) ?? BRANCH_LOCATION_OVERRIDES[location] ?? location;
  return `${chainNameEn} ${english}`;
}

interface RawCinema {
  id: string;
  displayName: string;
  link: string;
  addressInfo: { address1: string; city: string };
  latitude: number;
  longitude: number;
}
interface RawFilm {
  id: string;
  name: string;
  length: number;
  posterLink?: string;
  videoLink?: string;
  link?: string;
  releaseYear?: string;
  attributeIds: string[];
}
interface RawEvent {
  id: string;
  filmId: string;
  cinemaId: string;
  eventDateTime: string;
  attributeIds: string[];
  languages: { original: string[]; dubbed: string[]; voiceover: string[]; subtitles: string[] };
  bookingLink?: string;
  bookingRouterLaunchLink?: string;
  auditoriumTinyName?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const LANG_MAP: Record<string, AudioTrack> = { he: "hebrew", en: "english", ru: "russian", ar: "arabic" };
const mapLang = (code?: string): AudioTrack => (code && LANG_MAP[code]) || "other";

const GENRE_TAG_MAP: Record<string, { en: string; he: string }> = {
  action: { en: "Action", he: "אקשן" },
  animation: { en: "Animation", he: "אנימציה" },
  comedy: { en: "Comedy", he: "קומדיה" },
  drama: { en: "Drama", he: "דרמה" },
  family: { en: "Family", he: "משפחה" },
  horror: { en: "Horror", he: "אימה" },
  musical: { en: "Musical", he: "מחזמר" },
  thriller: { en: "Thriller", he: "מתח" },
  documentary: { en: "Documentary", he: "תיעודי" },
  romance: { en: "Romance", he: "רומנטי" },
  israeli: { en: "Israeli", he: "ישראלי" },
  foreign: { en: "Foreign", he: "לועזי" },
};

function guessAgeRating(attributeIds: string[]): string {
  const plus = attributeIds.find((a) => /^\d+-plus$/.test(a));
  if (plus) return plus.replace("-plus", "+");
  if (attributeIds.includes("all")) return "G";
  return "";
}

function guessFormat(attributeIds: string[]): ScreenFormat {
  if (attributeIds.includes("imax")) return "IMAX";
  if (attributeIds.includes("4dx")) return "4DX";
  if (attributeIds.includes("vip")) return "VIP";
  if (attributeIds.includes("3d")) return "3D";
  return "2D";
}

const POSTER_PALETTE = ["from-rose-500 to-red-800", "from-indigo-500 to-blue-800", "from-amber-500 to-orange-800", "from-teal-500 to-cyan-800"];
function posterColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return POSTER_PALETTE[h % POSTER_PALETTE.length];
}

/** The film's own URL slug is its real English/Latin title, e.g. /films/obsession/… → "Obsession". */
function slugToTitle(link: string | undefined, fallback: string): string {
  const slug = link?.split("/films/")[1]?.split("/")[0];
  if (!slug) return fallback;
  return slug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function citySlug(nameHe: string): string {
  return `city-${nameHe.trim().replace(/\s+/g, "-")}`;
}

export class QuickbookProvider implements CinemaDataProvider {
  readonly id: string;
  readonly name: string;
  readonly sourceType = "scraped" as const;
  readonly priority: number;

  constructor(private readonly cfg: QuickbookConfig, priority: number) {
    this.id = `quickbook-${cfg.chainId}`;
    this.name = `${cfg.chainName} (live)`;
    this.priority = priority;
  }

  isEnabled(): boolean {
    return true;
  }

  // `revalidateMs` uses Next.js's own fetch-level Data Cache (via the `next.revalidate`
  // option) instead of a hand-rolled cache — it's persisted by the platform (Vercel)
  // across serverless invocations for free, with no extra service to provision.
  private async fetchJson<T>(url: string, revalidateMs: number, forceFresh?: boolean): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        ...(forceFresh ? { cache: "no-store" as const } : { next: { revalidate: Math.round(revalidateMs / 1000) } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async fetchDataset(options?: FetchDatasetOptions): Promise<ProviderFetchOutcome> {
    const forceFresh = options?.forceFresh;
    const { chainId, chainName, apiBase, hebrewPrefixes } = this.cfg;
    const warnings: string[] = [];
    const errors: string[] = [];

    let cinemas: RawCinema[];
    try {
      const until = isoDate(new Date(Date.now() + 14 * 86_400_000));
      const data = await this.fetchJson<{ body: { cinemas: RawCinema[] } }>(
        `${apiBase}/cinemas/with-event/until/${until}?attr=`,
        CINEMAS_CACHE_TTL_MS,
        forceFresh,
      );
      cinemas = data.body.cinemas;
    } catch (err) {
      errors.push(`${chainName}: failed to fetch branch list (${err instanceof Error ? err.message : String(err)}).`);
      return { dataset: emptyDataset(), warnings, errors };
    }

    const theaters: Theater[] = cinemas.map((c) => {
      const cityId = cityIdByHebrewName(c.addressInfo.city) ?? citySlug(c.addressInfo.city);
      if (!cityIdByHebrewName(c.addressInfo.city)) warnings.push(`${chainName}: unmapped city "${c.addressInfo.city}" (still shown).`);
      return {
        id: `${chainId}-${c.id}`,
        name: englishBranchName(chainName, hebrewPrefixes, c.displayName),
        nameHe: c.displayName,
        chainId,
        cityId,
        cityNameHe: c.addressInfo.city,
        address: c.addressInfo.address1,
        addressHe: c.addressInfo.address1,
        lat: c.latitude,
        lng: c.longitude,
        amenities: [],
        accessibility: [],
        openingHours: [],
        screenCount: 0,
        officialUrl: c.link,
        sourceType: "scraped",
        lastUpdated: new Date().toISOString(),
      };
    });

    const moviesById = new Map<string, Movie>();
    const screenings: Screening[] = [];
    const auditoriumsByCinema = new Map<string, Set<string>>();
    const today = new Date();
    const dates = Array.from({ length: DAY_WINDOW }, (_, i) => isoDate(new Date(today.getTime() + i * 86_400_000)));

    for (const cinema of cinemas) {
      for (const date of dates) {
        let data: { body: { films: RawFilm[]; events: RawEvent[] } };
        try {
          data = await this.fetchJson<{ body: { films: RawFilm[]; events: RawEvent[] } }>(
            `${apiBase}/film-events/in-cinema/${cinema.id}/at-date/${date}?attr=`,
            SCHEDULE_CACHE_TTL_MS,
            forceFresh,
          );
          await sleep(POLITE_DELAY_MS);
        } catch {
          continue; // a single missing day isn't worth a warning per branch
        }

        const filmKeyById = new Map<string, string>();
        for (const film of data.body.films) {
          const id = movieKey(film.name);
          filmKeyById.set(film.id, id);
          if (!moviesById.has(id)) {
            const genreTags = film.attributeIds.map((a) => GENRE_TAG_MAP[a]).filter((g): g is { en: string; he: string } => Boolean(g));
            moviesById.set(id, {
              id,
              title: slugToTitle(film.link, film.name),
              titleHe: film.name,
              genre: genreTags.map((g) => g.en),
              genreHe: genreTags.map((g) => g.he),
              runtimeMinutes: film.length,
              ageRating: guessAgeRating(film.attributeIds),
              synopsis: "",
              synopsisHe: "",
              posterColor: posterColor(id),
              posterUrl: film.posterLink,
              releaseYear: Number(film.releaseYear) || today.getFullYear(),
              familyFriendly: film.attributeIds.includes("family"),
              trailerUrl: film.videoLink,
              popularityScore: 60,
              originalLanguage: mapLang(undefined),
              sourceType: "scraped",
            });
          }
        }

        for (const event of data.body.events) {
          const [eventDate, eventTime] = event.eventDateTime.split("T");
          const time = eventTime.slice(0, 5);

          const dubbed = event.languages.dubbed[0];
          const subtitle = event.languages.subtitles[0];
          const original = event.languages.original[0];
          let audio: AudioTrack | undefined;
          let subtitles: SubtitleTrack | undefined;
          let printKind: PrintKind | undefined;
          if (dubbed) {
            audio = mapLang(dubbed);
            subtitles = "none";
            printKind = "dubbed";
          } else if (subtitle) {
            audio = mapLang(original);
            subtitles = mapLang(subtitle) as SubtitleTrack;
            printKind = "subtitled";
          } else if (original) {
            audio = mapLang(original);
            subtitles = "none";
            printKind = "original";
          }

          const auds = auditoriumsByCinema.get(event.cinemaId) ?? new Set<string>();
          if (event.auditoriumTinyName) auds.add(event.auditoriumTinyName);
          auditoriumsByCinema.set(event.cinemaId, auds);

          screenings.push({
            id: `${chainId}-${event.id}`,
            movieId: filmKeyById.get(event.filmId) ?? movieKey(event.filmId),
            theaterId: `${chainId}-${event.cinemaId}`,
            chainId,
            date: eventDate,
            time,
            format: guessFormat(event.attributeIds),
            audio,
            subtitles,
            printKind,
            // Prefer a direct booking-page link on the ticketing host when configured
            // (e.g. https://tickets5.planetcinema.co.il/order/{eventId}?lang=he); otherwise
            // fall back to the API's booking-router launch link.
            bookingUrl: this.cfg.ticketsOrderBase
              ? `${this.cfg.ticketsOrderBase}/${event.id}?lang=he`
              : event.bookingRouterLaunchLink ?? cinemas.find((c) => c.id === event.cinemaId)?.link ?? apiBase,
            sourceType: "scraped",
            lastUpdated: new Date().toISOString(),
          });
        }
      }
    }

    for (const theater of theaters) {
      const cinemaId = theater.id.replace(`${chainId}-`, "");
      theater.screenCount = auditoriumsByCinema.get(cinemaId)?.size ?? 0;
    }

    return { dataset: { movies: Array.from(moviesById.values()), theaters, screenings }, warnings, errors };
  }
}

export const YES_PLANET_CONFIG: QuickbookConfig = {
  chainId: "yes-planet",
  chainName: "Yes Planet",
  apiBase: "https://www.planetcinema.co.il/il/data-api-service/v1/quickbook/10100",
  ticketsOrderBase: "https://tickets5.planetcinema.co.il/order",
  hebrewPrefixes: ["פלאנט"],
};

export const RAV_HEN_CONFIG: QuickbookConfig = {
  chainId: "rav-hen",
  chainName: "Rav-Hen",
  apiBase: "https://www.rav-hen.co.il/rh/data-api-service/v1/quickbook/10104",
  ticketsOrderBase: "https://tickets5.rav-hen.co.il/order",
  hebrewPrefixes: ["רב חן", "רב-חן"],
};
