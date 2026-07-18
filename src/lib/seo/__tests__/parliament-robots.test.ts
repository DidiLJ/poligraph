import { describe, it, expect } from "vitest";
import { isVoteDateArchiveSlug, voteDateArchiveRobotsMetadata } from "../parliament-robots";

describe("isVoteDateArchiveSlug", () => {
  it.each(["2026-03-04", "2020-01-01", "1999-12-31"])(
    "treats bare date %s as an archive",
    (slug) => {
      expect(isVoteDateArchiveSlug(slug)).toBe(true);
    }
  );

  // Real scrutin slugs are YYYY-MM-DD-title (or descriptive) and must never match.
  it.each([
    "2026-03-04-loi-de-finances",
    "loi-de-finances-2026",
    "aujourd-hui",
    "reforme-des-retraites",
    "2026-3-4",
    "2026-03",
  ])("leaves scrutin/route slug %s indexable", (slug) => {
    expect(isVoteDateArchiveSlug(slug)).toBe(false);
  });
});

describe("voteDateArchiveRobotsMetadata", () => {
  it("returns noindex,follow for a date archive", () => {
    expect(voteDateArchiveRobotsMetadata("2026-03-04")).toEqual({
      robots: { index: false, follow: true },
    });
  });

  it.each(["2026-03-04-loi-de-finances", "aujourd-hui", "loi-de-finances-2026"])(
    "returns {} (inherit index:true) for scrutin/route slug %s",
    (slug) => {
      expect(voteDateArchiveRobotsMetadata(slug)).toEqual({});
    }
  );
});
