import { describe, it, expect } from "vitest";
import { PolicyTitleOutputSchema } from "@/services/scrutin-policy-title/output-schema";

const valid = {
  policyTitle: "Limiter les dérogations aux seuils de qualité de l'eau",
  policySubtitle: "Ce sous-amendement supprime une exonération.",
  evidenceQuotes: [
    {
      sourceType: "subAmendment",
      sourceId: "a1",
      field: "Amendment.summary",
      quote: "supprime une exonération",
    },
  ],
  selfConfidence: "HIGH",
  rationale: "Dispositif explicite.",
};

describe("PolicyTitleOutputSchema", () => {
  it("accepts a valid output", () => {
    expect(PolicyTitleOutputSchema.safeParse(valid).success).toBe(true);
  });
  it("accepts null policySubtitle", () => {
    expect(PolicyTitleOutputSchema.safeParse({ ...valid, policySubtitle: null }).success).toBe(
      true
    );
  });
  it("rejects a missing policyTitle", () => {
    const { policyTitle: _policyTitle, ...rest } = valid;
    void _policyTitle;
    expect(PolicyTitleOutputSchema.safeParse(rest).success).toBe(false);
  });
  it("rejects a policyTitle over 140 chars", () => {
    expect(
      PolicyTitleOutputSchema.safeParse({ ...valid, policyTitle: "x".repeat(141) }).success
    ).toBe(false);
  });
  it("rejects an empty policyTitle", () => {
    expect(PolicyTitleOutputSchema.safeParse({ ...valid, policyTitle: "" }).success).toBe(false);
  });
  it("rejects an invalid selfConfidence", () => {
    expect(PolicyTitleOutputSchema.safeParse({ ...valid, selfConfidence: "MAYBE" }).success).toBe(
      false
    );
  });
});
