import { describe, it, expect, vi, beforeEach } from "vitest";

const revalidateTagSpy = vi.fn();
const revalidatePathSpy = vi.fn();

vi.mock("next/cache", () => ({
  revalidateTag: (tag: string, profile: string) => revalidateTagSpy(tag, profile),
  revalidatePath: (path: string, type: string) => revalidatePathSpy(path, type),
}));

import { invalidateEntity, revalidateAll, ALL_TAGS } from "@/lib/cache";

describe("cache invalidation scopes", () => {
  beforeEach(() => {
    revalidateTagSpy.mockClear();
    revalidatePathSpy.mockClear();
  });

  it("invalidateEntity('election') updates only the global elections tag", () => {
    invalidateEntity("election");
    const tags = revalidateTagSpy.mock.calls.map((c) => c[0]);
    expect(tags).toContain("elections");
    expect(tags).not.toContain("elections-municipales-2026");
  });

  it("invalidateEntity('election-2026') updates only the municipales-2026 tag", () => {
    invalidateEntity("election-2026");
    const tags = revalidateTagSpy.mock.calls.map((c) => c[0]);
    expect(tags).toContain("elections-municipales-2026");
    expect(tags).not.toContain("elections");
  });

  it("revalidateAll does NOT touch elections-municipales-2026", () => {
    revalidateAll();
    const tags = revalidateTagSpy.mock.calls.map((c) => c[0]);
    expect(tags).not.toContain("elections-municipales-2026");
  });

  it("ALL_TAGS does not include the figées municipales tag", () => {
    expect(ALL_TAGS).not.toContain("elections-municipales-2026" as never);
  });

  it("passes a cacheLife profile as the second arg to revalidateTag", () => {
    invalidateEntity("politician", "marine-le-pen");
    for (const call of revalidateTagSpy.mock.calls) {
      expect(typeof call[1]).toBe("string");
      expect(call[1].length).toBeGreaterThan(0);
    }
  });
});
