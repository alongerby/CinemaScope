/**
 * Date/time formatting pinned to Israel time. Pinning the timeZone is what
 * keeps server-rendered and client-hydrated output byte-identical — otherwise
 * `toLocaleString()` renders the server's timezone on the server and the
 * browser's timezone on the client, causing a React hydration mismatch
 * (error #425) that silently breaks interactivity across the page.
 */

const TZ = "Asia/Jerusalem";

function loc(locale: "en" | "he"): string {
  return locale === "he" ? "he-IL" : "en-GB";
}

/** Absolute instant (ISO string or epoch ms) → localized date + time. */
export function formatInstant(iso: string | number, locale: "en" | "he"): string {
  return new Date(iso).toLocaleString(loc(locale), {
    timeZone: TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// A YYYY-MM-DD calendar date is anchored at noon UTC so the day never slips
// across a timezone boundary when formatted.
function anchor(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00Z`);
}

/** YYYY-MM-DD → separate weekday + day/month parts (for day chips). */
export function formatDayParts(dateStr: string, locale: "en" | "he"): { weekday: string; day: string } {
  const d = anchor(dateStr);
  return {
    weekday: d.toLocaleDateString(loc(locale), { timeZone: TZ, weekday: "short" }),
    day: d.toLocaleDateString(loc(locale), { timeZone: TZ, day: "numeric", month: "short" }),
  };
}

/** YYYY-MM-DD → long day label, e.g. "Saturday, 4 July". */
export function formatDayLong(dateStr: string, locale: "en" | "he"): string {
  return anchor(dateStr).toLocaleDateString(loc(locale), { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
}

/** Today's date in Israel, as a YYYY-MM-DD string — for filtering out past showtimes. */
export function todayInIsrael(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return parts; // en-CA formats as YYYY-MM-DD
}
