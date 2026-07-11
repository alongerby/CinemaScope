"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { pick } from "@/lib/i18n/localize";
import type { Movie } from "@/lib/types";

/**
 * Renders a movie's real poster image when a provider actually supplied one
 * (currently: the Rav-Hen live provider). Falls back to a designed placeholder
 * "poster" — gradient, film-strip sprockets, clapper glyph, and the title —
 * for demo/fixture movies, or if the real image URL ever fails to load.
 */
export function MoviePoster({ movie, className = "", eager = false }: { movie: Movie; className?: string; eager?: boolean }) {
  const { locale } = useLanguage();
  const [failed, setFailed] = useState(false);
  const title = pick(locale, movie.title, movie.titleHe);

  if (movie.posterUrl && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={movie.posterUrl}
        alt={title}
        className={`object-cover ${className}`}
        onError={() => setFailed(true)}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
      />
    );
  }

  return (
    <div className={`relative flex flex-col overflow-hidden bg-gradient-to-br ${movie.posterColor} ${className}`}>
      {/* sprocket-hole film strips down each side */}
      <div className="pointer-events-none absolute inset-y-0 start-0 flex w-3 flex-col justify-around bg-black/20 py-1.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} className="mx-auto h-1.5 w-1.5 rounded-[2px] bg-black/30" />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 end-0 flex w-3 flex-col justify-around bg-black/20 py-1.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} className="mx-auto h-1.5 w-1.5 rounded-[2px] bg-black/30" />
        ))}
      </div>
      {/* soft vignette + sheen */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-white/10" />

      <div className="relative flex flex-1 items-center justify-center">
        <svg viewBox="0 0 24 24" className="h-2/5 w-2/5 text-white/25" fill="currentColor" aria-hidden>
          <path d="M4 4h3l1.2 2.4H5.2L4 4Zm4.6 0h3l1.2 2.4h-3L8.6 4Zm4.6 0h3l1.2 2.4h-3L13.2 4ZM3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8Z" />
        </svg>
      </div>
    </div>
  );
}
