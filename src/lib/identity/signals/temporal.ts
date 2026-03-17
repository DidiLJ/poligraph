import { MatchMethod } from "@/generated/prisma";
import type {
  SignalEvaluator,
  SignalResult,
  SignalScoringInput,
  SignalCandidateRecord,
  SignalScoringContext,
} from "./types";
import { SignalTier } from "./types";
import {
  TEMPORAL_ACTIVE_LLR,
  TEMPORAL_RECENT_LLR,
  TEMPORAL_NEUTRAL_LLR,
  TEMPORAL_OLD_LLR,
  TEMPORAL_RECENT_GAP_MS,
  TEMPORAL_OLD_GAP_MS,
} from "./constants";

export class TemporalSignal implements SignalEvaluator {
  readonly id = "temporal";
  readonly description = "Mandate period overlap with source date";
  readonly tier = SignalTier.CONTEXTUAL;

  evaluate(
    input: SignalScoringInput,
    candidate: SignalCandidateRecord,
    _context: SignalScoringContext
  ): SignalResult {
    if (!input.sourceDate || !candidate.mandatePeriods || candidate.mandatePeriods.length === 0) {
      return this.result(0, "No temporal data available");
    }

    const sourceTime = input.sourceDate.getTime();

    // Check for active mandate overlap
    for (const mandate of candidate.mandatePeriods) {
      const start = mandate.start.getTime();
      const end = mandate.end ? mandate.end.getTime() : Date.now();
      if (sourceTime >= start && sourceTime <= end) {
        return this.result(TEMPORAL_ACTIVE_LLR, `Active mandate overlap (${mandate.type})`);
      }
    }

    // Find closest mandate gap
    let minGap = Infinity;
    for (const mandate of candidate.mandatePeriods) {
      const start = mandate.start.getTime();
      const end = mandate.end ? mandate.end.getTime() : Date.now();
      const gap = Math.min(Math.abs(sourceTime - start), Math.abs(sourceTime - end));
      minGap = Math.min(minGap, gap);
    }

    if (minGap <= TEMPORAL_RECENT_GAP_MS) {
      return this.result(
        TEMPORAL_RECENT_LLR,
        `Recent mandate (gap ${Math.round(minGap / 86400000)}d)`
      );
    }

    if (minGap <= TEMPORAL_OLD_GAP_MS) {
      return this.result(TEMPORAL_NEUTRAL_LLR, "Moderate mandate gap");
    }

    return this.result(TEMPORAL_OLD_LLR, `Old mandate (gap ${Math.round(minGap / 86400000)}d)`);
  }

  private result(logLR: number, explanation: string): SignalResult {
    return {
      signalId: this.id,
      logLikelihoodRatio: logLR,
      deterministic: false,
      explanation,
      method: MatchMethod.TEMPORAL,
    };
  }
}
