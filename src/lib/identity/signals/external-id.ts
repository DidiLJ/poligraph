import { MatchMethod } from "@/generated/prisma";
import type {
  SignalEvaluator,
  SignalResult,
  SignalScoringInput,
  SignalCandidateRecord,
  SignalScoringContext,
} from "./types";
import { SignalTier } from "./types";

/**
 * ExternalId deterministic match. In Phase 1, this signal is evaluated
 * by the resolver separately (Step 2 of the pipeline), not through the
 * signal pipeline. It's defined here for completeness and future use.
 */
export class ExternalIdSignal implements SignalEvaluator {
  readonly id = "external-id";
  readonly description = "Deterministic match via shared external ID";
  readonly tier = SignalTier.DETERMINISTIC;

  evaluate(
    _input: SignalScoringInput,
    _candidate: SignalCandidateRecord,
    _context: SignalScoringContext
  ): SignalResult {
    // In Phase 1, ExternalId matching is handled by resolver's Step 2 (DB query).
    // This signal returns neutral — it exists for the interface contract.
    // Phase 2+ will integrate it into the signal pipeline.
    return {
      signalId: this.id,
      logLikelihoodRatio: 0,
      deterministic: false,
      explanation: "ExternalId checked separately in resolver pipeline",
      method: MatchMethod.EXTERNAL_ID,
    };
  }
}
