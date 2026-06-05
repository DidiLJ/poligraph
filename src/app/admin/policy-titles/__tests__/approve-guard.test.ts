import { describe, it, expect } from "vitest";
import { approveGuard, type ApproveContext } from "@/app/admin/policy-titles/approve-guard";
import type { GenerationWarning } from "@/services/scrutin-policy-title/types";

const warn: GenerationWarning = { code: "EVIDENCE_COVERAGE_LOW", severity: "warn", message: "x" };
const blocker: GenerationWarning = { code: "ARTICLE_ONLY", severity: "blocker", message: "x" };

const base = (over: Partial<ApproveContext> = {}): ApproveContext => ({
  row: {
    policyTitle: "Limiter les dérogations aux seuils de qualité de l'eau",
    status: "DRAFT",
    confidence: "HIGH",
    inputHash: "h1",
  },
  currentInputHash: "h1",
  currentWarnings: [],
  evidenceDrift: false,
  mode: "single",
  ...over,
});

describe("approveGuard hard blockers (never overridable)", () => {
  it("empty/null/whitespace title", () => {
    for (const t of [null, "", "   "]) {
      const r = approveGuard(
        base({ row: { ...base().row, policyTitle: t }, override: { reason: "x", actor: "a" } })
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.hardBlockers).toContain("EMPTY_OR_NULL_TITLE");
    }
  });
  it("over-length >140 (even with override)", () => {
    const r = approveGuard(
      base({
        row: { ...base().row, policyTitle: "x".repeat(141) },
        override: { reason: "x", actor: "a" },
      })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hardBlockers).toContain("OVER_LENGTH");
  });
  it("STALE status", () => {
    const r = approveGuard(base({ row: { ...base().row, status: "STALE" } }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hardBlockers).toContain("STALE");
  });
  it("input drift", () => {
    const r = approveGuard(base({ currentInputHash: "h2" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hardBlockers).toContain("INPUT_DRIFT");
  });
  it("evidence drift", () => {
    const r = approveGuard(base({ evidenceDrift: true }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hardBlockers).toContain("EVIDENCE_DRIFT");
  });
  it("current blocker warning", () => {
    const r = approveGuard(base({ currentWarnings: [blocker] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hardBlockers).toContain("VALIDATION_BLOCKER");
  });
});

describe("approveGuard single mode warnings", () => {
  it("warn without override → blocked (overridable)", () => {
    const r = approveGuard(base({ currentWarnings: [warn] }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.hardBlockers).toHaveLength(0);
      expect(r.overridableWarnings).toHaveLength(1);
    }
  });
  it("warn WITH override reason → ok", () => {
    const r = approveGuard(
      base({
        currentWarnings: [warn],
        override: { reason: "vérifié manuellement", actor: "lamine" },
      })
    );
    expect(r.ok).toBe(true);
  });
  it("clean → ok", () => {
    expect(approveGuard(base({})).ok).toBe(true);
  });
});

describe("approveGuard batch mode (no override path)", () => {
  it("any warning → blocked even with override", () => {
    const r = approveGuard(
      base({ mode: "batch", currentWarnings: [warn], override: { reason: "x", actor: "a" } })
    );
    expect(r.ok).toBe(false);
  });
  it("non-HIGH confidence → blocked", () => {
    const r = approveGuard(base({ mode: "batch", row: { ...base().row, confidence: "MEDIUM" } }));
    expect(r.ok).toBe(false);
  });
  it("HIGH + zero warnings + clean → ok", () => {
    expect(approveGuard(base({ mode: "batch" })).ok).toBe(true);
  });
});
