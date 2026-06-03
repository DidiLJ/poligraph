import { describe, it, expect } from "vitest";
import { deriveConfidence, deriveStatus } from "@/services/scrutin-policy-title/confidence";
import type { QualitySignals, GenerationWarning } from "@/services/scrutin-policy-title/types";

const signals = (over: Partial<QualitySignals> = {}): QualitySignals => ({
  hasConcreteObject: true,
  hasConcreteAction: true,
  mentionsOnlyProceduralRefs: false,
  evidenceCoverage: 0.7,
  substanceDepth: "subAmendment",
  llmSelfConfidence: "HIGH",
  validationFlags: [],
  ...over,
});
const blocker: GenerationWarning = { code: "ARTICLE_ONLY", severity: "blocker", message: "x" };
const warn: GenerationWarning = { code: "NO_DASH", severity: "warn", message: "x" };

describe("deriveConfidence", () => {
  it("any blocker → LOW regardless of signals", () => {
    expect(deriveConfidence(signals(), [blocker])).toBe("LOW");
  });
  it("subAmendment depth + concrete + coverage>=0.6 + 0 warns → HIGH", () => {
    expect(deriveConfidence(signals(), [])).toBe("HIGH");
  });
  it("medium when coverage between 0.4 and 0.6", () => {
    expect(deriveConfidence(signals({ evidenceCoverage: 0.5 }), [])).toBe("MEDIUM");
  });
  it("exposeDesMotifs depth caps at MEDIUM even when otherwise strong", () => {
    expect(deriveConfidence(signals({ substanceDepth: "exposeDesMotifs" }), [])).toBe("MEDIUM");
  });
  it("null depth → LOW", () => {
    expect(deriveConfidence(signals({ substanceDepth: null }), [])).toBe("LOW");
  });
  it("ignores llmSelfConfidence (HIGH self-confidence + blocker still LOW)", () => {
    expect(deriveConfidence(signals({ llmSelfConfidence: "HIGH" }), [blocker])).toBe("LOW");
  });
  it("warns reduce confidence (HIGH-eligible + 1 warn → MEDIUM)", () => {
    expect(deriveConfidence(signals(), [warn])).toBe("MEDIUM");
  });
});

describe("deriveStatus", () => {
  it("HIGH + no blocker → DRAFT", () => {
    expect(deriveStatus("HIGH", false)).toBe("DRAFT");
  });
  it("MEDIUM → NEEDS_REVIEW", () => {
    expect(deriveStatus("MEDIUM", false)).toBe("NEEDS_REVIEW");
  });
  it("LOW → NEEDS_REVIEW", () => {
    expect(deriveStatus("LOW", false)).toBe("NEEDS_REVIEW");
  });
  it("HIGH but hasBlocker → NEEDS_REVIEW (never DRAFT with a blocker)", () => {
    expect(deriveStatus("HIGH", true)).toBe("NEEDS_REVIEW");
  });
  it("NEVER returns APPROVED", () => {
    const all = [
      deriveStatus("HIGH", false),
      deriveStatus("MEDIUM", false),
      deriveStatus("LOW", true),
    ];
    expect(all).not.toContain("APPROVED");
  });
});
