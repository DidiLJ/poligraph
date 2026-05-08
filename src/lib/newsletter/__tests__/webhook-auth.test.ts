import { describe, it, expect } from "vitest";
import { verifyMailjetBasicAuth } from "../webhook-auth";

const SECRET = "Aabsolutely-not-a-real-secret-32bytes";
const VALID_HEADER = "Basic " + Buffer.from(`mailjet:${SECRET}`).toString("base64");

describe("verifyMailjetBasicAuth", () => {
  it("accepts a valid Basic Auth header with username 'mailjet'", () => {
    expect(verifyMailjetBasicAuth(VALID_HEADER, SECRET)).toBe(true);
  });

  it("accepts any username (only the password matters)", () => {
    const header = "Basic " + Buffer.from(`anyone:${SECRET}`).toString("base64");
    expect(verifyMailjetBasicAuth(header, SECRET)).toBe(true);
  });

  it("rejects a null Authorization header", () => {
    expect(verifyMailjetBasicAuth(null, SECRET)).toBe(false);
  });

  it("rejects a header without the Basic prefix", () => {
    const header = "Bearer " + Buffer.from(`mailjet:${SECRET}`).toString("base64");
    expect(verifyMailjetBasicAuth(header, SECRET)).toBe(false);
  });

  it("rejects an empty credential", () => {
    expect(verifyMailjetBasicAuth("Basic ", SECRET)).toBe(false);
  });

  it("rejects malformed base64", () => {
    expect(verifyMailjetBasicAuth("Basic !!!not-base64!!!", SECRET)).toBe(false);
  });

  it("rejects a credential without a colon (no username:password format)", () => {
    const header = "Basic " + Buffer.from("nocolonhere").toString("base64");
    expect(verifyMailjetBasicAuth(header, SECRET)).toBe(false);
  });

  it("rejects a wrong password of correct length (constant-time path)", () => {
    const wrong = SECRET.slice(0, -1) + (SECRET.slice(-1) === "x" ? "y" : "x");
    const header = "Basic " + Buffer.from(`mailjet:${wrong}`).toString("base64");
    expect(verifyMailjetBasicAuth(header, SECRET)).toBe(false);
  });

  it("rejects a too-short password (length pre-check)", () => {
    const header = "Basic " + Buffer.from(`mailjet:short`).toString("base64");
    expect(verifyMailjetBasicAuth(header, SECRET)).toBe(false);
  });

  it("rejects an empty secret (caller misconfiguration)", () => {
    expect(verifyMailjetBasicAuth(VALID_HEADER, "")).toBe(false);
  });
});
