import { describe, expect, it, vi } from "vitest";
import { revalidateRemoteCache, resolveRevalidationBaseUrl } from "./revalidate-cache";

describe("resolveRevalidationBaseUrl", () => {
  it("privilégie NEXT_PUBLIC_BASE_URL sans doubler le protocole", () => {
    expect(
      resolveRevalidationBaseUrl({
        NEXT_PUBLIC_BASE_URL: "https://poligraph.fr/",
        VERCEL_URL: "preview.vercel.app",
      })
    ).toBe("https://poligraph.fr");
  });

  it("utilise VERCEL_URL avec HTTPS quand la base publique est absente", () => {
    expect(resolveRevalidationBaseUrl({ VERCEL_URL: "preview.vercel.app" })).toBe(
      "https://preview.vercel.app"
    );
    expect(resolveRevalidationBaseUrl({ VERCEL_URL: "https://preview.vercel.app" })).toBe(
      "https://preview.vercel.app"
    );
  });

  it("utilise localhost quand aucune URL n'est définie", () => {
    expect(resolveRevalidationBaseUrl({})).toBe("http://localhost:3000");
  });
});

describe("revalidateRemoteCache", () => {
  it("échoue explicitement sans CRON_SECRET", async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(
      revalidateRemoteCache(["votes"], {
        env: { NEXT_PUBLIC_BASE_URL: "https://poligraph.fr" },
        fetchImpl,
      })
    ).rejects.toThrow("CRON_SECRET is required");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([401, 500])("échoue sur une réponse HTTP %s", async (status) => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("revalidation refused", { status }));

    await expect(
      revalidateRemoteCache(["votes"], {
        env: {
          NEXT_PUBLIC_BASE_URL: "https://poligraph.fr",
          CRON_SECRET: "test-secret",
        },
        fetchImpl,
      })
    ).rejects.toThrow(`HTTP ${status}`);
  });

  it("envoie les tags et l'authentification puis réussit sur HTTP 200", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{"revalidated":["votes"]}', { status: 200 }));

    await expect(
      revalidateRemoteCache(["votes"], {
        env: {
          NEXT_PUBLIC_BASE_URL: "https://poligraph.fr",
          CRON_SECRET: "test-secret",
        },
        fetchImpl,
      })
    ).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(
      "https://poligraph.fr/api/cron/revalidate",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer test-secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tags: ["votes"] }),
      })
    );
  });
});
