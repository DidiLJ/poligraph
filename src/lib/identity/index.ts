// Core resolver
export { resolve, resolveBatch, scoreCandidate } from "./resolver";

// Legacy types (preserved for backward compatibility)
export type {
  ResolveInput,
  ResolveResult,
  CandidateMatch,
  CachedPolitician,
  ScoringInput,
  LegacyScoringInput,
  BatchResolveInput,
  BatchResolveResult,
} from "./types";
export { IDENTITY_THRESHOLDS, BIRTHDATE_TOLERANCE_MS } from "./types";

// v2 signal pipeline
export type {
  SignalEvaluator,
  SignalResult,
  SignalScoringInput,
  SignalCandidateRecord,
  SignalScoringContext,
} from "./signals/types";
export { SignalTier } from "./signals/types";

// v2 adapter interfaces
export type {
  CountryAdapter,
  NameNormalizer,
  PhoneticEncoder,
  VariantResolver,
  BlockingKeyGenerator,
} from "./adapters/types";

// Adapter registry
export { getAdapter, getDefaultAdapter, registerAdapter } from "./adapters/registry";

// Combiner
export { LegacyCombiner } from "./combiner";
export type { CombinerResult } from "./combiner";
