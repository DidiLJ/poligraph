import { describe, it, expect } from "vitest";
import { parsePolicyTitleOutput } from "@/services/scrutin-policy-title/parse-output";

const validJson = JSON.stringify({
  policyTitle: "Limiter les dérogations aux seuils de qualité de l'eau",
  policySubtitle: null,
  evidenceQuotes: [
    { sourceType: "subAmendment", sourceId: "a1", field: "Amendment.summary", quote: "supprime" },
  ],
  selfConfidence: "HIGH",
  rationale: "ok",
});

describe("parsePolicyTitleOutput", () => {
  it("strict-parses valid JSON", () => {
    const r = parsePolicyTitleOutput(validJson);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.policyTitle).toContain("Limiter");
  });
  it("repairs fenced JSON (```json … ```)", () => {
    const r = parsePolicyTitleOutput("```json\n" + validJson + "\n```");
    expect(r.ok).toBe(true);
  });
  it("repairs prose-then-object", () => {
    const r = parsePolicyTitleOutput("Voici le résultat : " + validJson + " — fin.");
    expect(r.ok).toBe(true);
  });
  it("fails cleanly on unparseable text (no throw)", () => {
    const r = parsePolicyTitleOutput("pas du tout du json");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("LLM_OUTPUT_INVALID");
      expect(typeof r.diagnostic).toBe("string");
    }
  });
  it("fails on valid JSON that violates the schema (title > 140)", () => {
    const bad = JSON.stringify({ ...JSON.parse(validJson), policyTitle: "x".repeat(141) });
    const r = parsePolicyTitleOutput(bad);
    expect(r.ok).toBe(false);
  });
  it("never throws on any input", () => {
    expect(() => parsePolicyTitleOutput("")).not.toThrow();
    expect(() => parsePolicyTitleOutput("{")).not.toThrow();
  });
});
