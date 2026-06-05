import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EvidencePane } from "../EvidencePane";
import type { EvidenceQuote, SubstanceTextBlock } from "@/services/scrutin-policy-title/types";

const block: SubstanceTextBlock = {
  sourceType: "subAmendment",
  sourceId: "a1",
  field: "Amendment.summary",
  text: "Le sous-amendement supprime une dérogation aux seuils de qualité de l'eau.",
  trust: "official",
};

describe("EvidencePane", () => {
  it("highlights a verbatim quote with a <mark>", () => {
    const quote: EvidenceQuote = {
      sourceType: "subAmendment",
      sourceId: "a1",
      field: "Amendment.summary",
      quote: "supprime une dérogation",
    };
    const { container } = render(<EvidencePane evidenceQuotes={[quote]} blocks={[block]} />);
    const mark = container.querySelector("mark");
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe("supprime une dérogation");
    expect(screen.queryByText(/Citation introuvable/)).toBeNull();
  });

  it("shows the drift banner when the quote is missing from the block", () => {
    const quote: EvidenceQuote = {
      sourceType: "subAmendment",
      sourceId: "a1",
      field: "Amendment.summary",
      quote: "texte qui n'existe plus du tout",
    };
    render(<EvidencePane evidenceQuotes={[quote]} blocks={[block]} />);
    expect(screen.getByText(/Citation introuvable dans la source actuelle/)).toBeInTheDocument();
  });

  it("shows the fallback message when there are no quotes", () => {
    render(<EvidencePane evidenceQuotes={[]} blocks={[block]} />);
    expect(screen.getByText(/Aucune source citée/)).toBeInTheDocument();
  });
});
