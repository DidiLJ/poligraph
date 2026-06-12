import { describe, it, expect, vi } from "vitest";

// db is imported by the resolver module but never queried by extractAuthorSurname.
vi.mock("@/lib/db", () => ({ db: {} }));

import { extractAuthorSurname } from "@/services/scrutin-substance/debate-context-resolver";

describe("extractAuthorSurname", () => {
  it("cleans AN HTML entities and the civility prefix, keeps the first surname", () => {
    expect(extractAuthorSurname("Mme&#160;Lechon,  M.&#160;Allisio, M.&#160;Amblard")).toBe(
      "Lechon"
    );
    expect(extractAuthorSurname("M. de Fleurian")).toBe("de Fleurian");
    expect(extractAuthorSurname("Mme Pannier-Runacher")).toBe("Pannier-Runacher");
  });

  it("returns null for empty / too-short names", () => {
    expect(extractAuthorSurname(null)).toBeNull();
    expect(extractAuthorSurname("")).toBeNull();
    expect(extractAuthorSurname("M. Li")).toBeNull();
  });
});
