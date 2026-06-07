import { describe, it, expect } from "vitest";
import { buildPublicAffairLookupWheres } from "@/lib/affairs/affair-lookup";

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
