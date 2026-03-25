import type { ScrutinType } from "@/generated/prisma";

// Match both ASCII apostrophe (') and Unicode right single quotation mark (')
const APO = "['\u2019]";

/**
 * Classify a scrutin title into a ScrutinType based on regex patterns.
 *
 * Handles both Assemblée nationale and Sénat title formats, including
 * pre-2009 reform procedures (exception d'irrecevabilité, question préalable).
 *
 * Priority order matters:
 * 1. AMENDEMENT - checked first so "l'amendement à l'article X" doesn't become ARTICLE
 * 2. MOTION - checked before FINAL so "motion de rejet du projet de loi" stays MOTION
 * 3. FINAL - "l'ensemble du/de la projet/proposition" + budget section votes
 * 4. ARTICLE - excludes constitutional references ("de la Constitution")
 * 5. AUTRE - fallback
 */
export function classifyScrutinTitle(title: string): ScrutinType {
  const t = title.toLowerCase();

  // Amendments: "l'amendement", "les amendements", "sous-amendement"
  if (new RegExp(`l${APO}amendement|les\\s+amendements|sous-amendement`).test(t)) {
    return "AMENDEMENT";
  }

  // Motions: all procedural motions from both chambers
  // - AN: "motion de rejet/censure/renvoi"
  // - Sénat: "motion n° X, présentée par..." (covers renvoi en commission,
  //   question préalable, exception d'irrecevabilité in Sénat format)
  // - motion référendaire (art. 11 Constitution)
  // - déclaration de politique générale (art. 49-1 confidence vote)
  // - pre-2009 AN procedures: exception d'irrecevabilité, question préalable
  if (
    /motion\s+de\s+(?:rejet|censure|renvoi)/.test(t) ||
    /motion\s+n°/.test(t) ||
    /motion\s+référendaire/.test(t) ||
    /déclaration\s+de\s+politique\s+générale/.test(t) ||
    new RegExp(`exception\\s+d${APO}irrecevabilité`).test(t) ||
    /question\s+préalable/.test(t)
  ) {
    return "MOTION";
  }

  // Final votes: "l'ensemble du/de la/des projet/proposition de loi"
  // Also covers:
  // - AN data typo: "l'ensemble la proposition" (missing "de")
  // - Budget section votes: "la première/deuxième partie du projet" (PLF/PLFSS)
  if (
    new RegExp(`l${APO}ensemble\\s+(?:d(?:u|e\\s+la|es)\\s+|la\\s+)(?:projet|proposition)`).test(
      t
    ) ||
    /(?:première|deuxième|seconde|troisième|quatrième|cinquième)\s+partie\s+d(?:u|e\s+la)\s+projet/.test(
      t
    )
  ) {
    return "FINAL";
  }

  // Articles: "l'article N/unique/premier/liminaire"
  // Excludes constitutional article references: titles containing
  // "de la Constitution" use "l'article 49" to cite procedure, not a bill section
  if (
    new RegExp(`l${APO}article\\s+(?:\\d+|unique|premier|liminaire)`).test(t) &&
    !t.includes("de la constitution")
  ) {
    return "ARTICLE";
  }

  return "AUTRE";
}
