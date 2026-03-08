import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {},
}));

import { extractEntityId } from "./dedup";

describe("extractEntityId", () => {
  it("extracts politician slug from politiques URL", () => {
    expect(extractEntityId("https://poligraph.fr/politiques/marine-le-pen")).toBe(
      "politiques:marine-le-pen"
    );
  });

  it("extracts affair slug from affaires URL", () => {
    expect(extractEntityId("https://poligraph.fr/affaires/some-affair-slug")).toBe(
      "affaires:some-affair-slug"
    );
  });

  it("extracts vote slug from votes URL", () => {
    expect(extractEntityId("https://poligraph.fr/votes/some-vote")).toBe("votes:some-vote");
  });

  it("returns null for non-poligraph URLs", () => {
    expect(extractEntityId("https://example.com/foo")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(extractEntityId(undefined)).toBeNull();
  });
});
