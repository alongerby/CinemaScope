"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { pick, movieTitles } from "@/lib/i18n/localize";
import { enrichScreeningsClient } from "@/lib/enrichClient";
import { applyFilters, sortByTime } from "@/lib/searchFilters";
import type { Movie, Screening, Theater } from "@/lib/types";
import { DayPicker } from "@/components/DayPicker";
import { TheaterPicker } from "@/components/TheaterPicker";
import { FavoritesOnlyButton } from "@/components/FavoritesOnlyButton";
import { ScreeningCard } from "@/components/ScreeningCard";
import { EmptyState } from "@/components/states/EmptyState";

// Paginate the flat, time-sorted screening list itself (not theater groups) —
// with real datasets some theaters alone have hundreds of screenings, so
// grouping-only pagination could still dump thousands of rows on one page.
// A fixed slice size guarantees a bounded, fast render no matter how the
// screenings are distributed across theaters.
const SCREENINGS_PER_PAGE = 15;

export function SearchPageClient({
  movies,
  theaters,
  screenings,
}: {
  movies: Movie[];
  theaters: Theater[];
  screenings: Screening[];
}) {
  const { locale, t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  // The page number lives in the URL (?page=N) so a specific page is
  // shareable/bookmarkable and survives a refresh or the back button.
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
  const [movieId, setMovieId] = useState<string>(
    () => searchParams.get("movie") ?? "",
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (theaterIds.length) params.set("theaters", theaterIds.join(","));
    if (dates.length) params.set("dates", dates.join(","));
    if (movieId) params.set("movie", movieId);
    if (page > 1) params.set("page", String(page));
    const q = params.toString();
    router.replace(q ? `/search?${q}` : "/search", { scroll: false });
  }, [theaterIds, dates, movieId, page, router]);

  const availableDates = useMemo(
    () => Array.from(new Set(screenings.map((s) => s.date))).sort(),
    [screenings],
  );

  // Movies for the dropdown, sorted by their displayed title.
  const movieOptions = useMemo(() => {
    return [...movies]
      .map((m) => ({ id: m.id, label: movieTitles(locale, m).primary }))
      .sort((a, b) =>
        a.label.localeCompare(b.label, locale === "he" ? "he" : "en"),
      );
  }, [movies, locale]);

  const toggleTheater = (id: string) =>
    setTheaterIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const toggleDate = (d: string) =>
    setDates((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );

  const results = useMemo(() => {
    const enriched = enrichScreeningsClient(screenings, movies, theaters);
    return sortByTime(
      applyFilters(enriched, {
        theaterIds,
        dates,
        movieId: movieId || undefined,
      }),
    );
  }, [screenings, movies, theaters, theaterIds, dates, movieId]);

  // Group an (already time-sorted) list of screenings by theater, ordered by
  // city then theater name for a stable, scannable layout.
  const groupByTheater = (list: typeof results) => {
    const groups = new Map<string, typeof results>();
    for (const s of list) {
      const g = groups.get(s.theater.id) ?? [];
      g.push(s);
      groups.set(s.theater.id, g);
    }
    return Array.from(groups.entries()).sort(([, a], [, b]) => {
      const ca = pick(locale, a[0].city.name, a[0].city.nameHe);
      const cb = pick(locale, b[0].city.name, b[0].city.nameHe);
      if (ca !== cb) return ca.localeCompare(cb, locale === "he" ? "he" : "en");
      const ta = pick(locale, a[0].theater.name, a[0].theater.nameHe);
      const tb = pick(locale, b[0].theater.name, b[0].theater.nameHe);
      return ta.localeCompare(tb, locale === "he" ? "he" : "en");
    });
  };

  // The full result set in display order (grouped by theater, chronological
  // within each) — this is what gets sliced into fixed-size pages, so a page
  // is always a bounded, fast render no matter how many screenings a single
  // theater has.
  const orderedResults = useMemo(
    () => groupByTheater(results).flatMap(([, list]) => list),
    [results, locale],
  );

  // Reset to page 1 whenever the filtered result set changes shape, so we
  // never land on a page that no longer exists (e.g. after clearing a
  // filter). Compares against the previous values rather than a "first run"
  // flag, so it's a no-op both on mount (a direct link to ?page=3 shouldn't
  // get stomped back to page 1) and under React StrictMode's dev-only double
  // effect invocation (which would otherwise defeat a simple mount flag).
  const prevFiltersRef = useRef({ theaterIds, dates, movieId });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    const changed = prev.theaterIds !== theaterIds || prev.dates !== dates || prev.movieId !== movieId;
    prevFiltersRef.current = { theaterIds, dates, movieId };
    if (changed) setPage(1);
  }, [theaterIds, dates, movieId]);

  const totalPages = Math.max(
    1,
    Math.ceil(orderedResults.length / SCREENINGS_PER_PAGE),
  );
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * SCREENINGS_PER_PAGE;
  const pagedResults = orderedResults.slice(
    pageStart,
    pageStart + SCREENINGS_PER_PAGE,
  );
  const pagedTheaters = useMemo(
    () => groupByTheater(pagedResults),
    [pagedResults, locale],
  );

  const goToPage = (p: number) => {
    setPage(Math.min(Math.max(1, p), totalPages));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-ink-900">{t("search.title")}</h1>
        <p className="mt-1 text-sm text-ink-600">{t("search.subtitle")}</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Controls */}
        <div className="flex flex-col gap-4">
          <label className="card-surface flex flex-col gap-1.5 p-4">
            <span className="text-sm font-semibold text-ink-900">
              {t("filters.movie")}
            </span>
            <select
              value={movieId}
              onChange={(e) => setMovieId(e.target.value)}
              className="w-full px-3.5 py-2 text-sm"
            >
              <option value="">{t("filters.allMovies")}</option>
              {movieOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <FavoritesOnlyButton
            theaters={theaters}
            selected={theaterIds}
            onChange={setTheaterIds}
          />

          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="btn-secondary justify-between lg:hidden"
          >
            <span className="truncate text-start">
              🎬 {t("filters.theaters")}
              {theaterIds.length ? ` (${theaterIds.length})` : ""}
            </span>
            <span aria-hidden>{pickerOpen ? "▲" : "▼"}</span>
          </button>
          <div className={`${pickerOpen ? "block" : "hidden"} lg:block`}>
            <TheaterPicker
              theaters={theaters}
              selected={theaterIds}
              onToggle={toggleTheater}
              onClear={() => setTheaterIds([])}
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex flex-col gap-4">
          <div className="sticky-filter-bar -mx-4 border-b border-sand-200 bg-sand-50/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
            <DayPicker
              dates={availableDates}
              selected={dates}
              onToggle={toggleDate}
            />
          </div>

          <p className="text-sm text-ink-600">
            {t("search.resultsCount", { count: results.length })}
          </p>

          {results.length === 0 ? (
            <EmptyState
              title={t("search.noResults")}
              body={t("search.noResultsHint")}
            />
          ) : (
            <>
              <div className="flex flex-col gap-6">
                {pagedTheaters.map(([theaterId, list]) => {
                  const th = list[0].theater;
                  const cityName = pick(
                    locale,
                    list[0].city.name,
                    list[0].city.nameHe,
                  );
                  const chainColor = list[0].chain.color;
                  return (
                    <section key={theaterId} className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: chainColor }}
                          aria-hidden
                        />
                        <h2 className="text-sm font-bold text-ink-900">
                          {pick(locale, th.name, th.nameHe)}
                          <span className="font-normal text-ink-600/60">
                            {" "}
                            · {cityName}
                          </span>
                        </h2>
                        <span className="text-xs text-ink-600/50">
                          ({list.length})
                        </span>
                      </div>
                      {list.map((s) => (
                        <ScreeningCard
                          key={s.id}
                          screening={s}
                          showTheater={false}
                        />
                      ))}
                    </section>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <nav
                  className="mt-2 flex items-center justify-center gap-3"
                  aria-label={t("search.title")}
                >
                  <button
                    type="button"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    aria-label={t("common.previous")}
                    className="focus-ring grid h-9 w-9 place-items-center rounded-full border border-sand-200 bg-white text-ink-700 transition-colors hover:bg-sand-100 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <span aria-hidden>−</span>
                  </button>
                  <span className="text-sm text-ink-600">
                    {t("common.pageOf", {
                      page: currentPage,
                      total: totalPages,
                    })}
                  </span>
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
