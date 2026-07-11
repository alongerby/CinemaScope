"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { SourceType } from "@/lib/types";

const STYLES: Record<SourceType, string> = {
  live: "bg-emerald-100 text-emerald-800",
  scraped: "bg-blue-100 text-blue-800",
  cached: "bg-amber-100 text-amber-800",
  demo: "bg-neutral-200 text-neutral-700",
};

const DOT: Record<SourceType, string> = {
  live: "bg-emerald-500",
  scraped: "bg-blue-500",
  cached: "bg-amber-500",
  demo: "bg-neutral-500",
};

export function DataSourceBadge({ source, className = "" }: { source: SourceType; className?: string }) {
  const { t } = useLanguage();
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[source]} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[source]}`} aria-hidden />
      {t(`common.${source}`)}
    </span>
  );
}
