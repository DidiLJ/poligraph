import { describe, it, expect } from "vitest";
import { computeProximity, type PartyPositions, type UserAnswers } from "../matching";

describe("computeProximity", () => {
  it("returns 0 for identical positions", () => {
    const user: UserAnswers = { ECONOMIC_ROLE: -1, SOCIETAL_NORMS: 1 };
    const party: PartyPositions = { ECONOMIC_ROLE: -1, SOCIETAL_NORMS: 1 };
    const result = computeProximity(user, party);
    expect(result).toEqual({ score: 0, axesCompared: 2 });
  });

  it("returns 2 for fully opposed positions", () => {
    const user: UserAnswers = { ECONOMIC_ROLE: -1, SOCIETAL_NORMS: -1 };
    const party: PartyPositions = { ECONOMIC_ROLE: 1, SOCIETAL_NORMS: 1 };
    const result = computeProximity(user, party);
    expect(result).toEqual({ score: 2, axesCompared: 2 });
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
    const party: PartyPositions = { ECONOMIC_ROLE: 1, SOCIETAL_NORMS: -1 };
    const result = computeProximity(user, party);
    expect(result).toEqual({ score: 1, axesCompared: 1 });
  });

  it("returns null when no common axes", () => {
    const user: UserAnswers = { IMMIGRATION: 1 };
    const party: PartyPositions = { ECONOMIC_ROLE: -1 };
    const result = computeProximity(user, party);
    expect(result).toBeNull();
  });

  it("handles intermediate positions correctly", () => {
    const user: UserAnswers = { ECONOMIC_ROLE: 0 };
    const party: PartyPositions = { ECONOMIC_ROLE: -1 };
    const result = computeProximity(user, party);
    expect(result).toEqual({ score: 1, axesCompared: 1 });
  });
});
