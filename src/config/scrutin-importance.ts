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
  motion: 0.85,
  article: 0.6,
  amendment: 0.5,
  default: 0.4,
};

/**
 * Title patterns that auto-promote a scrutin to key vote status,
 * regardless of computed score. These are constitutional mechanisms
 * of the highest democratic significance.
 */
export const AUTO_KEY_VOTE_PATTERNS = [
  /motion\s+de\s+censure/,
  /motion\s+de\s+rejet/,
  /déclaration\s+de\s+politique\s+générale/,
  /motion\s+référendaire/,
];

export const GOVERNMENT_GROUP_CODE = "EPR";
export const SENATE_GOVERNMENT_GROUP_CODE = "RDPI";
export const CURRENT_LEGISLATURE = 17;
export const CURRENT_SENATE_SESSION = 2023;
export const KEY_VOTES_HUB_WINDOW_DAYS = 30;
export const KEY_VOTES_GRID_COUNT = 5;
