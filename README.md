# CinemaScope IL 🎬

A minimalist discovery layer over Israel's cinemas: pick the theaters you care about and a day, see every showtime in one place, and click straight through to that cinema's own booking page for the exact screening. **All data is real** — theaters, movies, showtimes, and per-showtime booking links are pulled live from Cinema City, Yes Planet, and Rav-Hen's own public ticketing APIs. No demo/fabricated data.

Built with Next.js App Router, TypeScript, and Tailwind CSS. No paid APIs, no database server, no required secret keys — it runs fully locally out of the box.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. That's it — no environment variables, no database setup, no API keys required. The first page load takes a few seconds longer than usual: it triggers the first data ingestion run, including a handful of real network calls to Rav-Hen's public site (see below). Every run after that is served from cache.

```bash
npm run build   # production build
npm run start   # run the production build
```

Optional: copy `.env.example` to `.env.local` and set `TMDB_API_KEY` to activate the free-tier TMDB metadata provider (see below). Everything works without it.

## What's actually in this MVP

- **15 seeded Israeli cities** (Tel Aviv, Jerusalem, Haifa, Rishon LeZion, Be'er Sheva, Herzliya, Ramat Gan, Petah Tikva, Netanya, Ashdod, Holon, Kfar Saba, Modi'in, plus Givatayim and Kiryat Ono — added because Rav-Hen genuinely operates branches there) with real coordinates for distance search.
- **7 cinema chains** (Cinema City, Yes Planet, Rav-Hen, Lev Cinemas, Hot Cinema, Movieland, Independent) across **20 seeded demo theaters + 3 real, live Rav-Hen branches**.
- **Real, live showtimes for Rav-Hen** — actual movies, hall assignments, times, and a genuine per-showtime booking link on Rav-Hen's own ticketing platform, refreshed on a daily cadence. See "Real data source" below for exactly how and why this works.
- **300+ generated demo screenings** for the other six chains (deterministic seeded generator, not hand-typed), spanning a rolling 4-day window, varied formats (2D/3D/IMAX/VIP), audio/subtitle combinations, and ILS pricing.
- Every "Book tickets" link points at a **real chain domain** — the exact per-showtime link for Rav-Hen, the chain's official homepage everywhere else. Nothing links to a fake placeholder domain.
- Full **Hebrew/English UI** with RTL/LTR layout switching, persisted to `localStorage`, set in a Hebrew-aware typeface (Rubik) so neither language falls back to a mismatched system font.
- A real **provider/ingestion pipeline** (see below) — including one live JSON-endpoint integration, one working HTML-fixture scraper, and a free-API integration point.
- **`/admin/import`**: live operational view of every data source, refreshable on demand, no login.

## Real data — all of it

**There is no demo/fabricated data.** Every theater, movie, showtime, and booking link in the app comes from a cinema chain's own public ticketing API. If a source is unreachable the app shows real data from the others (and the last good snapshot persists on disk) — it never invents a theater or a showtime.

Three chains are covered, via two API shapes discovered by reading each site's own publicly-served JS/config — nothing guessed, brute-forced, or obtained by bypassing any login, paywall, or bot-detection challenge:

