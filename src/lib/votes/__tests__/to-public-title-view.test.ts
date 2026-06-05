import { describe, it, expect } from "vitest";
import { toPublicTitleView, displayTitleOf, type ScrutinRowForView } from "../to-public-title-view";

const base: Omit<ScrutinRowForView, "policyTitle"> = {
  title: "Projet de loi de finances pour 2026",
  votingDate: new Date("2026-01-15T10:00:00Z"),
  result: "ADOPTED",
  chamber: "AN",
  sourceUrl: "https://assemblee.fr/scrutin/1",
};

function policy(over: Partial<NonNullable<ScrutinRowForView["policyTitle"]>>) {
  return {
    status: "APPROVED" as const,
    policyTitle: "Augmenter le budget de l'éducation",
    policySubtitle: "Ce que ça change",
    officialSourceUrl: null,
    proceduralLabel: "Vote solennel",
    ...over,
  };
}

function hasProceduralChip(chips: { kind: string }[]): boolean {
  return chips.some((c) => c.kind === "procedural");
}

describe("toPublicTitleView", () => {
  it("APPROVED + valid title → policy mode", () => {
    const v = toPublicTitleView({ ...base, policyTitle: policy({}) });
    expect(v.mode).toBe("policy");
    if (v.mode === "policy") expect(v.policyTitle).toBe("Augmenter le budget de l'éducation");
  });

  it.each(["DRAFT", "NEEDS_REVIEW", "REJECTED", "STALE"] as const)(
    "%s + valid title → official mode (no leak)",
    (status) => {
      const v = toPublicTitleView({ ...base, policyTitle: policy({ status }) });
      expect(v.mode).toBe("official");
    }
  );

  it("no policy row → official mode", () => {
    const v = toPublicTitleView({ ...base, policyTitle: null });
    expect(v.mode).toBe("official");
  });

  it("APPROVED but empty/whitespace title → official mode", () => {
    expect(toPublicTitleView({ ...base, policyTitle: policy({ policyTitle: "   " }) }).mode).toBe(
      "official"
    );
    expect(toPublicTitleView({ ...base, policyTitle: policy({ policyTitle: null }) }).mode).toBe(
      "official"
    );
  });

  // Source-URL precedence (revision #2)
  it("uses scrutin.sourceUrl when present", () => {
    const v = toPublicTitleView({
      ...base,
      sourceUrl: "https://primary",
      policyTitle: policy({ officialSourceUrl: "https://fallback" }),
    });
    expect(v.officialSourceUrl).toBe("https://primary");
  });

  it("falls back to policyTitle.officialSourceUrl when scrutin.sourceUrl is null", () => {
    const v = toPublicTitleView({
      ...base,
      sourceUrl: null,
      policyTitle: policy({ officialSourceUrl: "https://fallback" }),
    });
    expect(v.officialSourceUrl).toBe("https://fallback");
  });

  it("null when neither source URL is present", () => {
    const v = toPublicTitleView({
      ...base,
      sourceUrl: null,
      policyTitle: policy({ officialSourceUrl: null }),
    });
    expect(v.officialSourceUrl).toBeNull();
  });

  // Procedural chip sourcing (proceduralLabel lives only on the policy row)
  it("no policy row → official title, no procedural chip", () => {
    const v = toPublicTitleView({ ...base, policyTitle: null });
    expect(v.mode).toBe("official");
    expect(hasProceduralChip(v.chips)).toBe(false);
  });

  it("DRAFT policy row with proceduralLabel → official title, procedural chip present", () => {
    const v = toPublicTitleView({ ...base, policyTitle: policy({ status: "DRAFT" }) });
    expect(v.mode).toBe("official");
    expect(hasProceduralChip(v.chips)).toBe(true);
  });

  it("APPROVED policy row with proceduralLabel → policy title, procedural chip present", () => {
    const v = toPublicTitleView({ ...base, policyTitle: policy({}) });
    expect(v.mode).toBe("policy");
    expect(hasProceduralChip(v.chips)).toBe(true);
  });

  it("APPROVED policy row without proceduralLabel → policy title, no procedural chip", () => {
    const v = toPublicTitleView({ ...base, policyTitle: policy({ proceduralLabel: null }) });
    expect(v.mode).toBe("policy");
    expect(hasProceduralChip(v.chips)).toBe(false);
  });

  describe("displayTitleOf", () => {
    it("returns the policy title in policy mode", () => {
      const v = toPublicTitleView({ ...base, policyTitle: policy({}) });
      expect(displayTitleOf(v)).toBe("Augmenter le budget de l'éducation");
    });
    it("returns the official title in official mode (no leak)", () => {
      const v = toPublicTitleView({ ...base, policyTitle: policy({ status: "DRAFT" }) });
      expect(displayTitleOf(v)).toBe(base.title);
    });
  });
});
