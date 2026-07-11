"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function MapPlaceholder({ lat, lng, label }: { lat: number; lng: number; label?: string }) {
  const { t } = useLanguage();
  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-neutral-100 to-neutral-200">
      <div
        className="h-48 w-full bg-[radial-gradient(circle_at_1px_1px,_theme(colors.neutral.400)_1px,_transparent_0)] bg-[length:16px_16px] opacity-40"
        aria-hidden
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
        <span className="text-2xl" aria-hidden>
          📍
        </span>
        <p className="text-sm font-medium text-neutral-700">{label}</p>
        <p className="text-xs text-neutral-500">
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </p>
        <p className="mt-1 max-w-xs text-xs text-neutral-400">{t("theaters.mapPlaceholder")}</p>
      </div>
    </div>
  );
}
