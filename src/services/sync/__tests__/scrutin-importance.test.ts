import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { computeSignals, computeScore } from "../scrutin-importance";

describe("computeSignals", () => {
  it("computes turnout ratio from votes vs total deputies", () => {
    const signals = computeSignals({
      votesFor: 200,
      votesAgainst: 150,
      votesAbstain: 50,
      totalDeputies: 577,
      pressMentions: 0,
      hasDossier: false,
      hasCitizenImpact: false,
      voteType: "default",
    });
    expect(signals.turnout).toBeCloseTo(0.693, 2);
  });

  it("computes margin closeness (tight vote = high closeness)", () => {
    const signals = computeSignals({
      votesFor: 290,
      votesAgainst: 287,
      votesAbstain: 0,
      totalDeputies: 577,
      pressMentions: 0,
      hasDossier: false,
      hasCitizenImpact: false,
      voteType: "default",
    });
    expect(signals.margin).toBeGreaterThan(0.99);
  });

  it("normalizes press coverage to 0-1 (capped at 10)", () => {
    const signals = computeSignals({
      votesFor: 100,
      votesAgainst: 100,
      votesAbstain: 10,
      totalDeputies: 577,
      pressMentions: 15,
      hasDossier: false,
      hasCitizenImpact: false,
      voteType: "default",
    });
    expect(signals.pressCoverage).toBe(1);
  });

  it("gives binary flags for dossier and citizen impact", () => {
    const signals = computeSignals({
      votesFor: 100,
      votesAgainst: 100,
      votesAbstain: 10,
      totalDeputies: 577,
      pressMentions: 0,
      hasDossier: true,
      hasCitizenImpact: true,
      voteType: "final",
    });
    expect(signals.hasDossier).toBe(1);
    expect(signals.hasCitizenImpact).toBe(1);
    expect(signals.voteType).toBe(1.0);
  });
});

describe("computeScore", () => {
  it("returns weighted score", () => {
    const score = computeScore({
      turnout: 0.8,
      margin: 0.95,
      pressCoverage: 0.5,
      hasDossier: 1,
      hasCitizenImpact: 1,
      voteType: 1.0,
    });
    expect(score).toBeCloseTo(84, 0);
  });

  it("clamps between 0 and 100", () => {
    const score = computeScore({
      turnout: 1,
      margin: 1,
      pressCoverage: 1,
      hasDossier: 1,
      hasCitizenImpact: 1,
      voteType: 1,
    });
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});
