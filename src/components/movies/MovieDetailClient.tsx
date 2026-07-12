"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { pick, movieTitles } from "@/lib/i18n/localize";
import { enrichScreeningsClient } from "@/lib/enrichClient";
import { sortByTime, applyFilters } from "@/lib/searchFilters";
import { formatDayParts } from "@/lib/datetime";
import type { EnrichedScreening, Movie, Screening, Theater } from "@/lib/types";
import { DayPicker } from "@/components/DayPicker";
import { TheaterPicker } from "@/components/TheaterPicker";
import { FavoritesOnlyButton } from "@/components/FavoritesOnlyButton";
import { EmptyState } from "@/components/states/EmptyState";
import { MoviePoster } from "@/components/MoviePoster";
import { SpecialFilter, matchesSpecialFilters, type SpecialFilterKey } from "@/components/SpecialFilter";

function dayLabel(dateStr: string, locale: "en" | "he"): string {
  const { weekday, day } = formatDayParts(dateStr, locale);
  return `${weekday}, ${day}`;
}

/** A single showtime, rendered as a booking link with time + any special format/dub note. */
function ShowtimePill({ screening }: { screening: EnrichedScreening }) {
  const { t } = useLanguage();
  const meta: string[] = [];
  if (screening.format && screening.format !== "2D") meta.push(screening.format);
  if (screening.printKind === "dubbed") meta.push(t("filters.dubbed"));
  return (
    <a
      href={screening.bookingUrl}
      target="_blank"
      rel="noreferrer"
      title={t("screening.bookNow")}
      className="focus-ring flex min-w-[3.75rem] flex-col items-center rounded-xl border border-sand-200 bg-white px-3 py-1.5 leading-tight transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:bg-brand-50 hover:shadow-sm"
    >
      <span className="text-base font-bold tabular-nums text-ink-900">{screening.time}</span>
      {meta.length > 0 && <span className="text-[10px] font-medium text-brand-700">{meta.join(" · ")}</span>}
    </a>
  );
}

