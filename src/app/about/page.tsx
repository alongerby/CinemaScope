"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { CINEMA_CHAINS } from "@/lib/data/chains";
import { pick } from "@/lib/i18n/localize";

export default function AboutPage() {
  const { locale, t } = useLanguage();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-ink-900">{t("about.title")}</h1>
      <div className="mt-6 space-y-4 text-neutral-700">
        <p>{t("about.body1")}</p>
        <p>{t("about.body2")}</p>
        <p>{t("about.body3")}</p>
      </div>

      <div className="mt-8 card-surface p-6">
        <h2 className="font-semibold text-ink-900">{t("about.dataSources")}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {CINEMA_CHAINS.map((chain) => (
            <span key={chain.id} className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-1.5 text-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chain.color }} aria-hidden />
              {pick(locale, chain.name, chain.nameHe)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
