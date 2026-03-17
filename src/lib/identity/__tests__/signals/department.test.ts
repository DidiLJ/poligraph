import { describe, it, expect } from "vitest";
import { DepartmentSignal } from "../../signals/department";
import { MatchMethod } from "@/generated/prisma";
import { FrenchAdapter } from "../../adapters/fr";

const signal = new DepartmentSignal();
const context = { adapter: FrenchAdapter, mode: "legacy" as const };

const baseCandidate = {
  id: "c1",
  firstName: "Jean",
  lastName: "Dupont",
  birthDate: null,
  departments: ["42", "69"],
  gender: "M" as const,
  prominenceScore: 500,
};

describe("DepartmentSignal", () => {
  it("returns positive when department matches", () => {
    const result = signal.evaluate(
      { firstName: "Jean", lastName: "Dupont", department: "42" },
      baseCandidate,
      context
    );
    expect(result.logLikelihoodRatio).toBeGreaterThan(3);
    expect(result.method).toBe(MatchMethod.DEPARTMENT);
  });

  it("returns weak negative when department doesn't match", () => {
    const result = signal.evaluate(
      { firstName: "Jean", lastName: "Dupont", department: "75" },
      baseCandidate,
      context
    );
    expect(result.logLikelihoodRatio).toBeLessThan(0);
  });

  it("returns neutral when no department in input", () => {
    const result = signal.evaluate(
      { firstName: "Jean", lastName: "Dupont" },
      baseCandidate,
      context
    );
    expect(result.logLikelihoodRatio).toBe(0);
  });

  it("returns neutral when candidate has no departments", () => {
    const result = signal.evaluate(
      { firstName: "Jean", lastName: "Dupont", department: "42" },
      { ...baseCandidate, departments: [] },
      context
    );
    expect(result.logLikelihoodRatio).toBe(0);
  });
});
