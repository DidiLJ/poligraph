import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AffairModeToggle } from "@/components/affairs/AffairModeToggle";

// next/navigation is globally mocked in src/test/setup.tsx (useSearchParams -> empty).

describe("AffairModeToggle", () => {
  it("renders both perimeter tabs as links with clean hrefs", () => {
    render(<AffairModeToggle mode="mise-en-cause" />);
    expect(screen.getByRole("link", { name: /Mis en cause/ })).toHaveAttribute("href", "/affaires");
    expect(screen.getByRole("link", { name: /Violences contre les élus/ })).toHaveAttribute(
      "href",
      "/affaires?mode=victime"
    );
  });

  it("marks the active perimeter with aria-current", () => {
    render(<AffairModeToggle mode="victime" />);
    expect(screen.getByRole("link", { name: /Violences contre les élus/ })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: /Mis en cause/ })).not.toHaveAttribute("aria-current");
  });

  it("uses the correct accents in the group label and tab text", () => {
    render(<AffairModeToggle mode="mise-en-cause" />);
    expect(screen.getByRole("group", { name: "Type d'affaires" })).toBeInTheDocument();
    expect(screen.getByText("Violences contre les élus")).toBeInTheDocument();
  });
});
