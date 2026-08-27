import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const search = vi.fn();
vi.mock("@/lib/presidentielle/corpus-search", () => ({
  searchPresidentialCorpus: (...args: unknown[]) => search(...args),
}));

import Page, { metadata } from "./page";

describe("page complète de recherche présidentielle", () => {
  beforeEach(() => {
    search.mockReset();
    search.mockResolvedValue({
      query: "logement",
      total: 1,
      candidacies: [],
      measures: [
        {
          type: "measure",
          id: "m1",
          text: "Construire davantage de logements accessibles sur tout le territoire",
          url: "/elections/presidentielle-2027/mesures/m1",
          candidateName: "Camille Rivière",
          theme: "LOGEMENT_URBANISME",
          precision: null,
          sourceLabel: null,
        },
      ],
    });
  });

  it("reste partageable mais noindex avec un canonical sans requête", () => {
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe(
      "/elections/presidentielle-2027/recherche"
    );
  });

  it("affiche le texte complet et le lien canonique de la mesure", async () => {
    render(await Page({ searchParams: Promise.resolve({ q: "logement" }) }));
    const link = screen.getByRole("link", {
      name: /Construire davantage de logements accessibles sur tout le territoire/,
    });
    expect(link).toHaveAttribute("href", "/elections/presidentielle-2027/mesures/m1");
    expect(search).toHaveBeenCalledWith("presidentielle-2027", "logement", 50);
  });

  it("rend utile une correspondance claire avec un sujet sans l'ajouter au panneau", async () => {
    render(await Page({ searchParams: Promise.resolve({ q: "Santé" }) }));
    expect(screen.getByRole("link", { name: "Comparer le sujet Santé" })).toHaveAttribute(
      "href",
      "/elections/presidentielle-2027/sujets/sante"
    );
  });

  it("reprend l'état vide prudent du handoff", async () => {
    search.mockResolvedValue({
      query: "inconnu",
      total: 0,
      candidacies: [],
      measures: [],
    });
    render(await Page({ searchParams: Promise.resolve({ q: "inconnu" }) }));
    expect(screen.getByRole("heading", { name: "Aucun résultat pour « inconnu »" }))
      .toBeInTheDocument();
    expect(
      screen.getByText(/Cette absence ne prouve pas qu'une proposition n'existe pas/)
    ).toBeInTheDocument();
  });
});
