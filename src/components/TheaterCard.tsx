"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { pick } from "@/lib/i18n/localize";
import { getChainById } from "@/lib/data/chains";
import { getCityById } from "@/lib/data/cities";
import type { Theater } from "@/lib/types";
import { FavoriteButton } from "./FavoriteButton";

export function TheaterCard({ theater }: { theater: Theater }) {
  const { locale, t } = useLanguage();
  const name = pick(locale, theater.name, theater.nameHe);
  const address = pick(locale, theater.address, theater.addressHe);
  const chain = getChainById(theater.chainId);
  const city = getCityById(theater.cityId);

  return (
    <Link
      href={`/theaters/${theater.id}`}
      className="focus-ring group relative flex flex-col gap-2 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(16,19,34,0.04),0_8px_24px_-12px_rgba(16,19,34,0.12)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_32px_-12px_rgba(16,19,34,0.2)]"
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: chain?.color ?? "#9ca3af" }} aria-hidden />
      <div className="flex items-start justify-between gap-2 pt-1">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-ink-900">{name}</h3>
          <p className="truncate text-xs text-neutral-500">
            {chain ? pick(locale, chain.name, chain.nameHe) : ""}
            {city ? ` · ${pick(locale, city.name, city.nameHe)}` : ""}
          </p>
        </div>
        <FavoriteButton theaterId={theater.id} size="sm" />
      </div>
      <p className="line-clamp-1 text-sm text-neutral-600">{address}</p>
      {theater.screenCount > 0 && (
        <p className="mt-auto pt-1 text-xs text-neutral-500">
          {theater.screenCount} {t("theaters.screens")}
        </p>
      )}
    </Link>
  );
}
