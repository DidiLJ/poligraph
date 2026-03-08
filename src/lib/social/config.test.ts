import { describe, it, expect, vi, afterEach } from "vitest";
import { isSensitiveCategory, isAutoPostEnabled, SOCIAL_CATEGORIES } from "./config";

describe("social config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("marks all categories as sensitive (pending quality rework)", () => {
    for (const cat of SOCIAL_CATEGORIES) {
      expect(isSensitiveCategory(cat)).toBe(true);
    }
  });

  it("has exactly 9 categories", () => {
    expect(SOCIAL_CATEGORIES).toHaveLength(9);
  });

  it("auto-post is enabled by default", () => {
    expect(isAutoPostEnabled()).toBe(true);
  });

  it("auto-post is disabled when SOCIAL_AUTO_POST=false", () => {
    vi.stubEnv("SOCIAL_AUTO_POST", "false");
    expect(isAutoPostEnabled()).toBe(false);
  });
});
