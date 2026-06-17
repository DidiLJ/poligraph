import { describe, it, expect } from "vitest";
import { buildComparerVotesCanonical } from "../comparer-votes-metadata";

describe("buildComparerVotesCanonical", () => {
  it("returns null when `a` is missing", () => {
    expect(buildComparerVotesCanonical("deputes", undefined, "marine-le-pen")).toBeNull();
  });

  it("returns null when `b` is missing", () => {
    expect(buildComparerVotesCanonical("deputes", "marine-le-pen", undefined)).toBeNull();
  });

  it("returns null when both are missing", () => {
    expect(buildComparerVotesCanonical("deputes")).toBeNull();
  });

  it("builds a self-canonical from cat/a/b when both are present", () => {
    expect(buildComparerVotesCanonical("deputes", "marine-le-pen", "jean-luc-melenchon")).toBe(
      "/comparer/votes?cat=deputes&a=marine-le-pen&b=jean-luc-melenchon"
    );
  });

  it("excludes search/filter/page (only cat/a/b are inputs)", () => {
    const canonical = buildComparerVotesCanonical("partis", "rn", "lfi");
    expect(canonical).toBe("/comparer/votes?cat=partis&a=rn&b=lfi");
    expect(canonical).not.toContain("search");
    expect(canonical).not.toContain("filter");
    expect(canonical).not.toContain("page");
  });
});
