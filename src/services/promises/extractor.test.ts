import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/anthropic", () => ({
  callAnthropic: vi.fn(),
  parseAnthropicJSON: vi.fn(),
}));

import { callAnthropic, parseAnthropicJSON } from "@/lib/api/anthropic";
import { extractPromisesFromText } from "@/services/promises/extractor";

describe("extractPromisesFromText", () => {
  beforeEach(() => {
    vi.mocked(callAnthropic).mockReset();
    vi.mocked(parseAnthropicJSON).mockReset();
  });

  it("parse correctement une réponse Haiku valide", async () => {
    vi.mocked(callAnthropic).mockResolvedValueOnce({
      content: [{ type: "text", text: '{"promises":[...]}' }],
    } as never);
    vi.mocked(parseAnthropicJSON).mockReturnValueOnce({
      promises: [
        {
          text: "Baisser le SMIC à 1500 euros nets",
          context: "Lors du meeting",
          confidence: 0.9,
        },
      ],
    } as never);

    const result = await extractPromisesFromText({
      text: "Le candidat a déclaré vouloir baisser le SMIC...",
      politicianName: "Jean Dupont",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.text).toContain("SMIC");
  });

  it("retourne un tableau vide si pas de promesse", async () => {
    vi.mocked(callAnthropic).mockResolvedValueOnce({
      content: [{ type: "text", text: '{"promises":[]}' }],
    } as never);
    vi.mocked(parseAnthropicJSON).mockReturnValueOnce({ promises: [] });
    const result = await extractPromisesFromText({
      text: "Une dépêche neutre.",
      politicianName: "Jean Dupont",
    });
    expect(result).toEqual([]);
  });

  it("retourne un tableau vide sur réponse invalide", async () => {
    vi.mocked(callAnthropic).mockResolvedValueOnce({
      content: [{ type: "text", text: "réponse non-JSON" }],
    } as never);
    vi.mocked(parseAnthropicJSON).mockImplementationOnce(() => {
      throw new SyntaxError("not JSON");
    });
    const result = await extractPromisesFromText({
      text: "Article",
      politicianName: "Test",
    });
    expect(result).toEqual([]);
  });

  it("filtre les promesses trop courtes ou trop longues", async () => {
    const longText = "A".repeat(600);
    vi.mocked(callAnthropic).mockResolvedValueOnce({
      content: [{ type: "text", text: "ok" }],
    } as never);
    vi.mocked(parseAnthropicJSON).mockReturnValueOnce({
      promises: [
        { text: "OK", confidence: 0.9 },
        { text: longText, confidence: 0.9 },
      ],
    } as never);
    const result = await extractPromisesFromText({
      text: "Article",
      politicianName: "Test",
    });
    expect(result).toEqual([]);
  });
});
