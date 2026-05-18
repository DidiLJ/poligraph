import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { withValidation } from "@/lib/security/validate";
import { createProposalSchema } from "@/lib/validations/platforms";
import { invalidateEntity, revalidateTags } from "@/lib/cache";
import { getRequestMeta } from "@/lib/security/audit";

// GET: list proposals for a platform
export const GET = withAdminAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const platformId = searchParams.get("platformId");

  if (!platformId) {
    return NextResponse.json({ error: "platformId requis" }, { status: 400 });
  }

  const proposals = await db.proposal.findMany({
    where: { platformId },
    orderBy: { axis: "asc" },
  });

  return NextResponse.json(proposals);
});

// POST: create a proposal
export const POST = withAdminAuth(
  withValidation(createProposalSchema, async (request, _context, data) => {
    const proposal = await db.proposal.create({
      data: {
        platformId: data.platformId,
        axis: data.axis,
        position: data.position,
        summary: data.summary,
        sourceExcerpt: data.sourceExcerpt ?? null,
        sourceUrl: data.sourceUrl ?? null,
        aiGenerated: data.aiGenerated ?? false,
        verifiedBy: data.verifiedBy ?? null,
      },
    });

    const meta = getRequestMeta(request);
    await db.auditLog.create({
      data: {
        action: "CREATE",
        entityType: "Proposal",
        entityId: proposal.id,
        changes: { axis: data.axis, platformId: data.platformId },
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    invalidateEntity("party");
    revalidateTags(["platforms"]);

    return NextResponse.json(proposal, { status: 201 });
  })
);
