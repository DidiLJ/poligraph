import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CondamnationsStatsTable } from "@/components/affairs/CondamnationsStatsTable";
import type { CondamnationsPartyStats } from "@/lib/data/condamnations";

const rows: CondamnationsPartyStats[] = [
  {
    partyId: "1",
    partySlug: "les-republicains",
    partyShortName: "LR",
    partyName: "Les Républicains",
    nSuivis: 309,
    nCondamnesDefinitifs: 5,
    nCondamnesPrononces: 8,
    tauxDefinitif: 5 / 309,
  },
  {
    partyId: "2",
    partySlug: "parti-radical-de-gauche",
    partyShortName: "PRG",
    partyName: "Parti radical de gauche",
    nSuivis: 5,
    nCondamnesDefinitifs: 1,
    nCondamnesPrononces: 1,
    tauxDefinitif: 1 / 5,
  },
];

describe("CondamnationsStatsTable", () => {
  it("affiche le taux en texte pour chaque parti", () => {
    render(<CondamnationsStatsTable rows={rows} />);
    expect(screen.getByText("1.6%")).toBeInTheDocument();
    expect(screen.getByText("20.0%")).toBeInTheDocument();
  });

  it("n'affiche plus de jauge SVG (régression jauge trompeuse)", () => {
    const { container } = render(<CondamnationsStatsTable rows={rows} />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("expose un lien Détails descriptif et unique par parti (a11y)", () => {
    render(<CondamnationsStatsTable rows={rows} />);
    expect(
      screen.getByRole("link", { name: "Voir les condamnations définitives — Les Républicains" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Voir les condamnations définitives — Parti radical de gauche",
      })
    ).toBeInTheDocument();
  });

  it("structure le tableau avec une légende et des en-têtes de colonnes", () => {
    render(<CondamnationsStatsTable rows={rows} currentMandat="locaux" />);
    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Taux" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Élus suivis" })).toBeInTheDocument();
    // Le parti est un en-tête de ligne (scope="row")
    expect(within(table).getByRole("rowheader", { name: /Les Républicains/ })).toBeInTheDocument();
  });
});
