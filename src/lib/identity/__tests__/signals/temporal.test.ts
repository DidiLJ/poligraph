import { describe, it, expect } from "vitest";
import { TemporalSignal } from "../../signals/temporal";
import { FrenchAdapter } from "../../adapters/fr";
import {
  TEMPORAL_ACTIVE_LLR,
  TEMPORAL_RECENT_LLR,
  TEMPORAL_OLD_LLR,
} from "../../signals/constants";

const signal = new TemporalSignal();
const context = { adapter: FrenchAdapter, mode: "fellegi-sunter" as const };

const makeInput = (sourceDate: Date | null) => ({
  firstName: "Jean",
  lastName: "Dupont",
  sourceDate,
});

const makeCandidate = (
  mandatePeriods: Array<{ start: Date; end: Date | null; type: string }> | null
) => ({
  id: "1",
  firstName: "Jean",
  lastName: "Dupont",
  birthDate: null,
  departments: [],
  gender: null,
  prominenceScore: 100,
  mandatePeriods,
});

describe("TemporalSignal", () => {
  it("returns +2.5 when source date overlaps active mandate", () => {
    const result = signal.evaluate(
      makeInput(new Date("2025-06-01")),
      makeCandidate([{ start: new Date("2024-01-01"), end: null, type: "DEPUTE" }]),
      context
    );
    expect(result.logLikelihoodRatio).toBe(TEMPORAL_ACTIVE_LLR);
  });

  it("returns +0.5 when gap is <= 2 years", () => {
    const result = signal.evaluate(
      makeInput(new Date("2025-06-01")),
      makeCandidate([
        { start: new Date("2020-01-01"), end: new Date("2024-01-01"), type: "DEPUTE" },
      ]),
      context
    );
    expect(result.logLikelihoodRatio).toBe(TEMPORAL_RECENT_LLR);
  });

  it("returns -0.5 when gap is > 10 years", () => {
    const result = signal.evaluate(
      makeInput(new Date("2025-06-01")),
      makeCandidate([
        { start: new Date("2000-01-01"), end: new Date("2005-01-01"), type: "DEPUTE" },
      ]),
      context
    );
    expect(result.logLikelihoodRatio).toBe(TEMPORAL_OLD_LLR);
  });

  it("returns 0 when no source date provided", () => {
    const result = signal.evaluate(
      makeInput(null),
      makeCandidate([{ start: new Date("2024-01-01"), end: null, type: "DEPUTE" }]),
      context
    );
    expect(result.logLikelihoodRatio).toBe(0);
  });

  it("returns 0 when no mandate periods available", () => {
    const result = signal.evaluate(makeInput(new Date("2025-06-01")), makeCandidate(null), context);
    expect(result.logLikelihoodRatio).toBe(0);
  });
});
