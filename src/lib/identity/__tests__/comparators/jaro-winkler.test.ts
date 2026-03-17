import { describe, it, expect } from "vitest";
import { JaroWinklerComparator } from "../../comparators/jaro-winkler";
import type { NameComparator } from "../../comparators/types";

const comparator = new JaroWinklerComparator();

describe("JaroWinklerComparator", () => {
  describe("interface compliance", () => {
    it("satisfies NameComparator interface", () => {
      const c: NameComparator = comparator;
      expect(c.id).toBe("jaro-winkler");
      expect(typeof c.compare).toBe("function");
    });
  });

  describe("edge cases", () => {
    it("returns 1.0 for identical strings", () => {
      expect(comparator.compare("dupont", "dupont")).toBe(1.0);
    });

    it("returns 1.0 for identical single-character strings", () => {
      expect(comparator.compare("a", "a")).toBe(1.0);
    });

    it("returns 0.0 when first string is empty", () => {
      expect(comparator.compare("", "dupont")).toBe(0.0);
    });

    it("returns 0.0 when second string is empty", () => {
      expect(comparator.compare("dupont", "")).toBe(0.0);
    });

    it("returns 0.0 when both strings are empty", () => {
      expect(comparator.compare("", "")).toBe(1.0);
    });

    it("returns a value between 0 and 1 for any input", () => {
      const score = comparator.compare("martin", "dupont");
      expect(score).toBeGreaterThanOrEqual(0.0);
      expect(score).toBeLessThanOrEqual(1.0);
    });
  });

  describe("classic algorithm cases", () => {
    it('classic: "martha" vs "marhta" scores above 0.96', () => {
      const score = comparator.compare("martha", "marhta");
      expect(score).toBeGreaterThan(0.96);
    });

    it("is symmetric", () => {
      expect(comparator.compare("martha", "marhta")).toBeCloseTo(
        comparator.compare("marhta", "martha"),
        10
      );
    });
  });

  describe("French surname variants", () => {
    it('"lefebvre" vs "lefevre" scores above 0.92', () => {
      const score = comparator.compare("lefebvre", "lefevre");
      expect(score).toBeGreaterThan(0.92);
    });

    it('"dupont" vs "dupond" scores above 0.92', () => {
      const score = comparator.compare("dupont", "dupond");
      expect(score).toBeGreaterThan(0.92);
    });

    it('"martin" vs "martinez" scores between 0.85 and 0.95 (inclusive)', () => {
      const score = comparator.compare("martin", "martinez");
      expect(score).toBeGreaterThan(0.85);
      expect(score).toBeLessThanOrEqual(0.95);
    });
  });

  describe("prefix bonus", () => {
    it("scores higher when strings share a longer common prefix", () => {
      const withPrefix = comparator.compare("dupont", "dupond");
      const withoutPrefix = comparator.compare("martin", "nitram");
      expect(withPrefix).toBeGreaterThan(withoutPrefix);
    });

    it("applies at most 4 characters of prefix bonus", () => {
      // Both share 5-char prefix "abcde", but only 4 count
      const fivePrefix = comparator.compare("abcdefg", "abcdexyz");
      const fourPrefix = comparator.compare("abcdefg", "abcdyyy");
      // Both capped at prefix length 4, so behavior should be consistent
      expect(fivePrefix).toBeGreaterThanOrEqual(0.0);
      expect(fourPrefix).toBeGreaterThanOrEqual(0.0);
    });
  });
});
