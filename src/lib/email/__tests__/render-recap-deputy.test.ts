import { describe, it, expect, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    pressArticle: { findMany: vi.fn(), count: vi.fn() },
    politician: { findMany: vi.fn() },
    affair: { findMany: vi.fn() },
  },
}));

import { buildPersonalDeputyHtml, type PersonalDeputyContext } from "../render-recap";

const baseDeputy: PersonalDeputyContext = {
  fullName: "Aurélien Pradié",
  partyShortName: "LR",
  photoUrl: "https://example.com/p.jpg",
  constituency: "Lot, 2e circonscription",
  weeklyVotes: [
    { scrutinSlug: "v1", title: "Loi de finances", positionLabel: "POUR" },
    { scrutinSlug: "v2", title: "Réforme des retraites", positionLabel: "CONTRE" },
  ],
  weeklyConcordance: 64,
  profileUrl: "https://poligraph.fr/politiques/aurelien-pradie",
};

describe("buildPersonalDeputyHtml", () => {
  it("returns empty string when deputy is null", () => {
    expect(buildPersonalDeputyHtml(null)).toBe("");
  });

  it("renders deputy name, party, and concordance", () => {
    const html = buildPersonalDeputyHtml(baseDeputy);
    expect(html).toContain("Aurélien Pradié");
    expect(html).toContain("LR");
    expect(html).toContain("Concordance avec ton profil cette semaine : <strong>64%</strong>");
  });

  it("includes votes when present", () => {
    const html = buildPersonalDeputyHtml(baseDeputy);
    expect(html).toContain("Loi de finances");
    expect(html).toContain("POUR");
  });

  it("falls back to no-votes message when weeklyVotes is empty", () => {
    const html = buildPersonalDeputyHtml({ ...baseDeputy, weeklyVotes: [] });
    expect(html).toContain("Pas de vote cette semaine");
  });

  it("omits concordance line when weeklyConcordance is null", () => {
    const html = buildPersonalDeputyHtml({ ...baseDeputy, weeklyConcordance: null });
    expect(html).not.toContain("Concordance avec ton profil");
  });

  it("escapes HTML in deputy name", () => {
    const html = buildPersonalDeputyHtml({ ...baseDeputy, fullName: "<script>X</script>" });
    expect(html).not.toContain("<script>X</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
