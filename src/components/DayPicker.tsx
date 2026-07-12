"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { formatDayParts } from "@/lib/datetime";

const VISIBLE_COUNT = 4;

/**
 * Multi-select day chips. Empty selection = all days.
 *
 * Collapsed to the first few days by default — with the presale window now
 * spanning up to 35 days, rendering every date as a wrapped chip inside a
 * `sticky-filter-bar` could grow tall enough to cover most of a phone
 * screen (a sticky element doesn't scroll away). "Show more" reveals the
 * rest on demand instead.
 */
export function DayPicker({ dates, selected, onToggle }: { dates: string[]; selected: string[]; onToggle: (date: string) => void }) {
  const { locale, t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const allActive = selected.length === 0;

  const hasMore = dates.length > VISIBLE_COUNT;
  const visibleDates = expanded ? dates : dates.slice(0, VISIBLE_COUNT);

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => selected.forEach(onToggle)}
        aria-pressed={allActive}
        className={`focus-ring rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors ${
          allActive ? "border-brand-500 bg-brand-500 text-white" : "border-sand-200 bg-white text-ink-700 hover:border-brand-300"
        }`}
      >
        {t("filters.allDays")}
      </button>
      {visibleDates.map((d) => {
        const active = selected.includes(d);
        const { weekday, day } = formatDayParts(d, locale);
        return (
          <button
            key={d}
            type="button"
            onClick={() => onToggle(d)}
            aria-pressed={active}
            className={`focus-ring flex flex-col items-center rounded-xl border px-3.5 py-1.5 text-sm leading-tight transition-colors ${
              active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-sand-200 bg-white text-ink-700 hover:border-brand-300"
            }`}
          >
            <span className="font-semibold capitalize">{weekday}</span>
            <span className="text-[11px] opacity-70">{day}</span>
          </button>
        );
      })}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="focus-ring rounded-xl border border-dashed border-sand-300 px-3.5 py-2 text-sm font-medium text-ink-600 transition-colors hover:border-brand-300 hover:text-brand-700"
        >
          {expanded ? t("common.showLess") : t("common.showMore")}
        </button>
      )}
    </div>
  );
}
