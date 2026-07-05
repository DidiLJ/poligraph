import type { Metadata } from "next";

const NOINDEX_FOLLOW = { index: false, follow: true } as const;

/**
 * Communes below this population get noindex,follow on their municipales-2026
 * page: under 1000 inhabitants the ballot is panachage (no structured lists),
 * so the page is a bare candidate roster Google refuses to index (issue #385).
 * At 1000+ the list-based ballot produces real content (~10k communes).
 */
export const COMMUNE_MIN_POPULATION = 1_000;

/**
 * Unknown population stays indexable (fail-open): never deindex a real page
 * because of missing data. Only 6 communes have a null population in prod.
 */
export function isIndexableCommune(population: number | null | undefined): boolean {
  if (population == null) return true;
  return population >= COMMUNE_MIN_POPULATION;
}

/**
 * `robots` metadata fragment for a municipales-2026 commune page: {} for
 * communes with list-based elections, noindex,follow for thin ones.
 */
export function communeRobotsMetadata(
  population: number | null | undefined
): Pick<Metadata, "robots"> {
  return isIndexableCommune(population) ? {} : { robots: NOINDEX_FOLLOW };
}
