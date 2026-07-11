/**
 * The same film appears across chains under different internal ids (Yes Planet
 * and Rav-Hen share one id space; Cinema City uses another entirely). To show
 * each movie once — with showtimes merged from every chain — we derive a
 * stable, chain-agnostic movie id from its normalized Hebrew title. Two
 * providers that carry the same film therefore emit the same movie id, and the
 * ingestion pipeline's id de-duplication merges them automatically.
 */

/**
 * Some chains append a generic "this is the movie" qualifier to disambiguate
 * a film from the game/show/book it's based on, e.g. "סופר מריו גלקסי" vs
 * "סופר מריו גלקסי הסרט" ("... the movie"). Different chains don't agree on
 * whether to include it, which otherwise splits one film into two cards (one
 * with a poster/runtime, one without, depending on which chain supplied it).
 * Stripped unconditionally since it carries no distinguishing meaning between
 * two real, different films.
 */
function stripMovieQualifier(titleHe: string): string {
  return titleHe.replace(/\s*[-–:]?\s*(הסרט\s+הקולנועי|הסרט\s+המלא|הסרט)\s*$/u, "").trim() || titleHe.trim();
}

/**
 * Cinema City, Movieland, and Hot Cinema append the print's language/dub (and
 * sometimes an event note) to the title, e.g. "מיניונים ומפלצות-אנגלית",
 * "…-מדובב לרוסית", "… (מדובב)", or "קופה ראשית: הסרט - הקרנה רגישה". Strip it
 * so every print/listing of a film maps to one movie (and de-dupes across
 * chains) — both for the id (via movieKey) and for the displayed title.
 */
export function stripPrintSuffix(titleHe: string): string {
  let n = titleHe.trim();

  // Some listings put MORE text after the marker — a transliterated title in
  // another script, or an event note — e.g. "מייקל מדובב לרוסית - МАЙКЛ",
  // "מיניונים ומפלצות מדובב לערבית مدبلج بالعربية", or "קופה ראשית: הסרט -
  // הקרנה רגישה". Truncating only at the *end* of the string (as below)
  // misses these; cut at the marker itself instead, wherever it falls.
  for (const marker of ["מדובב", "כתוביות", "הקרנה רגישה", "מפגש"]) {
    const idx = n.indexOf(marker);
    if (idx > 0) n = n.slice(0, idx).trim();
  }
  n = n.replace(/[\s\-–:(]+$/u, "").trim(); // dangling connector left after truncation, e.g. "מייקל -" or "… ("

  n = n.replace(/\s*\((מדובב|מדובבת|subtitled|dubbed)[^)]*\)\s*$/iu, "");
  n = n.replace(/\s*[-–]?\s*מדובב(ת)?(\s+ל\S+)?\s*$/u, ""); // "-מדובב", " מדובב לעברית", …
  n = n.replace(/\s*[-–]?\s*(עם\s+)?כתוביות(\s+ב\S+)?\s*$/u, ""); // "כתוביות בעברית"
  n = n.replace(/\s*[-–]\s*(אנגלית|עברית|רוסית|צרפתית|ערבית|דובר \S+)\s*$/u, ""); // "-<lang>"
  n = n.replace(/\s+(אנגלית|רוסית|צרפתית|ערבית)\s*$/u, ""); // trailing standalone <lang>
  n = stripMovieQualifier(n);
  return n.trim() || titleHe.trim();
}

function normalizeTitle(titleHe: string): string {
  return stripMovieQualifier(stripPrintSuffix(titleHe))
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[֑-ׇ]/g, "") // strip Hebrew niqqud/cantillation
    // Punctuation becomes a space (not empty) so e.g. "במבי-הנקמה" and
    // "במבי: הנקמה" both normalize the same way instead of the hyphenated
    // form accidentally fusing the two words together.
    .replace(/["'’”“.,:!?()\-–—]/g, " ")
    // Then drop ALL whitespace (not just collapse it) so titles that differ
    // only in spacing — "סופר גירל" vs "סופרגירל" — hash identically too.
    .replace(/\s+/g, "");
}

/** Small, stable string hash → base36, so ids are short and URL-safe. */
function hash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function movieKey(titleHe: string): string {
  return `mv-${hash(normalizeTitle(titleHe))}`;
}
