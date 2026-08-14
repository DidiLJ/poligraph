import { describe, it, expect, vi, beforeEach } from "vitest";

// generateMetadata only reads the politician row and the index signals; the
// listing queries below it never run here. Stub the Prisma client so the module
// imports with no DATABASE_URL, and the signals loader so no cache primitive
// runs outside a Next request.
const findUnique = vi.fn();
vi.mock("@/lib/db", () => ({ db: { politician: { findUnique: () => findUnique() } } }));
vi.mock("@/lib/seo/politician-index-signals", () => ({
  getPoliticianIndexSignals: vi.fn(async () => null),
}));

import { generateMetadata } from "@/app/politiques/[slug]/votes/page";

type Mandate = { type: string; isCurrent: boolean; role: string | null };

const metadataFor = (fullName: string, mandates: Mandate[]) => {
  findUnique.mockResolvedValue({
    id: "p1",
    slug: "jean-dupont",
    fullName,
    firstName: "Jean",
    lastName: "Dupont",
    photoUrl: null,
    civility: "M.",
    currentParty: null,
    mandates,
  });
  return generateMetadata({
    params: Promise.resolve({ slug: "jean-dupont" }),
    searchParams: Promise.resolve({}),
  });
};

beforeEach(() => findUnique.mockReset());

describe("/politiques/[slug]/votes metadata", () => {
  it("a sitting deputy gets the Assemblée nationale", async () => {
    const m = await metadataFor("Jean Dupont", [{ type: "DEPUTE", isCurrent: true, role: null }]);
    expect(m.title).toBe("Votes de Jean Dupont à l'Assemblée nationale");
    expect(m.description).toContain("à l'Assemblée nationale");
    expect(m.alternates?.canonical).toBe("/politiques/jean-dupont/votes");
  });

  it("a sitting senator gets the Sénat, never the Assemblée nationale", async () => {
    const m = await metadataFor("Marie Martin", [
      { type: "SENATEUR", isCurrent: true, role: null },
    ]);
    expect(m.title).toBe("Votes de Marie Martin au Sénat");
    expect(m.title).not.toContain("Assemblée nationale");
    expect(String(m.description)).not.toContain("Assemblée nationale");
  });

  it("an undetermined chamber falls back to a neutral wording", async () => {
    const m = await metadataFor("Camille Durand", [
      { type: "MINISTRE", isCurrent: true, role: null },
    ]);
    expect(m.title).toBe("Votes parlementaires de Camille Durand");
    expect(String(m.description)).not.toContain("Assemblée nationale");
    expect(String(m.description)).not.toContain("Sénat");
  });

  it("an ambiguous mandate set claims no chamber at all", async () => {
    const m = await metadataFor("Camille Durand", [
      { type: "DEPUTE", isCurrent: true, role: null },
      { type: "SENATEUR", isCurrent: true, role: null },
    ]);
    expect(m.title).toBe("Votes parlementaires de Camille Durand");
  });

  it("keeps the canonical of an unknown politician untouched", async () => {
    findUnique.mockResolvedValue(null);
    const m = await generateMetadata({
      params: Promise.resolve({ slug: "inconnu" }),
      searchParams: Promise.resolve({}),
    });
    expect(m.title).toBe("Politicien non trouvé");
  });
});
