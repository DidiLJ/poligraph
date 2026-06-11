import { describe, it, expect, beforeEach, vi } from "vitest";

// Controlled DB + Mistral mocks: no real database, no network.
const findMany = vi.fn();
const upsert = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    scrutin: { findMany: (...a: unknown[]) => findMany(...a) },
    scrutinAnalysis: { upsert: (...a: unknown[]) => upsert(...a) },
  },
}));

const callMistral = vi.fn();
const extractMistralText = vi.fn();
const parseMistralJSON = vi.fn();
vi.mock("@/lib/api/mistral", () => ({
  callMistral: (...a: unknown[]) => callMistral(...a),
  extractMistralText: (...a: unknown[]) => extractMistralText(...a),
  parseMistralJSON: (...a: unknown[]) => parseMistralJSON(...a),
}));

import { generateScrutinAnalysis } from "../scrutin-analysis";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function keyVoteScrutin(debate: string | null): any {
  return {
    id: "s1",
    title: "l'amendement n° 2084 de Mme Lechon après l'article 22 ...",
    result: "REJECTED",
    votesFor: 37,
    votesAgainst: 38,
    votesAbstain: 2,
    groupPositions: [
      {
        group: { name: "Rassemblement National", code: "RN" },
        position: "POUR",
        forCount: 34,
        againstCount: 0,
        abstainCount: 0,
      },
    ],
    debateTranscripts: debate ? [{ content: debate }] : [],
    dossierLegislatif: { title: "Projet de loi d'urgence agricole" },
  };
}

describe("generateScrutinAnalysis — no-debate guard", () => {
  beforeEach(() => {
    findMany.mockReset();
    upsert.mockReset();
    callMistral.mockReset();
    extractMistralText.mockReset();
    parseMistralJSON.mockReset();
  });

  it("skips a scrutin with no usable debate transcript: no model call, no write", async () => {
    findMany.mockResolvedValue([keyVoteScrutin(null)]);

    const res = await generateScrutinAnalysis({ limit: 10 });

    expect(callMistral).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(res.generated).toBe(0);
    expect(res.skipped).toBeGreaterThanOrEqual(1);
  });

  it("still generates when a debate transcript is available", async () => {
    findMany.mockResolvedValue([
      keyVoteScrutin("M. X a défendu le texte en séance ; Mme Y s'y est opposée."),
    ]);
    callMistral.mockResolvedValue({});
    extractMistralText.mockReturnValue("{}");
    parseMistralJSON.mockReturnValue({
      argumentsFor: "Les partisans ont mis en avant la transparence.",
      argumentsAgainst: "Les opposants ont pointé une complexité accrue.",
    });

    const res = await generateScrutinAnalysis({ limit: 10 });

    expect(callMistral).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(res.generated).toBe(1);
  });
});
