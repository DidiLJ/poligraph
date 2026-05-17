import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    promise: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { Prisma, PromiseSourceKind, PromiseExtractionStatus } from "@/generated/prisma";
import { db } from "@/lib/db";

describe("Promise schema", () => {
  it("expose le modèle Promise dans le client Prisma généré", () => {
    expect(Prisma.ModelName.Promise).toBe("Promise");
  });

  it("expose les enums PromiseSourceKind et PromiseExtractionStatus", () => {
    expect(PromiseSourceKind.DISCOURS_AN).toBe("DISCOURS_AN");
    expect(PromiseSourceKind.AUTRE).toBe("AUTRE");
    expect(PromiseExtractionStatus.EXTRACTED).toBe("EXTRACTED");
    expect(PromiseExtractionStatus.PUBLISHED).toBe("PUBLISHED");
  });

  it("permet d'instancier une promesse via le client Prisma", () => {
    expect(typeof db.promise.findMany).toBe("function");
    expect(typeof db.promise.create).toBe("function");
  });
});
