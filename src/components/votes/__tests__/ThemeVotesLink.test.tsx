import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeVotesLink } from "@/components/votes/ThemeVotesLink";

describe("ThemeVotesLink", () => {
  it("is a crawlable link to the thematic landing", () => {
    render(<ThemeVotesLink theme="SANTE" />);
    const link = screen.getByRole("link", { name: /Voir tous les votes sur la santé/ });
    expect(link).toHaveAttribute("href", "/parlement/votes/themes/sante");
  });

  it("uses a descriptive anchor, not a bare label", () => {
    render(<ThemeVotesLink theme="ECONOMIE_BUDGET" />);
    const link = screen.getByRole("link", {
      name: /Voir tous les votes sur l'économie et le budget/,
    });
    expect(link).toHaveAttribute("href", "/parlement/votes/themes/economie-budget");
  });
});
