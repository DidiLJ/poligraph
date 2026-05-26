import { describe, it, expect, vi, beforeEach } from "vitest";

const revalidatePathMock = vi.fn();
const revalidateTagMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
}));

import { invalidateEntity } from "@/lib/cache";

describe("invalidateEntity('mandate')", () => {
  beforeEach(() => {
    revalidatePathMock.mockReset();
    revalidateTagMock.mockReset();
  });

  it("default purges politicians tag", () => {
    invalidateEntity("mandate");
    expect(revalidateTagMock).toHaveBeenCalledWith("politicians", "minutes");
    expect(revalidatePathMock).toHaveBeenCalledWith("/api/mandats", "layout");
  });

  it("affectsListings=true purges politicians tag", () => {
    invalidateEntity("mandate", undefined, { affectsListings: true });
    expect(revalidateTagMock).toHaveBeenCalledWith("politicians", "minutes");
  });

  it("affectsListings=false skips politicians tag", () => {
    invalidateEntity("mandate", undefined, { affectsListings: false });
    expect(revalidateTagMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
