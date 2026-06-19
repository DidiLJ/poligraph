import { describe, it, expect } from "vitest";
import { hasActiveListingFilter, listingRobotsMetadata } from "../listing-robots";

// /parlement/votes filter keys (Lot 3a)
const KEYS = ["search", "result", "legislature", "chamber", "theme", "type"] as const;

describe("listingRobotsMetadata", () => {
  it("returns no robots fragment for the bare listing (inherits index:true)", () => {
    expect(listingRobotsMetadata(false)).toEqual({});
  });

  it("returns noindex,follow for a filtered variant", () => {
    expect(listingRobotsMetadata(true)).toEqual({ robots: { index: false, follow: true } });
  });
});

describe("hasActiveListingFilter", () => {
  it("bare listing (no params) -> false (indexable)", () => {
    expect(hasActiveListingFilter({}, KEYS)).toBe(false);
  });

  it.each([...KEYS])("filter '%s' present -> true (noindex)", (key) => {
    expect(hasActiveListingFilter({ [key]: "x" }, KEYS)).toBe(true);
  });

  it("empty filter value -> false", () => {
    expect(hasActiveListingFilter({ search: "" }, KEYS)).toBe(false);
  });

  it("page=2 -> true", () => {
    expect(hasActiveListingFilter({ page: "2" }, KEYS)).toBe(true);
  });

  it("page=1 -> false (page 1 == bare listing)", () => {
    expect(hasActiveListingFilter({ page: "1" }, KEYS)).toBe(false);
  });

  it("page=0 -> false", () => {
    expect(hasActiveListingFilter({ page: "0" }, KEYS)).toBe(false);
  });

  it("page=abc -> false", () => {
    expect(hasActiveListingFilter({ page: "abc" }, KEYS)).toBe(false);
  });

  it("page=2abc -> false (Number(), not parseInt)", () => {
    expect(hasActiveListingFilter({ page: "2abc" }, KEYS)).toBe(false);
  });

  it("page='' -> false", () => {
    expect(hasActiveListingFilter({ page: "" }, KEYS)).toBe(false);
  });
});
