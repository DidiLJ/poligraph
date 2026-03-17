/**
 * Signal pipeline interfaces for identity resolution.
 * Language-agnostic — signals are pure functions.
 */

import type { MatchMethod } from "@/generated/prisma";
import type { CountryAdapter } from "../adapters/types";

export enum SignalTier {
  /** Deterministic — can produce SAME alone (ExternalId, exact birthdate+name) */
  DETERMINISTIC = 0,
  /** Strong — high discriminative power (birthdate) */
  STRONG = 1,
  /** Moderate — contributes but not decisive (name similarity, gender) */
  MODERATE = 2,
  /** Contextual — expensive, only for UNDECIDED (phonetic, temporal, party) */
  CONTEXTUAL = 3,
}

export interface SignalResult {
  /** Signal identifier */
  signalId: string;
  /**
   * Fellegi-Sunter log-likelihood ratio.
   * Positive = evidence FOR match. Negative = evidence AGAINST.
   * In Phase 1, this is computed and stored in evidence but NOT used for judgement.
   */
  logLikelihoodRatio: number;
  /** Whether this signal alone is sufficient for a SAME judgement */
  deterministic: boolean;
  /** Human-readable explanation (for evidence JSON) */
  explanation: string;
  /** Method used (maps to MatchMethod enum) */
  method: MatchMethod;
}

export interface SignalEvaluator {
  /** Unique identifier for this signal */
  readonly id: string;
  /** Human-readable description */
  readonly description: string;
  /** Which tier this signal belongs to */
  readonly tier: SignalTier;
  /**
   * Evaluate this signal for a candidate match.
   * MUST be a pure function (no DB calls, no side effects).
   */
  evaluate(
    input: SignalScoringInput,
    candidate: SignalCandidateRecord,
    context: SignalScoringContext
  ): SignalResult;
}

/** Input record being resolved — the "incoming" data */
export interface SignalScoringInput {
  firstName: string | null;
  lastName: string;
  birthDate?: Date | null;
  department?: string | null;
  gender?: string | null;
  sourceDate?: Date | null;
  sourceText?: string | null;
}

/** Politician record from the database — the "candidate" to match against */
export interface SignalCandidateRecord {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  departments: string[];
  gender: string | null;
  prominenceScore: number;
}

/** Pre-loaded context available to all signal evaluators */
export interface SignalScoringContext {
  /** Active country adapter */
  adapter: CountryAdapter;
  /** Combiner mode */
  mode: "legacy" | "fellegi-sunter";
  /** Name frequency lookup (Phase 2 - optional in Phase 1) */
  nameFrequency?: { get(name: string): number | undefined };
  /** Total politicians in DB (Phase 2 - for probability calculations) */
  totalRecords?: number;
  /** Unique last name count (Phase 2 - for Laplace smoothing) */
  uniqueNames?: number;
}
