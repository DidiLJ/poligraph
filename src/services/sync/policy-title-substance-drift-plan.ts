import type { PolicyTitleStatus } from "@/generated/prisma";

/**
 * What to do with a single policy title whose linked amendment substance changed.
 * Kept db-free so the decision logic is unit-testable without a live database.
 */
export type DriftAction = "stale" | "queue" | "ignore";

/** The minimal title shape the planner reasons about. */
export interface DriftTitleRow {
  id: string;
  status: PolicyTitleStatus;
  regenerationStatus: string;
}

export interface DriftPlan {
  /** Title ids to move APPROVED -> STALE. */
  toStale: string[];
  /** Title ids to flag regenerationStatus -> "queued" (already-queued rows excluded). */
  toQueue: string[];
  markedStale: number;
  queuedOrFlagged: number;
  ignored: number;
}

/**
 * Pure decision for one policy title whose linked amendment substance changed:
 *  - APPROVED              -> stale  (evidence no longer guaranteed in sync with the
 *                                     official text; also drops it from public, since
 *                                     only APPROVED is public)
 *  - NEEDS_REVIEW / DRAFT  -> queue  (flag for regeneration, status unchanged: this
 *                                     code never auto-publishes or auto-approves)
 *  - REJECTED              -> ignore (never auto-reactivated)
 *  - STALE                 -> ignore (already stale)
 */
export function classifyTitleForDrift(status: PolicyTitleStatus): DriftAction {
  switch (status) {
    case "APPROVED":
      return "stale";
    case "NEEDS_REVIEW":
    case "DRAFT":
      return "queue";
    case "REJECTED":
    case "STALE":
      return "ignore";
    default:
      return "ignore";
  }
}

/**
 * Pure planner: from the loaded title rows decide which ids become STALE, which get
 * flagged queued (rows already queued are excluded from the write but still counted
 * as flagged), and the per-bucket counts. No DB access, no model call.
 */
export function planSubstanceDriftActions(titles: DriftTitleRow[]): DriftPlan {
  const plan: DriftPlan = {
    toStale: [],
    toQueue: [],
    markedStale: 0,
    queuedOrFlagged: 0,
    ignored: 0,
  };
  for (const t of titles) {
    const action = classifyTitleForDrift(t.status);
    if (action === "stale") {
      plan.toStale.push(t.id);
      plan.markedStale++;
    } else if (action === "queue") {
      plan.queuedOrFlagged++;
      if (t.regenerationStatus !== "queued") plan.toQueue.push(t.id);
    } else {
      plan.ignored++;
    }
  }
  return plan;
}
