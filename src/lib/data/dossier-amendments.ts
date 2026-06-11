import { db } from "@/lib/db";
import { extractText } from "@/lib/parsing/html-utils";
import type { AmendmentStatus, Prisma } from "@/generated/prisma";
import { compareAmendmentNumbers, formatArticleLabel } from "./amendment-format";

export type AmendmentFilter = "adopted" | "rejected" | "with-content";

export const AMENDMENT_FILTERS: AmendmentFilter[] = ["adopted", "rejected", "with-content"];
export const AMENDMENTS_PAGE_SIZE = 20;
/**
 * Hard cap on the "with-content" filter: Poligraph helps readers understand a
 * dossier, it is not a paginated mirror of AN.fr. Beyond this, link out to AN.
 */
export const ALL_WITH_CONTENT_CAP = 200;
const EXCERPT_LENGTH = 400;

export interface CuratedAmendment {
  id: string;
  number: string;
  status: AmendmentStatus;
  articleLabel: string | null;
  authorName: string | null;
  authorType: string | null;
  excerpt: string | null;
}

export interface AmendmentStats {
  total: number;
  byStatus: Record<AmendmentStatus, number>;
}

export interface CuratedAmendmentsPage {
  filter: AmendmentFilter;
  items: CuratedAmendment[];
  /** Total amendments matching the filter (clamped to the cap for "with-content"). */
  total: number;
  hasMore: boolean;
  /** True when "with-content" matches more than the cap and we stopped at it. */
  capped: boolean;
}

function filterWhere(dossierId: string, filter: AmendmentFilter): Prisma.AmendmentWhereInput {
  // Boilerplate amendments (author + "insérer l'article suivant:" with no exposé
  // nor dispositif) carry no citizen value and are excluded from every filter.
  const base: Prisma.AmendmentWhereInput = {
    dossierId,
    OR: [{ summary: { not: null } }, { content: { not: null } }],
  };
  if (filter === "adopted") return { ...base, status: "ADOPTE" };
  if (filter === "rejected") return { ...base, status: "REJETE" };
  return base; // with-content: any status, content required
}

function toExcerpt(summary: string | null, content: string | null): string | null {
  const raw = summary ?? content;
  if (!raw) return null;
  const text = extractText(raw);
  if (text.length <= EXCERPT_LENGTH) return text;
  return text.slice(0, EXCERPT_LENGTH).trimEnd() + "…";
}

/** Counts by status (and total) for the dossier's amendments. */
export async function getAmendmentStats(dossierId: string): Promise<AmendmentStats> {
  const grouped = await db.amendment.groupBy({
    by: ["status"],
    where: { dossierId },
    _count: true,
  });
  const byStatus: Record<AmendmentStatus, number> = {
    DEPOSE: 0,
    ADOPTE: 0,
    REJETE: 0,
    RETIRE: 0,
    TOMBE: 0,
  };
  let total = 0;
  for (const g of grouped) {
    byStatus[g.status] = g._count;
    total += g._count;
  }
  return { total, byStatus };
}

/**
 * One page of curated amendments for a dossier.
 *
 * Two-step to keep payloads small and the sort correct: (1) fetch lightweight
 * {id, number} for every match and sort numerically in JS (Prisma can't ORDER BY a
 * computed numeric key on a String column); (2) fetch the full rows for the page slice
 * only. The "with-content" filter is clamped to ALL_WITH_CONTENT_CAP.
 */
export async function getCuratedAmendments(
  dossierId: string,
  filter: AmendmentFilter,
  page: number // 1-based, matching parsePagination()
): Promise<CuratedAmendmentsPage> {
  const where = filterWhere(dossierId, filter);

  const keys = await db.amendment.findMany({ where, select: { id: true, number: true } });
  keys.sort((a, b) => compareAmendmentNumbers(a.number, b.number));

  const capped = filter === "with-content" && keys.length > ALL_WITH_CONTENT_CAP;
  const sorted = capped ? keys.slice(0, ALL_WITH_CONTENT_CAP) : keys;
  const total = sorted.length;

  const start = Math.max(0, page - 1) * AMENDMENTS_PAGE_SIZE;
  const pageKeys = sorted.slice(start, start + AMENDMENTS_PAGE_SIZE);
  const hasMore = start + AMENDMENTS_PAGE_SIZE < total;

  if (pageKeys.length === 0) {
    return { filter, items: [], total, hasMore: false, capped };
  }

  const rows = await db.amendment.findMany({
    where: { id: { in: pageKeys.map((k) => k.id) } },
    select: {
      id: true,
      number: true,
      status: true,
      article: true,
      authorName: true,
      authorType: true,
      summary: true,
      content: true,
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  // Preserve the numeric sort order from the key list.
  const items: CuratedAmendment[] = pageKeys.map((k) => {
    const r = byId.get(k.id)!;
    return {
      id: r.id,
      number: r.number,
      status: r.status,
      articleLabel: r.article ? formatArticleLabel(extractText(r.article)) : null,
      authorName: r.authorName ? extractText(r.authorName) : null,
      authorType: r.authorType,
      excerpt: toExcerpt(r.summary, r.content),
    };
  });

  return { filter, items, total, hasMore, capped };
}
