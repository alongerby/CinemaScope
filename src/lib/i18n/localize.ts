import type { Locale } from "./dictionaries";

/** Picks the Hebrew or English variant of a bilingual data field. */
export function pick(locale: Locale, en: string, he: string): string {
  return locale === "he" ? he : en;
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * A movie's titles for display. `primary` follows the active locale; `secondary`
 * is the other language, shown only when it's meaningfully different (so a
 * Hebrew-only title isn't rendered twice).
 */
export function movieTitles(locale: Locale, movie: { title: string; titleHe: string }): { primary: string; secondary?: string } {
  const he = (movie.titleHe || "").trim();
  const en = (movie.title || "").trim();
  const primary = locale === "he" ? he || en : en || he;
  const other = locale === "he" ? en : he;
  const secondary = other && norm(other) !== norm(primary) ? other : undefined;
  return { primary, secondary };
}
