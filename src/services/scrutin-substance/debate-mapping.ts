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
