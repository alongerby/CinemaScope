"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { pick, movieTitles } from "@/lib/i18n/localize";
import type { EnrichedScreening } from "@/lib/types";
import { MoviePoster } from "./MoviePoster";

export function ScreeningCard({
  screening,
  showMovieTitle = true,
  showTheater = true,
}: {
  screening: EnrichedScreening;
  showMovieTitle?: boolean;
  showTheater?: boolean;
}) {
  const { locale, t } = useLanguage();
  const { primary: movieTitle, secondary: movieTitleAlt } = movieTitles(locale, screening.movie);
  const theaterName = pick(locale, screening.theater.name, screening.theater.nameHe);
  const cityName = pick(locale, screening.city.name, screening.city.nameHe);

  return (
    <div className="group relative flex gap-3 overflow-hidden rounded-2xl border border-sand-200/80 bg-white p-3 shadow-card transition-shadow duration-200 hover:shadow-card-hover sm:gap-4 sm:p-4">
      <span className="absolute inset-y-0 start-0 w-1" style={{ backgroundColor: screening.chain.color }} aria-hidden />

      {showMovieTitle && (
        <Link
          href={`/movies/${screening.movie.id}`}
          className="ms-1.5 hidden w-14 shrink-0 self-center overflow-hidden rounded-lg ring-1 ring-black/5 transition-transform duration-200 hover:scale-[1.03] sm:block"
        >
          <MoviePoster movie={screening.movie} className="aspect-[2/3] w-full" />
        </Link>
      )}

      <div className="flex flex-1 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5 ps-1.5 sm:ps-0">
          <div className="flex items-baseline gap-2.5">
            <span className="text-xl font-extrabold tabular-nums text-ink-900">{screening.time}</span>
            {showMovieTitle && (
              <Link href={`/movies/${screening.movie.id}`} className="focus-ring flex min-w-0 items-baseline gap-1.5 transition-colors hover:text-brand-700">
                <span className="truncate font-semibold text-ink-900">{movieTitle}</span>
                {movieTitleAlt && <span className="hidden truncate text-xs font-medium text-ink-600/60 md:inline">{movieTitleAlt}</span>}
              </Link>
            )}
          </div>
          {showTheater && (
            <Link href={`/theaters/${screening.theater.id}`} className="focus-ring w-fit truncate text-sm text-ink-600 transition-colors hover:text-brand-700">
              {theaterName} · {cityName}
            </Link>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {screening.format && <span className="chip">{screening.format}</span>}
            {screening.printKind && <span className="chip">{t(`filters.${screening.printKind}`)}</span>}
            {screening.audio && (
              <span className="chip">
                {t(`filters.${screening.audio}`)}
                {screening.subtitles && screening.subtitles !== "none" && ` · ${t("filters.subtitles")}: ${t(`filters.${screening.subtitles}`)}`}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <a href={screening.bookingUrl} target="_blank" rel="noreferrer" className="btn-primary whitespace-nowrap py-2 text-sm">
            {t("screening.bookNow")}
          </a>
          <p className="max-w-[10rem] text-end text-[11px] leading-tight text-ink-600/50">
            {t("screening.viaOfficialSite", { chain: pick(locale, screening.chain.name, screening.chain.nameHe) })}
          </p>
        </div>
      </div>
    </div>
  );
}
