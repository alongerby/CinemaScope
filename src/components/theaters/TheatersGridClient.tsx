"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { pick } from "@/lib/i18n/localize";
import { CITIES } from "@/lib/data/cities";
import { useFavorites } from "@/lib/useFavorites";
import type { Theater } from "@/lib/types";
import { TheaterCard } from "@/components/TheaterCard";
import { EmptyState } from "@/components/states/EmptyState";

export function TheatersGridClient({ theaters }: { theaters: Theater[] }) {
  const { locale, t } = useLanguage();
  const { favorites } = useFavorites();
  const [cityId, setCityId] = useState("");

  const filtered = useMemo(() => theaters.filter((th) => (cityId ? th.cityId === cityId : true)), [theaters, cityId]);

  const favoriteTheaters = useMemo(() => filtered.filter((th) => favorites.includes(th.id)), [filtered, favorites]);

  // Group by city for a clean directory.
  const byCity = useMemo(() => {
    const groups = new Map<string, Theater[]>();
    for (const th of filtered) {
      const list = groups.get(th.cityId) ?? [];
      list.push(th);
      groups.set(th.cityId, list);
    }
    return CITIES.map((c) => ({ city: c, theaters: groups.get(c.id) ?? [] })).filter((g) => g.theaters.length > 0);
  }, [filtered]);

  const citiesWithTheaters = useMemo(() => {
    const ids = new Set(theaters.map((t) => t.cityId));
    return CITIES.filter((c) => ids.has(c.id));
  }, [theaters]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-ink-900">{t("theaters.title")}</h1>
      <p className="mt-1 text-sm text-ink-600">{t("theaters.subtitle")}</p>

      <div className="mt-5">
        <select value={cityId} onChange={(e) => setCityId(e.target.value)} className="w-full max-w-xs px-3.5 py-2.5 text-sm">
          <option value="">{t("filters.allCities")}</option>
          {citiesWithTheaters.map((c) => (
            <option key={c.id} value={c.id}>
              {pick(locale, c.name, c.nameHe)}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          {favoriteTheaters.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-amber-500">
                ★ {t("favorites.title")}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {favoriteTheaters.map((theater) => (
                  <TheaterCard key={`fav-${theater.id}`} theater={theater} />
                ))}
              </div>
            </section>
          )}
          {byCity.map(({ city, theaters: list }) => (
            <section key={city.id}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-600/60">{pick(locale, city.name, city.nameHe)}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((theater) => (
                  <TheaterCard key={theater.id} theater={theater} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
