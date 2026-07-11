"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { LanguageToggle } from "./LanguageToggle";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/search", key: "nav.showtimes" },
  { href: "/movies", key: "nav.movies" },
  { href: "/theaters", key: "nav.theaters" },
  { href: "/about", key: "nav.about" },
];

export function Header() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-6">
        <Link href="/" className="focus-ring flex min-w-0 items-center gap-2 rounded-lg font-extrabold text-ink-900 sm:gap-2.5">
          <Logo className="h-9 w-9 shrink-0" />
          <span className="truncate text-base tracking-tight sm:text-lg">{t("common.appName")}</span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`focus-ring relative rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  active ? "text-brand-700" : "text-neutral-600 hover:bg-neutral-100 hover:text-ink-900"
                }`}
              >
                {t(link.key)}
                {active && <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-brand-500" />}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <LanguageToggle />
          <button
            type="button"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
            className="focus-ring grid h-10 w-10 place-items-center rounded-lg border border-neutral-200 text-ink-900 md:hidden"
          >
            <span aria-hidden>{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-neutral-200 bg-white px-4 py-3 md:hidden">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="focus-ring rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
