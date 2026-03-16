import { describe, it, expect } from "vitest";
import { GenderSignal } from "../../signals/gender";
import { FrenchAdapter } from "../../adapters/fr";

const signal = new GenderSignal();
const context = { adapter: FrenchAdapter, mode: "legacy" as const };

const maleCandidate = {
  id: "c1",
  firstName: "Jean",
  lastName: "Dupont",
  birthDate: null,
  departments: [],
  gender: "M" as const,
  prominenceScore: 500,
};

describe("GenderSignal", () => {
  it("returns weak positive for gender match", () => {
    const result = signal.evaluate(
      { firstName: "Jean", lastName: "Dupont", gender: "M" },
      maleCandidate,
      context
    );
    expect(result.logLikelihoodRatio).toBe(0.7);
  });

  it("returns strong negative for gender mismatch", () => {
    const result = signal.evaluate(
      { firstName: "Jean", lastName: "Dupont", gender: "F" },
      maleCandidate,
      context
    );
    expect(result.logLikelihoodRatio).toBe(-6.0);
  });

  it("returns neutral when input gender is missing", () => {
    const result = signal.evaluate(
      { firstName: "Jean", lastName: "Dupont" },
      maleCandidate,
      context
    );
    expect(result.logLikelihoodRatio).toBe(0);
  });

  it("returns neutral when candidate gender is missing", () => {
    const result = signal.evaluate(
      { firstName: "Jean", lastName: "Dupont", gender: "M" },
      { ...maleCandidate, gender: null },
      context
    );
    expect(result.logLikelihoodRatio).toBe(0);
  });
});
