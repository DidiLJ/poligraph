import type { GenerationWarning, QualitySignals } from "./types";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type GenerationStatus = "DRAFT" | "NEEDS_REVIEW";

/**
 * System-derived confidence. Deliberately IGNORES the LLM's self-reported
 * confidence: trust comes from grounded evidence and validator flags, never
 * from the model's own claim. Any blocker forces LOW.
 */
export function deriveConfidence(signals: QualitySignals, flags: GenerationWarning[]): Confidence {
  if (flags.some((f) => f.severity === "blocker")) return "LOW";

  const warnCount = flags.filter((f) => f.severity === "warn").length;
  const { substanceDepth, hasConcreteObject, hasConcreteAction, evidenceCoverage } = signals;

  if (substanceDepth === "subAmendment" || substanceDepth === "amendment") {
    if (hasConcreteObject && hasConcreteAction && evidenceCoverage >= 0.6 && warnCount === 0) {
      return "HIGH";
    }
    if (evidenceCoverage >= 0.4 && warnCount <= 2) return "MEDIUM";
    return "LOW";
  }

  if (substanceDepth === "exposeDesMotifs") {
    return hasConcreteObject && warnCount === 0 ? "MEDIUM" : "LOW";
  }

  return "LOW";
}

/**
 * Maps confidence + presence of a blocker onto an editorial status. Never emits
 * APPROVED: publication is always a human decision. A blocker can never produce
 * a DRAFT.
 */
export function deriveStatus(confidence: Confidence, hasBlocker: boolean): GenerationStatus {
  if (hasBlocker) return "NEEDS_REVIEW";
  return confidence === "HIGH" ? "DRAFT" : "NEEDS_REVIEW";
}
