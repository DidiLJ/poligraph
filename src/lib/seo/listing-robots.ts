import type { Metadata } from "next";

const NOINDEX_FOLLOW = { index: false, follow: true } as const;

/**
 * `robots` metadata fragment for a utility-filtered listing variant:
 * noindex,follow (Google can crawl and follow links, but won't index the
 * filtered/paginated URL). Returns {} for the bare listing so it inherits the
 * site default (index:true). Spread into the page's generateMetadata return.
 */
export function listingRobotsMetadata(hasActiveFilter: boolean): Pick<Metadata, "robots"> {
  return hasActiveFilter ? { robots: NOINDEX_FOLLOW } : {};
}

/**
 * True when a listing URL carries any utility filter/search param, or is
 * paginated beyond page 1. Pure and route-agnostic: pass the route's filter
 * keys. Pagination uses Number() (stricter than parseInt: "2abc" -> NaN -> false).
 */
export function hasActiveListingFilter(
  params: Record<string, string | undefined>,
  filterKeys: readonly string[],
  paginationKey = "page"
): boolean {
  if (filterKeys.some((key) => Boolean(params[key]))) return true;

  const rawPage = params[paginationKey];
  if (!rawPage) return false;
  const pageNumber = Number(rawPage);
  return Number.isFinite(pageNumber) && pageNumber > 1;
}
