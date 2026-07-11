"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { pick } from "@/lib/i18n/localize";
import type { EnrichedScreening } from "@/lib/types";
import { DataSourceBadge } from "./DataSourceBadge";

export function ImportPreviewTable({ screenings }: { screenings: EnrichedScreening[] }) {
  const { locale, t } = useLanguage();

  return (
    <div className="overflow-x-auto card-surface">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
          <tr>
            <th className="px-4 py-3 text-start">{t("admin.colMovie")}</th>
            <th className="px-4 py-3 text-start">{t("admin.colTheater")}</th>
            <th className="px-4 py-3 text-start">{t("admin.colDate")}</th>
            <th className="px-4 py-3 text-start">{t("admin.colTime")}</th>
            <th className="px-4 py-3 text-start">{t("admin.colFormat")}</th>
            <th className="px-4 py-3 text-start">{t("screening.source")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {screenings.map((s) => (
            <tr key={s.id} className="hover:bg-neutral-50">
              <td className="px-4 py-3 font-medium text-ink-900">{pick(locale, s.movie.title, s.movie.titleHe)}</td>
              <td className="px-4 py-3">{pick(locale, s.theater.name, s.theater.nameHe)}</td>
              <td className="px-4 py-3">{s.date}</td>
              <td className="px-4 py-3">{s.time}</td>
              <td className="px-4 py-3">{s.format}</td>
              <td className="px-4 py-3">
                <DataSourceBadge source={s.sourceType} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
