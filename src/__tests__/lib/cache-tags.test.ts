import { describe, it, expect, vi, beforeEach } from "vitest";

const updateTagSpy = vi.fn();
const revalidatePathSpy = vi.fn();

vi.mock("next/cache", () => ({
  updateTag: (tag: string) => updateTagSpy(tag),
  revalidatePath: (path: string, type: string) => revalidatePathSpy(path, type),
}));

import { invalidateEntity, revalidateAll, ALL_TAGS } from "@/lib/cache";

describe("cache invalidation scopes", () => {
  beforeEach(() => {
    updateTagSpy.mockClear();
    revalidatePathSpy.mockClear();
  });

  it("invalidateEntity('election') updates only the global elections tag", () => {
    invalidateEntity("election");
    expect(updateTagSpy).toHaveBeenCalledWith("elections");
    expect(updateTagSpy).not.toHaveBeenCalledWith("elections-municipales-2026");
  });

  it("invalidateEntity('election-2026') updates only the municipales-2026 tag", () => {
    invalidateEntity("election-2026");
    expect(updateTagSpy).toHaveBeenCalledWith("elections-municipales-2026");
    expect(updateTagSpy).not.toHaveBeenCalledWith("elections");
  });

  it("revalidateAll does NOT touch elections-municipales-2026", () => {
    revalidateAll();
    const calls = updateTagSpy.mock.calls.map((c) => c[0]);
    expect(calls).not.toContain("elections-municipales-2026");
  });

  it("ALL_TAGS does not include the figées municipales tag", () => {
    expect(ALL_TAGS).not.toContain("elections-municipales-2026" as never);
  });
});
