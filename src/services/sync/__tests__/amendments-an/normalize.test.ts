import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { normalizeAmendment, isNil } from "@/services/sync/amendments-an/normalize";

const fx = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8"));

describe("isNil", () => {
  it("treats AN nil-objects as nil", () => {
    expect(isNil({ "@xsi:nil": "true" })).toBe(true);
  });
  it("treats real values as not-nil", () => {
    expect(isNil("Adopté")).toBe(false);
    expect(isNil("")).toBe(false); // empty string is a value, not nil
    expect(isNil(undefined)).toBe(true);
    expect(isNil(null)).toBe(true);
  });
});

describe("normalizeAmendment", () => {
  it("maps a populated record with a string number", () => {
    const n = normalizeAmendment(fx("sample-amendment.json"), {
      dossierRefFromPath: "DLR5L17N54083",
      texteRefFromPath: "PIONANR5L17B1432",
      legislature: 17,
    });
    expect(n.externalId).toBe("AMANR5L17PO59051B1432P0D1N000008");
    expect(n.number).toBe("CL8");
    expect(n.texteRef).toBe("PIONANR5L17B1432");
    expect(n.dossierRefFromPath).toBe("DLR5L17N54083");
    expect(n.content).toBe("<p>Supprimer l'alin&#xE9;a 3.</p>");
    expect(n.summary).toBe("<p>Cet amendement supprime la d&#xE9;rogation.</p>");
    expect(n.status).toBe("ADOPTE");
    expect(n.parentExternalId).toBeNull();
    expect(n.identicalDiscussionId).toBe("12345");
    expect(n.article).toBe("Article 8");
    expect(n.authorName).toBe("M. Potier");
    expect(n.legislature).toBe(17);
    expect(n.chamber).toBe("AN");
  });

  it("decodes HTML entities in authorName and article (AN double-encoding)", () => {
    const record = {
      amendement: {
        uid: "X",
        identification: { numeroLong: "1" },
        pointeurFragmentTexte: {
          division: { articleDesignation: "APR&#200;S L&#39;ARTICLE 23" },
        },
        signataires: {
          libelle: "Mme&#160;Blin, M.&#160;F&#233;gn&#233;",
          auteur: { typeAuteur: "Député" },
        },
      },
    };
    const n = normalizeAmendment(record, {
      dossierRefFromPath: null,
      texteRefFromPath: null,
      legislature: 17,
    });
    expect(n.authorName).toBe("Mme Blin, M. Fégné");
    expect(n.article).toBe("APRÈS L'ARTICLE 23");
  });

  it("keeps content and summary as raw AN HTML (not decoded)", () => {
    const n = normalizeAmendment(fx("sample-amendment.json"), {
      dossierRefFromPath: null,
      texteRefFromPath: null,
      legislature: 17,
    });
    expect(n.content).toBe("<p>Supprimer l'alin&#xE9;a 3.</p>");
    expect(n.summary).toBe("<p>Cet amendement supprime la d&#xE9;rogation.</p>");
  });

  it("handles nil-objects as null and pending sort", () => {
    const n = normalizeAmendment(fx("nil-amendment.json"), {
      dossierRefFromPath: null,
      texteRefFromPath: null,
      legislature: 17,
    });
    expect(n.number).toBe("600 (Rect)");
    expect(n.content).toBeNull();
    expect(n.summary).toBeNull();
    expect(n.status).toBe("DEPOSE");
    expect(n.parentExternalId).toBeNull();
    expect(n.identicalDiscussionId).toBeNull();
    expect(n.article).toBeNull();
  });

  it("falls back to texteRefFromPath when JSON texteLegislatifRef is nil/absent", () => {
    const recordNoTexte = {
      amendement: {
        uid: "X",
        identification: { numeroLong: "1" },
        texteLegislatifRef: { "@xsi:nil": "true" },
      },
    };
    const n = normalizeAmendment(recordNoTexte, {
      dossierRefFromPath: null,
      texteRefFromPath: "PIONANR5L17B1432",
      legislature: 17,
    });
    expect(n.texteRef).toBe("PIONANR5L17B1432");
  });

  it("prefers JSON texteLegislatifRef over the path fallback when both are present", () => {
    const recordWithBoth = {
      amendement: {
        uid: "X",
        identification: { numeroLong: "1" },
        texteLegislatifRef: "PIONANR_FROM_JSON",
      },
    };
    const n = normalizeAmendment(recordWithBoth, {
      dossierRefFromPath: null,
      texteRefFromPath: "PIONANR_FROM_PATH",
      legislature: 17,
    });
    expect(n.texteRef).toBe("PIONANR_FROM_JSON");
  });

  it("extracts a populated parent ref for a sous-amendement", () => {
    const n = normalizeAmendment(fx("sub-amendment.json"), {
      dossierRefFromPath: null,
      texteRefFromPath: null,
      legislature: 17,
    });
    expect(n.parentExternalId).toBe("AMANR5L17XXP0D1N000028");
    expect(n.status).toBe("REJETE");
  });

  it("maps all AN sort codes", () => {
    const make = (sort: string) => ({
      amendement: {
        uid: "X",
        identification: { numeroLong: "1" },
        cycleDeVie: { sort },
      },
    });
    expect(
      normalizeAmendment(make("Adopté"), {
        dossierRefFromPath: null,
        texteRefFromPath: null,
        legislature: 17,
      }).status
    ).toBe("ADOPTE");
    expect(
      normalizeAmendment(make("Rejeté"), {
        dossierRefFromPath: null,
        texteRefFromPath: null,
        legislature: 17,
      }).status
    ).toBe("REJETE");
    expect(
      normalizeAmendment(make("Retiré"), {
        dossierRefFromPath: null,
        texteRefFromPath: null,
        legislature: 17,
      }).status
    ).toBe("RETIRE");
    expect(
      normalizeAmendment(make("Tombé"), {
        dossierRefFromPath: null,
        texteRefFromPath: null,
        legislature: 17,
      }).status
    ).toBe("TOMBE");
    expect(
      normalizeAmendment(make("Non soutenu"), {
        dossierRefFromPath: null,
        texteRefFromPath: null,
        legislature: 17,
      }).status
    ).toBe("TOMBE");
  });
});
