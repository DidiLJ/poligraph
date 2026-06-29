import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  classifyTitleForDrift,
  planSubstanceDriftActions,
  type DriftTitleRow,
} from "@/services/sync/policy-title-substance-drift-plan";

const row = (over: Partial<DriftTitleRow>): DriftTitleRow => ({
  id: "t1",
  status: "APPROVED",
  regenerationStatus: "idle",
  ...over,
});

describe("classifyTitleForDrift", () => {
  it("APPROVED -> stale", () => expect(classifyTitleForDrift("APPROVED")).toBe("stale"));
  it("NEEDS_REVIEW -> queue", () => expect(classifyTitleForDrift("NEEDS_REVIEW")).toBe("queue"));
  it("DRAFT -> queue", () => expect(classifyTitleForDrift("DRAFT")).toBe("queue"));
  it("REJECTED -> ignore (never reactivated)", () =>
    expect(classifyTitleForDrift("REJECTED")).toBe("ignore"));
  it("STALE -> ignore (already stale)", () =>
    expect(classifyTitleForDrift("STALE")).toBe("ignore"));
});

describe("planSubstanceDriftActions", () => {
  it("empty -> all zeros, no writes", () => {
    const plan = planSubstanceDriftActions([]);
    expect(plan).toEqual({
      toStale: [],
      toQueue: [],
      markedStale: 0,
      queuedOrFlagged: 0,
      ignored: 0,
    });
  });

  it("APPROVED -> toStale + markedStale", () => {
    const plan = planSubstanceDriftActions([row({ id: "a", status: "APPROVED" })]);
    expect(plan.toStale).toEqual(["a"]);
    expect(plan.markedStale).toBe(1);
    expect(plan.toQueue).toEqual([]);
  });

  it("NEEDS_REVIEW (idle) -> queued, status not touched here", () => {
    const plan = planSubstanceDriftActions([
      row({ id: "n", status: "NEEDS_REVIEW", regenerationStatus: "idle" }),
    ]);
    expect(plan.toQueue).toEqual(["n"]);
    expect(plan.queuedOrFlagged).toBe(1);
    expect(plan.toStale).toEqual([]); // never published/approved/stale'd
  });

  it("NEEDS_REVIEW already queued -> counted, no redundant write", () => {
    const plan = planSubstanceDriftActions([
      row({ id: "n", status: "NEEDS_REVIEW", regenerationStatus: "queued" }),
    ]);
    expect(plan.queuedOrFlagged).toBe(1);
    expect(plan.toQueue).toEqual([]); // already queued -> skip the write
  });

  it("DRAFT -> queued", () => {
    const plan = planSubstanceDriftActions([row({ id: "d", status: "DRAFT" })]);
    expect(plan.toQueue).toEqual(["d"]);
    expect(plan.queuedOrFlagged).toBe(1);
  });

  it("REJECTED -> ignored, no write", () => {
    const plan = planSubstanceDriftActions([row({ id: "r", status: "REJECTED" })]);
    expect(plan.ignored).toBe(1);
    expect(plan.toStale).toEqual([]);
    expect(plan.toQueue).toEqual([]);
  });

  it("STALE -> ignored, no write", () => {
    const plan = planSubstanceDriftActions([row({ id: "s", status: "STALE" })]);
    expect(plan.ignored).toBe(1);
    expect(plan.toStale).toEqual([]);
    expect(plan.toQueue).toEqual([]);
  });

  it("mixed batch -> correct per-bucket counts", () => {
    const plan = planSubstanceDriftActions([
      row({ id: "a", status: "APPROVED" }),
      row({ id: "n", status: "NEEDS_REVIEW", regenerationStatus: "idle" }),
      row({ id: "d", status: "DRAFT" }),
      row({ id: "r", status: "REJECTED" }),
      row({ id: "s", status: "STALE" }),
    ]);
    expect(plan.markedStale).toBe(1);
    expect(plan.queuedOrFlagged).toBe(2); // n + d
    expect(plan.ignored).toBe(2); // r + s
    expect(plan.toStale).toEqual(["a"]);
    expect(plan.toQueue).toEqual(["n", "d"]);
  });
});

describe("substance-drift modules never call a model (structural guard)", () => {
  const read = (rel: string) =>
    readFileSync(path.join(process.cwd(), "src/services/sync", rel), "utf8");

  it("plan + mark modules import no AI client", () => {
    const sources = [
      read("policy-title-substance-drift-plan.ts"),
      read("mark-policy-titles-substance-drift.ts"),
    ].join("\n");
    expect(sources).not.toMatch(/anthropic/i);
    expect(sources).not.toMatch(/mistral/i);
    expect(sources).not.toMatch(/callAnthropic|callMistral/);
    expect(sources).not.toMatch(/generateScrutinPolicyTitle/); // never triggers generation
  });
});
