import { describe, it, expect } from "vitest";
import { FellegiSunterCombiner } from "../fellegi-sunter-combiner";
import type { HardPenalty } from "../fellegi-sunter-combiner";
import { Judgement, MatchMethod } from "@/generated/prisma";
import type { SignalResult } from "../signals/types";

const combiner = new FellegiSunterCombiner();

function makeSignal(
  id: string,
  logLR: number,
  method: MatchMethod = MatchMethod.NAME_ONLY,
  deterministic = false
): SignalResult {
  return {
    signalId: id,
    logLikelihoodRatio: logLR,
    deterministic,
    explanation: "",
    method,
  };
}

describe("FellegiSunterCombiner — logLR summation", () => {
  it("sums all logLR values into compositeLogRatio", () => {
    const signals = [makeSignal("birthdate", 14.8), makeSignal("first-name", 3.0)];
    const result = combiner.combine(signals);
    expect(result.compositeLogRatio).toBeCloseTo(17.8);
  });

  it("compositeLogRatio is 0 for empty signals", () => {
    const result = combiner.combine([]);
    expect(result.compositeLogRatio).toBe(0);
  });

  it("compositeLogRatio is 0 when all signals are zero", () => {
    const signals = [makeSignal("birthdate", 0), makeSignal("first-name", 0)];
    const result = combiner.combine(signals);
    expect(result.compositeLogRatio).toBe(0);
  });

  it("sums negative logLR values correctly", () => {
    const signals = [makeSignal("birthdate", -8.0), makeSignal("first-name", -5.0)];
    const result = combiner.combine(signals);
    expect(result.compositeLogRatio).toBeCloseTo(-13.0);
  });

  it("sums mixed positive and negative logLR values", () => {
    const signals = [
      makeSignal("birthdate", 14.8),
      makeSignal("first-name", -5.0),
      makeSignal("gender", 0.7),
    ];
    const result = combiner.combine(signals);
    expect(result.compositeLogRatio).toBeCloseTo(10.5);
  });
});

