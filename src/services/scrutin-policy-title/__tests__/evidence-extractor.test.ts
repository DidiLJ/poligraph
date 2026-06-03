import { describe, it, expect } from "vitest";
import { extractEvidenceCandidates } from "@/services/scrutin-policy-title/evidence-extractor";
import type { SubstanceTextBlock } from "@/services/scrutin-policy-title/types";

const block = (over: Partial<SubstanceTextBlock>): SubstanceTextBlock => ({
  sourceType: "subAmendment",
  sourceId: "a1",
  field: "Amendment.summary",
  text: "",
  trust: "official",
  ...over,
});

describe("extractEvidenceCandidates", () => {
  it("extracts sentences with a policy verb + concrete object, inheriting block provenance", () => {
    const blocks = [
      block({
        text: "Le présent sous-amendement supprime la possibilité d'exonérer certaines exploitations des seuils de qualité de l'eau. Cette disposition vise la cohérence.",
      }),
    ];
    const cands = extractEvidenceCandidates(blocks);
    expect(cands.length).toBeGreaterThan(0);
    const top = cands[0]!;
    expect(top.sourceType).toBe("subAmendment");
    expect(top.sourceId).toBe("a1");
    expect(top.field).toBe("Amendment.summary");
    expect(top.quote).toContain("supprime");
    // offsets point into the block text
    expect(top.startOffset).toBeGreaterThanOrEqual(0);
    expect(top.endOffset).toBeGreaterThan(top.startOffset!);
  });

  it("ignores blocks whose trust is not official", () => {
    const blocks = [
      block({ trust: "editorialContext", text: "supprime les seuils de qualité de l'eau." }),
    ];
    expect(extractEvidenceCandidates(blocks)).toHaveLength(0);
  });

  it("rejects purely procedural sentences (only article/amendement/loi nouns, no concrete object)", () => {
    const blocks = [
      block({ text: "Cet amendement modifie l'article 8 du projet de loi en première lecture." }),
    ];
    const cands = extractEvidenceCandidates(blocks);
    // No concrete policy object → either no candidate, or weight 0 not surfaced
    expect(cands.every((c) => c.weight > 0)).toBe(true);
    expect(cands.find((c) => /article 8/.test(c.quote) && c.keywords.length === 0)).toBeUndefined();
  });

  it("caps at 8 candidates, highest weight first", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      block({
        sourceId: `a${i}`,
        text: `Mesure ${i}: limiter les dérogations aux seuils de qualité de l'eau pour les exploitations.`,
      })
    );
    const cands = extractEvidenceCandidates(many);
    expect(cands.length).toBeLessThanOrEqual(8);
    for (let i = 1; i < cands.length; i++)
      expect(cands[i - 1]!.weight).toBeGreaterThanOrEqual(cands[i]!.weight);
  });
});
