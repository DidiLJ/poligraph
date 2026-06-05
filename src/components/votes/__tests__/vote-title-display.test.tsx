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

  it("showChips=false hides the chip row (host card owns chrome), keeps title + badge", () => {
    render(<VoteTitleDisplay view={policyView} variant="card" showChips={false} />);
    expect(screen.getByText(/Limiter les dérogations/)).toBeTruthy();
    expect(screen.getByText(/Titre explicatif/i)).toBeTruthy();
    expect(screen.queryByText(/Sous-amendement n°2368/)).toBeNull();
  });

  it("showChips defaults true on detail variant (chip rendered)", () => {
    render(<VoteTitleDisplay view={policyView} variant="detail" />);
    expect(screen.getByText(/Sous-amendement n°2368/)).toBeTruthy();
  });

  it("showOfficialDisclosure=false hides the 'Titre officiel' disclosure in policy mode", () => {
    render(<VoteTitleDisplay view={policyView} variant="card" showOfficialDisclosure={false} />);
    expect(screen.queryByText(/Titre officiel/)).toBeNull();
    expect(screen.getByText(/Limiter les dérogations/)).toBeTruthy();
  });

  it("official mode with showChips=false renders just the heading", () => {
    render(<VoteTitleDisplay view={officialView} variant="card" showChips={false} />);
    expect(screen.getByText(/le sous-amendement n° 2368/)).toBeTruthy();
    expect(screen.queryByText(/Sous-amendement n°2368/)).toBeNull();
  });
});
