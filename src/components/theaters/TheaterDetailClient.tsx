"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { pick } from "@/lib/i18n/localize";
import { enrichScreeningsClient } from "@/lib/enrichClient";
import { sortByTime } from "@/lib/searchFilters";
import { formatInstant } from "@/lib/datetime";
import { getChainById } from "@/lib/data/chains";
import { getCityById } from "@/lib/data/cities";
import { getAmenityById, getAccessibilityById } from "@/lib/data/amenities";
import type { Movie, Screening, Theater } from "@/lib/types";
import { MapPlaceholder } from "@/components/MapPlaceholder";
import { DayPicker } from "@/components/DayPicker";
import { ScreeningCard } from "@/components/ScreeningCard";
import { FavoriteButton } from "@/components/FavoriteButton";
import { EmptyState } from "@/components/states/EmptyState";

export function TheaterDetailClient({ theater, screenings, movies }: { theater: Theater; screenings: Screening[]; movies: Movie[] }) {
  const { locale, t } = useLanguage();
  const [dates, setDates] = useState<string[]>([]);

  const name = pick(locale, theater.name, theater.nameHe);
  const address = pick(locale, theater.address, theater.addressHe);
  const chain = getChainById(theater.chainId);
  const city = getCityById(theater.cityId);

  const availableDates = useMemo(() => Array.from(new Set(screenings.map((s) => s.date))).sort(), [screenings]);
  const toggleDate = (d: string) => setDates((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const enriched = useMemo(() => {
    const all = sortByTime(enrichScreeningsClient(screenings, movies, [theater]));
    return all.filter((s) => dates.length === 0 || dates.includes(s.date));
  }, [screenings, movies, theater, dates]);

  const officialUrl = theater.officialUrl ?? chain?.website;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="card-surface relative overflow-hidden p-6">
        <span className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: chain?.color ?? "#9ca3af" }} aria-hidden />
        <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-start gap-1">
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-500">
                  {chain ? pick(locale, chain.name, chain.nameHe) : ""} · {city ? pick(locale, city.name, city.nameHe) : ""}
                </p>
                <h1 className="mt-1 text-2xl font-bold text-ink-900">{name}</h1>
              </div>
              <FavoriteButton theaterId={theater.id} />
            </div>
            <p className="mt-1 text-sm text-neutral-600">{address}</p>
            {theater.screenCount > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="chip">
                  {theater.screenCount} {t("theaters.screens")}
                </span>
              </div>
            )}
          </div>
          {officialUrl && (
            <a href={officialUrl} target="_blank" rel="noreferrer" className="btn-secondary shrink-0">
              🔗 {t("theaters.officialSite")}
            </a>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <MapPlaceholder lat={theater.lat} lng={theater.lng} label={name} />

          {theater.amenities.length > 0 && (
            <div className="card-surface p-4">
              <h2 className="font-semibold text-ink-900">{t("theaters.amenities")}</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {theater.amenities.map((id) => {
                  const amenity = getAmenityById(id);
                  if (!amenity) return null;
                  return (
                    <span key={id} className="chip">
                      <span aria-hidden>{amenity.icon}</span> {pick(locale, amenity.label, amenity.labelHe)}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {theater.accessibility.length > 0 && (
            <div className="card-surface p-4">
              <h2 className="font-semibold text-ink-900">{t("theaters.accessibility")}</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {theater.accessibility.map((id) => {
                  const feature = getAccessibilityById(id);
                  if (!feature) return null;
                  return (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                      ♿ {pick(locale, feature.label, feature.labelHe)}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {(theater.parkingNotes || theater.transitNotes) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {theater.parkingNotes && (
                <div className="card-surface p-4">
                  <h2 className="font-semibold text-ink-900">{t("theaters.parking")}</h2>
                  <p className="mt-1 text-sm text-neutral-600">{pick(locale, theater.parkingNotes ?? "", theater.parkingNotesHe ?? "")}</p>
                </div>
              )}
              {theater.transitNotes && (
                <div className="card-surface p-4">
                  <h2 className="font-semibold text-ink-900">{t("theaters.transit")}</h2>
                  <p className="mt-1 text-sm text-neutral-600">{pick(locale, theater.transitNotes ?? "", theater.transitNotesHe ?? "")}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="card-surface p-4">
            <h2 className="font-semibold text-ink-900">{t("theaters.openingHours")}</h2>
            {theater.openingHours.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm text-neutral-600">
                {theater.openingHours.map((h) => (
                  <li key={h.day} className="flex justify-between">
                    <span>{h.day}</span>
                    <span>{h.hours}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-neutral-400">{t("theaters.hoursUnavailable")}</p>
            )}
          </div>

          <div className="card-surface p-4">
            <h2 className="font-semibold text-ink-900">{t("theaters.updated")}</h2>
            <p className="mt-2 text-xs text-neutral-500">{formatInstant(theater.lastUpdated, locale)}</p>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold text-ink-900">{t("theaters.screeningsHere")}</h2>
        {availableDates.length > 0 && (
          <div className="mt-3">
            <DayPicker dates={availableDates} selected={dates} onToggle={toggleDate} />
          </div>
        )}
        <div className="mt-4 flex flex-col gap-3">
          {enriched.length === 0 ? <EmptyState /> : enriched.map((s) => <ScreeningCard key={s.id} screening={s} showMovieTitle showTheater={false} />)}
        </div>
      </div>
    </div>
  );
}
