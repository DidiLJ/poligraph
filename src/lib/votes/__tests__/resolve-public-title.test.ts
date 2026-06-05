import { describe, it, expect } from "vitest";
import {
  resolvePublicTitle,
  type ScrutinForDisplay,
  type PolicyTitleForDisplay,
} from "@/lib/votes/resolve-public-title";

const scrutin: ScrutinForDisplay = {
  title: "le sous-amendement n° 2368 ... (première lecture).",
  votingDate: new Date("2026-05-22T10:00:00Z"),
  result: "ADOPTED",
  chamber: "AN",
  sourceUrl: "https://an.fr/x",
  proceduralLabel: "Sous-amendement n°2368",
};
const policy = (over: Partial<PolicyTitleForDisplay>): PolicyTitleForDisplay => ({
  status: "APPROVED",
  policyTitle: "Limiter les dérogations aux seuils de qualité de l'eau",
  policySubtitle: "Précision.",
  ...over,
});

describe("resolvePublicTitle — no-leak contract", () => {
  it("APPROVED + valid title → policy mode (the ONLY policy case)", () => {
    const r = resolvePublicTitle(scrutin, policy({}));
    expect(r.mode).toBe("policy");
    if (r.mode === "policy") {
      expect(r.policyTitle).toContain("Limiter");
      expect(r.officialTitle).toBe(scrutin.title);
    }
  });
  for (const status of ["DRAFT", "NEEDS_REVIEW", "REJECTED", "STALE"] as const) {
    it(`${status} + valid title → official mode (no leak)`, () => {
      expect(resolvePublicTitle(scrutin, policy({ status })).mode).toBe("official");
    });
  }
  it("APPROVED + null title → official", () => {
    expect(resolvePublicTitle(scrutin, policy({ policyTitle: null })).mode).toBe("official");
  });
  it("APPROVED + empty title → official", () => {
    expect(resolvePublicTitle(scrutin, policy({ policyTitle: "" })).mode).toBe("official");
  });
  it("APPROVED + whitespace title → official", () => {
    expect(resolvePublicTitle(scrutin, policy({ policyTitle: "   " })).mode).toBe("official");
  });
  it("APPROVED + 141-char title → official", () => {
    expect(resolvePublicTitle(scrutin, policy({ policyTitle: "x".repeat(141) })).mode).toBe(
      "official"
    );
  });
  it("no policy row → official", () => {
    expect(resolvePublicTitle(scrutin, null).mode).toBe("official");
  });
  it("every mode carries chips + official title", () => {
    const off = resolvePublicTitle(scrutin, null);
    expect(off.officialTitle).toBe(scrutin.title);
    expect(off.chips.length).toBeGreaterThan(0);
    const pol = resolvePublicTitle(scrutin, policy({}));
    expect(pol.officialTitle).toBe(scrutin.title);
    expect(pol.chips.length).toBeGreaterThan(0);
  });
  it("there is no code path that upgrades a non-APPROVED row to policy mode", () => {
    for (const status of ["DRAFT", "NEEDS_REVIEW", "REJECTED", "STALE"] as const)
      expect(resolvePublicTitle(scrutin, policy({ status })).mode).toBe("official");
  });
});
