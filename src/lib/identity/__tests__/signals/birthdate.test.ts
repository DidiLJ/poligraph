import { describe, it, expect } from "vitest";
import { BirthdateSignal } from "../../signals/birthdate";
import { MatchMethod } from "@/generated/prisma";
import { SignalTier } from "../../signals/types";
import { FrenchAdapter } from "../../adapters/fr";

const signal = new BirthdateSignal();
const context = { adapter: FrenchAdapter, mode: "legacy" as const };

const baseCandidate = {
  id: "c1",
  firstName: "Jean",
  lastName: "Dupont",
  birthDate: new Date("1965-03-15"),
  departments: [],
  gender: "M" as const,
  prominenceScore: 500,
};

describe("BirthdateSignal", () => {
  it("has correct metadata", () => {
    expect(signal.id).toBe("birthdate");
    expect(signal.tier).toBe(SignalTier.STRONG);
  });

  it("returns strong positive for exact birthdate match", () => {
    const result = signal.evaluate(
      { firstName: "Jean", lastName: "Dupont", birthDate: new Date("1965-03-15") },
      baseCandidate,
      context
    );
    expect(result.logLikelihoodRatio).toBeGreaterThan(14);
    expect(result.method).toBe(MatchMethod.BIRTHDATE);
  });

  it("returns strong positive for 1-day tolerance match", () => {
    const result = signal.evaluate(
      { firstName: "Jean", lastName: "Dupont", birthDate: new Date("1965-03-16") },
      baseCandidate,
      context
    );
    expect(result.logLikelihoodRatio).toBeGreaterThan(14);
  });

  it("returns strong negative for birthdate mismatch", () => {
    const result = signal.evaluate(
      { firstName: "Jean", lastName: "Dupont", birthDate: new Date("1970-06-20") },
      baseCandidate,
      context
    );
    expect(result.logLikelihoodRatio).toBeLessThan(-7);
  });

  it("returns neutral when input has no birthdate", () => {
    const result = signal.evaluate(
      { firstName: "Jean", lastName: "Dupont" },
      baseCandidate,
      context
    );
    expect(result.logLikelihoodRatio).toBe(0);
  });

  it("returns neutral when candidate has no birthdate", () => {
    const result = signal.evaluate(
      { firstName: "Jean", lastName: "Dupont", birthDate: new Date("1965-03-15") },
      { ...baseCandidate, birthDate: null },
      context
    );
    expect(result.logLikelihoodRatio).toBe(0);
  });
});
