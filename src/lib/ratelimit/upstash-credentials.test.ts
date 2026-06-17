import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getUpstashCredentials } from "./upstash-credentials";

const KEYS = [
  "POLIGRAPH_API_KV_REST_API_URL",
  "POLIGRAPH_API_KV_REST_API_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

describe("getUpstashCredentials", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("returns null when nothing is configured", () => {
    expect(getUpstashCredentials()).toBeNull();
  });

  it("returns null when only the URL is set (token missing)", () => {
    process.env.POLIGRAPH_API_KV_REST_API_URL = "https://int.example";
    expect(getUpstashCredentials()).toBeNull();
  });

  it("uses the manual UPSTASH_* aliases as a fallback", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://alias.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "alias-token";
    expect(getUpstashCredentials()).toEqual({
      url: "https://alias.example",
      token: "alias-token",
    });
  });

  it("prefers the POLIGRAPH_API_KV_* integration vars over the UPSTASH_* aliases", () => {
    process.env.POLIGRAPH_API_KV_REST_API_URL = "https://int.example";
    process.env.POLIGRAPH_API_KV_REST_API_TOKEN = "int-token";
    process.env.UPSTASH_REDIS_REST_URL = "https://alias.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "alias-token";
    expect(getUpstashCredentials()).toEqual({
      url: "https://int.example",
      token: "int-token",
    });
  });

  it("resolves url and token independently (per-var fallback)", () => {
    process.env.POLIGRAPH_API_KV_REST_API_URL = "https://int.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "alias-token";
    expect(getUpstashCredentials()).toEqual({
      url: "https://int.example",
      token: "alias-token",
    });
  });

  it("never reads the READ_ONLY token", () => {
    process.env.POLIGRAPH_API_KV_REST_API_READ_ONLY_TOKEN = "ro-token";
    process.env.POLIGRAPH_API_KV_REST_API_URL = "https://int.example";
    // URL present but no write token -> null (read-only must not satisfy it)
    expect(getUpstashCredentials()).toBeNull();
  });
});
