import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { HubCandidacy } from "@/lib/data/hub";
import { HubCandidacyOverview } from "../HubCandidacyOverview";

function candidacy(over: Partial<HubCandidacy> = {}): HubCandidacy {
  return {
    id: "c1",
    candidateName: "Alix Dupont",
    politicianSlug: "alix-dupont",
    photoUrl: null,
    blobPhotoUrl: null,
    status: "DECLARE",
    sourceUrl: "https://example.org/source",
    sourceLabel: "Le Monde",
    partyLabel: "Parti Test",
    partyColor: null,
    partyShortName: null,
    partyLogoUrl: null,
    measureCount: 0,
    themesCoveredCount: 0,
    programmeAbsence: "aucun_programme",
    ...over,
  };
}

const field = [
  candidacy(),
  candidacy({ id: "c2", status: "DECLARE", measureCount: 3, themesCoveredCount: 2 }),
  candidacy({ id: "c3", status: "PRESSENTI" }),
  candidacy({ id: "c4", status: "ENVISAGE" }),
];

describe("HubCandidacyOverview", () => {
  it("montre chaque personnalité et compte les filtres avec les mêmes prédicats que la liste", () => {
    render(<HubCandidacyOverview candidacies={field} />);

    expect(screen.getAllByRole("link", { name: /Alix Dupont/ })).toHaveLength(4);
    expect(screen.getByRole("link", { name: /Candidatures annoncées · 2/ })).toHaveAttribute(
      "href",
      "/elections/presidentielle-2027/candidats?statut=annoncees"
    );
    expect(screen.getByRole("link", { name: /Personnalités pressenties · 2/ })).toHaveAttribute(
      "href",
      "/elections/presidentielle-2027/candidats?statut=pressenties"
    );
  });

  it("ouvre la liste sur les personnes ayant des propositions publiées", () => {
    render(<HubCandidacyOverview candidacies={field} />);

    expect(
      screen.getByRole("link", { name: /Avec des propositions publiées · 1/ })
    ).toHaveAttribute("href", "/elections/presidentielle-2027/candidats?propositions=publiees");
  });

  it("ne rend pas un filtre vide, qui n'aurait rien à montrer", () => {
    render(<HubCandidacyOverview candidacies={field} />);

    // Aucune candidature retirée dans ce champ : le compteur reste du texte.
    expect(screen.queryByText("Candidatures retirées")).not.toBeInTheDocument();
  });

  it("mène au champ complet, avec son effectif dans le libellé du lien", () => {
    render(<HubCandidacyOverview candidacies={field} />);

    expect(screen.getByRole("link", { name: /Les 4 fiches/ })).toHaveAttribute(
      "href",
      "/elections/presidentielle-2027/candidats"
    );
  });

  it("qualifie l'état du programme sans inventer de mesure", () => {
    render(
      <HubCandidacyOverview
        candidacies={[
          candidacy({ programmeAbsence: "non_depouille" }),
          candidacy({ id: "c2", measureCount: 1, programmeAbsence: null }),
        ]}
      />
    );

    expect(screen.getByText("Programme non dépouillé")).toBeInTheDocument();
    expect(screen.getByText("1 mesure publiée")).toBeInTheDocument();
  });

  it("reste lisible sur un champ vide, sans compteurs à zéro", () => {
    render(<HubCandidacyOverview candidacies={[]} />);

    expect(screen.getByText("Aucune candidature sourcée à ce jour.")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
