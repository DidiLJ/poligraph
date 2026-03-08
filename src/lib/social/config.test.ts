import { describe, it, expect, vi, afterEach } from "vitest";
import { isSensitiveCategory, isAutoPostEnabled, SOCIAL_CATEGORIES } from "./config";

describe("social config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("has exactly 8 categories", () => {
    expect(SOCIAL_CATEGORIES).toHaveLength(8);
  });

  it("does not include consensus or presse", () => {
    expect(SOCIAL_CATEGORIES).not.toContain("consensus");
    expect(SOCIAL_CATEGORIES).not.toContain("presse");
  });

  it("includes methodo", () => {
    expect(SOCIAL_CATEGORIES).toContain("methodo");
  });

  it("marks all categories as sensitive", () => {
    for (const cat of SOCIAL_CATEGORIES) {
      expect(isSensitiveCategory(cat)).toBe(true);
    }
  });

  it("auto-post is enabled by default", () => {
    expect(isAutoPostEnabled()).toBe(true);
  });

  it("auto-post is disabled when SOCIAL_AUTO_POST=false", () => {
    vi.stubEnv("SOCIAL_AUTO_POST", "false");
    expect(isAutoPostEnabled()).toBe(false);
  });
});
