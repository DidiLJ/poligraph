import { describe, it, expect } from "vitest";
import { computeHemicycleLayout } from "./hemicycle-layout";

describe("computeHemicycleLayout", () => {
  it("returns correct number of seats", () => {
    const groups = [
      { code: "A", color: "#ff0000", seats: 300 },
      { code: "B", color: "#0000ff", seats: 277 },
    ];
    const result = computeHemicycleLayout(groups);
    expect(result).toHaveLength(577);
  });

  it("assigns correct group to each seat", () => {
    const groups = [
      { code: "A", color: "#ff0000", seats: 3 },
      { code: "B", color: "#0000ff", seats: 2 },
    ];
    const result = computeHemicycleLayout(groups);
    expect(result.filter((s) => s.groupCode === "A")).toHaveLength(3);
    expect(result.filter((s) => s.groupCode === "B")).toHaveLength(2);
  });

  it("places all seats within hemicycle bounds (y >= 0, within semicircle)", () => {
    const groups = [{ code: "A", color: "#ff0000", seats: 577 }];
    const result = computeHemicycleLayout(groups, { width: 800, height: 400 });
    for (const seat of result) {
      expect(seat.y).toBeLessThanOrEqual(400 + 5);
      expect(seat.y).toBeGreaterThanOrEqual(0);
      expect(seat.x).toBeGreaterThanOrEqual(0);
      expect(seat.x).toBeLessThanOrEqual(800);
    }
  });

  it("orders seats left-to-right by group order", () => {
    const groups = [
      { code: "LEFT", color: "#ff0000", seats: 50 },
      { code: "RIGHT", color: "#0000ff", seats: 50 },
    ];
    const result = computeHemicycleLayout(groups);
    const leftAvgX =
      result.filter((s) => s.groupCode === "LEFT").reduce((sum, s) => sum + s.x, 0) / 50;
    const rightAvgX =
      result.filter((s) => s.groupCode === "RIGHT").reduce((sum, s) => sum + s.x, 0) / 50;
    expect(leftAvgX).toBeLessThan(rightAvgX);
  });

  it("returns seats with seatIndex for mapping to deputy data", () => {
    const groups = [{ code: "A", color: "#ff0000", seats: 10 }];
    const result = computeHemicycleLayout(groups);
    const indices = result.map((s) => s.seatIndex);
    expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});
