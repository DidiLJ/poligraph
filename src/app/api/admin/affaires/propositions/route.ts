import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { parsePagination } from "@/lib/api/pagination";
import {
  summarizeProposalOfficialEvidence,
  summarizeProposalSourceLink,
} from "@/lib/affairs/official-decision-verification";
import type { Prisma, ProposalStatus } from "@/generated/prisma";

// Affaires v2, lot 1: review queue for importer-proposed affair changes.

const PAGE_SIZE = 20;

const VALID_STATUSES: ProposalStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "AUTO_APPLIED",
  "CONFLICT",
];

function parseStatus(raw: string | null): ProposalStatus {
  return VALID_STATUSES.includes(raw as ProposalStatus) ? (raw as ProposalStatus) : "PENDING";
}

export const GET = withAdminAuth(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const status = parseStatus(params.get("status"));
  const importer = params.get("importer");
  const { page, skip } = parsePagination(params, {
    defaultLimit: PAGE_SIZE,
    maxLimit: PAGE_SIZE,
  });

  const where: Prisma.AffairUpdateProposalWhereInput = {
    status,
    ...(importer ? { importer } : {}),
  };

  const [rows, total, statusCounts] = await Promise.all([
    db.affairUpdateProposal.findMany({
      where,
      // riskLevel is declared LOW, MEDIUM, HIGH, so "desc" surfaces HIGH first.
      orderBy: [{ riskLevel: "desc" }, { createdAt: "desc" }],
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        importer: true,
        extractorVersion: true,
        proposedPatch: true,
        observedValues: true,
        // Read when the affair was deleted: the relation is null, the snapshot
        // is what keeps the row readable.
        affairSnapshot: true,
        source: true,
        sourceUrl: true,
        officialId: true,
        sourceContentHash: true,
        sourceExcerpt: true,
        metadata: true,
        confidence: true,
        riskLevel: true,
        rationale: true,
        status: true,
        conflictDetail: true,
        reviewedAt: true,
        reviewedBy: true,
        reviewNotes: true,
        createdAt: true,
        affair: {
          select: {
            id: true,
            title: true,
            slug: true,
            publicationStatus: true,
            politician: { select: { fullName: true, slug: true } },
          },
        },
      },
    }),
    db.affairUpdateProposal.count({ where }),
    db.affairUpdateProposal.groupBy({ by: ["status"], _count: true }),
  ]);

  return NextResponse.json({
    rows: rows.map(({ metadata, ...row }) => {
      const officialEvidence = summarizeProposalOfficialEvidence({
        source: row.source,
        sourceUrl: row.sourceUrl,
        officialId: row.officialId,
        metadata,
      });
      const sourceLink = officialEvidence.required
        ? { rawUrl: row.sourceUrl, safeUrl: null }
        : summarizeProposalSourceLink(row.sourceUrl);

      return {
        ...row,
        officialEvidence,
        sourceLink,
      };
    }),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    counts: Object.fromEntries(statusCounts.map((c) => [c.status, c._count])),
  });
});
