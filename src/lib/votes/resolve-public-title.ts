import type { VotingResult, Chamber, PolicyTitleStatus } from "@/generated/prisma";

export interface ScrutinForDisplay {
  title: string;
  votingDate: Date;
  result: VotingResult;
  chamber: Chamber;
  sourceUrl: string | null;
  proceduralLabel: string;
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
  return [
    { kind: "procedural", label: s.proceduralLabel },
    { kind: "result", result: s.result },
    { kind: "date", iso: s.votingDate.toISOString() },
  ];
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
