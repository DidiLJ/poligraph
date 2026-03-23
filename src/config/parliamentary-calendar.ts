import { formatDate } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────

export type ParliamentaryPeriodType =
  | "dissolution"
  | "intersession"
  | "extraordinary"
  | "electoral"
  | "recess";

export interface ParliamentaryPeriod {
  type: ParliamentaryPeriodType;
  message: string;
  /** Optional ISO date string for expected return to session */
  resumeDate?: string;
}

/** Admin override shape stored in FeatureFlag.value JSON */
export interface PeriodOverride {
  type: ParliamentaryPeriodType;
  message?: string;
  resumeDate?: string;
}

// Feature flag name used for admin overrides
export const PARLIAMENTARY_PERIOD_FLAG = "PARLIAMENTARY_PERIOD_OVERRIDE";

// ─── Calendar constants ──────────────────────────────────────────────

/** Ordinary session runs October (month 9) through June (month 5) */
const SESSION_START_MONTH = 9; // October (0-based)
const SESSION_END_MONTH = 5; // June (0-based)

/** Threshold before showing any banner during session */
const NO_VOTE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000;

// ─── Default messages ────────────────────────────────────────────────

const DEFAULT_MESSAGES: Record<ParliamentaryPeriodType, string> = {
  dissolution:
    "L'Assembl\u00e9e nationale a \u00e9t\u00e9 dissoute. De nouvelles \u00e9lections sont pr\u00e9vues.",
  intersession:
    "Le Parlement est en intersession estivale. La session ordinaire reprend en octobre.",
  extraordinary: "Le Parlement si\u00e8ge en session extraordinaire.",
  electoral:
    "P\u00e9riode \u00e9lectorale en cours. L'activit\u00e9 parlementaire est r\u00e9duite.",
  recess: "Aucun scrutin enregistr\u00e9 r\u00e9cemment.",
};

// ─── Detection logic ─────────────────────────────────────────────────

/**
 * Returns true if the given date falls within ordinary session (October-June).
 * July (6), August (7), September (8) = intersession.
 */
export function isInOrdinarySession(date: Date): boolean {
  const month = date.getMonth();
  return month >= SESSION_START_MONTH || month <= SESSION_END_MONTH;
}

/**
 * Auto-detect the current parliamentary period based on calendar and last vote date.
 * Returns null if no banner should be shown (votes are recent).
 */
export function detectParliamentaryPeriod(
  lastVoteDate: Date | null,
  now: Date = new Date()
): ParliamentaryPeriod | null {
  // If we have recent votes, no banner needed
  if (lastVoteDate && now.getTime() - lastVoteDate.getTime() <= NO_VOTE_THRESHOLD_MS) {
    return null;
  }

  // Summer intersession (July-September)
  if (!isInOrdinarySession(now)) {
    const year = now.getMonth() >= SESSION_START_MONTH ? now.getFullYear() + 1 : now.getFullYear();
    return {
      type: "intersession",
      message: DEFAULT_MESSAGES.intersession,
      resumeDate: `${year}-10-01`,
    };
  }

  // During session but no recent votes
  if (lastVoteDate) {
    return {
      type: "recess",
      message: `Aucun scrutin enregistr\u00e9 depuis le ${formatDate(lastVoteDate)}.`,
    };
  }

  return null;
}

/**
 * Resolve the parliamentary period, giving priority to admin override.
 * Called from ParlementHub (server component).
 */
export function resolveParliamentaryPeriod(
  lastVoteDate: Date | null,
  override: PeriodOverride | null,
  now: Date = new Date()
): ParliamentaryPeriod | null {
  // Admin override takes priority
  if (override) {
    return {
      type: override.type,
      message: override.message || DEFAULT_MESSAGES[override.type],
      resumeDate: override.resumeDate,
    };
  }

  return detectParliamentaryPeriod(lastVoteDate, now);
}
