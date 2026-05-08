import { describe, it, expect } from "vitest";
import { computeWeeklyConcordance } from "../concordance";

describe("computeWeeklyConcordance", () => {
  it("returns null when fewer than 2 mappable votes", () => {
    const result = computeWeeklyConcordance(
      [{ scrutinId: "s1", position: "POUR" }],
      [{ scrutinId: "s1", position: "POUR" }]
    );
    expect(result).toBeNull();
  });

  it("returns 100 when user and deputy fully agree", () => {
    const result = computeWeeklyConcordance(
      [
        { scrutinId: "s1", position: "POUR" },
        { scrutinId: "s2", position: "CONTRE" },
      ],
      [
        { scrutinId: "s1", position: "POUR" },
        { scrutinId: "s2", position: "CONTRE" },
      ]
    );
    expect(result).toBe(100);
  });

  it("returns 0 when fully disagree", () => {
    const result = computeWeeklyConcordance(
      [
        { scrutinId: "s1", position: "POUR" },
        { scrutinId: "s2", position: "POUR" },
      ],
      [
        { scrutinId: "s1", position: "CONTRE" },
        { scrutinId: "s2", position: "CONTRE" },
      ]
    );
    expect(result).toBe(0);
  });

  it("treats ABSTENTION as half-agreement on either side", () => {
    const result = computeWeeklyConcordance(
      [
        { scrutinId: "s1", position: "POUR" },
        { scrutinId: "s2", position: "ABSTENTION" },
      ],
      [
        { scrutinId: "s1", position: "POUR" },
        { scrutinId: "s2", position: "POUR" },
      ]
    );
    expect(result).toBe(75);
  });

  it("treats both ABSTENTION as full agreement (mutual abstention)", () => {
    const result = computeWeeklyConcordance(
      [
        { scrutinId: "s1", position: "ABSTENTION" },
        { scrutinId: "s2", position: "POUR" },
      ],
      [
        { scrutinId: "s1", position: "ABSTENTION" },
        { scrutinId: "s2", position: "POUR" },
      ]
    );
    expect(result).toBe(100);
  });

  it("ignores votes not present in user profile", () => {
    const result = computeWeeklyConcordance(
      [
        { scrutinId: "s1", position: "POUR" },
        { scrutinId: "s2", position: "POUR" },
      ],
      [
        { scrutinId: "s1", position: "POUR" },
        { scrutinId: "s2", position: "POUR" },
        { scrutinId: "s3", position: "CONTRE" },
      ]
    );
    expect(result).toBe(100);
  });
});
