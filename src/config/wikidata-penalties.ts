/**
 * Wikidata penalty Q-IDs -> Poligraph DB field mapping
 *
 * Maps Wikidata P1596 (penalty) qualifier values to our Affair penalty fields.
 * Used by discover-affairs Phase 1 to extract sentence details.
 */

export interface PenaltyMapping {
  /** Which DB field this penalty maps to */
  field:
    | "prisonMonths"
    | "fineAmount"
    | "ineligibilityMonths"
    | "communityService"
    | "otherSentence";
  /** For prisonMonths: whether the sentence is suspended (sursis) */
  suspended?: boolean;
  /** Fixed value to use instead of parsing duration (e.g., perpetuity = 9999) */
  fixedMonths?: number;
  /** Label for otherSentence field */
  label?: string;
}

export const PENALTY_QID_MAP: Record<string, PenaltyMapping> = {
  // --- Prison ---
  Q853735: { field: "prisonMonths", suspended: false }, // imprisonment (emprisonnement)
  Q841236: { field: "prisonMonths", suspended: false }, // prison sentence
  Q11698769: { field: "prisonMonths", suspended: false }, // custodial sentence
  Q40357: { field: "prisonMonths", suspended: false }, // prison
  Q68676: { field: "prisonMonths", suspended: false, fixedMonths: 9999 }, // life imprisonment

  // --- Prison avec sursis ---
  Q4737759: { field: "prisonMonths", suspended: true }, // suspended sentence
  Q17355222: { field: "prisonMonths", suspended: true }, // sursis probatoire
  Q108476309: { field: "otherSentence", label: "Bracelet électronique" }, // electronic monitoring

  // --- Amende ---
  Q1243001: { field: "fineAmount" }, // fine (amende)

  // --- Inéligibilité ---
  Q16643987: { field: "ineligibilityMonths" }, // ineligibility
  Q3721893: { field: "ineligibilityMonths" }, // privation des droits civiques

  // --- TIG ---
  Q4820670: { field: "communityService" }, // community service (travail d'intérêt général)
};

const UNIT_YEAR = "http://www.wikidata.org/entity/Q577";
const UNIT_MONTH = "http://www.wikidata.org/entity/Q5151";
const UNIT_DAY = "http://www.wikidata.org/entity/Q573";

/**
 * Look up a Wikidata Q-ID to find which DB penalty field it maps to.
 * Returns null if the Q-ID is not a recognized penalty type.
 */
export function mapWikidataPenalty(qId: string): PenaltyMapping | null {
  return PENALTY_QID_MAP[qId] ?? null;
}

/**
 * Parse a Wikidata duration (amount + unit URI) into months.
 * Handles years, months, and days. Days are rounded up (min 1 month).
 * Returns null if the unit is unrecognized.
 */
export function parseDurationToMonths(amount: string, unitUri: string): number | null {
  const numericAmount = parseFloat(amount.replace(/^\+/, ""));
  if (isNaN(numericAmount)) return null;

  switch (unitUri) {
    case UNIT_YEAR:
      return Math.round(numericAmount * 12);
    case UNIT_MONTH:
      return Math.round(numericAmount);
    case UNIT_DAY:
      return Math.max(1, Math.ceil(numericAmount / 30));
    default:
      return null;
  }
}
