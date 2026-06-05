import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VoteTitleDisplay } from "@/components/votes/VoteTitleDisplay";
import type { PublicTitleView } from "@/lib/votes/resolve-public-title";

const policyView: PublicTitleView = {
  mode: "policy",
  policyTitle: "Limiter les dérogations aux seuils de qualité de l'eau",
  policySubtitle: "Précision.",
  officialTitle: "le sous-amendement n° 2368 ...",
  officialSourceUrl: null,
  chips: [
    { kind: "procedural", label: "Sous-amendement n°2368" },
    { kind: "result", result: "ADOPTED" },
    { kind: "date", iso: "2026-05-22T10:00:00.000Z" },
  ],
};
const officialView: PublicTitleView = {
  mode: "official",
  officialTitle: "le sous-amendement n° 2368 ...",
  officialSourceUrl: null,
  chips: policyView.chips,
};

describe("VoteTitleDisplay", () => {
  it("policy mode renders the policyTitle + 'Titre explicatif' badge", () => {
    render(<VoteTitleDisplay view={policyView} variant="preview" />);
    expect(screen.getByText(/Limiter les dérogations/)).toBeTruthy();
    expect(screen.getByText(/Titre explicatif/i)).toBeTruthy();
  });
  it("official mode renders the official title, NO badge, NO policyTitle", () => {
    render(<VoteTitleDisplay view={officialView} variant="preview" />);
    expect(screen.getByText(/le sous-amendement n° 2368/)).toBeTruthy();
    expect(screen.queryByText(/Titre explicatif/i)).toBeNull();
    expect(screen.queryByText(/Limiter les dérogations/)).toBeNull();
  });
});
