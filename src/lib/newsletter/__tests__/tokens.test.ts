import { describe, it, expect } from "vitest";
import { generateToken } from "../tokens";

describe("generateToken", () => {
  it("returns a base64url string", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns 43 chars (32 bytes encoded base64url)", () => {
    expect(generateToken()).toHaveLength(43);
  });

  it("returns a different token each call", () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});
