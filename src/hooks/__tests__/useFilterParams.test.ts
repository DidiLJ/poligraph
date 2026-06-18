import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Stable router spies + controllable search string, shared with the mock below.
const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  search: "",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/affaires",
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

import { useFilterParams } from "@/hooks/useFilterParams";

describe("useFilterParams", () => {
  beforeEach(() => {
    mocks.push.mockClear();
    mocks.replace.mockClear();
    mocks.search = "";
  });

  it("uses router.push by default", () => {
    const { result } = renderHook(() => useFilterParams());
    act(() => result.current.updateParams({ parti: "rn" }));
    expect(mocks.push).toHaveBeenCalledWith("/affaires?parti=rn", { scroll: false });
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("uses router.replace when mode is 'replace'", () => {
    const { result } = renderHook(() => useFilterParams());
    act(() => result.current.updateParams({ parti: "rn" }, { mode: "replace" }));
    expect(mocks.replace).toHaveBeenCalledWith("/affaires?parti=rn", { scroll: false });
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("always drops the page param on update", () => {
    mocks.search = "page=3&parti=rn";
    const { result } = renderHook(() => useFilterParams());
    act(() => result.current.updateParams({ sort: "date-asc" }));
    expect(mocks.push).toHaveBeenCalledTimes(1);
    const url = mocks.push.mock.calls[0]![0] as string;
    expect(url).not.toContain("page=");
    expect(url).toContain("sort=date-asc");
    expect(url).toContain("parti=rn");
  });

  it("navigates to the bare pathname when no params remain", () => {
    mocks.search = "parti=rn";
    const { result } = renderHook(() => useFilterParams());
    act(() => result.current.updateParams({ parti: "" }));
    expect(mocks.push).toHaveBeenCalledWith("/affaires", { scroll: false });
  });
});
