import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AnthropicResponse } from "@/lib/api/anthropic";
import type { MistralResponse } from "@/lib/api/mistral";

// Mock only the network calls; keep the real extract/parse helpers.
vi.mock("@/lib/api/anthropic", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api/anthropic")>();
  return { ...actual, callAnthropic: vi.fn() };
});
vi.mock("@/lib/api/mistral", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api/mistral")>();
  return { ...actual, callMistral: vi.fn() };
});

import { callAnthropic } from "@/lib/api/anthropic";
import { callMistral } from "@/lib/api/mistral";
import { classifyTheme } from "@/services/classify-theme";

const anthropicTool = (theme: string): AnthropicResponse => ({
  content: [{ type: "tool_use", name: "classify_theme", input: { theme } }],
});

const mistralJson = (obj: unknown): MistralResponse => ({
  choices: [
    { message: { role: "assistant", content: JSON.stringify(obj) }, finish_reason: "stop" },
  ],
});

describe("classifyTheme — Mistral fallback", () => {
  beforeEach(() => {
    vi.mocked(callAnthropic).mockReset();
    vi.mocked(callMistral).mockReset();
  });

  it("Anthropic OK -> returns theme, Mistral NOT called", async () => {
    vi.mocked(callAnthropic).mockResolvedValue(anthropicTool("SANTE"));
    const res = await classifyTheme("Loi hôpital", "réforme des urgences");
    expect(res).toBe("SANTE");
    expect(callMistral).not.toHaveBeenCalled();
  });

  it("Anthropic throws (quota / rate-limit) -> Mistral called", async () => {
    vi.mocked(callAnthropic).mockRejectedValue(
      new Error("Anthropic API error 429: rate_limit_error")
    );
    vi.mocked(callMistral).mockResolvedValue(mistralJson({ theme: "TRANSPORTS" }));
    const res = await classifyTheme("Loi mobilités");
    expect(res).toBe("TRANSPORTS");
    expect(callMistral).toHaveBeenCalledTimes(1);
  });

  it("Mistral fallback returns an alias -> normalized", async () => {
    vi.mocked(callAnthropic).mockRejectedValue(
      new Error("Anthropic API error 400: credit balance too low")
    );
    vi.mocked(callMistral).mockResolvedValue(mistralJson({ theme: "CULTURE_EDUCATION" }));
    const res = await classifyTheme("Loi école");
    expect(res).toBe("EDUCATION_CULTURE");
  });

  it("Mistral fallback returns an invalid theme -> null (not thrown)", async () => {
    vi.mocked(callAnthropic).mockRejectedValue(new Error("Anthropic API error 500"));
    vi.mocked(callMistral).mockResolvedValue(mistralJson({ theme: "PAS_UN_THEME" }));
    const res = await classifyTheme("Texte ambigu");
    expect(res).toBeNull();
  });

  it("both providers throw -> error propagated (not swallowed)", async () => {
    vi.mocked(callAnthropic).mockRejectedValue(new Error("Anthropic API error 429"));
    vi.mocked(callMistral).mockRejectedValue(
      new Error("Mistral API error 503: service unavailable")
    );
    await expect(classifyTheme("X")).rejects.toThrow(/Theme classification failed/);
  });

  it("MISTRAL_API_KEY missing + Anthropic throws -> explicit error, not silent null", async () => {
    vi.mocked(callAnthropic).mockRejectedValue(new Error("Anthropic API error 429"));
    vi.mocked(callMistral).mockRejectedValue(
      new Error("MISTRAL_API_KEY environment variable is not set")
    );
    await expect(classifyTheme("X")).rejects.toThrow(
      /MISTRAL_API_KEY environment variable is not set/
    );
  });
});
