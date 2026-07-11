"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { formatDayParts } from "@/lib/datetime";

/** Multi-select day chips. Empty selection = all days. */
export function DayPicker({ dates, selected, onToggle }: { dates: string[]; selected: string[]; onToggle: (date: string) => void }) {
  const { locale, t } = useLanguage();
  const allActive = selected.length === 0;

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
      {dates.map((d) => {
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
    </div>
  );
}
