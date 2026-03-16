import { describe, it, expect } from "vitest";
import { getAdapter, getDefaultAdapter } from "../adapters/registry";

describe("Adapter registry", () => {
  it("returns French adapter for 'FR'", () => {
    const adapter = getAdapter("FR");
    expect(adapter.countryCode).toBe("FR");
    expect(adapter.name).toBe("France");
  });

  it("getDefaultAdapter returns French adapter", () => {
    const adapter = getDefaultAdapter();
    expect(adapter.countryCode).toBe("FR");
  });

  it("throws for unregistered country code", () => {
    expect(() => getAdapter("XX")).toThrow("No adapter registered");
  });
});