describe("FellegiSunterCombiner — confidence sigmoid", () => {
  it("logRatio 0 -> confidence 0.5", () => {
    const result = combiner.combine([makeSignal("x", 0)]);
    expect(result.confidence).toBeCloseTo(0.5);
  });

  it("logRatio 4 -> confidence ~0.94", () => {
    const result = combiner.combine([makeSignal("x", 4)]);
    // 1 / (1 + 2^-4) = 1 / (1 + 0.0625) ≈ 0.9412
    expect(result.confidence).toBeCloseTo(0.9412, 3);
  });

  it("logRatio 12 -> confidence ~0.9998", () => {
    const result = combiner.combine([makeSignal("x", 12)]);
    // 1 / (1 + 2^-12) ≈ 0.99976
    expect(result.confidence).toBeGreaterThan(0.999);
  });

  it("negative logRatio -> confidence < 0.5", () => {
    const result = combiner.combine([makeSignal("x", -4)]);
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("large negative logRatio -> confidence near 0", () => {
    const result = combiner.combine([makeSignal("x", -20)]);
    expect(result.confidence).toBeCloseTo(0, 4);
  });

  it("empty signals -> confidence 0.5 (logRatio 0)", () => {
    const result = combiner.combine([]);
    expect(result.confidence).toBeCloseTo(0.5);
  });
});

describe("FellegiSunterCombiner — judgement thresholds", () => {
  it("SAME when compositeLogRatio >= 12.0", () => {
    const result = combiner.combine([makeSignal("birthdate", 14.8)]);
    expect(result.judgement).toBe(Judgement.SAME);
  });

  it("SAME at exactly the sameThreshold", () => {
    const result = combiner.combine([makeSignal("x", 12.0)]);
    expect(result.judgement).toBe(Judgement.SAME);
  });

  it("UNDECIDED when compositeLogRatio in [4.0, 12.0)", () => {
    const result = combiner.combine([makeSignal("x", 8.0)]);
    expect(result.judgement).toBe(Judgement.UNDECIDED);
  });

  it("UNDECIDED at exactly the undecidedThreshold", () => {
    const result = combiner.combine([makeSignal("x", 4.0)]);
    expect(result.judgement).toBe(Judgement.UNDECIDED);
  });

  it("null when compositeLogRatio < 4.0", () => {
    const result = combiner.combine([makeSignal("x", 3.9)]);
    expect(result.judgement).toBeNull();
  });

  it("null for zero compositeLogRatio", () => {
    const result = combiner.combine([]);
    expect(result.judgement).toBeNull();
  });

  it("null for negative compositeLogRatio", () => {
    const result = combiner.combine([makeSignal("x", -5)]);
    expect(result.judgement).toBeNull();
  });
});

describe("FellegiSunterCombiner — custom thresholds", () => {
  it("respects custom sameThreshold and undecidedThreshold", () => {
    const custom = new FellegiSunterCombiner({ sameThreshold: 6.0, undecidedThreshold: 2.0 });
    const same = custom.combine([makeSignal("x", 6.0)]);
    expect(same.judgement).toBe(Judgement.SAME);

    const undecided = custom.combine([makeSignal("x", 3.0)]);
    expect(undecided.judgement).toBe(Judgement.UNDECIDED);

    const none = custom.combine([makeSignal("x", 1.9)]);
    expect(none.judgement).toBeNull();
  });
});

describe("FellegiSunterCombiner — primaryMethod selection", () => {
  it("NAME_ONLY for empty signals", () => {
    const result = combiner.combine([]);
    expect(result.primaryMethod).toBe(MatchMethod.NAME_ONLY);
  });

  it("highest |logLR| signal method wins", () => {
    const signals = [
      makeSignal("first-name", 3.0, MatchMethod.NAME_ONLY),
      makeSignal("birthdate", 14.8, MatchMethod.BIRTHDATE),
    ];
    const result = combiner.combine(signals);
    expect(result.primaryMethod).toBe(MatchMethod.BIRTHDATE);
  });

  it("COMPOSITE when top 2 |logLR| are within 1.0 of each other", () => {
    const signals = [
      makeSignal("a", 5.0, MatchMethod.DEPARTMENT),
      makeSignal("b", 5.5, MatchMethod.BIRTHDATE),
    ];
    const result = combiner.combine(signals);
    expect(result.primaryMethod).toBe(MatchMethod.COMPOSITE);
  });

  it("COMPOSITE at exactly 1.0 difference", () => {
    const signals = [
      makeSignal("a", 5.0, MatchMethod.DEPARTMENT),
      makeSignal("b", 6.0, MatchMethod.BIRTHDATE),
    ];
    const result = combiner.combine(signals);
    expect(result.primaryMethod).toBe(MatchMethod.COMPOSITE);
  });

  it("no COMPOSITE when top 2 |logLR| differ by more than 1.0", () => {
    const signals = [
      makeSignal("a", 3.0, MatchMethod.DEPARTMENT),
      makeSignal("b", 14.8, MatchMethod.BIRTHDATE),
    ];
    const result = combiner.combine(signals);
    expect(result.primaryMethod).toBe(MatchMethod.BIRTHDATE);
  });

  it("deterministic signal wins regardless of logLR magnitude", () => {
    const signals = [
      makeSignal("external-id", 0, MatchMethod.EXTERNAL_ID, true),
      makeSignal("birthdate", 14.8, MatchMethod.BIRTHDATE, false),
    ];
    const result = combiner.combine(signals);
    expect(result.primaryMethod).toBe(MatchMethod.EXTERNAL_ID);
  });

  it("single signal method is returned directly (no COMPOSITE)", () => {
    const signals = [makeSignal("department", 3.5, MatchMethod.DEPARTMENT)];
    const result = combiner.combine(signals);
    expect(result.primaryMethod).toBe(MatchMethod.DEPARTMENT);
  });

  it("highest |logLR| wins with negative values", () => {
    const signals = [
      makeSignal("gender", -6.0, MatchMethod.NAME_ONLY),
      makeSignal("department", -1.5, MatchMethod.DEPARTMENT),
    ];
    const result = combiner.combine(signals);
    expect(result.primaryMethod).toBe(MatchMethod.NAME_ONLY);
  });
});

describe("FellegiSunterCombiner — hard penalties", () => {
  it("caps SAME to UNDECIDED when maxJudgement is UNDECIDED", () => {
    const penalty: HardPenalty = {
      id: "test-cap",
      description: "Test cap to UNDECIDED",
      applies: () => true,
      maxJudgement: Judgement.UNDECIDED,
    };
    const capped = new FellegiSunterCombiner({ hardPenalties: [penalty] });
    const result = capped.combine([makeSignal("birthdate", 14.8)]);
    expect(result.judgement).toBe(Judgement.UNDECIDED);
    expect(result.penalties).toContain("test-cap");
  });

  it("does not downgrade UNDECIDED to null when maxJudgement is UNDECIDED", () => {
    const penalty: HardPenalty = {
      id: "cap-undecided",
      description: "Cap at UNDECIDED",
      applies: () => true,
      maxJudgement: Judgement.UNDECIDED,
    };
    const capped = new FellegiSunterCombiner({ hardPenalties: [penalty] });
    const result = capped.combine([makeSignal("x", 6.0)]);
    expect(result.judgement).toBe(Judgement.UNDECIDED);
  });

  it("null maxJudgement rejects entirely", () => {
    const penalty: HardPenalty = {
      id: "reject",
      description: "Hard reject",
      applies: () => true,
      maxJudgement: null,
    };
    const rejecting = new FellegiSunterCombiner({ hardPenalties: [penalty] });
    const result = rejecting.combine([makeSignal("birthdate", 14.8)]);
    expect(result.judgement).toBeNull();
    expect(result.penalties).toContain("reject");
  });

  it("penalty does not fire if applies() returns false", () => {
    const penalty: HardPenalty = {
      id: "inactive",
      description: "Does not apply",
      applies: () => false,
      maxJudgement: null,
    };
    const c = new FellegiSunterCombiner({ hardPenalties: [penalty] });
    const result = c.combine([makeSignal("birthdate", 14.8)]);
    expect(result.judgement).toBe(Judgement.SAME);
    expect(result.penalties).toHaveLength(0);
  });

  it("penalty applies based on signal content", () => {
    const penalty: HardPenalty = {
      id: "gender-conflict",
      description: "Gender mismatch penalty",
      applies: (sigs) => sigs.some((s) => s.signalId === "gender" && s.logLikelihoodRatio < 0),
      maxJudgement: Judgement.UNDECIDED,
    };
    const c = new FellegiSunterCombiner({ hardPenalties: [penalty] });
    const withGenderMismatch = c.combine([
      makeSignal("birthdate", 14.8),
      makeSignal("gender", -6.0),
    ]);
    expect(withGenderMismatch.judgement).toBe(Judgement.UNDECIDED);
    expect(withGenderMismatch.penalties).toContain("gender-conflict");

    const noGenderMismatch = c.combine([makeSignal("birthdate", 14.8)]);
    expect(noGenderMismatch.judgement).toBe(Judgement.SAME);
    expect(noGenderMismatch.penalties).toHaveLength(0);
  });

  it("multiple penalties: first null penalty stops processing", () => {
    const penalties: HardPenalty[] = [
      {
        id: "hard-reject",
        description: "First penalty — rejects",
        applies: () => true,
        maxJudgement: null,
      },
      {
        id: "unreached",
        description: "Should not be reached",
        applies: () => true,
        maxJudgement: Judgement.UNDECIDED,
      },
    ];
    const c = new FellegiSunterCombiner({ hardPenalties: penalties });
    const result = c.combine([makeSignal("birthdate", 14.8)]);
    expect(result.judgement).toBeNull();
    // Only first penalty fires — loop breaks after null reject
    expect(result.penalties).toEqual(["hard-reject"]);
  });

  it("multiple cap penalties accumulate correctly", () => {
    const penalties: HardPenalty[] = [
      {
        id: "cap-1",
        description: "First cap",
        applies: () => true,
        maxJudgement: Judgement.UNDECIDED,
      },
      {
        id: "cap-2",
        description: "Second cap (UNDECIDED stays UNDECIDED)",
        applies: () => true,
        maxJudgement: Judgement.UNDECIDED,
      },
    ];
    const c = new FellegiSunterCombiner({ hardPenalties: penalties });
    const result = c.combine([makeSignal("birthdate", 14.8)]);
    expect(result.judgement).toBe(Judgement.UNDECIDED);
    expect(result.penalties).toEqual(["cap-1", "cap-2"]);
  });

  it("penalty that applies does not affect null judgement below threshold", () => {
    const penalty: HardPenalty = {
      id: "cap",
      description: "Cap at UNDECIDED",
      applies: () => true,
      maxJudgement: Judgement.UNDECIDED,
    };
    const c = new FellegiSunterCombiner({ hardPenalties: [penalty] });
    // logRatio below undecidedThreshold -> null judgement
    const result = c.combine([makeSignal("x", 2.0)]);
    // null stays null — penalty only caps downwards (SAME -> UNDECIDED), doesn't promote null
    expect(result.judgement).toBeNull();
    expect(result.penalties).toContain("cap");
  });
});

describe("FellegiSunterCombiner — edge cases", () => {
  it("signals array is preserved in result", () => {
    const signals = [makeSignal("birthdate", 14.8), makeSignal("first-name", 3.0)];
    const result = combiner.combine(signals);
    expect(result.signals).toBe(signals);
  });

  it("empty penalties array when no penalties configured", () => {
    const result = combiner.combine([makeSignal("birthdate", 14.8)]);
    expect(result.penalties).toEqual([]);
  });

  it("all-zero signals produce judgement null and confidence 0.5", () => {
    const signals = [
      makeSignal("birthdate", 0),
      makeSignal("first-name", 0),
      makeSignal("gender", 0),
    ];
    const result = combiner.combine(signals);
    expect(result.compositeLogRatio).toBe(0);
    expect(result.confidence).toBeCloseTo(0.5);
    expect(result.judgement).toBeNull();
  });
});
