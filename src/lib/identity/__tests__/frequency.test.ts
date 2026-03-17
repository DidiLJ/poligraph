import { describe, it, expect, vi } from "vitest";

// Mock db before importing frequency to avoid DATABASE_URL requirement
vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(),
  },
}));

import { NameFrequencyCache } from "../frequency";

describe("NameFrequencyCache", () => {
  describe("fromCounts", () => {
    it("returns correct frequency for a known name", () => {
      const counts = new Map([
        ["martin", 10],
        ["dupont", 5],
        ["durand", 5],
      ]);
      const cache = NameFrequencyCache.fromCounts(counts, 20);
      expect(cache.get("martin")).toBeCloseTo(0.5);
      expect(cache.get("dupont")).toBeCloseTo(0.25);
      expect(cache.get("durand")).toBeCloseTo(0.25);
    });

    it("returns undefined for an unknown name", () => {
      const counts = new Map([["martin", 10]]);
      const cache = NameFrequencyCache.fromCounts(counts, 10);
      expect(cache.get("melenchon")).toBeUndefined();
    });

    it("getCount returns the raw occurrence count", () => {
      const counts = new Map([
        ["martin", 42],
        ["dupont", 7],
      ]);
      const cache = NameFrequencyCache.fromCounts(counts, 49);
      expect(cache.getCount("martin")).toBe(42);
      expect(cache.getCount("dupont")).toBe(7);
    });

    it("getCount returns undefined for an unknown name", () => {
      const counts = new Map([["martin", 10]]);
      const cache = NameFrequencyCache.fromCounts(counts, 10);
      expect(cache.getCount("xyz")).toBeUndefined();
    });

    it("exposes correct totalRecords and uniqueNames", () => {
      const counts = new Map([
        ["martin", 10],
        ["dupont", 5],
        ["durand", 5],
      ]);
      const cache = NameFrequencyCache.fromCounts(counts, 20);
      expect(cache.totalRecords).toBe(20);
      expect(cache.uniqueNames).toBe(3);
    });

    it("handles an empty map without errors", () => {
      const cache = NameFrequencyCache.fromCounts(new Map(), 0);
      expect(cache.totalRecords).toBe(0);
      expect(cache.uniqueNames).toBe(0);
      expect(cache.get("martin")).toBeUndefined();
      expect(cache.getCount("martin")).toBeUndefined();
    });
  });
});
