import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/anthropic", () => ({
  callAnthropic: vi.fn(),
  extractToolUse: vi.fn(),
}));

import { moderateAffair, type ModerationInput } from "./affair-moderation";
import { callAnthropic, extractToolUse } from "@/lib/api/anthropic";

const mockedCallAnthropic = callAnthropic as ReturnType<typeof vi.fn>;
const mockedExtractToolUse = extractToolUse as ReturnType<typeof vi.fn>;

const baseToolResult = {
  recommendation: "PUBLISH",
  confidence: 90,
  reasoning: "Sources fiables, données cohérentes.",
  corrected_title: null,
  corrected_description: null,
  corrected_status: null,
  corrected_category: null,
  corrected_involvement: null,
  issues: [],
};

const baseInput: ModerationInput = {
  affairId: "a1",
  title: "Menaces de mort contre un maire",
  description: "Le maire a été menacé de mort.",
  status: "ENQUETE_PRELIMINAIRE",
  category: "MENACE",
  involvement: "MENTIONED_ONLY",
  politicianName: "Jean Dupont",
  politicianSlug: "jean-dupont",
  sources: [
    {
      url: "https://example.org/article",
      title: "Un maire menacé",
      publisher: "Presse Régionale",
      publishedAt: "2026-05-18T00:00:00.000Z",
    },
  ],
  factsDate: "2026-05-18T00:00:00.000Z",
  startDate: null,
  verdictDate: null,
  court: null,
  sentence: null,
};

function userMessageContent(): string {
  const messages = mockedCallAnthropic.mock.calls[0]![0] as { content: string }[];
  return messages[0]!.content;
}

function systemPrompt(): string {
  const options = mockedCallAnthropic.mock.calls[0]![1] as { system: string };
  return options.system;
}

describe("moderateAffair", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCallAnthropic.mockResolvedValue({ content: [] });
    mockedExtractToolUse.mockReturnValue({ ...baseToolResult });
  });

  it("injects the provided today date into the user message", async () => {
    await moderateAffair({ ...baseInput, today: "2026-06-05" });

    expect(userMessageContent()).toContain("Date du jour : 2026-06-05");
  });

  it("defaults today to the current date when not provided", async () => {
    await moderateAffair(baseInput);

    expect(userMessageContent()).toMatch(/Date du jour : \d{4}-\d{2}-\d{2}/);
  });

  it("instructs the model to compare dates against the provided today", async () => {
    await moderateAffair(baseInput);

    expect(systemPrompt()).toContain("Date du jour");
    expect(systemPrompt()).toContain("JAMAIS à tes connaissances internes");
  });

  it("declares victim and plaintiff affairs as in scope", async () => {
    await moderateAffair(baseInput);

    expect(systemPrompt()).toContain("PÉRIMÈTRE ÉDITORIAL");
    expect(systemPrompt()).toContain("VICTIME ou PLAIGNANT sont AUSSI dans le périmètre");
  });

  it("exposes corrected_involvement in the tool schema as required", async () => {
    await moderateAffair(baseInput);

    const options = mockedCallAnthropic.mock.calls[0]![1] as {
      tools: { input_schema: { properties: Record<string, unknown>; required: string[] } }[];
    };
    const schema = options.tools[0]!.input_schema;
    expect(schema.properties.corrected_involvement).toBeDefined();
    expect(schema.required).toContain("corrected_involvement");
  });

  it("returns a valid corrected involvement", async () => {
    mockedExtractToolUse.mockReturnValue({
      ...baseToolResult,
      corrected_involvement: "VICTIM",
    });

    const result = await moderateAffair(baseInput);

    expect(result.correctedInvolvement).toBe("VICTIM");
  });

  it("falls back to null on an invalid corrected involvement", async () => {
    mockedExtractToolUse.mockReturnValue({
      ...baseToolResult,
      corrected_involvement: "WITNESS",
    });

    const result = await moderateAffair(baseInput);

    expect(result.correctedInvolvement).toBeNull();
  });

  it("still forces NEEDS_REVIEW for sensitive categories", async () => {
    mockedExtractToolUse.mockReturnValue({ ...baseToolResult, recommendation: "PUBLISH" });

    const result = await moderateAffair({ ...baseInput, category: "AGRESSION_SEXUELLE" });

    expect(result.recommendation).toBe("NEEDS_REVIEW");
    expect(result.issues.some((i) => i.type === "SENSITIVE_CATEGORY")).toBe(true);
  });
});
