import { checkPublishable } from "@/lib/affairs/publish-guard";
import { loadBlockingDecisions, type BlockingDecision } from "@/lib/affairs/blocking-decisions";

/**
 * The matching decisions that hold up an affair's publication, ready to display.
 *
 * The guard stays the authority: it decides what blocks, and this only gathers the
 * decision ids it flagged and loads what it takes to judge them. Used to surface the
 * resolution panel on the affair edit page before any publish attempt.
 */
export async function loadBlockingDecisionsForAffair(
  affairId: string
): Promise<BlockingDecision[]> {
  const reasons = await checkPublishable(affairId);
  const decisionIds = reasons.flatMap((r) => ("decisionIds" in r ? r.decisionIds : []));
  if (decisionIds.length === 0) return [];
  return loadBlockingDecisions(decisionIds);
}
