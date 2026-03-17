import { MatchMethod } from "@/generated/prisma";
import type {
  SignalEvaluator,
  SignalResult,
  SignalScoringInput,
  SignalCandidateRecord,
  SignalScoringContext,
} from "./types";
import { SignalTier } from "./types";
import { GENDER_MATCH_LLR, GENDER_MISMATCH_LLR } from "./constants";

export class GenderSignal implements SignalEvaluator {
  readonly id = "gender";
  readonly description = "Gender consistency check";
  readonly tier = SignalTier.MODERATE;

  evaluate(
    input: SignalScoringInput,
    candidate: SignalCandidateRecord,
    _context: SignalScoringContext
  ): SignalResult {
    if (!input.gender || !candidate.gender) {
      return {
        signalId: this.id,
        logLikelihoodRatio: 0,
        deterministic: false,
        explanation: "Gender data missing",
        method: MatchMethod.NAME_ONLY,
      };
    }

    if (input.gender === candidate.gender) {
      return {
        signalId: this.id,
        logLikelihoodRatio: GENDER_MATCH_LLR,
        deterministic: false,
        explanation: `Gender match: ${input.gender}`,
        method: MatchMethod.NAME_ONLY,
      };
    }

    return {
      signalId: this.id,
      logLikelihoodRatio: GENDER_MISMATCH_LLR,
      deterministic: false,
      explanation: `Gender mismatch: ${input.gender} vs ${candidate.gender}`,
      method: MatchMethod.NAME_ONLY,
    };
  }
}
