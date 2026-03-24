/**
 * Importance scoring configuration for scrutins.
 * Weights determine how much each signal contributes to the 0-100 score.
 * Key vote threshold determines which scrutins get AI analysis.
 */

export const IMPORTANCE_WEIGHTS = {
  turnoutRatio: 25,
  marginCloseness: 20,
  pressCoverage: 20,
  hasDossier: 10,
  hasCitizenImpact: 10,
  voteType: 15,
} as const;

export const KEY_VOTE_THRESHOLD = 70;

export const VOTE_TYPE_SCORES: Record<string, number> = {
  final: 1.0,
  amendment: 0.5,
  motion: 0.3,
  default: 0.4,
};

export const GOVERNMENT_GROUP_CODE = "EPR";
export const CURRENT_LEGISLATURE = 17;
export const KEY_VOTES_HUB_WINDOW_DAYS = 30;
export const KEY_VOTES_GRID_COUNT = 5;
