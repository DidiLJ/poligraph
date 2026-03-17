import { Judgement, MatchMethod } from "@/generated/prisma";
import type { SignalResult } from "./signals/types";

export interface HardPenalty {
  id: string;
  description: string;
  applies(signals: SignalResult[]): boolean;
  /** null = reject entirely (judgement becomes null); Judgement value = cap at that level */
  maxJudgement: Judgement | null;
}

export interface FellegiSunterConfig {
  sameThreshold: number;
  undecidedThreshold: number;
  hardPenalties: HardPenalty[];
}

export interface FellegiSunterResult {
  compositeLogRatio: number;
  confidence: number;
  judgement: Judgement | null;
  signals: SignalResult[];
  penalties: string[];
  primaryMethod: MatchMethod;
}

const DEFAULT_CONFIG: FellegiSunterConfig = {
  sameThreshold: 12.0,
  undecidedThreshold: 4.0,
  hardPenalties: [],
};

/**
 * Fellegi-Sunter combiner: sums log-likelihood ratios from all signals,
 * converts to confidence via sigmoid, then applies hard penalties.
 *
 * Coexists alongside LegacyCombiner — Phase 1 uses LegacyCombiner,
 * Phase 2 will switch to this combiner via SignalScoringContext.mode.
 */
export class FellegiSunterCombiner {
  private readonly config: FellegiSunterConfig;

  constructor(config: Partial<FellegiSunterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  combine(signals: SignalResult[]): FellegiSunterResult {
    // Step 1: Sum all log-likelihood ratios
    const compositeLogRatio = signals.reduce((sum, s) => sum + s.logLikelihoodRatio, 0);

    // Step 2: Sigmoid conversion — logRatio 0 -> 0.5, large positive -> ~1, large negative -> ~0
    const confidence = 1 / (1 + Math.pow(2, -compositeLogRatio));

    // Step 3: Base judgement from thresholds
    let judgement: Judgement | null;
    if (compositeLogRatio >= this.config.sameThreshold) {
      judgement = Judgement.SAME;
    } else if (compositeLogRatio >= this.config.undecidedThreshold) {
      judgement = Judgement.UNDECIDED;
    } else {
      judgement = null;
    }

    // Step 4: Apply hard penalties
    const firedPenalties: string[] = [];
    for (const penalty of this.config.hardPenalties) {
      if (!penalty.applies(signals)) continue;
      firedPenalties.push(penalty.id);

      if (penalty.maxJudgement === null) {
        // Reject entirely
        judgement = null;
        break;
      }

      // Cap: SAME -> UNDECIDED if maxJudgement is UNDECIDED
      if (judgement === Judgement.SAME && penalty.maxJudgement === Judgement.UNDECIDED) {
        judgement = Judgement.UNDECIDED;
      }
    }

    // Step 5: Select primaryMethod
    const primaryMethod = this.selectPrimaryMethod(signals);

    return {
      compositeLogRatio,
      confidence,
      judgement,
      signals,
      penalties: firedPenalties,
      primaryMethod,
    };
  }

  /**
   * Deterministic signal wins outright.
   * Otherwise: highest |logLR| signal wins.
   * If top 2 are within 1.0 of each other (by absolute logLR), use COMPOSITE.
   */
  private selectPrimaryMethod(signals: SignalResult[]): MatchMethod {
    if (signals.length === 0) return MatchMethod.NAME_ONLY;

    // Deterministic signal takes absolute priority
    const deterministicSignal = signals.find((s) => s.deterministic);
    if (deterministicSignal) return deterministicSignal.method;

    // Sort by absolute logLR descending
    const sorted = [...signals].sort(
      (a, b) => Math.abs(b.logLikelihoodRatio) - Math.abs(a.logLikelihoodRatio)
    );

    const top = sorted[0]!;
    const second = sorted[1];

    // If top 2 are within 1.0 of each other, use COMPOSITE
    if (
      second !== undefined &&
      Math.abs(Math.abs(top.logLikelihoodRatio) - Math.abs(second.logLikelihoodRatio)) <= 1.0
    ) {
      return MatchMethod.COMPOSITE;
    }

    return top.method;
  }
}
