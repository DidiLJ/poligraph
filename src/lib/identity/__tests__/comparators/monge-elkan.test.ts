import { describe, it, expect } from "vitest";
import { MongeElkanComparator } from "../../comparators/monge-elkan";
import { JaroWinklerComparator } from "../../comparators/jaro-winkler";
import type { NameComparator } from "../../comparators/types";

// Simple exact-match test double for deterministic unit tests
const exactInner: NameComparator = {
  id: "exact",
  compare(a, b) {
    return a === b ? 1.0 : 0.0;
  },
};

const jwComparator = new JaroWinklerComparator();
const meJW = new MongeElkanComparator(jwComparator);
const meExact = new MongeElkanComparator(exactInner);

describe("MongeElkanComparator", () => {
  describe("interface compliance", () => {
    it('has id "monge-elkan"', () => {
      expect(meJW.id).toBe("monge-elkan");
    });

    it("returns a number in [0, 1] range", () => {
      const score = meJW.compare("jean dupont", "jean dupont");
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe("edge cases", () => {
    it("returns 1 for two empty strings", () => {
      expect(meJW.compare("", "")).toBe(1);
    });

    it("returns 0 when one side is empty", () => {
      expect(meJW.compare("jean dupont", "")).toBe(0);
      expect(meJW.compare("", "jean dupont")).toBe(0);
    });
  });

  describe("single-token strings", () => {
    it("delegates to inner comparator for single tokens on both sides", () => {
      // exact inner: same token -> 1
      expect(meExact.compare("dupont", "dupont")).toBe(1.0);
      // exact inner: different tokens -> 0
      expect(meExact.compare("dupont", "martin")).toBe(0.0);
    });

    it("uses jaro-winkler scoring for single fuzzy tokens", () => {
      const direct = jwComparator.compare("dupont", "dupond");
      expect(meJW.compare("dupont", "dupond")).toBeCloseTo(direct, 6);
    });
  });

  describe("multi-token similarity", () => {
    it("returns 1.0 for identical multi-token strings", () => {
      expect(meJW.compare("jean dupont", "jean dupont")).toBe(1.0);
      expect(meJW.compare("jean pierre dupont", "jean pierre dupont")).toBe(1.0);
    });

    it("handles token reordering: 'dupont jean' vs 'jean dupont' -> >0.95", () => {
      const score = meJW.compare("dupont jean", "jean dupont");
      expect(score).toBeGreaterThan(0.95);
    });

    it("handles hyphenated compound tokens as separate tokens", () => {
      // "jean-pierre" splits to ["jean", "pierre"]
      const score = meJW.compare("jean-pierre dupont", "jean pierre dupont");
      expect(score).toBeGreaterThan(0.95);
    });

    it("handles compound vs simple name: 'jean pierre dupont' vs 'jean dupont' -> >0.8", () => {
      const score = meJW.compare("jean pierre dupont", "jean dupont");
      expect(score).toBeGreaterThan(0.8);
    });

    it("returns low score for clearly different names: 'jean dupont' vs 'marie martin' -> <0.6", () => {
      // Jaro-Winkler character-level matching on short tokens yields ~0.55 for
      // unrelated French first/last names — well below the 0.95+ threshold used
      // for same-person decisions, but above 0.5 due to shared common letters.
      const score = meJW.compare("jean dupont", "marie martin");
      expect(score).toBeLessThan(0.6);
    });
  });

  describe("symmetry", () => {
    it("is symmetric: compare(A,B) === compare(B,A)", () => {
      const pairs = [
        ["jean dupont", "dupont jean"],
        ["jean pierre dupont", "jean dupont"],
        ["marie-claire martin", "marie martin"],
        ["jean dupont", "marie martin"],
      ];
      for (const [a, b] of pairs) {
        expect(meJW.compare(a, b)).toBeCloseTo(meJW.compare(b, a), 10);
      }
    });
  });

  describe("French name patterns", () => {
    it("handles accented names correctly", () => {
      const score = meJW.compare("stéphane le foll", "stephane le foll");
      // different strings but high similarity
      expect(score).toBeGreaterThan(0.8);
    });

    it("handles particle 'de' in compound names", () => {
      // "de" is a short token; Monge-Elkan still aligns it
      const score = meJW.compare("charles de gaulle", "de gaulle charles");
      expect(score).toBeGreaterThan(0.95);
    });
  });

  describe("exact inner comparator determinism", () => {
    it("scores 1 when all tokens match exactly (order-independent)", () => {
      // exact inner: directed(["b","a"], ["a","b"]) = (max(0,1) + max(1,0)) / 2 = 1
      expect(meExact.compare("a b", "b a")).toBe(1.0);
    });

    it("scores correctly for partial token overlap", () => {
      // tokens A=["jean","pierre","dupont"], B=["jean","dupont"]
      // directed(A,B): jean->1, pierre->0, dupont->1 => 2/3
      // directed(B,A): jean->1, dupont->1 => 2/2 = 1
      // max(2/3, 1) = 1
      expect(meExact.compare("jean pierre dupont", "jean dupont")).toBe(1.0);
    });
  });
});
