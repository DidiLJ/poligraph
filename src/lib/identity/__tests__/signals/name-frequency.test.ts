import { describe, it, expect, vi } from "vitest";

// Mock db before importing frequency to avoid DATABASE_URL requirement
vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(),
  },
}));

import { NameFrequencySignal } from "../../signals/name-frequency";
import { NameFrequencyCache } from "../../frequency";
import { FrenchAdapter } from "../../adapters/fr";

const cache = NameFrequencyCache.fromCounts(
  new Map([
    ["martin", 80],
    ["melenchon", 1],
    ["dupont", 30],
  ]),
  10000
);

const context = {
  adapter: FrenchAdapter,
  mode: "fellegi-sunter" as const,
  nameFrequency: cache,
  totalRecords: 10000,
  uniqueNames: 3,
};

const signal = new NameFrequencySignal();

const makeInput = (lastName: string) => ({
  firstName: "Jean",
  lastName,
  birthDate: null,
  department: null,
  gender: null,
});

const makeCandidate = (lastName: string) => ({
  id: "1",
  firstName: "Jean",
  lastName,
  birthDate: null,
  departments: [],
  gender: null,
  prominenceScore: 100,
});

describe("NameFrequencySignal", () => {
  it("gives high logLR for rare name match", () => {
    // melenchon freq = 1/10000 = 0.0001
    // logLR = log2(1/0.0001) = ~13.3
    const result = signal.evaluate(makeInput("melenchon"), makeCandidate("melenchon"), context);
    expect(result.logLikelihoodRatio).toBeGreaterThan(13);
    expect(result.logLikelihoodRatio).toBeLessThan(14);
  });

  it("gives lower logLR for common name match", () => {
    // martin freq = 80/10000 = 0.008
    // logLR = log2(1/0.008) = ~6.97
    const result = signal.evaluate(makeInput("martin"), makeCandidate("martin"), context);
    expect(result.logLikelihoodRatio).toBeGreaterThan(6.5);
    expect(result.logLikelihoodRatio).toBeLessThan(7.5);
  });

  it("caps logLR at 20.0", () => {
    const unknownCache = NameFrequencyCache.fromCounts(new Map([["zzz", 1]]), 1000000);
    const ctx = { ...context, nameFrequency: unknownCache, totalRecords: 1000000, uniqueNames: 1 };
    const result = signal.evaluate(makeInput("zzz"), makeCandidate("zzz"), ctx);
    expect(result.logLikelihoodRatio).toBeLessThanOrEqual(20.0);
  });

  it("returns 0 when nameFrequency is not available (legacy mode)", () => {
    const legacyCtx = { adapter: FrenchAdapter, mode: "legacy" as const };
    const result = signal.evaluate(makeInput("martin"), makeCandidate("martin"), legacyCtx);
    expect(result.logLikelihoodRatio).toBe(0);
  });

  it("gives discounted logLR for fuzzy name match (Jaro-Winkler >= 0.92)", () => {
    const result = signal.evaluate(makeInput("dupond"), makeCandidate("dupont"), context);
    expect(result.logLikelihoodRatio).toBeGreaterThan(0);
    const exactResult = signal.evaluate(makeInput("dupont"), makeCandidate("dupont"), context);
    expect(result.logLikelihoodRatio).toBeLessThan(exactResult.logLikelihoodRatio);
  });

  it("returns 0 when names do not match at all", () => {
    const result = signal.evaluate(makeInput("martin"), makeCandidate("dupont"), context);
    expect(result.logLikelihoodRatio).toBe(0);
  });
});
