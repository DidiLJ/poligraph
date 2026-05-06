import { describe, it, expect } from "vitest";
import { subscribeSchema } from "../newsletter";

describe("subscribeSchema", () => {
  it("accepts a minimal payload (email + source)", () => {
    const r = subscribeSchema.safeParse({ email: "a@b.fr", source: "FOOTER" });
    expect(r.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const r = subscribeSchema.safeParse({ email: "nope", source: "FOOTER" });
    expect(r.success).toBe(false);
  });

  it("rejects unknown source", () => {
    const r = subscribeSchema.safeParse({ email: "a@b.fr", source: "TWITTER" });
    expect(r.success).toBe(false);
  });

  it("accepts boussoleProfile", () => {
    const r = subscribeSchema.safeParse({
      email: "a@b.fr",
      source: "BOUSSOLE",
      deputySlug: "marine-le-pen",
      postalCode: "75001",
      boussoleProfile: {
        answers: [{ scrutinId: "sc-1", position: "POUR" }],
        topPartyMatches: [{ partyId: "p-1", score: 80 }],
        profileHash: "abc123",
        computedAt: new Date().toISOString(),
        boussoleVersion: "1.0",
      },
    });
    expect(r.success).toBe(true);
  });
});
