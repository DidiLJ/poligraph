import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { SearchAutocomplete } from "./SearchAutocomplete";

const mockSearchResults = [
  {
    id: "1",
    fullName: "Jean Dupont",
    slug: "jean-dupont",
    photoUrl: "https://example.com/photo.jpg",
    party: "LR",
    partyColor: "#0066CC",
    mandate: "DEPUTE",
  },
];

describe("SearchAutocomplete", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve(mockSearchResults),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should render politician avatar with alt text containing full name when photo URL is provided", async () => {
    render(<SearchAutocomplete />);

    const input = screen.getByPlaceholderText("Rechercher un représentant...");
    fireEvent.change(input, { target: { value: "je" } });

    await waitFor(() => {
      const listbox = screen.getByRole("listbox");
      const img = listbox.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("alt", "Jean Dupont");
    });
  });
});
