"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { pick } from "@/lib/i18n/localize";
import { CINEMA_CHAINS } from "@/lib/data/chains";
import type { Movie } from "@/lib/types";
import { PosterCarousel } from "@/components/home/PosterCarousel";

export function HomeClient({
  movieCount,
  theaterCount,
  marqueeMovies,
}: {
  movieCount: number;
  theaterCount: number;
  marqueeMovies: Movie[];
}) {
  const { locale, t } = useLanguage();

  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden bg-gradient-to-b from-ink-900 via-ink-900 to-ink-800 pb-12 pt-20 text-white sm:pt-24">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -top-24 start-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-brand-500/25 blur-3xl"
          aria-hidden
        />

        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-200 ring-1 ring-white/10">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            {t("home.badge", { movies: movieCount, theaters: theaterCount })}
          </span>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            {t("home.heroTitleEn")}
          </h1>
          <p className="max-w-xl text-base text-neutral-300 sm:text-lg">
            {t("home.heroBodyEn")}
          </p>
          <Link href="/search" className="btn-primary px-7 py-3.5 text-base">
            {t("home.ctaPrimary")}
          </Link>
        </div>

        <PosterCarousel movies={marqueeMovies} />
      </section>

      {/* Minimal "combining all cinemas" trust strip */}
      <section className="border-b border-sand-200 bg-white px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-medium text-ink-600">
            {t("home.chainsTitle")}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2.5">
            {CINEMA_CHAINS.map((chain) => (
              <span
                key={chain.id}
                className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3.5 py-1.5 text-sm font-medium text-ink-800"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: chain.color }}
                  aria-hidden
                />
                {pick(locale, chain.name, chain.nameHe)}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Two simple entry points */}
      <section className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/search"
            className="card-surface group flex flex-col gap-1 p-6 transition-all hover:-translate-y-1 hover:shadow-card-hover"
          >
            <span className="text-2xl" aria-hidden>
              🎟️
            </span>
            <span className="mt-2 font-semibold text-ink-900">
              {t("home.entryShowtimesTitle")}
            </span>
            <span className="text-sm text-ink-600">
              {t("home.entryShowtimesBody")}
            </span>
            <span className="mt-2 text-sm font-semibold text-brand-700">
              {t("common.seeDetails")} →
            </span>
          </Link>
          <Link
            href="/movies"
            className="card-surface group flex flex-col gap-1 p-6 transition-all hover:-translate-y-1 hover:shadow-card-hover"
          >
            <span className="text-2xl" aria-hidden>
              🎬
            </span>
            <span className="mt-2 font-semibold text-ink-900">
              {t("home.entryMoviesTitle")}
            </span>
            <span className="text-sm text-ink-600">
              {t("home.entryMoviesBody")}
            </span>
            <span className="mt-2 text-sm font-semibold text-brand-700">
              {t("common.viewAll")} →
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
