import { describe, it, expect } from "vitest";
import { buildPublicAffairLookupWheres, pickPublicLinkedAffair } from "@/lib/affairs/affair-lookup";

describe("buildPublicAffairLookupWheres — contrat no-leak", () => {
  it("chacune des 3 clauses (slug, oldSlugs, id) filtre PUBLISHED", () => {
    const wheres = buildPublicAffairLookupWheres("abc123");
    expect(wheres).toHaveLength(3);
    for (const where of wheres) {
      expect(where.publicationStatus).toBe("PUBLISHED");
    }
  });

  it("la clause id ne résout jamais sans filtre de publication", () => {
    const [, , byId] = buildPublicAffairLookupWheres("cuid_draft");
    expect(byId).toEqual({ id: "cuid_draft", publicationStatus: "PUBLISHED" });
  });
});

describe("pickPublicLinkedAffair — contrat no-leak", () => {
  type AffairFixture = { slug: string; title: string; publicationStatus: "PUBLISHED" | "DRAFT" };
  const published: AffairFixture = { slug: "a", title: "A", publicationStatus: "PUBLISHED" };
  const draft: AffairFixture = { slug: "b", title: "B", publicationStatus: "DRAFT" };

  it("retourne l'affaire liée publiée", () => {
    expect(pickPublicLinkedAffair(published, [])).toBe(published);
  });

  it("ne retourne jamais une affaire liée non publiée", () => {
    expect(pickPublicLinkedAffair(draft, [])).toBeNull();
  });

  it("retombe sur linkedBy si linkedAffair est non publiée", () => {
    expect(pickPublicLinkedAffair(draft, [published])).toBe(published);
  });

  it("retourne null sans aucune affaire liée publiée", () => {
    expect(pickPublicLinkedAffair(null, [])).toBeNull();
  });
});
