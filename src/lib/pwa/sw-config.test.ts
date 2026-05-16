import { describe, expect, it } from "vitest";
import { isCacheableDocument, isApiRoute, isStaticAsset, SW_CACHE_VERSION } from "./sw-config";

describe("sw-config", () => {
  describe("isCacheableDocument", () => {
    it("matche une fiche politicien", () => {
      expect(isCacheableDocument("/politiques/jean-luc-melenchon")).toBe(true);
    });

    it("matche une fiche affaire", () => {
      expect(isCacheableDocument("/affaires/affaire-PG000123")).toBe(true);
    });

    it("ne matche pas la liste politiques", () => {
      expect(isCacheableDocument("/politiques")).toBe(false);
    });

    it("ne matche pas une route admin", () => {
      expect(isCacheableDocument("/admin/politiques/123")).toBe(false);
    });

    it("ne matche pas une fiche admin affaire", () => {
      expect(isCacheableDocument("/admin/affaires/456")).toBe(false);
    });
  });

  describe("isApiRoute", () => {
    it("matche /api/*", () => {
      expect(isApiRoute("/api/v1/politicians")).toBe(true);
      expect(isApiRoute("/api/inngest")).toBe(true);
    });

    it("ne matche pas une route applicative", () => {
      expect(isApiRoute("/politiques/x")).toBe(false);
    });
  });

  describe("isStaticAsset", () => {
    it("matche /_next/static", () => {
      expect(isStaticAsset("/_next/static/chunks/main.js")).toBe(true);
    });

    it("matche les icônes", () => {
      expect(isStaticAsset("/icon-192.png")).toBe(true);
      expect(isStaticAsset("/logo.svg")).toBe(true);
    });

    it("ne matche pas un document", () => {
      expect(isStaticAsset("/politiques/test")).toBe(false);
    });
  });

  it("expose une version de cache versionnée", () => {
    expect(SW_CACHE_VERSION).toMatch(/^v\d+$/);
  });
});
