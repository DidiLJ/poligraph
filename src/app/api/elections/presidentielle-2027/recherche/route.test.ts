import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const search = vi.fn();
vi.mock("@/lib/presidentielle/corpus-search", () => ({
  searchPresidentialCorpus: (...args: unknown[]) => search(...args),
}));

import { GET } from "./route";

const context = { params: Promise.resolve({}) };

describe("GET recherche présidentielle", () => {
  beforeEach(() => search.mockReset());

  it("distingue une requête trop courte sans interroger l'index", async () => {
    const response = await GET(
      new NextRequest("https://poligraph.fr/api/elections/presidentielle-2027/recherche?q=a"),
      context
    );
    expect(await response.json()).toEqual({
      state: "too_short",
      query: "a",
      total: 0,
      groups: { candidacies: [], measures: [] },
    });
    expect(search).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("renvoie seulement les groupes Personnalités puis Mesures du corpus scopé", async () => {
    search.mockResolvedValue({
      query: "logement",
      total: 2,
      candidacies: [{ id: "c1", type: "candidacy" }],
      measures: [{ id: "m1", type: "measure" }],
    });
    const response = await GET(
      new NextRequest(
        "https://poligraph.fr/api/elections/presidentielle-2027/recherche?q=logement&limit=8"
      ),
      context
    );
    const body = await response.json();
    expect(search).toHaveBeenCalledWith("presidentielle-2027", "logement", 8);
    expect(Object.keys(body.groups)).toEqual(["candidacies", "measures"]);
    expect(body).not.toHaveProperty("subjects");
    expect(body.state).toBe("results");
  });

  it("renvoie un état vide prudent sans transformer l'absence en fait politique", async () => {
    search.mockResolvedValue({ query: "inconnu", total: 0, candidacies: [], measures: [] });
    const response = await GET(
      new NextRequest("https://poligraph.fr/api/elections/presidentielle-2027/recherche?q=inconnu"),
      context
    );
    expect(await response.json()).toMatchObject({ state: "empty", total: 0 });
  });
});
