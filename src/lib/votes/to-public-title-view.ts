import { resolvePublicTitle, type PublicTitleView } from "./resolve-public-title";
import type { PolicyTitleStatus, VotingResult, Chamber } from "@/generated/prisma";

/** The policy fields a public surface must select alongside its scrutin.
 *  `proceduralLabel` and `officialSourceUrl` live on the policy row, not the
 *  scrutin, so they ride here. */
export interface PolicyForView {
  status: PolicyTitleStatus;
  policyTitle: string | null;
  policySubtitle: string | null;
  officialSourceUrl: string | null;
  proceduralLabel: string | null;
}

/** A scrutin row joined with its (optional) policyTitle relation. The scrutin
 *  itself carries no proceduralLabel — it is sourced from the policy row. */
export interface ScrutinRowForView {
  title: string;
  votingDate: Date;
  result: VotingResult;
  chamber: Chamber;
  sourceUrl: string | null;
  policyTitle: PolicyForView | null;
}

/**
 * Thin adapter: maps a scrutin row (+ its policyTitle relation) to a
 * PublicTitleView via the single chokepoint `resolvePublicTitle`. It makes NO
 * display decision of its own. Two pieces of pass-through wiring live here:
 *  - source URL coalesce: `scrutin.sourceUrl` is canonical, the policy row's
 *    `officialSourceUrl` is fallback (Plan 6 revision #2);
 *  - `proceduralLabel` is sourced from the policy row (it lives only there), so
 *    a scrutin with no policy row yields no procedural chip.
 * Every public surface maps through this so field wiring never diverges.
 */
export function toPublicTitleView(row: ScrutinRowForView): PublicTitleView {
  const policy = row.policyTitle;
  const sourceUrl = row.sourceUrl ?? policy?.officialSourceUrl ?? null;
  return resolvePublicTitle(
    {
      title: row.title,
      votingDate: row.votingDate,
      result: row.result,
      chamber: row.chamber,
      sourceUrl,
      proceduralLabel: policy?.proceduralLabel ?? undefined,
    },
    policy
      ? {
          status: policy.status,
          policyTitle: policy.policyTitle,
          policySubtitle: policy.policySubtitle,
        }
      : null
  );
}
