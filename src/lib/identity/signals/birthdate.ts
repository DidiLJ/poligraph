import { MatchMethod } from "@/generated/prisma";
import type {
  SignalEvaluator,
  SignalResult,
  SignalScoringInput,
  SignalCandidateRecord,
  SignalScoringContext,
} from "./types";
import { SignalTier } from "./types";
import { BIRTHDATE_TOLERANCE_MS } from "../types";
import { BIRTHDATE_MATCH_LLR, BIRTHDATE_MISMATCH_LLR } from "./constants";

export class BirthdateSignal implements SignalEvaluator {
  readonly id = "birthdate";
  readonly description = "Birthdate matching within 1-day tolerance";
  readonly tier = SignalTier.STRONG;

  evaluate(
    input: SignalScoringInput,
    candidate: SignalCandidateRecord,
    _context: SignalScoringContext
  ): SignalResult {
    if (!input.birthDate || !candidate.birthDate) {
      return {
        signalId: this.id,
        logLikelihoodRatio: 0,
        deterministic: false,
        explanation: "Missing birthdate data",
        method: MatchMethod.BIRTHDATE,
      };
    }

    const diff = Math.abs(candidate.birthDate.getTime() - input.birthDate.getTime());

    if (diff <= BIRTHDATE_TOLERANCE_MS) {
      return {
        signalId: this.id,
        logLikelihoodRatio: BIRTHDATE_MATCH_LLR,
        deterministic: false,
        explanation: `Birthdate match within 1 day (diff=${Math.round(diff / 86_400_000)}d)`,
        method: MatchMethod.BIRTHDATE,
      };
    }

    return {
      signalId: this.id,
      logLikelihoodRatio: BIRTHDATE_MISMATCH_LLR,
      deterministic: false,
      explanation: `Birthdate mismatch: ${input.birthDate.toISOString().slice(0, 10)} vs ${candidate.birthDate.toISOString().slice(0, 10)}`,
      method: MatchMethod.BIRTHDATE,
    };
  }
}
