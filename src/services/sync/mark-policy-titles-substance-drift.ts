import { db } from "@/lib/db";
import type { PolicyTitleSubstanceDriftResult } from "./amendments-an/types";
import { planSubstanceDriftActions } from "./policy-title-substance-drift-plan";

/**
 * Consume the substance-drift signal produced by the AN sync writer
 * (`changedSubstanceAmendmentIds`): flag the policy titles linked to those
 * amendments for regeneration.
 *
 * Read-mostly: resolves amendmentId -> ScrutinAmendment -> scrutinId (deduped),
 * loads the unique policy title per scrutin, and applies STALE / queued markers via
 * two bulk updateMany calls. It NEVER generates, approves, publishes, or creates a
 * ScrutinPolicyTitle, and never calls a model. Returns explicit per-bucket stats.
 *
 * APPROVED -> STALE; NEEDS_REVIEW / DRAFT -> regenerationStatus "queued" (status
 * unchanged); REJECTED / STALE -> untouched.
 */
export async function markPolicyTitlesForSubstanceDrift(
  changedSubstanceAmendmentIds: string[]
): Promise<PolicyTitleSubstanceDriftResult> {
  const result: PolicyTitleSubstanceDriftResult = {
    changedSubstanceAmendmentCount: changedSubstanceAmendmentIds.length,
    linkedScrutins: 0,
    policyTitlesMarkedStale: 0,
    policyTitlesQueuedOrFlagged: 0,
    policyTitlesIgnored: 0,
  };
  if (changedSubstanceAmendmentIds.length === 0) return result; // no-op

  // amendmentId -> scrutinId, deduplicated.
  const links = await db.scrutinAmendment.findMany({
    where: { amendmentId: { in: changedSubstanceAmendmentIds } },
    select: { scrutinId: true },
  });
  const scrutinIds = [...new Set(links.map((l) => l.scrutinId))];
  result.linkedScrutins = scrutinIds.length;
  if (scrutinIds.length === 0) return result; // amendments not linked to any scrutin

  // scrutinId is @unique on ScrutinPolicyTitle, so at most one title per scrutin.
  const titles = await db.scrutinPolicyTitle.findMany({
    where: { scrutinId: { in: scrutinIds } },
    select: { id: true, status: true, regenerationStatus: true },
  });

  const plan = planSubstanceDriftActions(titles);

  if (plan.toStale.length > 0) {
    await db.scrutinPolicyTitle.updateMany({
      where: { id: { in: plan.toStale } },
      data: { status: "STALE" },
    });
  }
  if (plan.toQueue.length > 0) {
    await db.scrutinPolicyTitle.updateMany({
      where: { id: { in: plan.toQueue } },
      data: { regenerationStatus: "queued" },
    });
  }

  result.policyTitlesMarkedStale = plan.markedStale;
  result.policyTitlesQueuedOrFlagged = plan.queuedOrFlagged;
  result.policyTitlesIgnored = plan.ignored;
  return result;
}
