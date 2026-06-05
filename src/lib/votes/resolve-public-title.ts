import type { VotingResult, Chamber, PolicyTitleStatus } from "@/generated/prisma";

export interface ScrutinForDisplay {
  title: string;
  votingDate: Date;
  result: VotingResult;
  chamber: Chamber;
  sourceUrl: string | null;
  /** Lives only on ScrutinPolicyTitle, so it is optional here: scrutins without
   *  a policy row have none, and the procedural chip is then omitted. Sourced by
   *  toPublicTitleView from the policy relation; never derived from scrutin.type. */
  proceduralLabel?: string | null;
}
export interface PolicyTitleForDisplay {
  status: PolicyTitleStatus;
  policyTitle: string | null;
  policySubtitle: string | null;
}
export type Chip =
  | { kind: "procedural"; label: string }
  | { kind: "result"; result: VotingResult }
  | { kind: "date"; iso: string };

export type PublicTitleView =
  | { mode: "official"; officialTitle: string; officialSourceUrl: string | null; chips: Chip[] }
  | {
      mode: "policy";
      policyTitle: string;
      policySubtitle: string | null;
      officialTitle: string;
      officialSourceUrl: string | null;
      chips: Chip[];
    };

function buildChips(s: ScrutinForDisplay): Chip[] {
  const chips: Chip[] = [];
  const procedural = s.proceduralLabel?.trim();
  if (procedural) chips.push({ kind: "procedural", label: procedural });
  chips.push({ kind: "result", result: s.result });
  chips.push({ kind: "date", iso: s.votingDate.toISOString() });
  return chips;
}

/** The ONLY gate for public display. A generated title is shown publicly IFF the
 *  row is APPROVED AND policyTitle is a non-empty trimmed string <=140 chars.
 *  Every other state (incl. STALE, null/empty/over-length, no row) → official mode.
 *  This function NEVER infers or upgrades approval. */
export function resolvePublicTitle(
  scrutin: ScrutinForDisplay,
  policy: PolicyTitleForDisplay | null
): PublicTitleView {
  const chips = buildChips(scrutin);
  const t = policy?.policyTitle?.trim();
  const displayable = policy != null && policy.status === "APPROVED" && !!t && t.length <= 140;
  if (displayable) {
    return {
      mode: "policy",
      policyTitle: t,
      policySubtitle: policy.policySubtitle?.trim() || null,
      officialTitle: scrutin.title,
      officialSourceUrl: scrutin.sourceUrl,
      chips,
    };
  }
  return {
    mode: "official",
    officialTitle: scrutin.title,
    officialSourceUrl: scrutin.sourceUrl,
    chips,
  };
}
