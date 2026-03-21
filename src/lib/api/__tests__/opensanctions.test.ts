import { describe, it, expect } from "vitest";
import { OpenSanctionsClient } from "../opensanctions";

describe("OpenSanctionsClient", () => {
  it("throws if no API key provided", () => {
    expect(() => new OpenSanctionsClient("")).toThrow("API key required");
  });

  it("constructs with valid API key", () => {
    const client = new OpenSanctionsClient("test-key");
    expect(client).toBeDefined();
  });

  it("exposes match, getEntity, and search methods", () => {
    const client = new OpenSanctionsClient("test-key");
    expect(typeof client.match).toBe("function");
    expect(typeof client.getEntity).toBe("function");
    expect(typeof client.search).toBe("function");
  });
});
