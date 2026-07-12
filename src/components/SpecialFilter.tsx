"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Screening } from "@/lib/types";

export type SpecialFilterKey = "dubbed" | "subtitled" | "original" | "vip" | "threeD" | "imax" | "fourDX";

const SPECIAL_FILTER_KEYS: SpecialFilterKey[] = ["dubbed", "subtitled", "original", "vip", "threeD", "imax", "fourDX"];

const SPECIAL_PREDICATES: Record<SpecialFilterKey, (s: Screening) => boolean> = {
  dubbed: (s) => s.printKind === "dubbed",
  subtitled: (s) => s.printKind === "subtitled",
  original: (s) => s.printKind === "original",
  vip: (s) => s.format === "VIP",
  threeD: (s) => s.format === "3D",
  imax: (s) => s.format === "IMAX",
  fourDX: (s) => s.format === "4DX",
};

/** True if a screening matches at least one of the selected special filters (OR within the group); no selection = match everything. */
export function matchesSpecialFilters(s: Screening, selected: SpecialFilterKey[]): boolean {
  return selected.length === 0 || selected.some((key) => SPECIAL_PREDICATES[key](s));
}

/** Multi-select chips for screening attributes (dub/subtitle print, VIP/3D/IMAX/4DX format). Empty selection = no filtering. */
export function SpecialFilter({ selected, onToggle }: { selected: SpecialFilterKey[]; onToggle: (key: SpecialFilterKey) => void }) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink-900">{t("filters.special")}</span>
      <div className="flex flex-wrap gap-2">
        {SPECIAL_FILTER_KEYS.map((key) => {
          const active = selected.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggle(key)}
              aria-pressed={active}
              className={`focus-ring rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-sand-200 bg-white text-ink-700 hover:border-brand-300"
              }`}
            >
              {t(`filters.${key}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
