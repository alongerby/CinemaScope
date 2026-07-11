"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useFavorites } from "@/lib/useFavorites";

/** Star toggle for favoriting a cinema. Safe to place inside a <Link>. */
export function FavoriteButton({ theaterId, size = "md" }: { theaterId: string; size?: "sm" | "md" }) {
  const { t } = useLanguage();
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(theaterId);

  return (
    <button
      type="button"
      aria-pressed={fav}
      aria-label={fav ? t("favorites.remove") : t("favorites.add")}
      title={fav ? t("favorites.remove") : t("favorites.add")}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(theaterId);
      }}
      className={`focus-ring grid shrink-0 place-items-center rounded-full transition-transform hover:scale-110 active:scale-95 ${
        size === "sm" ? "h-7 w-7 text-base" : "h-9 w-9 text-xl"
      } ${fav ? "text-amber-400" : "text-neutral-300 hover:text-amber-400"}`}
    >
      <span aria-hidden>{fav ? "★" : "☆"}</span>
    </button>
  );
}