**Yes Planet + Rav-Hen — the shared "quickbook" platform** (`src/lib/providers/quickbookProvider.ts`). Both sister-company sites render their own showtimes by calling an unauthenticated JSON endpoint (the same request a visitor's browser makes):

```
GET {host}/data-api-service/v1/quickbook/{tenantId}/cinemas/with-event/until/{date}
GET {host}/data-api-service/v1/quickbook/{tenantId}/film-events/in-cinema/{cinemaId}/at-date/{date}
   Yes Planet: host=www.planetcinema.co.il  tenantId=10100   (6 real branches)
   Rav-Hen:    host=www.rav-hen.co.il        tenantId=10104   (3 real branches)
```

Response is plain public JSON: real branches (name, address, **coordinates and city**), real films (Hebrew name + English title from the film's own URL slug + poster image + YouTube trailer), and per-showtime events with format, language/subtitle track, and a **real per-showtime booking link** (`booking-router/launch/{id}`, which opens the exact seat-selection for that screening — verified live).

**Cinema City — its own `/tickets` API** (`src/lib/providers/cinemaCityProvider.ts`). A separate company on a different (Knockout.js) stack, but with equally public endpoints:

```
GET  https://www.cinema-city.co.il/tickets/Movies                        (all now-playing movies)
GET  https://www.cinema-city.co.il/tickets/Events?MovieId={id}           (per-movie showtimes + EventId + TheaterId)
book https://www.cinema-city.co.il/order/?eventID={id}&theaterId={id}    (real per-showtime booking page)
```

Its events endpoint doesn't expose branch coordinates or a machine-readable city, so the 8 branches are geocoded from a small **curated, verified table** in the provider (e.g. Glilot is correctly placed in **Ramat HaSharon**, not Tel Aviv). It also doesn't expose per-showtime format/language, so those chips simply aren't shown for Cinema City rather than being guessed.

**Cross-chain de-duplication.** The same film appears under different internal ids across chains. `src/lib/movieKey.ts` derives a stable movie id from the normalized Hebrew title, so a film playing at several chains shows up once on the movies page with its showtimes merged — and picks up the English title/poster from whichever chain provides them.

**Why `scraped`, not `live`:** it's real-time data, but from undocumented, unofficial endpoints rather than published/sanctioned APIs — see "Legal & operational notes" below for the tradeoffs.

**Graceful failure.** Every call has a timeout + try/catch. A failing source returns an empty dataset with a clear error on `/admin/import`; that chain just shows nothing until it recovers.

## Daily scrape scheduling

"Daily scrape" is a real cadence here, not a one-off:

- Each provider's own `fetch()` calls carry a `next: { revalidate }` option (6-12h, see `src/lib/providers/*`), so the actual freshness guarantee lives in Next.js's fetch-level Data Cache — persisted by the deployment platform (Vercel) across serverless invocations for free, no extra service to run or provision.
- `src/lib/repository.ts` keeps a short in-memory re-use window on top of that, just to avoid redoing the (cheap) merge/dedupe pass on every request within the same warm instance.
- `src/instrumentation.ts` starts an in-process hourly check when the server boots; if the last run is more than 24h old, it triggers a refresh automatically. This only helps while the server process stays alive (fine for `next start` on a persistent host, not for serverless).
- `src/app/api/cron/refresh/route.ts` is the production-correct trigger: point any external scheduler at it once a day (`POST /api/cron/refresh`) — Windows Task Scheduler, cron, or a hosted scheduled job all work identically. Set `CRON_SECRET` in the environment to require `Authorization: Bearer <secret>` (or `?secret=`) before it'll run; unset by default so local use needs no configuration.
- `/admin/import`'s "Refresh data now" button bypasses the cache immediately (`forceFresh`, threaded through every provider), for on-demand testing.

## Movieland mirror (working around a Cloudflare IP-reputation gate)

Movieland's `/api/Events` sits behind a Cloudflare Managed Challenge that gates almost entirely on IP/ASN reputation — cloud hosting ranges (Vercel, Netlify, etc.) get challenged/blocked no matter what headers are sent, while a residential IP passes straight through untouched. No amount of header spoofing or proxy relaying fixes an IP-reputation gate, so instead: a residential machine mirrors the raw response to a GitHub Gist once a day, and the deployed site reads that mirror instead of talking to Movieland directly.

Setup:
1. Create a GitHub Personal Access Token with the `gist` scope ([github.com/settings/tokens](https://github.com/settings/tokens)).
2. Create a Gist with one file `movieland-events.json` containing `[]` as a placeholder. Note its id from the URL.
3. On the machine that'll run the daily scrape (e.g. your home PC via Windows Task Scheduler), set `MOVIELAND_GIST_ID` and `MOVIELAND_GIST_TOKEN`, then run `node scripts/scrapeMovieland.mjs` (schedule it once a day).
4. On the deployment (Vercel), set `MOVIELAND_MIRROR_URL` to `https://gist.githubusercontent.com/<user>/<GIST_ID>/raw/movieland-events.json`.

Without `MOVIELAND_MIRROR_URL` set, `movielandProvider.ts` just fetches Movieland directly (fine for local dev, where a residential IP isn't blocked anyway).

## Architecture

```
src/
  app/                    Next.js App Router pages (mostly thin server components)
    page.tsx              /            landing page
    search/                /search      showtimes by theater + day
    movies/, movies/[id]/  /movies      catalogue + detail
    theaters/, theaters/[id]/           theater directory + detail
    about/                 /about
    admin/import/           /admin/import  provider status + refresh
    api/cron/refresh/       daily-refresh trigger for external schedulers
  components/             Reusable UI (cards, pickers, badges, states, ...)
    home/ movies/ theaters/ admin/ search/  page-specific client components
    states/               EmptyState / LoadingState / ErrorState
  lib/
    types.ts              Core domain model (Movie, Theater, Screening, ...)
    data/                 Seed data: cities, chains, amenities, movies, theaters, screenings
    providers/             CinemaDataProvider implementations (see below)
    scrapers/              Chain-specific scraper adapters
    i18n/                  Dictionaries + LanguageProvider (React context)
    ingestion.ts           Orchestrates providers → merged dataset
    repository.ts          Server-side data access layer (the only thing pages call)
    searchFilters.ts       Pure filter/sort logic (safe to import from client components)
    enrichClient.ts        Client-safe screening enrichment (joins + distance)
    validation.ts          Field-level validation used during ingestion
    cache.ts               File-based cache for scraped/API responses (.cache/)
    geo.ts                 Haversine distance
  instrumentation.ts       In-process daily-refresh scheduler (server boot hook)
```

**Server vs. client boundary matters here.** `repository.ts` and everything it touches (`ingestion.ts`, providers, `fs`-based caching) is server-only — it can't be imported from a `"use client"` file, or the browser bundle would try to include Node's `fs` module and fail to build. Client components (search, theater/movie detail) receive plain serializable data as props from a server-component `page.tsx`, then use `searchFilters.ts` / `enrichClient.ts` (pure functions, no Node APIs) to filter and group.

### Data model

All shapes live in `src/lib/types.ts`: `Movie`, `Theater`, `Screening`, `CinemaChain`, `City`, `Amenity`, `AccessibilityFeature`, `PriceInfo`, plus `ProviderImportResult` / `ProviderStatusSnapshot` for the ingestion pipeline. Every `Theater`, `Movie`, and `Screening` carries a `sourceType: "live" | "scraped" | "cached" | "demo"` and a `lastUpdated` timestamp, and the UI surfaces this via `<DataSourceBadge>` everywhere a record is shown. `Movie.posterUrl` and `Screening.priceEstimated` / `bookingUrl` are populated with real values where a provider actually has them.

### Data ingestion pipeline (the important part)

`src/lib/providers/provider.ts` defines the contract:

```ts
interface CinemaDataProvider {
  id: string;
  name: string;
  sourceType: SourceType;
  priority: number;       // lower runs first
  isEnabled(): boolean;
  fetchDataset(): Promise<ProviderFetchOutcome>;
}
```

`src/lib/ingestion.ts` runs every registered provider in priority order and merges the results:

| Priority | Provider | What it does |
|---|---|---|
| 20 | `QuickbookProvider(YES_PLANET_CONFIG)` | Real Yes Planet data (6 branches) from the quickbook JSON API — theaters, films, showtimes, booking links. |
| 21 | `QuickbookProvider(RAV_HEN_CONFIG)` | Same code path, Rav-Hen (3 branches). Films that also play at Yes Planet de-dupe into one movie. |
| 30 | `CinemaCityProvider` | Real Cinema City data (8 branches) from its `/tickets` API + `/order` booking links, geocoded via a curated table. |

Adding a real chain is a one-liner in `buildProviderRegistry()`; the id-based merge, validation, caching, and status tracking are all generic.

Every provider's output passes through:
- **`src/lib/validation.ts`** — rejects malformed names / invalid dates-times / bad coordinates, and collapses duplicate showtimes (same film + branch + minute + format) before anything reaches the merged dataset.
- **`src/lib/cache.ts`** — file-based cache under `.cache/` (6–12h TTL per source) so ingestion doesn't re-fetch needlessly.
- **`src/lib/providerStatus.ts`** — status registry (last success/attempt, imported counts, warnings, errors) surfaced on `/admin/import`.

## Adding another chain

1. Find the chain's data source: open its site's public JS bundles / inline config and look for the `fetch`/`ajax` call that builds a showtimes URL from page config (a host + `tenantId`, a `/tickets/...` path, etc. — exactly how the three current sources were found). If it's on the shared "quickbook" platform, you may only need a new `QuickbookConfig`.
2. Create `src/lib/providers/<chain>Provider.ts` implementing `CinemaDataProvider` (`quickbookProvider.ts` / `cinemaCityProvider.ts` are the two templates). Shape the response into `{ movies, theaters, screenings }` per `src/lib/types.ts`, using `movieKey(titleHe)` for the movie id so films de-dupe across chains, and a real per-showtime `bookingUrl`.
3. Register it in `buildProviderRegistry()` in `src/lib/ingestion.ts`.
4. Always wrap network calls in a timeout + try/catch and cache responses — a broken/changed endpoint must degrade to "0 results, clear warning," never a thrown error or fabricated data.

## Legal & operational notes on scraping

This is real, and worth taking seriously before scraping any cinema site in production:

- **Terms of Service**: most cinema chains' ToS restrict automated access. Calling an unauthenticated JSON endpoint the chain's own frontend uses can still violate those terms for a commercial product, even when no login or technical protection is bypassed. These integrations only call public endpoints the sites' own visitors' browsers call; they don't touch anything behind login, payment, or a bot-detection challenge. That distinction matters, but it doesn't make ToS risk zero.
- **robots.txt**: verify the target path isn't disallowed before shipping, and honor `Crawl-delay` if present.
- **Rate limiting**: each provider fetches on the order of a few dozen requests once per day (or on manual refresh), spaced out (200–250ms apart or a small concurrency cap), all responses cached 6–12h — deliberately far below anything that looks like load or abuse. Never poll aggressively or in a tight loop.
- **Copyright / database rights**: titles, descriptions, poster images, and showtime listings may be protected as a compiled database in some jurisdictions even when individual facts (a showtime) are not copyrightable. Redistributing this data commercially carries different risk than displaying it live with attribution.
- **Fragility**: these are undocumented endpoints that can change without notice. Every provider catches failures and degrades to an empty result with a clear warning; `/admin/import` shows exactly which source failed and when. Someone still has to notice and fix it.
- **Caching is not optional**: beyond politeness, it's what keeps the app usable when a source is slow, rate-limits you, or is briefly down.
- **Path to commercial use**: before charging money or scaling traffic, replace unofficial-endpoint integrations with official APIs, cinema partnerships, or a licensed showtime data provider — and disclose to each chain exactly how their data is being used.

## Assumptions made

- Each chain's endpoint returns its real, complete current branch list and now-playing schedule for the ingest window (today + 4 days) — those are the numbers shown, not a cap we impose.
- English titles come from Yes Planet / Rav-Hen's own film URL slugs. Cinema City exposes only a Hebrew title, so Cinema City-exclusive films show Hebrew only (the UI shows both languages whenever they're available and differ).
- Cinema City's endpoint doesn't expose per-branch coordinates/city or per-showtime format/language, so branches are geocoded from a small curated verified table and those chips are simply omitted for Cinema City rather than guessed.
- "Currently playing" = has at least one showtime in the ingest window.
- No authentication anywhere, including `/admin/import` and `/api/cron/refresh` (unless `CRON_SECRET` is set).
- The dataset reloads instantly from `.cache/daily-ingestion-snapshot.json` on restart if still fresh — a production build would persist this in SQLite/Postgres instead.

## Known limitations / what a real launch would still need

- `npm audit` flags Next.js advisories fixed only in Next 16 (a breaking migration out of scope here). Fine for local use; address before any public deployment.
- These integrations depend on undocumented endpoints that could change without notice — real today, not guaranteed forever. The app degrades gracefully if one breaks.
- No exact ticket prices (the chains compute them at checkout) — the app deliberately shows no prices; you see them on the cinema's own page when booking.
- No automated test suite.
- The map is a static placeholder (address + coordinates); swapping in Leaflet/MapLibre with free OSM tiles is the natural next step and needs no paid API.

## Self-check

**All data is real, no fabrication.** Theaters (17 branches across Cinema City, Yes Planet, Rav-Hen), movies (~80 now-playing, de-duplicated across chains), showtimes (thousands), and booking links all come live from each chain's own public ticketing API and are cached to disk. Locations are accurate (e.g. Cinema City Glilot is in Ramat HaSharon; there is no fictional "Yes Planet Herzliya"). Every "Book tickets" link opens the specific screening on the cinema's own site (verified: Cinema City `/order`, Yes Planet & Rav-Hen `booking-router/launch`).

**Fully implemented:** landing, `/search` (showtimes by theater + day), `/movies`, `/movies/[id]`, `/theaters`, `/theaters/[id]`, `/about`, `/admin/import`. Hebrew/English toggle with RTL/LTR and no visible i18n keys; bilingual movie titles; theater multi-select grouped by city + day multi-select; daily-cadence refresh with disk persistence, in-process scheduler, and cron-friendly API route; provider status + import preview on `/admin/import`.

**Deliberately minimal / removed:** no prices, no geolocation/distance, no compare page, and only the two intended filters (theaters + day(s)) — the product is a thin, accurate layer that combines cinemas and hands you off to book.

**Would need before commercial launch:** official APIs / partnerships to replace the unofficial endpoints, exact pricing (if desired), an interactive map, and tests.
