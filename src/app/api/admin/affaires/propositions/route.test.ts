import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  db: {
    affairUpdateProposal: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ db: h.db }));
vi.mock("@/lib/api/with-admin-auth", () => ({
  withAdminAuth: (handler: (request: NextRequest) => Promise<Response>) => handler,
}));

import { GET } from "./route";

const PRESS_URL = "https://www.lemonde.fr/politique/article-test.html";

function proposalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "proposal-1",
    importer: "press-analysis",
    extractorVersion: "v1",
    proposedPatch: { court: "Tribunal judiciaire de Paris" },
    observedValues: { court: null },
    affairSnapshot: {
      publicId: "PG000001",
      slug: "affaire-test",
      title: "Affaire test",
      politicianSlug: "personne-test",
      politicianName: "Personne Test",
    },
    source: "PRESSE",
    sourceUrl: PRESS_URL,
    officialId: null,
    sourceContentHash: null,
    sourceExcerpt: null,
    metadata: null,
    confidence: 80,
    riskLevel: "MEDIUM",
    rationale: "Article de presse soumis à la revue.",
    status: "PENDING",
    conflictDetail: null,
    reviewedAt: null,
    reviewedBy: null,
    reviewNotes: null,
    createdAt: new Date("2026-08-19T09:00:00.000Z"),
    affair: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.db.affairUpdateProposal.count.mockResolvedValue(2);
  h.db.affairUpdateProposal.groupBy.mockResolvedValue([{ status: "PENDING", _count: 2 }]);
});

describe("GET admin affair proposals source links", () => {
  it("returns a safe ordinary press link without treating it as official evidence", async () => {
    h.db.affairUpdateProposal.findMany.mockResolvedValue([proposalRow()]);

    const response = await GET(
      new NextRequest("https://poligraph.fr/api/admin/affaires/propositions?status=PENDING"),
      { params: Promise.resolve({}) }
    );
    const body = (await response.json()) as {
      rows: Array<{
        sourceLink: { rawUrl: string | null; safeUrl: string | null };
        officialEvidence: { required: boolean; canonicalUrl: string | null };
      }>;
    };

    expect(body.rows[0]).toMatchObject({
      sourceLink: { rawUrl: PRESS_URL, safeUrl: PRESS_URL },
      officialEvidence: { required: false, canonicalUrl: null },
    });
  });

  it("never returns an ordinary fallback link when decision evidence is required", async () => {
    h.db.affairUpdateProposal.findMany.mockResolvedValue([
      proposalRow({
        metadata: {
          courtDecisionCandidate: {
            canonicalUrl: "https://example.com/not-an-official-decision",
          },
        },
      }),
    ]);

    const response = await GET(
      new NextRequest("https://poligraph.fr/api/admin/affaires/propositions?status=PENDING"),
      { params: Promise.resolve({}) }
    );
    const body = (await response.json()) as {
      rows: Array<{
        sourceLink: { safeUrl: string | null };
        officialEvidence: { required: boolean; canonicalUrl: string | null };
      }>;
    };

    expect(body.rows[0]).toMatchObject({
      sourceLink: { safeUrl: null },
      officialEvidence: { required: true, canonicalUrl: null },
    });
  });
});
