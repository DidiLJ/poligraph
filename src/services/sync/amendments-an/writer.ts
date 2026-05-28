import crypto from "crypto";
import { db } from "@/lib/db";
import type { NormalizedAmendment } from "./types";

export interface BatchResult {
  created: number;
  updated: number;
  dossiersResolved: number;
  dossiersUnresolved: number;
}

/**
 * Idempotent upsert by externalId. Resolves dossierRefFromPath -> dossierId via
 * a bulk lookup, then per-row create/update. Returns counts of dossier-refs that
 * resolved vs. did not (for visibility into amendments referencing a dossier we
 * haven't ingested).
 */
export async function writeAmendmentBatch(batch: NormalizedAmendment[]): Promise<BatchResult> {
  let created = 0;
  let updated = 0;
  let dossiersResolved = 0;
  let dossiersUnresolved = 0;

  // Bulk-resolve dossier refs.
  const dossierRefs = [
    ...new Set(batch.map((b) => b.dossierRefFromPath).filter((x): x is string => !!x)),
  ];
  const dossiers = dossierRefs.length
    ? await db.legislativeDossier.findMany({
        where: { externalId: { in: dossierRefs } },
        select: { id: true, externalId: true },
      })
    : [];
  const dossierIdByRef = new Map(dossiers.map((d) => [d.externalId, d.id]));

  for (const a of batch) {
    if (!a.externalId || !a.number) continue;

    let dossierId: string | null = null;
    if (a.dossierRefFromPath) {
      const resolved = dossierIdByRef.get(a.dossierRefFromPath);
      if (resolved) {
        dossierId = resolved;
        dossiersResolved++;
      } else {
        dossiersUnresolved++;
      }
    }

    const data = {
      number: a.number,
      texteRef: a.texteRef,
      article: a.article,
      content: a.content,
      summary: a.summary,
      status: a.status,
      authorType: a.authorType,
      authorName: a.authorName,
      legislature: a.legislature,
      chamber: a.chamber,
      dossierId,
    };

    const existing = await db.amendment.findUnique({
      where: { externalId: a.externalId },
      select: { id: true },
    });

    if (existing) {
      await db.amendment.update({ where: { externalId: a.externalId }, data });
      updated++;
    } else {
      await db.amendment.create({ data: { externalId: a.externalId, ...data } });
      created++;
    }
  }

  return { created, updated, dossiersResolved, dossiersUnresolved };
}

/**
 * Second pass: set parentAmendmentId from parentExternalId.
 * Idempotent (skipped when already correct).
 */
export async function resolveParents(
  records: NormalizedAmendment[]
): Promise<{ resolved: number; deferred: number }> {
  let resolved = 0;
  let deferred = 0;

  const withParent = records.filter((r) => r.parentExternalId);
  const parentRefs = [...new Set(withParent.map((r) => r.parentExternalId as string))];
  const parents = parentRefs.length
    ? await db.amendment.findMany({
        where: { externalId: { in: parentRefs } },
        select: { id: true, externalId: true },
      })
    : [];
  const idByRef = new Map(parents.map((p) => [p.externalId, p.id]));

  for (const r of withParent) {
    const pid = idByRef.get(r.parentExternalId as string);
    if (!pid) {
      deferred++;
      continue;
    }
    await db.amendment.update({
      where: { externalId: r.externalId },
      data: { parentAmendmentId: pid },
    });
    resolved++;
  }
  return { resolved, deferred };
}

/** Deterministic group key shared by all members of an AN identique discussion. */
export function computeIdenticalGroupKey(discussionId: string): string {
  return crypto.createHash("sha1").update(`identique:${discussionId}`).digest("hex").slice(0, 16);
}

/** Set identicalGroupKey for grouped amendments. Idempotent (same key on re-run). */
export async function resolveIdenticalGroups(
  records: NormalizedAmendment[]
): Promise<{ groups: number }> {
  const byDiscussion = new Map<string, string[]>();
  for (const r of records) {
    if (!r.identicalDiscussionId) continue;
    const arr = byDiscussion.get(r.identicalDiscussionId) ?? [];
    arr.push(r.externalId);
    byDiscussion.set(r.identicalDiscussionId, arr);
  }
  for (const [discussionId, externalIds] of byDiscussion) {
    const key = computeIdenticalGroupKey(discussionId);
    await db.amendment.updateMany({
      where: { externalId: { in: externalIds } },
      data: { identicalGroupKey: key },
    });
  }
  return { groups: byDiscussion.size };
}
