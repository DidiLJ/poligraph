import { describe, expect, it } from "vitest";
import { shouldShowPrompt } from "./install-gate";

const NOW = new Date("2026-05-16T12:00:00Z").getTime();

describe("shouldShowPrompt", () => {
  it("refuse si déjà dismissé dans le futur", () => {
    const result = shouldShowPrompt({
      now: NOW,
      visitCount: 10,
      dismissedUntil: NOW + 24 * 3600 * 1000,
      isMobile: true,
      hasPromptEvent: true,
    });
    expect(result).toBe(false);
  });

  it("refuse si pas mobile", () => {
    expect(
      shouldShowPrompt({
        now: NOW,
        visitCount: 10,
        dismissedUntil: 0,
        isMobile: false,
        hasPromptEvent: true,
      })
    ).toBe(false);
  });

  it("refuse si moins de 3 visites", () => {
    expect(
      shouldShowPrompt({
        now: NOW,
        visitCount: 2,
        dismissedUntil: 0,
        isMobile: true,
        hasPromptEvent: true,
      })
    ).toBe(false);
  });

  it("refuse sans event beforeinstallprompt capturé", () => {
    expect(
      shouldShowPrompt({
        now: NOW,
        visitCount: 5,
        dismissedUntil: 0,
        isMobile: true,
        hasPromptEvent: false,
      })
    ).toBe(false);
  });

  it("autorise après 3 visites mobile avec event prêt", () => {
    expect(
      shouldShowPrompt({
        now: NOW,
        visitCount: 3,
        dismissedUntil: 0,
        isMobile: true,
        hasPromptEvent: true,
      })
    ).toBe(true);
  });

  it("autorise si dismissedUntil dans le passé", () => {
    expect(
      shouldShowPrompt({
        now: NOW,
        visitCount: 5,
        dismissedUntil: NOW - 1000,
        isMobile: true,
        hasPromptEvent: true,
      })
    ).toBe(true);
  });
});
