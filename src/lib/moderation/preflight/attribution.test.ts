import { describe, it, expect } from "vitest";
import { auditAttribution } from "./attribution";

describe("auditAttribution", () => {
  it("returns STRONG when politician fullName appears verbatim in title", () => {
    const result = auditAttribution({
      affairTitle: "Mise en examen de François Fillon dans l'affaire Penelope",
      affairDescription: "...",
      politician: { id: "p1", fullName: "François Fillon", normalizedLastName: "fillon" },
      otherPoliticians: [],
    });
    expect(result.confidence).toBe("STRONG");
  });

  it("returns WEAK when lastName matches but firstName mismatches", () => {
    const result = auditAttribution({
      affairTitle: "Penelope Fillon: emplois fictifs présumés",
      affairDescription: "...",
      politician: { id: "p1", fullName: "François Fillon", normalizedLastName: "fillon" },
      otherPoliticians: [{ id: "p2", fullName: "Penelope Fillon", normalizedLastName: "fillon" }],
    });
    expect(result.confidence).toBe("WEAK");
    expect(result.suggestedAlternativePoliticianId).toBe("p2");
  });

  it("returns MISMATCH when similar surnames refer to different people", () => {
    const result = auditAttribution({
      affairTitle: "Condamnation d'Aliotti pour fraude fiscale",
      affairDescription: "...",
      politician: { id: "p1", fullName: "Louis Aliot", normalizedLastName: "aliot" },
      otherPoliticians: [],
    });
    expect(result.confidence).toBe("MISMATCH");
  });

  it("returns STRONG when description mentions full name with all accents normalized", () => {
    const result = auditAttribution({
      affairTitle: "Affaire X",
      affairDescription: "Sébastien Lecornu, Premier ministre, est mis en cause...",
      politician: { id: "p1", fullName: "Sébastien Lecornu", normalizedLastName: "lecornu" },
      otherPoliticians: [],
    });
    expect(result.confidence).toBe("STRONG");
  });
});
