// Listing params that belong to the scrutins listing (/parlement/votes).
// Kept in sync with the searchParams accepted by ScrutinsListing.
export const VOTES_LISTING_PARAMS = [
  "page",
  "result",
  "legislature",
  "chamber",
  "theme",
  "type",
  "search",
] as const;

const VOTES_LISTING_PARAM_SET: ReadonlySet<string> = new Set(VOTES_LISTING_PARAMS);

/**
 * Build the canonical /parlement/votes listing target from a /parlement request's
 * query string. Returns null when no non-empty listing param is present, so the
 * bare /parlement hub is never redirected. Input order is preserved, unknown and
 * empty params are dropped, the first occurrence of a repeated param wins, and
 * values are passed through unchanged. Pure + edge-safe (used from middleware).
 */
export function buildVotesListingRedirect(searchParams: URLSearchParams): string | null {
  const out = new URLSearchParams();
  for (const [key, value] of searchParams) {
    if (VOTES_LISTING_PARAM_SET.has(key) && value && !out.has(key)) {
      out.set(key, value);
    }
  }
  const query = out.toString();
  return query ? `/parlement/votes?${query}` : null;
}
