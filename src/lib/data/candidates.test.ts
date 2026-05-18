import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma";

describe("CandidacyPresidential schema", () => {
  it("declares CandidacyPresidential in the Prisma ModelName enum", () => {
    expect(Prisma.ModelName).toHaveProperty("CandidacyPresidential");
  });
});
