import { afterEach, describe, it, expect, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    legislativeDossier: {
      findMany: vi.fn().mockResolvedValue([] as unknown[]),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  buildDocumentUrl,
  downloadDocumentText,
  extractExposeDesMotifs,
  syncLegislationContent,
  DOCUMENT_HOST,
} from "@/services/sync/legislation-content";
import { extractBlockText } from "@/lib/parsing/html-utils";

describe("buildDocumentUrl", () => {
  it("targets the AN open data endpoint, not the retired docparl host", () => {
    expect(buildDocumentUrl("PIONANR5L17B3110")).toBe(
      "https://www.assemblee-nationale.fr/dyn/opendata/PIONANR5L17B3110.html"
    );
    expect(DOCUMENT_HOST).not.toContain("docparl");
  });

  it("builds the same URL shape for a Senate-originated text", () => {
    expect(buildDocumentUrl("PIONSNR5S479B0937")).toBe(
      "https://www.assemblee-nationale.fr/dyn/opendata/PIONSNR5S479B0937.html"
    );
  });

  it("escapes an unexpected document id instead of forging a path", () => {
    expect(buildDocumentUrl("../../etc/passwd")).toBe(
      "https://www.assemblee-nationale.fr/dyn/opendata/..%2F..%2Fetc%2Fpasswd.html"
    );
  });
});

describe("extractExposeDesMotifs on open data HTML", () => {
  const exposeBody =
    "Mesdames, Messieurs, la présente proposition de loi vise à renforcer " +
    "l'information des citoyens sur le travail parlementaire, dans la continuité " +
    "des engagements pris devant la représentation nationale.";

  function documentHtml(body: string): string {
    return `<html><head><title>Proposition de loi</title><style>p{margin:0}</style></head>
      <body><h1>N° 3110</h1><h2>EXPOSÉ DES MOTIFS</h2><p>${body}</p>
      <h2>Article 1er</h2><p>Le code électoral est ainsi modifié.</p></body></html>`;
  }

  it("extracts the exposé section and stops at the first article", () => {
    const expose = extractExposeDesMotifs(extractBlockText(documentHtml(exposeBody)));

    expect(expose).toContain("Mesdames, Messieurs");
    expect(expose).toContain("information des citoyens");
    expect(expose).not.toContain("code électoral");
  });

  it("decodes entities coming from the HTML source", () => {
    const html = documentHtml("L&rsquo;acc&egrave;s aux d&eacute;bats " + exposeBody);

    expect(extractExposeDesMotifs(extractBlockText(html))).toContain("L'accès aux débats");
  });

  it("keeps paragraph breaks so the stored text stays readable", () => {
    const html = `<h2>EXPOSÉ DES MOTIFS</h2><p>${exposeBody}</p><p>${exposeBody}</p>`;

    expect(extractExposeDesMotifs(extractBlockText(html))).toContain("\n");
  });

  it("falls back to the head of the document when no section is found", () => {
    const text = extractBlockText(`<p>${"Texte sans section identifiable. ".repeat(10)}</p>`);

    expect(extractExposeDesMotifs(text)).toMatch(/^Texte sans section identifiable\./);
  });

  it("returns null on a document too short to carry anything useful", () => {
    expect(extractExposeDesMotifs(extractBlockText("<p>Vide</p>"))).toBeNull();
  });

  it("ignores an exposé heading followed by no content", () => {
    expect(extractExposeDesMotifs("EXPOSÉ DES MOTIFS\nArticle 1er")).toBeNull();
  });
});

describe("downloadDocumentText", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the document text on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<p>Mesdames,</p><p>Messieurs,</p>", { status: 200 })
    );

    await expect(downloadDocumentText("PIONANR5L17B3110")).resolves.toBe("Mesdames,\nMessieurs,");
  });

  it("returns null when the AN never published the text", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 404, statusText: "Not Found" })
    );

    await expect(downloadDocumentText("PIONANR5L17B9999")).resolves.toBeNull();
  });
});

describe("syncLegislationContent when the source host is gone", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    dbMock.legislativeDossier.findMany.mockResolvedValue([]);
    dbMock.legislativeDossier.update.mockReset();
  });

  it("stops after the first dossier instead of repeating the same DNS error", async () => {
    const dossiers = ["DLR5L17N54818", "DLR5L17N54819", "DLR5L17N54817"].map((externalId, i) => ({
      id: `id-${i}`,
      externalId,
      documentExternalId: `PIONANR5L17B31${i}`,
      title: externalId,
    }));
    dbMock.legislativeDossier.findMany.mockResolvedValue(dossiers);

    const cause = Object.assign(new Error("getaddrinfo ENOTFOUND gone.example.fr"), {
      code: "ENOTFOUND",
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("fetch failed", { cause }));
    vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await syncLegislationContent();

    // One dossier attempted, one request (no retry on a name that does not resolve).
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.processed).toBe(1);
    expect(result.downloaded).toBe(0);
    expect(dbMock.legislativeDossier.update).not.toHaveBeenCalled();
    expect(result.errors).toEqual([
      "DLR5L17N54818: fetch failed <- getaddrinfo ENOTFOUND gone.example.fr [ENOTFOUND] " +
        `(${buildDocumentUrl("PIONANR5L17B310")}) ` +
        "<- fetch failed <- getaddrinfo ENOTFOUND gone.example.fr [ENOTFOUND]",
      `Aborting: ${DOCUMENT_HOST} does not resolve, 2 dossiers left unprocessed`,
    ]);
  });
});

describe("syncLegislationContent when every document is missing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    dbMock.legislativeDossier.findMany.mockResolvedValue([]);
    dbMock.legislativeDossier.update.mockReset();
  });

  it("reports a whole batch of 404s as a broken URL scheme", async () => {
    dbMock.legislativeDossier.findMany.mockResolvedValue(
      Array.from({ length: 6 }, (_, i) => ({
        id: `id-${i}`,
        externalId: `DLR5L17N5480${i}`,
        documentExternalId: `PIONANR5L17B310${i}`,
        title: `Dossier ${i}`,
      }))
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 404, statusText: "Not Found" })
    );
    vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await syncLegislationContent();

    expect(result.notFound).toBe(6);
    expect(result.errors).toEqual([
      `All 6 documents answered 404 on ${DOCUMENT_HOST}: the open data URL scheme has most likely changed`,
    ]);
  });

  it("stays silent when a single document is missing among successful ones", async () => {
    dbMock.legislativeDossier.findMany.mockResolvedValue([
      {
        id: "id-0",
        externalId: "DLR5L17N54800",
        documentExternalId: "PIONANR5L17B3100",
        title: "Dossier",
      },
    ]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 404, statusText: "Not Found" })
    );
    vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await syncLegislationContent();

    expect(result.notFound).toBe(1);
    expect(result.errors).toEqual([]);
  });
});
