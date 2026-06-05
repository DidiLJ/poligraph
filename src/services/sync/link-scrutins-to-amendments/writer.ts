import { db } from "@/lib/db";
import type { ResolvedLink } from "./types";

export interface WriteResult {
  created: number;
  skipped: number;
}

/**
 * Persists ResolvedLinks as ScrutinAmendment rows.
 * createMany({ skipDuplicates: true }) — the composite PK (scrutinId, amendmentId)
 * provides the uniqueness guarantee. `source` is hard-coded to "TITLE_REGEX"
 * (V1 has no other linker source).
 */
export async function writeScrutinAmendments(links: ResolvedLink[]): Promise<WriteResult> {
  if (links.length === 0) return { created: 0, skipped: 0 };

  const pairs = links.map((l) => ({ scrutinId: l.scrutinId, amendmentId: l.amendmentId }));
  const existing = await db.scrutinAmendment.findMany({
    where: { OR: pairs.map((p) => ({ scrutinId: p.scrutinId, amendmentId: p.amendmentId })) },
    select: { scrutinId: true, amendmentId: true },
  });
  const existingSet = new Set(existing.map((e) => `${e.scrutinId}:${e.amendmentId}`));

  const toInsert = links.filter((l) => !existingSet.has(`${l.scrutinId}:${l.amendmentId}`));
  if (toInsert.length === 0) return { created: 0, skipped: links.length };

  const result = await db.scrutinAmendment.createMany({
    skipDuplicates: true,
    data: toInsert.map((l) => ({
      scrutinId: l.scrutinId,
      amendmentId: l.amendmentId,
      role: l.role,
      source: "TITLE_REGEX" as const,
      parserConfidence: l.parserConfidence,
      parserWarnings: l.parserWarnings.length ? l.parserWarnings : undefined,
    })),
  });

  return { created: result.count, skipped: links.length - result.count };
}
