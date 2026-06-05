import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublicPreviewCard } from "../_components/PublicPreviewCard";
import type { ScrutinForDisplay, PolicyTitleForDisplay } from "@/lib/votes/resolve-public-title";

const scrutin: ScrutinForDisplay = {
  title: "Projet de loi de finances pour 2026",
  votingDate: new Date("2026-01-15T10:00:00Z"),
  result: "ADOPTED",
  chamber: "AN",
  sourceUrl: "https://example.org/scrutin",
  proceduralLabel: "Vote solennel",
};

const draftPolicy: PolicyTitleForDisplay = {
  status: "DRAFT",
  policyTitle: "Augmenter le budget de l'éducation",
  policySubtitle: "Ce que ça change pour vous",
};

const approvedPolicy: PolicyTitleForDisplay = {
  status: "APPROVED",
  policyTitle: "Augmenter le budget de l'éducation",
  policySubtitle: "Ce que ça change pour vous",
};

describe("PublicPreviewCard", () => {
  it("renders the policy preview AND the preview label for a DRAFT row with previewAsApproved", () => {
    render(<PublicPreviewCard scrutin={scrutin} policy={draftPolicy} previewAsApproved />);
    expect(screen.getByText("Augmenter le budget de l'éducation")).toBeInTheDocument();
    expect(screen.getByText("Aperçu — pas encore publié")).toBeInTheDocument();
  });

  it("renders official mode (no policy title) for a DRAFT row without previewAsApproved", () => {
    render(<PublicPreviewCard scrutin={scrutin} policy={draftPolicy} />);
    expect(screen.queryByText("Augmenter le budget de l'éducation")).not.toBeInTheDocument();
    expect(screen.getByText("Projet de loi de finances pour 2026")).toBeInTheDocument();
    expect(screen.queryByText("Aperçu — pas encore publié")).not.toBeInTheDocument();
  });

  it("falls back to the official title (not a blank heading) when the policy title is empty under previewAsApproved", () => {
    const empty: PolicyTitleForDisplay = {
      status: "DRAFT",
      policyTitle: "   ",
      policySubtitle: null,
    };
    render(<PublicPreviewCard scrutin={scrutin} policy={empty} previewAsApproved />);
    expect(screen.getByText("Projet de loi de finances pour 2026")).toBeInTheDocument();
  });

  it("renders policy mode WITHOUT a preview label for a genuinely APPROVED row", () => {
    render(<PublicPreviewCard scrutin={scrutin} policy={approvedPolicy} />);
    expect(screen.getByText("Augmenter le budget de l'éducation")).toBeInTheDocument();
    expect(screen.queryByText("Aperçu — pas encore publié")).not.toBeInTheDocument();
  });
});