export function MovieDetailClient({ movie, screenings, theaters }: { movie: Movie; screenings: Screening[]; theaters: Theater[] }) {
  const { locale, t } = useLanguage();
  const [dates, setDates] = useState<string[]>([]);
  const [theaterIds, setTheaterIds] = useState<string[]>([]);
  const [special, setSpecial] = useState<SpecialFilterKey[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { primary: title, secondary: titleAlt } = movieTitles(locale, movie);
  const genres = pick(locale, movie.genre.join(", "), movie.genreHe.join(", "));
  const synopsis = pick(locale, movie.synopsis, movie.synopsisHe);

  const enriched = useMemo(() => enrichScreeningsClient(screenings, [movie], theaters), [screenings, movie, theaters]);

  const availableDates = useMemo(() => Array.from(new Set(screenings.map((s) => s.date))).sort(), [screenings]);

  // Only the theaters where THIS movie actually plays.
  const movieTheaters = useMemo(() => {
    const ids = new Set(enriched.map((s) => s.theater.id));
    return theaters.filter((th) => ids.has(th.id));
  }, [enriched, theaters]);

  const toggleDate = (d: string) => setDates((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  const toggleTheater = (id: string) => setTheaterIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleSpecial = (key: SpecialFilterKey) => setSpecial((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));

  const filtered = useMemo(
    () => sortByTime(applyFilters(enriched, { dates, theaterIds })).filter((s) => matchesSpecialFilters(s, special)),
    [enriched, dates, theaterIds, special],
  );

  // Group by place (theater) → then by day, ordered by city then theater name.
  const byTheater = useMemo(() => {
    const groups = new Map<string, EnrichedScreening[]>();
    for (const s of filtered) {
      const list = groups.get(s.theater.id) ?? [];
      list.push(s);
      groups.set(s.theater.id, list);
    }
    return Array.from(groups.values())
      .sort((a, b) => {
        const ca = pick(locale, a[0].city.name, a[0].city.nameHe);
        const cb = pick(locale, b[0].city.name, b[0].city.nameHe);
        if (ca !== cb) return ca.localeCompare(cb, locale === "he" ? "he" : "en");
        return pick(locale, a[0].theater.name, a[0].theater.nameHe).localeCompare(pick(locale, b[0].theater.name, b[0].theater.nameHe));
      })
      .map((list) => {
        const byDay = new Map<string, EnrichedScreening[]>();
        for (const s of list) {
          const d = byDay.get(s.date) ?? [];
          d.push(s);
          byDay.set(s.date, d);
        }
        return { list, byDay: Array.from(byDay.entries()) };
      });
  }, [filtered, locale]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl">
        {movie.posterUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={movie.posterUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl" />
            <div className="absolute inset-0 bg-ink-900/70" />
          </>
        ) : (
          <>
            <div className={`absolute inset-0 bg-gradient-to-br ${movie.posterColor}`} />
            <div className="absolute inset-0 bg-black/40" />
          </>
        )}
        <div className="relative flex flex-col gap-6 p-6 text-white sm:flex-row sm:items-end sm:p-10">
          <div className="mx-auto w-40 shrink-0 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/20 sm:mx-0 sm:w-52">
            <MoviePoster movie={movie} className="aspect-[2/3] w-full" />
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-start">
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs sm:justify-start">
              {movie.ageRating && <span className="rounded-full bg-black/30 px-2.5 py-1 backdrop-blur-sm">{movie.ageRating}</span>}
              {movie.runtimeMinutes > 0 && (
                <span className="rounded-full bg-black/30 px-2.5 py-1 backdrop-blur-sm">
                  {movie.runtimeMinutes} {t("common.min")}
                </span>
              )}
              {movie.familyFriendly && <span className="rounded-full bg-white/90 px-2.5 py-1 font-semibold text-ink-900">👪 {t("movieCard.familyFriendly")}</span>}
            </div>
            <h1 className="mt-3 text-3xl font-extrabold drop-shadow-sm sm:text-4xl">{title}</h1>
            {titleAlt && <p className="mt-0.5 text-lg font-semibold opacity-80">{titleAlt}</p>}
            {genres && <p className="mt-1 text-sm opacity-90">{genres}</p>}
            {synopsis && <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed opacity-90 sm:mx-0">{synopsis}</p>}
            {movie.trailerUrl && (
              <div className="mt-4">
                <a href={movie.trailerUrl} target="_blank" rel="noreferrer" className="btn-secondary">
                  ▶ {t("movies.trailer")}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Where it's playing */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-ink-900">{t("movies.detailsTitle")}</h2>
        <p className="mt-1 text-sm text-ink-600">{t("movies.bookingNote")}</p>

        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* Filters */}
          <div className="flex flex-col gap-4">
            <FavoritesOnlyButton theaters={movieTheaters} selected={theaterIds} onChange={setTheaterIds} />
            <div className="card-surface p-4">
              <SpecialFilter selected={special} onToggle={toggleSpecial} />
            </div>
            <button type="button" onClick={() => setPickerOpen((v) => !v)} className="btn-secondary justify-between lg:hidden">
              <span className="truncate text-start">🎬 {t("filters.theaters")}{theaterIds.length ? ` (${theaterIds.length})` : ""}</span>
              <span aria-hidden>{pickerOpen ? "▲" : "▼"}</span>
            </button>
            <div className={`${pickerOpen ? "block" : "hidden"} lg:block`}>
              <TheaterPicker theaters={movieTheaters} selected={theaterIds} onToggle={toggleTheater} onClear={() => setTheaterIds([])} />
            </div>
          </div>

          {/* Results grouped by theater */}
          <div className="flex flex-col gap-4">
            {/* Not sticky: with the day chips able to expand (see DayPicker),
                a sticky element that changes height while pinned is a classic
                source of mobile-browser rendering glitches (content jumping
                or seeming to vanish behind the pinned box). */}
            <div className="-mx-4 border-b border-sand-200 bg-sand-50/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
              <DayPicker dates={availableDates} selected={dates} onToggle={toggleDate} />
            </div>

            {filtered.length === 0 ? (
              <EmptyState title={t("movies.noScreenings")} />
            ) : (
              byTheater.map(({ list, byDay }) => {
                const s0 = list[0];
                const chain = s0.chain;
                return (
                  <section key={s0.theater.id} className="card-surface relative overflow-hidden">
                    <span className="absolute inset-y-0 start-0 w-1.5" style={{ backgroundColor: chain.color }} aria-hidden />
                    <div className="p-4 ps-5 sm:p-5 sm:ps-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: chain.color }} aria-hidden />
                            <h3 className="truncate text-lg font-bold text-ink-900">{pick(locale, s0.theater.name, s0.theater.nameHe)}</h3>
                          </div>
                          <p className="mt-0.5 text-sm text-ink-600">
                            {pick(locale, s0.city.name, s0.city.nameHe)} · {pick(locale, chain.name, chain.nameHe)}
                          </p>
                        </div>
                        <span className="chip shrink-0">{list.length}</span>
                      </div>

                      <div className="mt-4 flex flex-col gap-3">
                        {byDay.map(([date, times]) => (
                          <div key={date} className="flex flex-col gap-2 border-t border-sand-100 pt-3 first:border-t-0 first:pt-0 sm:flex-row sm:gap-4">
                            <span className="shrink-0 pt-1.5 text-xs font-semibold capitalize text-ink-600/70 sm:w-28">{dayLabel(date, locale)}</span>
                            <div className="flex flex-wrap gap-2">
                              {times.map((s) => (
                                <ShowtimePill key={s.id} screening={s} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
