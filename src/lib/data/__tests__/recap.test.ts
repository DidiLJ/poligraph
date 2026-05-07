import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    pressArticle: { findMany: vi.fn(), count: vi.fn() },
    politician: { findMany: vi.fn() },
    affair: { findMany: vi.fn() },
  },
}));

import { getISOWeekString, parseISOWeekString } from "../recap";

describe("getISOWeekString", () => {
  it("formats 2026-W18 for the Monday of ISO week 18", () => {
    // ISO Monday W18 of 2026 = April 27, 2026
    expect(getISOWeekString(new Date(Date.UTC(2026, 3, 27)))).toBe("2026-W18");
  });

  it("pads single-digit week to 2 digits", () => {
    // Monday W5 of 2026 = January 26, 2026
    const monday = new Date(Date.UTC(2026, 0, 26));
    expect(getISOWeekString(monday)).toBe("2026-W05");
  });

  it("handles week-year boundary (Dec 29 2025 belongs to 2026-W01)", () => {
    // ISO Monday W1 of 2026 = December 29, 2025
    expect(getISOWeekString(new Date(Date.UTC(2025, 11, 29)))).toBe("2026-W01");
  });
});

describe("parseISOWeekString", () => {
  it("parses 2026-W18 to its Monday", () => {
    const d = parseISOWeekString("2026-W18");
    expect(d).not.toBeNull();
    expect(d!.toISOString().slice(0, 10)).toBe("2026-04-27");
  });

  it("returns null on invalid format", () => {
    expect(parseISOWeekString("2026-18")).toBeNull();
    expect(parseISOWeekString("garbage")).toBeNull();
    expect(parseISOWeekString("")).toBeNull();
  });

  it("returns null on out-of-range week", () => {
    expect(parseISOWeekString("2026-W00")).toBeNull();
    expect(parseISOWeekString("2026-W54")).toBeNull();
  });

  it("round-trips with getISOWeekString", () => {
    const monday = new Date(Date.UTC(2026, 3, 27));
    const iso = getISOWeekString(monday);
    const parsed = parseISOWeekString(iso);
    expect(parsed!.toISOString()).toBe(monday.toISOString());
  });
});
