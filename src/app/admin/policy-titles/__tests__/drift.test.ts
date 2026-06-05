import { describe, it, expect } from "vitest";
import {
  computeCurrentWarnings,
  detectEvidenceDrift,
} from "@/app/admin/policy-titles/approve-guard";
import type { SubstanceTextBlock, EvidenceQuote } from "@/services/scrutin-policy-title/types";

const block: SubstanceTextBlock = {
  sourceType: "subAmendment",
  sourceId: "a1",
  field: "Amendment.summary",
  text: "Le sous-amendement supprime une exonération aux règles de qualité de l'eau.",
  trust: "official",
};

describe("detectEvidenceDrift", () => {
  it("false when every quote still matches its block", () => {
    const q: EvidenceQuote = {
      sourceType: "subAmendment",
      sourceId: "a1",
      field: "Amendment.summary",
      quote: "supprime une exonération aux règles de qualité de l'eau",
    };
    expect(detectEvidenceDrift([q], [block])).toBe(false);
  });
  it("true when a quote's tuple is gone (sourceId not in blocks)", () => {
    const q: EvidenceQuote = {
      sourceType: "subAmendment",
      sourceId: "GHOST",
      field: "Amendment.summary",
      quote: "supprime",
    };
    expect(detectEvidenceDrift([q], [block])).toBe(true);
  });
  it("true when the quote text no longer appears in the block", () => {
    const q: EvidenceQuote = {
      sourceType: "subAmendment",
      sourceId: "a1",
      field: "Amendment.summary",
      quote: "texte qui n'existe plus du tout",
    };
    expect(detectEvidenceDrift([q], [block])).toBe(true);
  });
});

describe("computeCurrentWarnings", () => {
  it("returns warnings for the current title against current blocks (delegates to runValidators)", () => {
    const flags = computeCurrentWarnings(
      "Rétablir l'article 8 du projet de loi agricole",
      null,
      [],
      [block]
    );
    expect(flags.some((f) => f.severity === "blocker")).toBe(true); // ARTICLE_ONLY / EVIDENCE_GROUNDING
  });
});
