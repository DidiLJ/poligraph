import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ db: {} }));
import { extractRelevantContent } from "../debate-transcripts";

describe("extractRelevantContent", () => {
  it("extracts seanceRef, date, and content from valid JSON", () => {
    const result = extractRelevantContent({
      compteRendu: {
        uid: "CRSANR5L17S2025CRI0042",
        dateSeanceJour: "2025-03-15",
        contenu: {
          pointsOdj: {
            pointOdj: [
              {
                interventions: {
                  intervention: [
                    { texte: "M. Le Maire a indiqué que le budget..." },
                    { texte: "Mme Panot a répondu que..." },
                  ],
                },
              },
            ],
          },
        },
      },
    });

    expect(result).not.toBeNull();
    expect(result!.seanceRef).toBe("CRSANR5L17S2025CRI0042");
    expect(result!.date).toBe("2025-03-15");
    expect(result!.content).toContain("M. Le Maire");
    expect(result!.content).toContain("Mme Panot");
  });

  it("returns null when uid is missing", () => {
    const result = extractRelevantContent({
      compteRendu: { dateSeanceJour: "2025-03-15" },
    });
    expect(result).toBeNull();
  });

  it("returns null when no interventions exist", () => {
    const result = extractRelevantContent({
      compteRendu: {
        uid: "CR123",
        dateSeanceJour: "2025-03-15",
        contenu: { pointsOdj: { pointOdj: [] } },
      },
    });
    expect(result).toBeNull();
  });

  it("truncates content to 5000 chars", () => {
    const longText = "A".repeat(6000);
    const result = extractRelevantContent({
      compteRendu: {
        uid: "CR123",
        dateSeanceJour: "2025-03-15",
        contenu: {
          pointsOdj: {
            pointOdj: [{ interventions: { intervention: { texte: longText } } }],
          },
        },
      },
    });
    expect(result!.content.length).toBeLessThanOrEqual(5000);
  });
});
