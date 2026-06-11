import { NextResponse } from "next/server";
import { withPublicRoute } from "@/lib/api/with-public-route";
import { withCache } from "@/lib/cache";
import { parsePagination } from "@/lib/api/pagination";
import {
  getCuratedAmendments,
  AMENDMENT_FILTERS,
  type AmendmentFilter,
} from "@/lib/data/dossier-amendments";

/**
 * Curated, numerically-sorted amendments for a dossier, paginated.
 * Public read-only data; cached on the "static" tier so it matches the dossier
 * page's hourly ISR and avoids hitting the DB on every "Voir plus" click.
 */
export const GET = withPublicRoute(async (request, context) => {
  const { id } = await context.params;

  const url = new URL(request.url);
  const filterParam = url.searchParams.get("filter") ?? "adopted";
  const filter: AmendmentFilter = (AMENDMENT_FILTERS as string[]).includes(filterParam)
    ? (filterParam as AmendmentFilter)
    : "adopted";

  // 1-based, clamped by the shared helper (CI bans inline parseInt for pagination).
  const { page } = parsePagination(url.searchParams);

  const result = await getCuratedAmendments(id!, filter, Math.min(page, 1000));
  return withCache(NextResponse.json(result), "static");
});
