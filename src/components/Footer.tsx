"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © {t("common.appName")} — {t("footer.rights")}
        </p>
        <div className="flex gap-4">
          <Link href="/about" className="focus-ring rounded hover:text-ink-900">
            {t("footer.legal")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
