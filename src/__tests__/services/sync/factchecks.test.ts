import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/name-matching", () => ({
  normalizeText: vi.fn(),
  buildPoliticianIndex: vi.fn(),
  findMentions: vi.fn(),
}));
vi.mock("@/lib/identity/mention-blocklist", () => ({
  loadMentionBlocklist: vi.fn(),
}));

import { FACTCHECK_ALLOWED_SOURCES } from "@/config/labels";
import { getPublicationStatusForSource } from "@/services/sync/factchecks";

describe("getPublicationStatusForSource", () => {
  it("returns PUBLISHED for allowed sources", () => {
    for (const source of FACTCHECK_ALLOWED_SOURCES) {
      expect(getPublicationStatusForSource(source)).toBe("PUBLISHED");
    }
  });

  it("returns DRAFT for unknown sources", () => {
    expect(getPublicationStatusForSource("dpa-factchecking")).toBe("DRAFT");
    expect(getPublicationStatusForSource("Snopes")).toBe("DRAFT");
    expect(getPublicationStatusForSource("PolitiFact")).toBe("DRAFT");
  });
});
