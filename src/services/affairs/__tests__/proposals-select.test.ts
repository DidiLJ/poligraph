import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { AFFAIR_PROPOSABLE_SELECT } from "../proposals";

const judicialFields = [
  "status",
  "verdictDate",
  "court",
  "sentence",
  "prisonMonths",
  "prisonFirmMonths",
  "fineAmount",
  "ineligibilityMonths",
  "ineligibilityFirmMonths",
  "communityService",
  "otherSentence",
] as const;

describe("AFFAIR_PROPOSABLE_SELECT", () => {
  it.each(judicialFields)("captures %s for proposal drift detection", (field) => {
    expect(AFFAIR_PROPOSABLE_SELECT[field]).toBe(true);
  });
});
