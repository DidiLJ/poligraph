import { describe, it, expect } from "vitest";
import { LegacyCombiner } from "../combiner";
import { MatchMethod } from "@/generated/prisma";
import type { SignalResult } from "../signals/types";

const combiner = new LegacyCombiner();

function makeSignal(
  id: string,
  logLR: number,
  method: MatchMethod = MatchMethod.NAME_ONLY
): SignalResult {
  return {
    signalId: id,
    logLikelihoodRatio: logLR,
    deterministic: false,
    explanation: "",
    method,
  };
}

describe("LegacyCombiner", () => {
  it("produces 0.5 base score with no signals firing", () => {
    const result = combiner.combine([], { prominenceScore: 0 });
    expect(result.confidence).toBe(0.5);
  });

  it("produces 0.9 for birthdate match", () => {
    const signals = [makeSignal("birthdate", 14.8, MatchMethod.BIRTHDATE)];
    const result = combiner.combine(signals, { prominenceScore: 0 });
    expect(result.confidence).toBe(0.9);
    expect(result.primaryMethod).toBe(MatchMethod.BIRTHDATE);
  });

  it("produces 0.1 for birthdate mismatch", () => {
    const signals = [makeSignal("birthdate", -8.0, MatchMethod.BIRTHDATE)];
    const result = combiner.combine(signals, { prominenceScore: 0 });
    expect(result.confidence).toBe(0.1);
  });

  it("produces 0.7 for department match when no birthdate", () => {
    const signals = [makeSignal("department", 3.5, MatchMethod.DEPARTMENT)];
    const result = combiner.combine(signals, { prominenceScore: 0 });
    expect(result.confidence).toBe(0.7);
    expect(result.primaryMethod).toBe(MatchMethod.DEPARTMENT);
  });

  it("birthdate match + exact firstName = 0.98 (capped)", () => {
    const signals = [
      makeSignal("birthdate", 14.8, MatchMethod.BIRTHDATE),
      makeSignal("first-name", 3.0),
    ];
    const result = combiner.combine(signals, { prominenceScore: 0 });
    // 0.9 + 0.15 = 1.05 → capped at 0.98
    expect(result.confidence).toBe(0.98);
  });

  it("department match + exact firstName = 0.85", () => {
    const signals = [
      makeSignal("department", 3.5, MatchMethod.DEPARTMENT),
      makeSignal("first-name", 3.0),
    ];
    const result = combiner.combine(signals, { prominenceScore: 0 });
    expect(result.confidence).toBe(0.85);
  });

  it("firstName mismatch multiplies score by 0.4", () => {
    const signals = [
      makeSignal("department", 3.5, MatchMethod.DEPARTMENT),
      makeSignal("first-name", -5.0),
    ];
    const result = combiner.combine(signals, { prominenceScore: 0 });
    // 0.7 * 0.4 = 0.28
    expect(result.confidence).toBeCloseTo(0.28);
  });

  it("gender mismatch multiplies score by 0.3", () => {
    const signals = [
      makeSignal("department", 3.5, MatchMethod.DEPARTMENT),
      makeSignal("first-name", 3.0),
      makeSignal("gender", -6.0),
    ];
    const result = combiner.combine(signals, { prominenceScore: 0 });
    // (0.7 + 0.15) * 0.3 = 0.255
    expect(result.confidence).toBeCloseTo(0.255);
  });

  it("prominence boost for NAME_ONLY + exact firstName + prominent", () => {
    const signals = [makeSignal("first-name", 3.0)];
    const result = combiner.combine(signals, { prominenceScore: 500 });
    // 0.5 + 0.15 + 0.06 = 0.71
    expect(result.confidence).toBeCloseTo(0.71);
  });

  it("no prominence boost if not NAME_ONLY", () => {
    const signals = [
      makeSignal("department", 3.5, MatchMethod.DEPARTMENT),
      makeSignal("first-name", 3.0),
    ];
    const result = combiner.combine(signals, { prominenceScore: 500 });
    // 0.7 + 0.15 = 0.85 (no prominence boost because method is DEPARTMENT)
    expect(result.confidence).toBe(0.85);
  });

  it("no prominence boost if firstName not exact", () => {
    const signals = [makeSignal("first-name", 1.0)]; // partial match
    const result = combiner.combine(signals, { prominenceScore: 500 });
    // 0.5 (no firstName boost for partial, no prominence boost)
    expect(result.confidence).toBe(0.5);
  });

  it("birthdate match + department match: department does not override", () => {
    const signals = [
      makeSignal("birthdate", 14.8, MatchMethod.BIRTHDATE),
      makeSignal("department", 3.5, MatchMethod.DEPARTMENT),
    ];
    const result = combiner.combine(signals, { prominenceScore: 0 });
    // Birthdate sets 0.9, department guard (score < 0.7) prevents override
    expect(result.confidence).toBe(0.9);
    expect(result.primaryMethod).toBe(MatchMethod.BIRTHDATE);
  });

  it("gender match is a no-op in legacy mode", () => {
    const signals = [
      makeSignal("department", 3.5, MatchMethod.DEPARTMENT),
      makeSignal("gender", 0.7),
    ];
    const result = combiner.combine(signals, { prominenceScore: 0 });
    // 0.7 (department), gender match (positive logLR) has no effect
    expect(result.confidence).toBe(0.7);
  });

  it("birthdate mismatch + exact firstName", () => {
    const signals = [
      makeSignal("birthdate", -8.0, MatchMethod.BIRTHDATE),
      makeSignal("first-name", 3.0),
    ];
    const result = combiner.combine(signals, { prominenceScore: 0 });
    // 0.1 + 0.15 = 0.25
    expect(result.confidence).toBe(0.25);
  });

  it("prominence boost + gender mismatch", () => {
    const signals = [makeSignal("first-name", 3.0), makeSignal("gender", -6.0)];
    const result = combiner.combine(signals, { prominenceScore: 500 });
    // 0.5 + 0.15 + 0.06 = 0.71, then * 0.3 = 0.213
    expect(result.confidence).toBeCloseTo(0.213);
  });
});
