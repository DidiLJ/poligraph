import { describe, it, expect } from "vitest";
import { AffairStatus } from "@/generated/prisma";
import { COLORS } from "@/config/colors";
import { VALID_STATUSES } from "@/lib/security/schemas/affair";
import { getJudicialMaturity } from "@/config/judicial-maturity";
import { getCertaintyLevel } from "@/config/certainty";

const prismaValues = Object.keys(AffairStatus).sort();

describe("les listes de statuts recopiées suivent l'enum Prisma", () => {
  // colors.ts type ses clés depuis l'objet lui-même (keyof typeof), donc le
  // compilateur ne voit aucune omission. Deux statuts manquaient déjà.
  it("COLORS.affairStatus couvre tous les statuts", () => {
    expect(Object.keys(COLORS.affairStatus).sort()).toEqual(prismaValues);
  });

  it("VALID_STATUSES couvre tous les statuts", () => {
    expect([...VALID_STATUSES].sort()).toEqual(prismaValues);
  });
});

describe("cohérence croisée entre les deux taxonomies", () => {
  it("aucun statut validé judiciairement n'est classé instruction close", () => {
    for (const status of Object.keys(AffairStatus) as (keyof typeof AffairStatus)[]) {
      if (getJudicialMaturity(status) === "INSTRUCTION_CLOSE") {
        expect(getCertaintyLevel(status)).toBe("CLOS_SANS_CHARGE");
      }
    }
  });

  it("aucun statut clos sans charge n'est classé dans un autre palier de maturité", () => {
    for (const status of Object.keys(AffairStatus) as (keyof typeof AffairStatus)[]) {
      if (getCertaintyLevel(status) === "CLOS_SANS_CHARGE") {
        expect(getJudicialMaturity(status)).toBe("INSTRUCTION_CLOSE");
      }
    }
  });
});
