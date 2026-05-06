import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { verifyMailjetSignature } from "../webhook-signature";

describe("verifyMailjetSignature", () => {
  const secret = "test-secret";
  const body = '{"event":"open","email":"a@b.fr","time":1700000000}';
  const validSig = createHmac("sha256", secret).update(body).digest("hex");

  it("accepts a valid signature", () => {
    expect(verifyMailjetSignature(body, validSig, secret)).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(verifyMailjetSignature(body + "x", validSig, secret)).toBe(false);
  });

  it("rejects a wrong signature of correct length (constant-time path)", () => {
    const flipped = validSig.slice(0, -1) + (validSig.slice(-1) === "0" ? "1" : "0");
    expect(verifyMailjetSignature(body, flipped, secret)).toBe(false);
  });

  it("rejects a too-short signature (length pre-check)", () => {
    expect(verifyMailjetSignature(body, "deadbeef", secret)).toBe(false);
  });

  it("rejects null signature", () => {
    expect(verifyMailjetSignature(body, null, secret)).toBe(false);
  });

  it("rejects empty secret behavior — caller responsibility", () => {
    const sigWithEmpty = createHmac("sha256", "").update(body).digest("hex");
    expect(verifyMailjetSignature(body, sigWithEmpty, "")).toBe(true);
  });
});
