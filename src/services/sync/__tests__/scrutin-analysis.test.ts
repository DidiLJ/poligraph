import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/api/mistral", () => ({
  callMistral: vi.fn(),
  extractMistralText: vi.fn(),
  parseMistralJSON: vi.fn(),
}));

import { buildAnalysisPrompt, validateAnalysisOutput } from "../scrutin-analysis";

describe("buildAnalysisPrompt", () => {
  it("includes vote data and debate excerpt in prompt", () => {
    const prompt = buildAnalysisPrompt({
      title: "Projet de loi de finances 2026",
      result: "ADOPTED",
      votesFor: 312,
      votesAgainst: 245,
      votesAbstain: 18,
      groupPositions: [
        { groupName: "EPR", position: "POUR", forCount: 95, againstCount: 2, abstainCount: 1 },
        { groupName: "LFI", position: "CONTRE", forCount: 3, againstCount: 68, abstainCount: 4 },
      ],
      debateExcerpt: "M. Le Maire a défendu le texte en indiquant...",
      dossierContext: null,
    });

    expect(prompt).toContain("Projet de loi de finances 2026");
    expect(prompt).toContain("EPR");
    expect(prompt).toContain("LFI");
    expect(prompt).toContain("M. Le Maire");
  });
});

describe("validateAnalysisOutput", () => {
  it("accepts valid structured output", () => {
    const result = validateAnalysisOutput({
      argumentsFor: "Les partisans du texte ont mis en avant la stabilité budgétaire.",
      argumentsAgainst: "Les opposants ont dénoncé l'impact sur les collectivités.",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects output with value-laden adjectives", () => {
    const result = validateAnalysisOutput({
      argumentsFor: "Les défenseurs ont présenté un argument raisonnable.",
      argumentsAgainst: "Opposition courageuse face au texte.",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("neutrality");
  });

  it("rejects output exceeding 500 chars per argument", () => {
    const result = validateAnalysisOutput({
      argumentsFor: "A".repeat(501),
      argumentsAgainst: "Short.",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("conciseness");
  });
});
