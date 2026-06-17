/**
 * Canonical de la page de concordance des votes (/comparer/votes).
 *
 * Une comparaison n'existe que si `a` ET `b` sont présents : sans eux la page
 * renvoie 404 (page.tsx, notFound() quand slugA/slugB manquent), donc on
 * n'émet PAS de canonical pointant vers cette 404 (retour null).
 *
 * `search`, `filter` et `page` sont volontairement exclus : les variantes
 * filtrées/paginées d'une même paire se consolident sur l'URL propre de la paire.
 */
export function buildComparerVotesCanonical(cat: string, a?: string, b?: string): string | null {
  if (!a || !b) return null;
  const qs = new URLSearchParams({ cat, a, b });
  return `/comparer/votes?${qs.toString()}`;
}
