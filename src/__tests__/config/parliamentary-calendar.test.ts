import { describe, it, expect } from "vitest";
import {
  isInOrdinarySession,
  detectParliamentaryPeriod,
  resolveParliamentaryPeriod,
} from "@/config/parliamentary-calendar";

describe("isInOrdinarySession", () => {
  it("returns true during October-June", () => {
    expect(isInOrdinarySession(new Date("2026-10-01"))).toBe(true); // October
    expect(isInOrdinarySession(new Date("2026-01-15"))).toBe(true); // January
    expect(isInOrdinarySession(new Date("2026-06-30"))).toBe(true); // June
  });

  it("returns false during July-September (intersession)", () => {
    expect(isInOrdinarySession(new Date("2026-07-01"))).toBe(false);
    expect(isInOrdinarySession(new Date("2026-08-15"))).toBe(false);
    expect(isInOrdinarySession(new Date("2026-09-30"))).toBe(false);
  });
});

describe("detectParliamentaryPeriod", () => {
  it("returns null when votes are recent (within 14 days)", () => {
    const now = new Date("2026-03-15");
    const lastVote = new Date("2026-03-10"); // 5 days ago
    expect(detectParliamentaryPeriod(lastVote, now)).toBeNull();
  });

  it("returns intersession during summer with no recent votes", () => {
    const now = new Date("2026-07-20");
    const lastVote = new Date("2026-06-25"); // 25 days ago
    const result = detectParliamentaryPeriod(lastVote, now);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("intersession");
    expect(result!.resumeDate).toBe("2026-10-01");
    expect(result!.message).toContain("intersession");
  });

  it("returns intersession during summer even with null lastVoteDate", () => {
    const now = new Date("2026-08-01");
    const result = detectParliamentaryPeriod(null, now);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("intersession");
  });

  it("returns recess during session when votes are stale", () => {
    const now = new Date("2026-03-15");
    const lastVote = new Date("2026-02-20"); // 23 days ago
    const result = detectParliamentaryPeriod(lastVote, now);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("recess");
    expect(result!.message).toContain("20 f\u00e9vrier 2026");
  });

  it("returns null during session with no lastVoteDate", () => {
    const now = new Date("2026-03-15");
    expect(detectParliamentaryPeriod(null, now)).toBeNull();
  });
});

describe("resolveParliamentaryPeriod", () => {
  it("returns admin override when provided", () => {
    const now = new Date("2026-03-15");
    const lastVote = new Date("2026-03-10"); // Recent, would normally show nothing
    const override = {
      type: "dissolution" as const,
      message: "Dissolution prononc\u00e9e le 9 juin.",
    };

    const result = resolveParliamentaryPeriod(lastVote, override, now);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("dissolution");
    expect(result!.message).toBe("Dissolution prononc\u00e9e le 9 juin.");
  });

  it("uses default message when override has no custom message", () => {
    const result = resolveParliamentaryPeriod(null, { type: "electoral" });
    expect(result).not.toBeNull();
    expect(result!.type).toBe("electoral");
    expect(result!.message).toContain("\u00e9lectorale");
  });

  it("falls back to auto-detection when no override", () => {
    const now = new Date("2026-07-20");
    const lastVote = new Date("2026-06-25");
    const result = resolveParliamentaryPeriod(lastVote, null, now);
    expect(result!.type).toBe("intersession");
  });

  it("preserves resumeDate from override", () => {
    const override = {
      type: "dissolution" as const,
      resumeDate: "2026-07-07",
    };
    const result = resolveParliamentaryPeriod(null, override);
    expect(result!.resumeDate).toBe("2026-07-07");
  });
});
