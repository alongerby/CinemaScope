"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { pick } from "@/lib/i18n/localize";
import { CINEMA_CHAINS, getChainById } from "@/lib/data/chains";
import { CITIES, getCityById } from "@/lib/data/cities";
import { useFavorites } from "@/lib/useFavorites";
import type { Theater } from "@/lib/types";

type GroupBy = "city" | "chain";

/**
 * Multi-select list of specific theaters (e.g. "Movieland Netanya"), grouped by
 * city and searchable by name, with favorites pinned to the top. Empty
 * selection = every theater. The app's primary "which cinemas" control.
 */
export function TheaterPicker({
  theaters,
  selected,
  onToggle,
  onClear,
}: {
  theaters: Theater[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const { locale, t } = useLanguage();
  const { isFavorite, toggle: toggleFav } = useFavorites();
  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("city");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return theaters.filter((th) => !q || `${th.name} ${th.nameHe}`.toLowerCase().includes(q));
  }, [theaters, query]);

  const favoriteList = useMemo(() => matches.filter((th) => isFavorite(th.id)), [matches, isFavorite]);

  const groups = useMemo(() => {
    const map = new Map<string, Theater[]>();
    for (const th of matches) {
      const key = groupBy === "chain" ? th.chainId : th.cityId;
      const list = map.get(key) ?? [];
      list.push(th);
      map.set(key, list);
    }
    if (groupBy === "chain") {
      const order = [...CINEMA_CHAINS.map((c) => c.id), ...[...map.keys()].filter((id) => !getChainById(id))];
      return order
        .filter((id) => map.has(id))
        .map((id) => ({ id, label: (() => { const c = getChainById(id); return c ? pick(locale, c.name, c.nameHe) : id; })(), theaters: map.get(id)! }));
    }
    const order = [...CITIES.map((c) => c.id), ...[...map.keys()].filter((id) => !getCityById(id))];
    return order
      .filter((id) => map.has(id))
      .map((id) => {
        const known = getCityById(id);
        const sample = map.get(id)![0];
        const label = known ? pick(locale, known.name, known.nameHe) : sample.cityNameHe ?? id;
        return { id, label, theaters: map.get(id)! };
      });
  }, [matches, groupBy, locale]);

  function Row({ th }: { th: Theater }) {
    const chain = getChainById(th.chainId);
    const active = selected.includes(th.id);
    const fav = isFavorite(th.id);
    return (
      <div
        className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm transition-colors ${active ? "bg-brand-50 text-brand-800" : "text-ink-700 hover:bg-sand-50"}`}
      >
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 py-0.5">
          <input type="checkbox" checked={active} onChange={() => onToggle(th.id)} className="h-4 w-4 shrink-0 rounded accent-brand-500" />
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: chain?.color ?? "#9ca3af" }} aria-hidden />
          <span className="truncate">{pick(locale, th.name, th.nameHe)}</span>
        </label>
        <button
          type="button"
          onClick={() => toggleFav(th.id)}
          aria-pressed={fav}
          aria-label={fav ? t("favorites.remove") : t("favorites.add")}
          title={fav ? t("favorites.remove") : t("favorites.add")}
          className={`focus-ring grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm transition-transform hover:scale-110 ${fav ? "text-amber-400" : "text-neutral-300 hover:text-amber-400"}`}
        >
          <span aria-hidden>{fav ? "★" : "☆"}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="card-surface flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink-900">
          {t("filters.theaters")}{" "}
          <span className="text-xs font-normal text-ink-600/60">
            {selected.length === 0 ? `(${t("filters.allTheaters")})` : `(${selected.length})`}
          </span>
        </h2>
        {selected.length > 0 && (
          <button type="button" onClick={onClear} className="focus-ring rounded text-xs font-medium text-brand-700 hover:underline">
            {t("filters.clearAll")}
          </button>
        )}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("filters.searchTheater")}
        className="w-full px-3.5 py-2 text-sm"
      />

      {/* Group the list by city or by cinema company */}
      <div className="flex rounded-lg border border-sand-200 p-0.5 text-xs font-medium">
        {(["city", "chain"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setGroupBy(mode)}
            aria-pressed={groupBy === mode}
            className={`focus-ring flex-1 rounded-md px-2 py-1 transition-colors ${groupBy === mode ? "bg-brand-500 text-white" : "text-ink-600 hover:bg-sand-50"}`}
          >
            {t(mode === "city" ? "filters.byCity" : "filters.byChain")}
          </button>
        ))}
      </div>

      <div className="flex max-h-[26rem] flex-col gap-3 overflow-y-auto pe-1">
        {favoriteList.length > 0 && (
          <div>
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-amber-500">★ {t("favorites.title")}</p>
            <div className="flex flex-col">
              {favoriteList.map((th) => (
                <Row key={`fav-${th.id}`} th={th} />
              ))}
            </div>
          </div>
        )}
        {groups.map(({ id, label, theaters: list }) => (
          <div key={id}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-600/50">{label}</p>
            <div className="flex flex-col">
              {list.map((th) => (
                <Row key={th.id} th={th} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
