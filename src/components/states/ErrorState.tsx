"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center">
      <span className="text-3xl" aria-hidden>
        ⚠️
      </span>
      <p className="text-lg font-semibold text-red-900">{t("common.errorTitle")}</p>
      <p className="max-w-sm text-sm text-red-700">{t("common.errorBody")}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="focus-ring mt-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}
