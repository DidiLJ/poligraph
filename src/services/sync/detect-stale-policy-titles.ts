/**
 * STALE detector for policy titles. An APPROVED ScrutinPolicyTitle was validated
 * against a specific snapshot of its inputs (title, links, official substance).
 * When any of those inputs drift, the approved title may no longer match. This
 * service recomputes each APPROVED row's inputHash from the CURRENT inputs and
 * flips the row to STALE when it diverges from the stored hash.
 *
 * The hash is built via the SAME `buildInputHashInput` the generator uses, so the
 * detector and the generator can never disagree on what "the inputs" are.
 */

import { db } from "@/lib/db";
import { buildInputHashInput, proceduralLabel } from "@/services/scrutin-policy-title";
import { resolveSubstanceSources } from "@/services/scrutin-policy-title/substance-resolver";
import { computeInputHash } from "@/services/scrutin-policy-title/input-hash";

/**
 * Recomputes the inputHash for a scrutin from its current title, amendment links
 * and resolved official substance. Mirrors the orchestrator exactly. Exported so
 * callers (and tests) can seed a "currently-matching" stored hash.
 */
export async function recomputeInputHashForScrutin(scrutinId: string): Promise<string> {
  const scrutin = await db.scrutin.findUnique({
    where: { id: scrutinId },
    select: {
      title: true,
      sourceUrl: true,
      amendmentLinks: {
        select: {
          role: true,
          amendment: { select: { id: true, number: true } },
        },
      },
    },
  });

  if (!scrutin) {
    throw new Error(`Scrutin not found: ${scrutinId}`);
  }

  const label = proceduralLabel(scrutin.amendmentLinks);
  const resolved = await resolveSubstanceSources(scrutinId);
  return computeInputHash(buildInputHashInput(scrutin, label, resolved.blocks));
}

/**
 * Scans every APPROVED ScrutinPolicyTitle, recomputes its inputHash, and flips
 * rows whose inputs changed to STALE. Idempotent: a row already matching its
 * inputs is left untouched. Non-APPROVED rows are never checked.
 */
export async function detectStalePolicyTitles(opts?: {
  limit?: number;
}): Promise<{ checked: number; staled: number }> {
  const rows = await db.scrutinPolicyTitle.findMany({
    where: { status: "APPROVED" },
    select: { id: true, scrutinId: true, inputHash: true },
    orderBy: { generatedAt: "asc" },
    ...(opts?.limit !== undefined ? { take: opts.limit } : {}),
  });

  let staled = 0;
  for (const row of rows) {
    const currentHash = await recomputeInputHashForScrutin(row.scrutinId);
    if (currentHash !== row.inputHash) {
      await db.scrutinPolicyTitle.update({
        where: { id: row.id },
        data: { status: "STALE" },
      });
      staled++;
    }
  }

  return { checked: rows.length, staled };
}
