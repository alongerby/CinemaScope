"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function EmptyState({ title, body, icon = "🍿" }: { title?: string; body?: string; icon?: string }) {
  const { t } = useLanguage();
  return (
    <div className="animate-float-in flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
      <span className="text-4xl" aria-hidden>
        {icon}
      </span>
      <p className="text-lg font-semibold text-ink-900">{title ?? t("emptyState.title")}</p>
      <p className="max-w-sm text-sm text-neutral-500">{body ?? t("emptyState.body")}</p>
    </div>
  );
}
