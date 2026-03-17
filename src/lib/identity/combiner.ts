import { MatchMethod } from "@/generated/prisma";
import type { SignalResult } from "./signals/types";
import { PROMINENCE_THRESHOLD } from "./types";
import { FIRST_NAME_EXACT_LLR, FIRST_NAME_PARTIAL_LLR } from "./signals/constants";

export interface CombinerResult {
  /** Legacy 0-1 confidence score (drives judgement in Phase 1) */
  confidence: number;
  /** Signal results (stored in evidence for future Phase 2 use) */
  signals: SignalResult[];
  /** Primary method that drove the decision */
  primaryMethod: MatchMethod;
}

interface CombinerCandidate {
  prominenceScore: number;
}

/**
 * Legacy combiner that reproduces the exact arithmetic of the current
 * scoreCandidate() function. Signal logLR values are collected for evidence
 * but DO NOT drive the judgement — the legacy additive/multiplicative
 * formula is used instead.
 *
 * Uses shared constants from signals/constants.ts so that signal evaluators
 * and this combiner always agree on the logLR values they exchange.
 */
export class LegacyCombiner {
  combine(signals: SignalResult[], candidate: CombinerCandidate): CombinerResult {
    let score = 0.5;
    let method: MatchMethod = MatchMethod.NAME_ONLY;

    const birthdateSignal = signals.find((s) => s.signalId === "birthdate");
    const departmentSignal = signals.find((s) => s.signalId === "department");
    const firstNameSignal = signals.find((s) => s.signalId === "first-name");
    const genderSignal = signals.find((s) => s.signalId === "gender");

    // Step 1: Birthdate (highest priority base score)
    if (birthdateSignal && birthdateSignal.logLikelihoodRatio !== 0) {
      if (birthdateSignal.logLikelihoodRatio > 0) {
        score = 0.9;
        method = MatchMethod.BIRTHDATE;
      } else {
        score = 0.1;
      }
    }

    // Step 2: Department match (only if score still below 0.7)
    if (departmentSignal && departmentSignal.logLikelihoodRatio > 0 && score < 0.7) {
      score = 0.7;
      method = MatchMethod.DEPARTMENT;
    }

    // Step 3: First name modifier
    // Use shared constants to detect exact/partial — no magic numbers
    const firstNameExact =
      firstNameSignal && firstNameSignal.logLikelihoodRatio === FIRST_NAME_EXACT_LLR;
    const firstNamePartial =
      firstNameSignal && firstNameSignal.logLikelihoodRatio === FIRST_NAME_PARTIAL_LLR;

    if (firstNameExact) {
      score = Math.min(score + 0.15, 0.98);
    } else if (firstNameSignal && !firstNamePartial && firstNameSignal.logLikelihoodRatio < 0) {
      score = score * 0.4;
    }
    // Partial match or missing: no change

    // Step 4: Prominence boost
    if (
      candidate.prominenceScore >= PROMINENCE_THRESHOLD &&
      firstNameExact &&
      method === MatchMethod.NAME_ONLY
    ) {
      score = Math.min(score + 0.06, 0.98);
    }

    // Step 5: Gender mismatch penalty
    if (genderSignal && genderSignal.logLikelihoodRatio < 0) {
      score = score * 0.3;
    }

    return {
      confidence: score,
      signals,
      primaryMethod: method,
    };
  }
}
