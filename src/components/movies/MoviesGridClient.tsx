"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { movieTitles } from "@/lib/i18n/localize";
import type { Movie, Screening, Theater } from "@/lib/types";
import { DayPicker } from "@/components/DayPicker";
import { TheaterPicker } from "@/components/TheaterPicker";
import { FavoritesOnlyButton } from "@/components/FavoritesOnlyButton";
import { MovieCard } from "@/components/MovieCard";
import { EmptyState } from "@/components/states/EmptyState";
import { SpecialFilter, matchesSpecialFilters, type SpecialFilterKey } from "@/components/SpecialFilter";

const MOVIES_PER_PAGE = 24;

/**
 * Same filter model as the showtimes page: pick theaters + day(s), narrowed
 * further by a text search. A movie shows up if it has at least one screening
 * matching the current theater/day selection.
 */
export function MoviesGridClient({ movies, theaters, screenings }: { movies: Movie[]; theaters: Theater[]; screenings: Screening[] }) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  // The page number lives in the URL (?page=N) so a specific page is
  // shareable/bookmarkable and survives a refresh or the back button — a path
  // segment like /movies/2 was the other option, but that would collide with
  // /movies/[id] (movie detail pages use ids like "mv-xxxx", but the route
  // itself can't tell "2" apart from a real id without checking data first).
  const [page, setPage] = useState(() => {
    const raw = Number(searchParams.get("page"));
    return Number.isInteger(raw) && raw > 0 ? raw : 1;
  });

  const [theaterIds, setTheaterIds] = useState<string[]>(() => {
    const raw = searchParams.get("theaters");
    return raw ? raw.split(",").filter(Boolean) : [];
  });
  const [dates, setDates] = useState<string[]>(() => {
    const raw = searchParams.get("dates");
    return raw ? raw.split(",").filter(Boolean) : [];
  });
  const [special, setSpecial] = useState<SpecialFilterKey[]>(() => {
    const raw = searchParams.get("special");
    return raw ? (raw.split(",").filter(Boolean) as SpecialFilterKey[]) : [];
  });
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (theaterIds.length) params.set("theaters", theaterIds.join(","));
    if (dates.length) params.set("dates", dates.join(","));
    if (special.length) params.set("special", special.join(","));
    if (page > 1) params.set("page", String(page));
    const q = params.toString();
    router.replace(q ? `/movies?${q}` : "/movies", { scroll: false });
  }, [theaterIds, dates, special, page, router]);

  const availableDates = useMemo(() => Array.from(new Set(screenings.map((s) => s.date))).sort(), [screenings]);

  const toggleTheater = (id: string) => setTheaterIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleDate = (d: string) => setDates((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  const toggleSpecial = (key: SpecialFilterKey) => setSpecial((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));

  // Which movies have a screening matching the current theater/day/special selection.
  const matchingMovieIds = useMemo(() => {
    if (theaterIds.length === 0 && dates.length === 0 && special.length === 0) return null; // no filter active
    const ids = new Set<string>();
    for (const s of screenings) {
      if (theaterIds.length > 0 && !theaterIds.includes(s.theaterId)) continue;
      if (dates.length > 0 && !dates.includes(s.date)) continue;
      if (!matchesSpecialFilters(s, special)) continue;
      ids.add(s.movieId);
    }
    return ids;
  }, [screenings, theaterIds, dates, special]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = movies.filter((m) => {
      if (matchingMovieIds && !matchingMovieIds.has(m.id)) return false;
      if (q && !m.title.toLowerCase().includes(q) && !m.titleHe.includes(query.trim())) return false;
      return true;
    });
    // Alphabetical by displayed title — also keeps near-duplicate titles that
    // slipped past ingestion's merge (e.g. differing only by a trailing
    // qualifier) adjacent to each other instead of scattered across the grid.
    // Posterless cards (no chain supplied an image for that film) sort after
    // everything else, so the grid's visual rhythm isn't broken up by them.
    return list.sort((a, b) => {
      if (Boolean(a.posterUrl) !== Boolean(b.posterUrl)) return a.posterUrl ? -1 : 1;
      return movieTitles(locale, a).primary.localeCompare(movieTitles(locale, b).primary, locale === "he" ? "he" : "en");
    });
  }, [movies, query, matchingMovieIds, locale]);

  // Reset to page 1 whenever the filtered set changes shape. Compares
  // against the previous values rather than a "first run" flag, so it's a
  // no-op both on mount (a direct link to ?page=3 shouldn't get stomped back
  // to page 1) and under React StrictMode's dev-only double effect
  // invocation (which would otherwise defeat a simple mount flag).
  const prevFiltersRef = useRef({ theaterIds, dates, special, query });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    const changed = prev.theaterIds !== theaterIds || prev.dates !== dates || prev.special !== special || prev.query !== query;
    prevFiltersRef.current = { theaterIds, dates, special, query };
    if (changed) setPage(1);
  }, [theaterIds, dates, special, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / MOVIES_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * MOVIES_PER_PAGE;
  const paged = filtered.slice(pageStart, pageStart + MOVIES_PER_PAGE);

  const goToPage = (p: number) => {
    setPage(Math.min(Math.max(1, p), totalPages));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-ink-900">{t("movies.title")}</h1>
        <p className="mt-1 text-sm text-ink-600">{t("movies.subtitle")}</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Controls */}
        <div className="flex flex-col gap-4">
          <label className="card-surface flex flex-col gap-1.5 p-4">
            <span className="text-sm font-semibold text-ink-900">{t("filters.searchMovie")}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("filters.searchMovie")}
              className="w-full px-3.5 py-2 text-sm"
            />
          </label>

          <FavoritesOnlyButton theaters={theaters} selected={theaterIds} onChange={setTheaterIds} />

          <div className="card-surface p-4">
            <SpecialFilter selected={special} onToggle={toggleSpecial} />
          </div>

          <button type="button" onClick={() => setPickerOpen((v) => !v)} className="btn-secondary justify-between lg:hidden">
            <span className="truncate text-start">🎬 {t("filters.theaters")}{theaterIds.length ? ` (${theaterIds.length})` : ""}</span>
            <span aria-hidden>{pickerOpen ? "▲" : "▼"}</span>
          </button>
          <div className={`${pickerOpen ? "block" : "hidden"} lg:block`}>
            <TheaterPicker theaters={theaters} selected={theaterIds} onToggle={toggleTheater} onClear={() => setTheaterIds([])} />
          </div>
        </div>

        {/* Results */}
        <div className="flex flex-col gap-4">
          <div className="sticky-filter-bar -mx-4 border-b border-sand-200 bg-sand-50/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
            <DayPicker dates={availableDates} selected={dates} onToggle={toggleDate} />
          </div>

          <p className="text-sm text-ink-600">{t("movies.count", { count: filtered.length })}</p>

          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {paged.map((movie) => (
                  <MovieCard key={movie.id} movie={movie} />
                ))}
              </div>

              {totalPages > 1 && (
                <nav className="mt-2 flex items-center justify-center gap-3" aria-label={t("movies.title")}>
                  <button
                    type="button"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    aria-label={t("common.previous")}
                    className="focus-ring grid h-9 w-9 place-items-center rounded-full border border-sand-200 bg-white text-ink-700 transition-colors hover:bg-sand-100 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <span aria-hidden>−</span>
                  </button>
                  <span className="text-sm text-ink-600">{t("common.pageOf", { page: currentPage, total: totalPages })}</span>
                  <button
                    type="button"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    aria-label={t("common.next")}
                    className="focus-ring grid h-9 w-9 place-items-center rounded-full border border-sand-200 bg-white text-ink-700 transition-colors hover:bg-sand-100 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <span aria-hidden>+</span>
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
