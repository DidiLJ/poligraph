import { describe, it, expect } from "vitest";
import { computeProximity, POSITION_MAX, type PartyPositions, type UserAnswers } from "../matching";

describe("computeProximity", () => {
  it("returns 0 for identical positions", () => {
    const user: UserAnswers = { ECONOMIC_ROLE: -1, SOCIETAL_NORMS: 1 };
    const party: PartyPositions = { ECONOMIC_ROLE: -1, SOCIETAL_NORMS: 1 };
    const result = computeProximity(user, party);
    expect(result).toEqual({ score: 0, axesCompared: 2 });
  });

  it("returns max score for fully opposed positions", () => {
    const user: UserAnswers = { ECONOMIC_ROLE: -1, SOCIETAL_NORMS: -1 };
    const party: PartyPositions = { ECONOMIC_ROLE: POSITION_MAX, SOCIETAL_NORMS: POSITION_MAX };
    const result = computeProximity(user, party);
    // distance = (1+3)+(1+3) = 8, max per axis = 4, normalized = 8/(2*4) = 1
    expect(result).toEqual({ score: 1, axesCompared: 2 });
  });

  it("ignores axes where party has no position", () => {
    const user: UserAnswers = {
      ECONOMIC_ROLE: -1,
      SOCIETAL_NORMS: 1,
      IMMIGRATION: 0,
    };
    const party: PartyPositions = { ECONOMIC_ROLE: -1 };
    const result = computeProximity(user, party);
    expect(result).toEqual({ score: 0, axesCompared: 1 });
  });

  it("ignores axes where user has no answer", () => {
    const user: UserAnswers = { ECONOMIC_ROLE: 0 };
    const party: PartyPositions = { ECONOMIC_ROLE: 2 };
    const result = computeProximity(user, party);
    // distance = 2, normalized = 2/4 = 0.5
    expect(result).toEqual({ score: 0.5, axesCompared: 1 });
  });

  it("returns null when no common axes", () => {
    const user: UserAnswers = { IMMIGRATION: 1 };
    const party: PartyPositions = { ECONOMIC_ROLE: -1 };
    const result = computeProximity(user, party);
    expect(result).toBeNull();
  });

  it("handles intermediate party positions", () => {
    const user: UserAnswers = { ECONOMIC_ROLE: 0 };
    const party: PartyPositions = { ECONOMIC_ROLE: -2 };
    const result = computeProximity(user, party);
    // distance = 2, normalized = 2/4 = 0.5
    expect(result).toEqual({ score: 0.5, axesCompared: 1 });
  });

  it("POSITION_MAX is 3", () => {
    expect(POSITION_MAX).toBe(3);
  });
});
