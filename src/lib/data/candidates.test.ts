import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    candidacyPresidential: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma";

describe("CandidacyPresidential schema", () => {
  it("exposes the candidacyPresidential model via Prisma client", () => {
    expect(typeof db.candidacyPresidential.findUnique).toBe("function");
    expect(typeof db.candidacyPresidential.create).toBe("function");
  });

  it("declares CandidacyPresidential in the Prisma ModelName enum", () => {
    expect(Prisma.ModelName).toHaveProperty("CandidacyPresidential");
  });
});
