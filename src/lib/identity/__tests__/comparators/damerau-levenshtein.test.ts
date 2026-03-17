import { describe, it, expect } from "vitest";
import {
  DamerauLevenshteinComparator,
  damerauLevenshtein,
} from "../../comparators/damerau-levenshtein";
import type { NameComparator } from "../../comparators/types";

describe("DamerauLevenshteinComparator", () => {
  const comparator = new DamerauLevenshteinComparator();

  describe("interface compliance", () => {
    it("has the correct id", () => {
      expect(comparator.id).toBe("damerau-levenshtein");
    });

    it("satisfies the NameComparator interface", () => {
      const c: NameComparator = comparator;
      expect(typeof c.compare).toBe("function");
      expect(typeof c.id).toBe("string");
    });

    it("exports a singleton instance", () => {
      expect(damerauLevenshtein).toBeInstanceOf(DamerauLevenshteinComparator);
      expect(damerauLevenshtein.id).toBe("damerau-levenshtein");
    });
  });

  describe("edge cases", () => {
    it("returns 1 for identical strings", () => {
      expect(comparator.compare("dupont", "dupont")).toBe(1);
    });

    it("returns 1 for identical empty strings", () => {
      expect(comparator.compare("", "")).toBe(1);
    });

    it("returns 0 when one string is empty and the other is not", () => {
      expect(comparator.compare("", "dupont")).toBe(0);
      expect(comparator.compare("dupont", "")).toBe(0);
    });

    it("returns 0 for completely different strings of equal length", () => {
      // "abc" vs "xyz": 3 substitutions, distance = 3, max = 3 -> similarity = 0
      expect(comparator.compare("abc", "xyz")).toBe(0);
    });
  });

  describe("transposition", () => {
    it("scores a single transposition correctly: 'ab'/'ba' -> 0.5", () => {
      // distance = 1, max = 2 -> 1 - 1/2 = 0.5
      expect(comparator.compare("ab", "ba")).toBeCloseTo(0.5);
    });

    it("handles transposition in the middle of a word", () => {
      // "dupnot" vs "dupont": 1 transposition -> distance = 1, max = 6
      expect(comparator.compare("dupnot", "dupont")).toBeCloseTo(1 - 1 / 6);
    });
  });

  describe("insertion and deletion", () => {
    it("single insertion: 'dupont'/'dupontt' -> ~0.857", () => {
      // distance = 1, max = 7 -> 1 - 1/7 ≈ 0.857
      expect(comparator.compare("dupont", "dupontt")).toBeCloseTo(1 - 1 / 7, 3);
    });

    it("single deletion", () => {
      // "dupontt" -> "dupont": distance = 1, max = 7
      expect(comparator.compare("dupontt", "dupont")).toBeCloseTo(1 - 1 / 7, 3);
    });

    it("is symmetric for insertions and deletions", () => {
      const s1 = comparator.compare("martin", "martine");
      const s2 = comparator.compare("martine", "martin");
      expect(s1).toBeCloseTo(s2, 10);
    });
  });

  describe("French OCR / typo errors", () => {
    it("lefebvre/lefevbre (transposition) scores >0.85", () => {
      // distance = 1, max = 8 -> 1 - 1/8 = 0.875
      expect(comparator.compare("lefebvre", "lefevbre")).toBeGreaterThan(0.85);
    });

    it("handles common French name variants with extra letter", () => {
      // "bernard" vs "bernarde": distance = 1, max = 8
      expect(comparator.compare("bernard", "bernarde")).toBeGreaterThan(0.85);
    });

    it("handles accented vs unaccented chars as substitutions", () => {
      // "éric" vs "eric": distance = 1, max = 4 -> 0.75
      expect(comparator.compare("éric", "eric")).toBeCloseTo(0.75);
    });
  });

  describe("similarity is symmetric", () => {
    it("compare(a, b) === compare(b, a)", () => {
      const pairs = [
        ["dupont", "durant"],
        ["lefebvre", "lefevbre"],
        ["martin", "martine"],
        ["jean", "jeanne"],
      ];
      for (const [a, b] of pairs) {
        expect(comparator.compare(a, b)).toBeCloseTo(comparator.compare(b, a), 10);
      }
    });
  });

  describe("score range", () => {
    it("always returns a value between 0 and 1 inclusive", () => {
      const pairs = [
        ["", ""],
        ["a", ""],
        ["", "b"],
        ["abc", "abc"],
        ["abc", "xyz"],
        ["lefebvre", "lefevbre"],
        ["dupont", "dupontt"],
      ];
      for (const [a, b] of pairs) {
        const score = comparator.compare(a, b);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    });
  });
});
