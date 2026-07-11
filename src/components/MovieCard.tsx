"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { pick, movieTitles } from "@/lib/i18n/localize";
import type { Movie } from "@/lib/types";
import { MoviePoster } from "./MoviePoster";

export function MovieCard({ movie }: { movie: Movie }) {
  const { locale, t } = useLanguage();
  const { primary, secondary } = movieTitles(locale, movie);
  const genres = pick(locale, movie.genre.join(" · "), movie.genreHe.join(" · "));

  return (
    <Link
      href={`/movies/${movie.id}`}
      className="focus-ring group flex flex-col overflow-hidden rounded-2xl border border-sand-200/80 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden">
        <MoviePoster movie={movie} className="h-full w-full transition-transform duration-500 group-hover:scale-105" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0" />
        <span className="absolute end-2.5 top-2.5 rounded-full bg-black/40 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
          {movie.ageRating}
        </span>
        {movie.familyFriendly && (
          <span className="absolute start-2.5 top-2.5 rounded-full bg-white/95 px-2 py-1 text-[11px] font-semibold text-ink-900 shadow-sm">
            👪 {t("movieCard.familyFriendly")}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-white drop-shadow">{primary}</h3>
          {secondary && <p className="line-clamp-1 text-[11px] font-medium text-white/70 drop-shadow">{secondary}</p>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {genres && <p className="line-clamp-1 text-xs text-ink-600">{genres}</p>}
        {movie.runtimeMinutes > 0 && (
          <p className="mt-auto pt-1 text-xs text-ink-600/60">
            {movie.runtimeMinutes} {t("common.min")}
          </p>
        )}
      </div>
    </Link>
  );
}
