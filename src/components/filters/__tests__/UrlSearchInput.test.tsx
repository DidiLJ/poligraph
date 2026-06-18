import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Capture updateParams calls instead of touching the router.
const { updateParams } = vi.hoisted(() => ({ updateParams: vi.fn() }));

vi.mock("@/hooks/useFilterParams", () => ({
  useFilterParams: () => ({
    updateParams,
    searchParams: new URLSearchParams(),
    isPending: false,
  }),
}));

import { UrlSearchInput } from "@/components/filters/UrlSearchInput";

describe("UrlSearchInput", () => {
  beforeEach(() => updateParams.mockClear());

  it("updates the default 'search' param in push mode by default", () => {
    render(<UrlSearchInput value="" manual />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "macron" } });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    expect(updateParams).toHaveBeenCalledWith({ search: "macron" }, { mode: "push" });
  });

  it("writes a custom param in replace mode", () => {
    render(<UrlSearchInput value="" param="q" mode="replace" manual />);
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "borne" } });
    fireEvent.submit(input.closest("form")!);
    expect(updateParams).toHaveBeenCalledWith({ q: "borne" }, { mode: "replace" });
  });
});
