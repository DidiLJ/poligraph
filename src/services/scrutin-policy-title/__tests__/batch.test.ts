import { describe, it, expect, afterAll, vi } from "vitest";

// The batch wrapper must not touch the LLM when there are no scrutins to process.
const mockCall = vi.fn();
vi.mock("@/lib/api/mistral", async (orig) => {
  const actual = await orig<typeof import("@/lib/api/mistral")>();
  return { ...actual, callMistral: (...a: unknown[]) => mockCall(...a) };
});

import { db } from "@/lib/db";
import { generateScrutinPolicyTitles } from "@/services/sync/generate-scrutin-policy-titles";

afterAll(async () => {
  await db.$disconnect();
});

describe("generateScrutinPolicyTitles (batch smoke)", () => {
  it("limit 0 + dryRun → zeroed stats, no LLM call", async () => {
    const stats = await generateScrutinPolicyTitles({ limit: 0, dryRun: true });
    expect(stats.processed).toBe(0);
    expect(stats.generated).toBe(0);
    expect(stats.fallbacks).toBe(0);
    expect(stats.skipped).toBe(0);
    expect(stats.results).toEqual([]);
    expect(mockCall).not.toHaveBeenCalled();
  });
});
