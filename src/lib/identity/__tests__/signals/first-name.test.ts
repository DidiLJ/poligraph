import { describe, it, expect } from "vitest";
import { FirstNameSignal } from "../../signals/first-name";
import { FrenchAdapter } from "../../adapters/fr";

const signal = new FirstNameSignal();
const context = { adapter: FrenchAdapter, mode: "legacy" as const };

const baseCandidate = {
  id: "c1",
  firstName: "Jean-Pierre",
  lastName: "Dupont",
  birthDate: null,
  departments: [],
  gender: null,
  prominenceScore: 500,
};

describe("FirstNameSignal", () => {
  it("returns positive for exact first name match", () => {
    const result = signal.evaluate(
      { firstName: "Jean-Pierre", lastName: "Dupont" },
      baseCandidate,
      context
    );
    expect(result.logLikelihoodRatio).toBe(3.0);
    expect(result.explanation).toContain("exact");
  });

  it("returns positive for exact match with different casing/accents", () => {
    const result = signal.evaluate(
      { firstName: "jean-pierre", lastName: "Dupont" },
      baseCandidate,
      context
    );
    expect(result.logLikelihoodRatio).toBe(3.0);
  });

  it("returns weak positive for partial match (substring)", () => {
    const result = signal.evaluate(
      { firstName: "Jean", lastName: "Dupont" },
      baseCandidate,
      context
    );
    expect(result.logLikelihoodRatio).toBe(1.0);
  });

  it("returns strong negative for complete mismatch", () => {
    const result = signal.evaluate(
      { firstName: "Marie", lastName: "Dupont" },
      baseCandidate,
      context
    );
    expect(result.logLikelihoodRatio).toBe(-5.0);
  });

  it("returns neutral when input has no first name", () => {
    const result = signal.evaluate({ firstName: null, lastName: "Dupont" }, baseCandidate, context);
    expect(result.logLikelihoodRatio).toBe(0);
  });
});
