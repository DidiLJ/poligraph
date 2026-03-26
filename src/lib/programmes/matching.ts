import type { ThematicAxis } from "@/generated/prisma";

export type UserAnswers = Partial<Record<ThematicAxis, -1 | 0 | 1>>;
export type PartyPositions = Partial<Record<ThematicAxis, -1 | 0 | 1>>;

export interface ProximityResult {
  score: number; // 0 (identical) to 2 (fully opposed)
  axesCompared: number;
}

/**
 * Manhattan distance normalized by number of common axes.
 * Returns null if no axes in common.
 */
export function computeProximity(user: UserAnswers, party: PartyPositions): ProximityResult | null {
  let totalDistance = 0;
  let axesCompared = 0;

  for (const axis of Object.keys(user) as ThematicAxis[]) {
    const userPos = user[axis];
    const partyPos = party[axis];
    if (userPos === undefined || partyPos === undefined) continue;

    totalDistance += Math.abs(userPos - partyPos);
    axesCompared++;
  }

  if (axesCompared === 0) return null;

  return {
    score: totalDistance / axesCompared,
    axesCompared,
  };
}
