import type { ThematicAxis } from "@/generated/prisma";

// User quiz answers stay ternary (-1/0/1), party positions use full -3..+3 scale
export type UserAnswers = Partial<Record<ThematicAxis, -1 | 0 | 1>>;
export type PartyPositions = Partial<Record<ThematicAxis, number>>;

export interface ProximityResult {
  score: number; // 0 (identical) to 1 (fully opposed), normalized
  axesCompared: number;
}

/** Maximum absolute position value on the scale */
export const POSITION_MAX = 3;

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

  // Normalize: max distance per axis is |(-1) - POSITION_MAX| = 4, so divide by 4
  const maxDistancePerAxis = 1 + POSITION_MAX;
  return {
    score: totalDistance / (axesCompared * maxDistancePerAxis),
    axesCompared,
  };
}
