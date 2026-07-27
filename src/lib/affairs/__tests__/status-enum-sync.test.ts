import { describe, it, expect } from "vitest";
import { AffairStatus } from "@/generated/prisma";
import { COLORS } from "@/config/colors";
import { VALID_STATUSES } from "@/lib/security/schemas/affair";

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
