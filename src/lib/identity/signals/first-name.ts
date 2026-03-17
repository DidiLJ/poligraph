import { MatchMethod } from "@/generated/prisma";
import type {
  SignalEvaluator,
  SignalResult,
  SignalScoringInput,
  SignalCandidateRecord,
  SignalScoringContext,
} from "./types";
import { SignalTier } from "./types";
import { FIRST_NAME_EXACT_LLR, FIRST_NAME_PARTIAL_LLR, FIRST_NAME_MISMATCH_LLR } from "./constants";

export class FirstNameSignal implements SignalEvaluator {
  readonly id = "first-name";
  readonly description = "First name exact/partial/mismatch comparison";
  readonly tier = SignalTier.MODERATE;

  evaluate(
    input: SignalScoringInput,
    candidate: SignalCandidateRecord,
    context: SignalScoringContext
  ): SignalResult {
    if (!input.firstName) {
      return {
        signalId: this.id,
        logLikelihoodRatio: 0,
        deterministic: false,
        explanation: "No first name in input",
        method: MatchMethod.NAME_ONLY,
      };
    }

    const normalizer = context.adapter.normalizer;
    const inputFirst = normalizer.normalizeFirstName(input.firstName);
    const candidateFirst = normalizer.normalizeFirstName(candidate.firstName);

    const exact = inputFirst === candidateFirst;
    const partial =
      !exact && (inputFirst.includes(candidateFirst) || candidateFirst.includes(inputFirst));

    if (exact) {
      return {
        signalId: this.id,
        logLikelihoodRatio: FIRST_NAME_EXACT_LLR,
        deterministic: false,
        explanation: `First name exact match: "${input.firstName}"`,
        method: MatchMethod.NAME_ONLY,
      };
    }

    if (partial) {
      return {
        signalId: this.id,
        logLikelihoodRatio: FIRST_NAME_PARTIAL_LLR,
        deterministic: false,
        explanation: `First name partial match: "${input.firstName}" ~ "${candidate.firstName}"`,
        method: MatchMethod.NAME_ONLY,
      };
    }

    return {
      signalId: this.id,
      logLikelihoodRatio: FIRST_NAME_MISMATCH_LLR,
      deterministic: false,
      explanation: `First name mismatch: "${input.firstName}" vs "${candidate.firstName}"`,
      method: MatchMethod.NAME_ONLY,
    };
  }
}
