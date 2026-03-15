/**
 * Judicial keywords for press article pre-filtering.
 *
 * Articles matching these keywords in title or description are classified as
 * TIER_1 and analyzed with Sonnet 4.5 (higher precision, higher cost).
 * Remaining articles are TIER_2, analyzed with Haiku 4.5.
 */

export type ArticleTier = "TIER_1" | "TIER_2";

/**
 * Judicial keywords organized by category.
 * Matching is case-insensitive and accent-insensitive.
 */

// Procédure pénale
const PROCEDURE_KEYWORDS = [
  "mis en examen",
  "mise en examen",
  "condamne",
  "condamnee",
  "condamnation",
  "renvoye devant",
  "poursuivi",
  "poursuivie",
  "garde a vue",
  "perquisition",
  "tribunal correctionnel",
  "proces",
  "relaxe",
  "relaxee",
  "acquitte",
  "acquittee",
  "juge",
  "jugee",
  "inculpe",
  "inculpee",
  "ecroue",
  "ecrouee",
  "detention",
  "mandat d'arret",
  "controle judiciaire",
];

// Infractions
const INFRACTION_KEYWORDS = [
  "detournement",
  "corruption",
  "fraude",
  "abus de bien",
  "prise illegale",
  "favoritisme",
  "harcelement",
  "agression sexuelle",
  "viol",
  "blanchiment",
  "emploi fictif",
  "conflit d'interets",
  "trafic d'influence",
];

// Juridictions
const JURISDICTION_KEYWORDS = [
  "cour d'appel",
  "cour de cassation",
  "tribunal",
  "parquet",
  "pnf",
  "procureur",
];

/** All judicial keywords (already normalized — no accents, lowercase) */
export const JUDICIAL_KEYWORDS: string[] = [
  ...PROCEDURE_KEYWORDS,
  ...INFRACTION_KEYWORDS,
  ...JURISDICTION_KEYWORDS,
];

// ============================================
// POLITICAL RELEVANCE (gates last-name-only matching in press sync)
// ============================================

const POLITICAL_ROLE_KEYWORDS = [
  "depute",
  "deputee",
  "senateur",
  "senatrice",
  "ministre",
  "secretaire d'etat",
  "parlementaire",
  "eurodepute",
  "eurodeputee",
  "premier ministre",
  "maire",
  "prefet",
  "prefete",
  "elu",
  "elue",
  "candidat",
  "candidate",
  "diplomate",
];

const POLITICAL_INSTITUTION_KEYWORDS = [
  "assemblee nationale",
  "assemblee",
  "senat",
  "gouvernement",
  "parlement",
  "elysee",
  "matignon",
  "hemicycle",
];

const POLITICAL_PROCESS_KEYWORDS = [
  "election",
  "scrutin",
  "projet de loi",
  "proposition de loi",
  "amendement",
  "motion de censure",
  "referendum",
  "remaniement",
  "legislatives",
  "municipales",
  "presidentielles",
  "europeennes",
  "campagne electorale",
];

const POLITICAL_GENERAL_KEYWORDS = ["politique", "opposition", "majorite parlementaire"];

/** All political keywords: judicial + roles + institutions + processes */
export const POLITICAL_KEYWORDS: string[] = [
  ...JUDICIAL_KEYWORDS,
  ...POLITICAL_ROLE_KEYWORDS,
  ...POLITICAL_INSTITUTION_KEYWORDS,
  ...POLITICAL_PROCESS_KEYWORDS,
  ...POLITICAL_GENERAL_KEYWORDS,
];

/**
 * Normalize text for keyword matching:
 * lowercase, strip accents, normalize whitespace
 */
function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[\u2018\u2019']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Match a keyword against text, using word boundaries for single-word keywords
 * to avoid false positives (e.g., "viol" matching "violation").
 * Multi-word keywords use substring matching (already specific enough).
 */
function matchesKeyword(text: string, keyword: string): boolean {
  if (keyword.includes(" ")) {
    return text.includes(keyword);
  }
  // Word boundary: space, start/end, or punctuation around the keyword
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(?:^|[\\s.,;:!?'"/()\\-])${escaped}(?:$|[\\s.,;:!?'"/()\\-])`, "i");
  return regex.test(text);
}

/**
 * Classify an article as TIER_1 (judicial keywords found) or TIER_2 (no match).
 * Matching is case-insensitive and accent-insensitive on title + description.
 */
export function classifyArticleTier(title: string, description: string | null): ArticleTier {
  const text = normalizeForMatching(`${title} ${description || ""}`);

  for (const keyword of JUDICIAL_KEYWORDS) {
    if (matchesKeyword(text, keyword)) {
      return "TIER_1";
    }
  }

  return "TIER_2";
}

/**
 * Check if article text contains political keywords.
 * Used to gate last-name-only matching in press sync:
 * non-political articles (sports, culture, etc.) only match full politician names.
 */
export function isPoliticallyRelevant(text: string): boolean {
  const normalized = normalizeForMatching(text);
  return POLITICAL_KEYWORDS.some((kw) => matchesKeyword(normalized, kw));
}
