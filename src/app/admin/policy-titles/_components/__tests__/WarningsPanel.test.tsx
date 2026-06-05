import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WarningsPanel } from "../WarningsPanel";
import type { GenerationWarning } from "@/services/scrutin-policy-title/types";

describe("WarningsPanel", () => {
  it("renders both columns and an empty state for each", () => {
    render(<WarningsPanel generationWarnings={[]} currentWarnings={[]} />);
    expect(screen.getByText("Avertissements à la génération")).toBeInTheDocument();
    expect(screen.getByText("Avertissements actuels")).toBeInTheDocument();
    expect(screen.getAllByText("Aucun avertissement.")).toHaveLength(2);
  });

  it("renders a SUB_TARGET_NOT_CITED blocker with a prominent red border", () => {
    const warn: GenerationWarning = {
      code: "SUB_TARGET_NOT_CITED",
      severity: "blocker",
      message: "Un sous-amendement porte le texte décisif mais aucune citation ne s'y rapporte.",
    };
    render(<WarningsPanel generationWarnings={[]} currentWarnings={[warn]} />);
    const codeEl = screen.getByText("SUB_TARGET_NOT_CITED");
    const item = codeEl.closest("li");
    expect(item).not.toBeNull();
    expect(item?.className).toContain("border-red-500");
    expect(item?.className).toContain("border-2");
  });
});
