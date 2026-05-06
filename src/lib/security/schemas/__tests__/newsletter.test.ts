import { describe, it, expect } from "vitest";
import { subscribeSchema, tokenQuerySchema, forgetSchema } from "../newsletter";

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

describe("tokenQuerySchema", () => {
  it("accepts a valid token", () => {
    const r = tokenQuerySchema.safeParse({ token: "x".repeat(32) });
    expect(r.success).toBe(true);
  });
  it("rejects too-short tokens", () => {
    const r = tokenQuerySchema.safeParse({ token: "short" });
    expect(r.success).toBe(false);
  });
});

describe("forgetSchema", () => {
  it("accepts email + valid unsubscribeToken", () => {
    const r = forgetSchema.safeParse({
      email: "a@b.fr",
      unsubscribeToken: "y".repeat(32),
    });
    expect(r.success).toBe(true);
  });
  it("rejects missing token", () => {
    const r = forgetSchema.safeParse({ email: "a@b.fr" });
    expect(r.success).toBe(false);
  });
});
