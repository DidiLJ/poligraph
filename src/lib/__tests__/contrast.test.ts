import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  getRelativeLuminance,
  getContrastRatio,
  getAccessibleTextColor,
  ensureContrast,
} from "../contrast";

describe("hexToRgb", () => {
  it("parses a 6-digit hex color with #", () => {
    expect(hexToRgb("#FF0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("parses black correctly", () => {
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("parses white correctly", () => {
    expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("expands a 3-digit shorthand hex", () => {
    expect(hexToRgb("#F00")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("parses hex without # prefix", () => {
    expect(hexToRgb("FF0000")).toEqual({ r: 255, g: 0, b: 0 });
  });
});

describe("getRelativeLuminance", () => {
  it("returns 0 for black", () => {
    expect(getRelativeLuminance("#000000")).toBe(0);
  });

  it("returns 1 for white", () => {
    expect(getRelativeLuminance("#ffffff")).toBe(1);
  });

  it("returns ~0.2159 for 50% gray", () => {
    expect(getRelativeLuminance("#808080")).toBeCloseTo(0.2159, 4);
  });

  it("returns ~0.2126 for pure red", () => {
    expect(getRelativeLuminance("#ff0000")).toBeCloseTo(0.2126, 4);
  });
});

describe("getContrastRatio", () => {
  it("returns ~21 for black on white", () => {
    expect(getContrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("returns 1 for identical colors", () => {
    expect(getContrastRatio("#ff0000", "#ff0000")).toBeCloseTo(1, 1);
  });

  it("is symmetric regardless of argument order", () => {
    const ratio1 = getContrastRatio("#000000", "#ffffff");
    const ratio2 = getContrastRatio("#ffffff", "#000000");
    expect(ratio1).toBe(ratio2);
  });

  it("returns ~4.54 for WCAG AA gray (#767676) on white", () => {
    expect(getContrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 1);
  });
});

describe("getAccessibleTextColor", () => {
  it("returns black for a white background", () => {
    expect(getAccessibleTextColor("#ffffff")).toBe("#000000");
  });

  it("returns white for a black background", () => {
    expect(getAccessibleTextColor("#000000")).toBe("#ffffff");
  });

  it("returns black for a very light background", () => {
    expect(getAccessibleTextColor("#f0f0f0")).toBe("#000000");
  });

  it("returns white for a very dark background", () => {
    expect(getAccessibleTextColor("#1a1a2e")).toBe("#ffffff");
  });

  it("returns black for mid-gray (above 0.179 threshold)", () => {
    expect(getAccessibleTextColor("#808080")).toBe("#000000");
  });
});

describe("ensureContrast", () => {
  it("returns the original color when it already meets the ratio", () => {
    // Black on white = 21:1 ratio, well above 4.5
    expect(ensureContrast("#000000")).toBe("#000000");
  });

  it("darkens white until it meets 4.5:1 ratio on white background", () => {
    const adjusted = ensureContrast("#ffffff");
    const ratio = getContrastRatio(adjusted, "#ffffff");
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("falls back to black when 20 iterations are exhausted", () => {
    // Requesting a 21:1 ratio is impossible by darkening alone
    expect(ensureContrast("#ffffff", "#ffffff", 21)).toBe("#000000");
  });

  it("respects a custom minRatio of 3.0", () => {
    const adjusted = ensureContrast("#dddddd", "#ffffff", 3.0);
    const ratio = getContrastRatio(adjusted, "#ffffff");
    expect(ratio).toBeGreaterThanOrEqual(3.0);
  });

  it("uses white as default background when none is provided", () => {
    // Should not throw and should return a valid hex string
    const result = ensureContrast("#000000");
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });
});
