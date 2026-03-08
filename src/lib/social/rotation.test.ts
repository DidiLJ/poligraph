import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    socialPost: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

vi.mock("./generators", () => ({
  generateForCategory: vi.fn().mockResolvedValue(null),
}));

import { generateBatchDrafts } from "./rotation";
import { generateForCategory } from "./generators";

const mockGenerate = vi.mocked(generateForCategory);

describe("generateBatchDrafts", () => {
  it("returns empty array when no generators produce content", async () => {
    const result = await generateBatchDrafts(3);
    expect(result).toEqual([]);
  });

  it("returns drafts sorted by category priority", async () => {
    mockGenerate.mockImplementation(async (category) => {
      if (category === "affaires") return { content: "affair post", link: "https://example.com" };
      if (category === "votes") return { content: "vote post", link: "https://example.com" };
      return null;
    });

    const result = await generateBatchDrafts(3);
    expect(result).toHaveLength(2);
    expect(result[0]!.category).toBe("affaires");
    expect(result[1]!.category).toBe("votes");
  });

  it("stops at maxDrafts", async () => {
    mockGenerate.mockResolvedValue({ content: "post", link: "https://example.com" });

    const result = await generateBatchDrafts(2);
    expect(result).toHaveLength(2);
  });
});
