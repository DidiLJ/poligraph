/**
 * Judilibre Scoring Module
 *
 * Replaces the boolean textRefersToPersonByName approach with a scored matrix.
 * Combines name quality (how the name was found) with context signals
 * (jurisdiction, external IDs) to produce a confidence score and judgement.
 */

import { Judgement, MatchMethod } from "@/generated/prisma";
import { checkJurisdictionMatch } from "./judilibre";

// ============================================
// CONSTANTS
// ============================================

const MIN_LASTNAME_LENGTH = 3;
const NAME_PROXIMITY_CHARS = 80;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const WB_BEFORE = "(?<![a-zA-ZÀ-ÿ])";
const WB_AFTER = "(?![a-zA-ZÀ-ÿ])";

export const JUDILIBRE_THRESHOLDS = { SAME: 80, UNDECIDED: 50 } as const;

// ============================================
// TYPES
// ============================================

export type NameQuality = "STRONG" | "MODERATE";

export type ContextSignal = "CERTAIN" | "POSITIVE" | "NEUTRAL" | "NEGATIVE";

export interface JudilibreMatchResult {
  score: number;
  judgement: Judgement | null;
  nameQuality: NameQuality | null;
  contextSignal: ContextSignal;
  method: MatchMethod;
}

export interface JudilibreMatchEvidence {
  nameQuality: NameQuality | null;
  contextSignal: ContextSignal;
  score: number;
  fullNameFound: boolean;
  legalTitleFound: boolean;
  proximityFound: boolean;
  jurisdictionCity: string | null;
}

// ============================================
// SCORE MATRIX
// ============================================

const SCORE_MATRIX: Record<NameQuality, Record<ContextSignal, number>> = {
  STRONG: {
    CERTAIN: 100,
    POSITIVE: 85,
    NEUTRAL: 70,
    NEGATIVE: 50,
  },
  MODERATE: {
    CERTAIN: 100,
    POSITIVE: 70,
    NEUTRAL: 0,
    NEGATIVE: 0,
  },
};

// ============================================
// NAME QUALITY DETECTION
// ============================================

/**
 * Detect how strongly a name appears in a text.
 *
 * - STRONG: full name with word boundaries, or legal title + lastName
 * - MODERATE: firstName and lastName both present within 80 chars proximity
 * - null: name not found or too short to match reliably
 */
export function detectNameQuality(text: string, fullName: string): NameQuality | null {
  const parts = fullName.split(/\s+/);
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");

  if (!firstName || lastName.length < MIN_LASTNAME_LENGTH) return null;

  // Full name with French-aware word boundaries
  const fullNamePattern = new RegExp(`${WB_BEFORE}${escapeRegex(fullName)}${WB_AFTER}`, "i");
  if (fullNamePattern.test(text)) return "STRONG";

  // Legal title + lastName
  const titlePattern = new RegExp(
    `(?:M\\.|Mme|Mr|Sieur|Dame|Prévenu[e]?|Condamné[e]?|Appelant[e]?|Demandeur|Demanderesse|Défendeur|Défenderesse)\\s+${escapeRegex(lastName)}${WB_AFTER}`,
    "i"
  );
  if (titlePattern.test(text)) return "STRONG";

  // Proximity check: firstName and lastName within NAME_PROXIMITY_CHARS
  const firstRe = new RegExp(`${WB_BEFORE}${escapeRegex(firstName)}${WB_AFTER}`, "gi");
  const lastRe = new RegExp(`${WB_BEFORE}${escapeRegex(lastName)}${WB_AFTER}`, "gi");

  const firstPositions: number[] = [];
  const lastPositions: number[] = [];

  let match;
  while ((match = firstRe.exec(text)) !== null) firstPositions.push(match.index);
  while ((match = lastRe.exec(text)) !== null) lastPositions.push(match.index);

  if (firstPositions.length === 0 || lastPositions.length === 0) return null;

  for (const fp of firstPositions) {
    for (const lp of lastPositions) {
      if (Math.abs(fp - lp) <= NAME_PROXIMITY_CHARS) return "MODERATE";
    }
  }

  return null;
}

// ============================================
// CONTEXT SIGNAL
// ============================================

interface ExternalIdMatch {
  hasEcliMatch?: boolean;
  hasPourvoiMatch?: boolean;
}

/**
 * Determine the context signal for a Judilibre match.
 *
 * - CERTAIN: external ID (ECLI or pourvoi) matches an existing affair
 * - POSITIVE: court jurisdiction overlaps with politician's departments
 * - NEGATIVE: court jurisdiction is known but doesn't overlap
 * - NEUTRAL: jurisdiction unknown or no departments to compare
 */
export function determineContextSignal(
  summaryText: string,
  politicianDepartments: string[],
  externalIdMatch?: ExternalIdMatch
): { signal: ContextSignal; jurisdictionCity: string | null } {
  if (externalIdMatch?.hasEcliMatch || externalIdMatch?.hasPourvoiMatch) {
    return { signal: "CERTAIN", jurisdictionCity: null };
  }

  const jurisdictionResult = checkJurisdictionMatch(summaryText, politicianDepartments);

  if (jurisdictionResult.match === true) {
    return { signal: "POSITIVE", jurisdictionCity: jurisdictionResult.jurisdiction };
  }
  if (jurisdictionResult.match === false) {
    return { signal: "NEGATIVE", jurisdictionCity: jurisdictionResult.jurisdiction };
  }

  return { signal: "NEUTRAL", jurisdictionCity: jurisdictionResult.jurisdiction };
}

// ============================================
// SCORING
// ============================================

/**
 * Compute a Judilibre match result from name quality and context signal.
 *
 * Score matrix:
 * | Name \ Context | CERTAIN | POSITIVE | NEUTRAL | NEGATIVE |
 * |----------------|---------|----------|---------|----------|
 * | STRONG         | 100     | 85       | 70      | 50       |
 * | MODERATE       | 100     | 70       | 0       | 0        |
 *
 * Thresholds: SAME >= 80, UNDECIDED >= 50, else skip (null judgement).
 */
export function scoreJudilibreMatch(
  nameQuality: NameQuality | null,
  contextSignal: ContextSignal
): JudilibreMatchResult {
  if (!nameQuality) {
    return {
      score: 0,
      judgement: null,
      nameQuality: null,
      contextSignal,
      method: "NAME_ONLY",
    };
  }

  const score = SCORE_MATRIX[nameQuality][contextSignal];

  let judgement: Judgement | null = null;
  if (score >= JUDILIBRE_THRESHOLDS.SAME) {
    judgement = "SAME";
  } else if (score >= JUDILIBRE_THRESHOLDS.UNDECIDED) {
    judgement = "UNDECIDED";
  }

  let method: MatchMethod;
  if (contextSignal === "CERTAIN") {
    method = "EXTERNAL_ID";
  } else if (contextSignal === "POSITIVE") {
    method = "DEPARTMENT";
  } else {
    method = "NAME_ONLY";
  }

  return { score, judgement, nameQuality, contextSignal, method };
}
