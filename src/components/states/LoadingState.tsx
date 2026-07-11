"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

interface LoadingStateProps {
  rows?: number;
  /** Optional heading + description banner shown above the skeleton rows — used where the wait is meaningful enough to explain (e.g. the first data fetch of the session). */
  title?: string;
  description?: string;
}

export function LoadingState({ rows = 4, title, description }: LoadingStateProps) {
  const { t } = useLanguage();
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{t("common.loading")}</span>
      {(title || description) && (
        <div className="card-surface flex items-center gap-3 p-4">
          <span
            className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"
            aria-hidden
          />
          <div className="min-w-0">
            {title && <p className="text-sm font-semibold text-ink-900">{title}</p>}
            {description && <p className="mt-0.5 text-xs text-ink-600">{description}</p>}
          </div>
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-neutral-200/70" />
      ))}
    </div>
  );
}
