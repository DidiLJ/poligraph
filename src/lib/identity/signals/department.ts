import { MatchMethod } from "@/generated/prisma";
import type {
  SignalEvaluator,
  SignalResult,
  SignalScoringInput,
  SignalCandidateRecord,
  SignalScoringContext,
} from "./types";
import { SignalTier } from "./types";
import { DEPARTMENT_MATCH_LLR, DEPARTMENT_MISMATCH_LLR } from "./constants";

export class DepartmentSignal implements SignalEvaluator {
  readonly id = "department";
  readonly description = "Geographic department overlap from mandates";
  readonly tier = SignalTier.MODERATE;

  evaluate(
    input: SignalScoringInput,
    candidate: SignalCandidateRecord,
    _context: SignalScoringContext
  ): SignalResult {
    if (!input.department || candidate.departments.length === 0) {
      return {
        signalId: this.id,
        logLikelihoodRatio: 0,
        deterministic: false,
        explanation: "No department data available",
        method: MatchMethod.DEPARTMENT,
      };
    }

    if (candidate.departments.includes(input.department)) {
      return {
        signalId: this.id,
        logLikelihoodRatio: DEPARTMENT_MATCH_LLR,
        deterministic: false,
        explanation: `Department match: ${input.department}`,
        method: MatchMethod.DEPARTMENT,
      };
    }

    return {
      signalId: this.id,
      logLikelihoodRatio: DEPARTMENT_MISMATCH_LLR,
      deterministic: false,
      explanation: `Department mismatch: input=${input.department}, candidate=${candidate.departments.join(",")}`,
      method: MatchMethod.DEPARTMENT,
    };
  }
}
