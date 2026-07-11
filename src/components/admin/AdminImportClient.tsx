"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { formatInstant } from "@/lib/datetime";
import type { EnrichedScreening, ProviderImportResult, ProviderStatusSnapshot } from "@/lib/types";
import { refreshDataAction } from "@/app/admin/import/actions";
import { ProviderStatusCard } from "@/components/ProviderStatusCard";
import { ImportPreviewTable } from "@/components/ImportPreviewTable";

interface Props {
  statuses: ProviderStatusSnapshot[];
  results: ProviderImportResult[];
  warnings: string[];
  lastIngestedAt: number | null;
  preview: EnrichedScreening[];
  totals: { movies: number; theaters: number; screenings: number };
}

export function AdminImportClient({ statuses, warnings, lastIngestedAt, preview, totals }: Props) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [justRefreshed, setJustRefreshed] = useState(false);

  function handleRefresh() {
    startTransition(async () => {
      await refreshDataAction();
      setJustRefreshed(true);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{t("admin.title")}</h1>
          <p className="mt-1 text-sm text-neutral-500">{t("admin.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isPending}
          className="btn-primary disabled:pointer-events-none disabled:opacity-60"
        >
          {isPending ? t("admin.refreshing") : `🔄 ${t("admin.refresh")}`}
        </button>
      </div>

      <p className="mt-2 text-xs text-neutral-400">
        {t("admin.lastRun")}: {lastIngestedAt ? formatInstant(lastIngestedAt, locale) : t("admin.never")}
        {justRefreshed && <span className="ms-2 text-emerald-600">✓ {t("admin.ok")}</span>}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="card-surface p-4 text-center">
          <p className="text-2xl font-bold text-ink-900">{totals.movies}</p>
          <p className="text-xs text-neutral-500">{t("admin.moviesImported")}</p>
        </div>
        <div className="card-surface p-4 text-center">
          <p className="text-2xl font-bold text-ink-900">{totals.theaters}</p>
          <p className="text-xs text-neutral-500">{t("admin.theatersImported")}</p>
        </div>
        <div className="card-surface p-4 text-center">
          <p className="text-2xl font-bold text-ink-900">{totals.screenings}</p>
          <p className="text-xs text-neutral-500">{t("admin.screeningsImported")}</p>
        </div>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold text-ink-900">{t("admin.providerStatus")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {statuses.map((s) => (
          <ProviderStatusCard key={s.providerId} status={s} />
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold text-ink-900">{t("admin.validationWarnings")}</h2>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        {warnings.length === 0 ? (
          <p className="text-sm text-amber-800">{t("admin.noWarnings")}</p>
        ) : (
          <ul className="max-h-64 list-inside list-disc space-y-1 overflow-y-auto text-sm text-amber-800">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold text-ink-900">{t("admin.preview")}</h2>
      <ImportPreviewTable screenings={preview} />
    </div>
  );
}
