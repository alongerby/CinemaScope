"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { formatInstant } from "@/lib/datetime";
import type { ProviderStatusSnapshot } from "@/lib/types";
import { DataSourceBadge } from "./DataSourceBadge";

export function ProviderStatusCard({ status }: { status: ProviderStatusSnapshot }) {
  const { t, locale } = useLanguage();
  const result = status.lastResult;
  const ok = result?.success && (result?.errors.length ?? 0) === 0;

  return (
    <div className="flex flex-col gap-2 card-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-ink-900">{status.providerName}</h3>
        <DataSourceBadge source={status.sourceType} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
        <span>
          {t("admin.priority")}: {status.priority}
        </span>
        <span>
          {t("admin.status")}: {ok ? `✅ ${t("admin.ok")}` : `⚠️ ${t("admin.failed")}`}
        </span>
        <span>
          {t("admin.lastSuccess")}: {status.lastSuccessAt ? formatInstant(status.lastSuccessAt, locale) : t("admin.never")}
        </span>
      </div>
      {result && (
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-neutral-50 p-3 text-center text-xs">
          <div>
            <p className="text-lg font-bold text-ink-900">{result.moviesImported}</p>
            <p className="text-neutral-500">{t("admin.moviesImported")}</p>
          </div>
          <div>
            <p className="text-lg font-bold text-ink-900">{result.theatersImported}</p>
            <p className="text-neutral-500">{t("admin.theatersImported")}</p>
          </div>
          <div>
            <p className="text-lg font-bold text-ink-900">{result.screeningsImported}</p>
            <p className="text-neutral-500">{t("admin.screeningsImported")}</p>
          </div>
        </div>
      )}
      {result && result.warnings.length > 0 && (
        <details className="text-xs text-amber-700">
          <summary className="cursor-pointer font-medium">
            {t("admin.warnings")} ({result.warnings.length})
          </summary>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
      {result && result.errors.length > 0 && (
        <details className="text-xs text-red-700">
          <summary className="cursor-pointer font-medium">
            {t("admin.errors")} ({result.errors.length})
          </summary>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {result.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
