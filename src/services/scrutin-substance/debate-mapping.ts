/**
 * PURE classifier: turns a debate-context resolution into a deterministic,
 * auditable verdict on whether a scrutin is reliably linked to the right debate.
 *
 * Strict mapping (no LLM, no I/O):
 *   - matched   : amendment number cited (HIGH) AND a single same-day transcript
 *                 → the only class an exploitable debate can come from.
 *   - ambiguous : number cited but several same-day transcripts (session not
 *                 proven), OR author+article proximity without the number (MEDIUM).
 *   - unsafe    : a transcript exists but never cites the voted amendment (LOW/NONE)
 *                 → the 2084 case: do NOT attribute, skip.
 *   - missing   : no candidate transcript for that day at all.
 *
 * Only `matched` is exploitable. Everything else means "skip" for generation.
 */
import type { DebateContextConfidence } from "./debate-context";

export type DebateMatchClass = "matched" | "ambiguous" | "missing" | "unsafe";

export interface DebateMatchInput {
  hasCandidateTranscript: boolean;
  candidateTranscriptCount: number;
  confidence: DebateContextConfidence;
}

export interface DebateMatchVerdict {
  class: DebateMatchClass;
  reason: string;
  /** True only for `matched`: a single same-day transcript explicitly cites the amendment. */
  exploitable: boolean;
}

export function classifyDebateMatch(input: DebateMatchInput): DebateMatchVerdict {
  const { candidateTranscriptCount, confidence } = input;

  if (!input.hasCandidateTranscript || candidateTranscriptCount <= 0) {
    return {
      class: "missing",
      reason: "Aucun compte rendu de séance candidat ce jour-là.",
      exploitable: false,
    };
  }

  if (confidence === "HIGH") {
    if (candidateTranscriptCount === 1) {
      return {
        class: "matched",
        reason:
          "Numéro d'amendement cité explicitement dans l'unique compte rendu candidat du jour.",
        exploitable: true,
      };
    }
    return {
      class: "ambiguous",
      reason: `Numéro cité, mais ${candidateTranscriptCount} comptes rendus le même jour : la séance exacte n'est pas prouvée.`,
      exploitable: false,
    };
  }

  if (confidence === "MEDIUM") {
    return {
      class: "ambiguous",
      reason:
        "Auteur et article à proximité, sans le numéro d'amendement : rattachement non prouvé.",
      exploitable: false,
    };
  }

  // LOW or NONE while a transcript exists: the voted amendment is never cited.
  return {
    class: "unsafe",
    reason: "Compte rendu présent mais sans mention explicite de l'amendement voté.",
    exploitable: false,
  };
}

/**
 * Séance-scoped variant, for the improved ingestion (one full-content record per
 * séance). Instead of counting all same-day transcripts, it counts how many
 * séances of the day actually cite the amendment number (HIGH). A vote carries no
 * time, so a single citing séance is the strongest deterministic proof available.
 *
 *   - matched   : exactly ONE séance of the day cites the amendment number.
 *   - ambiguous : ≥2 séances cite it (debated across sittings), OR only an
 *                 author/article proximity (MEDIUM), never the number.
 *   - unsafe    : séance(s) exist but none cites the amendment (the 2084 case while
 *                 truncated; no false positive from same-day coincidence).
 *   - missing   : no séance for that day.
 */
export interface SeanceScopeInput {
  /** Number of séances recorded for the voting day. */
  seanceCount: number;
  /** Séances whose full content explicitly cites the amendment number (HIGH). */
  mentioningHighCount: number;
  /** At least one séance has an author+article proximity without the number. */
  hasMedium: boolean;
}

export function classifyDebateMatchBySeance(input: SeanceScopeInput): DebateMatchVerdict {
  if (input.seanceCount <= 0) {
    return {
      class: "missing",
      reason: "Aucune séance enregistrée pour le jour du vote.",
      exploitable: false,
    };
  }

  if (input.mentioningHighCount === 1) {
    return {
      class: "matched",
      reason: "Numéro d'amendement cité dans une seule séance du jour (séance unique prouvée).",
      exploitable: true,
    };
  }

  if (input.mentioningHighCount >= 2) {
    return {
      class: "ambiguous",
      reason: `Numéro cité dans ${input.mentioningHighCount} séances du jour : séance exacte non prouvée.`,
      exploitable: false,
    };
  }

  if (input.hasMedium) {
    return {
      class: "ambiguous",
      reason:
        "Auteur et article à proximité, sans le numéro d'amendement : rattachement non prouvé.",
      exploitable: false,
    };
  }

  return {
    class: "unsafe",
    reason: "Séance(s) présente(s) mais aucune ne cite explicitement l'amendement voté.",
    exploitable: false,
  };
}
