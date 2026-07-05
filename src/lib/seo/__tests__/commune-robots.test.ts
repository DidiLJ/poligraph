import { describe, it, expect } from "vitest";
import {
  isIndexableCommune,
  communeRobotsMetadata,
  COMMUNE_MIN_POPULATION,
} from "../commune-robots";

const NOINDEX = { robots: { index: false, follow: true } };

describe("isIndexableCommune", () => {
  it("population at threshold -> indexable", () => {
    expect(isIndexableCommune(COMMUNE_MIN_POPULATION)).toBe(true);
  });

  it("population just below threshold -> NOT indexable", () => {
    expect(isIndexableCommune(COMMUNE_MIN_POPULATION - 1)).toBe(false);
  });

  it("large commune -> indexable", () => {
    expect(isIndexableCommune(150_000)).toBe(true);
  });

  it("tiny commune -> NOT indexable", () => {
    expect(isIndexableCommune(120)).toBe(false);
  });

  it("population 0 -> NOT indexable", () => {
    expect(isIndexableCommune(0)).toBe(false);
  });

  it("null population -> indexable (fail-open on missing data)", () => {
    expect(isIndexableCommune(null)).toBe(true);
  });

  it("undefined population -> indexable (fail-open)", () => {
    expect(isIndexableCommune(undefined)).toBe(true);
  });
});

describe("communeRobotsMetadata", () => {
  it("indexable commune -> {} (inherits index:true)", () => {
    expect(communeRobotsMetadata(COMMUNE_MIN_POPULATION)).toEqual({});
  });

  it("thin commune -> noindex,follow", () => {
    expect(communeRobotsMetadata(500)).toEqual(NOINDEX);
  });
});
