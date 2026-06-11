/**
 * Pure formatting helpers for AN amendment numbers and article designations.
 * Used by the curated dossier amendments view and unit-tested in isolation.
 */

/**
 * Extract the first integer embedded in an AN amendment number, for numeric sort.
 *
 * AN numbers are not always plain integers: commission amendments are prefixed
 * ("CD332", "CE135"), some carry a rectification suffix ("600 (Rect)"), a few use
 * other separators ("I-390"). We sort on the embedded integer and fall back to a
 * string compare for ties and digit-less values.
 *
 * @returns the integer, or null when the value contains no digit.
 */
export function amendmentNumberSortKey(value: string): number | null {
  const match = value.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Compare two AN amendment numbers numerically, digit-less values last.
 * Ties break on the original string so "600" precedes "600 (Rect)" deterministically.
 */
export function compareAmendmentNumbers(a: string, b: string): number {
  const ka = amendmentNumberSortKey(a);
  const kb = amendmentNumberSortKey(b);
  if (ka === null && kb === null) return a.localeCompare(b, "fr");
  if (ka === null) return 1;
  if (kb === null) return -1;
  if (ka !== kb) return ka - kb;
  return a.localeCompare(b, "fr");
}

// AN appends this formula to amendments that insert a brand-new article; it adds
// no information once the dispositif/exposé is shown, so we strip it.
const INSERT_FORMULA = /,?\s*ins[eé]rer\s+l['’]article\s+suivant\s*:?\s*$/i;

/**
 * Turn AN's verbose, all-caps article designation into a short readable label.
 *
 * "APRÈS L'ARTICLE 11, insérer l'article suivant:" -> "Après l'article 11"
 * "ARTICLE 10" -> "Article 10"; "ARTICLE PREMIER" -> "Article premier"
 *
 * Mixed-case input is left untouched (only AN's ALL-CAPS values are sentence-cased).
 */
export function formatArticleLabel(article: string): string {
  let s = article.trim().replace(INSERT_FORMULA, "").trim();
  if (s.length > 0 && !/[a-zà-ÿ]/.test(s)) {
    s = s.toLowerCase();
    s = s.charAt(0).toUpperCase() + s.slice(1);
  }
  return s;
}
