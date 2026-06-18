import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DebouncedSearchInput } from "@/components/filters/DebouncedSearchInput";

describe("DebouncedSearchInput (manual mode)", () => {
  it("does not call onSearch while typing", () => {
    const onSearch = vi.fn();
    render(<DebouncedSearchInput value="" onSearch={onSearch} manual />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "macron" } });
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("calls onSearch with the trimmed value when the submit button is clicked", () => {
    const onSearch = vi.fn();
    render(<DebouncedSearchInput value="" onSearch={onSearch} manual submitLabel="Rechercher" />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "  macron  " } });
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    expect(onSearch).toHaveBeenCalledWith("macron");
  });

  it("submits via the form submit path", () => {
    const onSearch = vi.fn();
    render(<DebouncedSearchInput value="" onSearch={onSearch} manual />);
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "borne" } });
    fireEvent.submit(input.closest("form")!);
    expect(onSearch).toHaveBeenCalledWith("borne");
  });

  it("renders no clear (X) button when no search is applied (value empty)", () => {
    const onSearch = vi.fn();
    render(<DebouncedSearchInput value="" onSearch={onSearch} manual />);
    expect(screen.queryByRole("button", { name: "Effacer la recherche" })).toBeNull();
  });

  it("shows the clear (X) button when a search is applied and removes it", () => {
    const onSearch = vi.fn();
    render(<DebouncedSearchInput value="macron" onSearch={onSearch} manual />);
    fireEvent.click(screen.getByRole("button", { name: "Effacer la recherche" }));
    expect(onSearch).toHaveBeenCalledWith("");
  });
});
