"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useFavorites } from "@/lib/useFavorites";
import type { Theater } from "@/lib/types";

/**
 * One-click shortcut that sets the theater-picker selection to exactly the
 * user's favorite cinemas (or clears it if favorites are already the whole
 * selection). Shared across search, movies, and movie-detail so the filter
 * behavior is identical everywhere a TheaterPicker appears.
 */
export function FavoritesOnlyButton({
  theaters,
  selected,
  onChange,
}: {
  theaters: Theater[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { t } = useLanguage();
  const { favorites } = useFavorites();

  const favInSet = theaters.filter((th) => favorites.includes(th.id)).map((th) => th.id);
  if (favInSet.length === 0) return null;

  const isActive = favInSet.length > 0 && favInSet.every((id) => selected.includes(id)) && selected.length === favInSet.length;

  return (
    <button
      type="button"
      onClick={() => onChange(isActive ? [] : favInSet)}
      aria-pressed={isActive}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
        isActive ? "border-amber-400 bg-amber-50 text-amber-700" : "border-sand-200 bg-white text-ink-800 hover:border-amber-300"
      }`}
    >
      ★ {t("favorites.onlyFavorites")}
    </button>
  );
}
