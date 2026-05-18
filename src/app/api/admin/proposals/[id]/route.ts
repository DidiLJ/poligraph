import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { withValidation } from "@/lib/security/validate";
import { updateProposalSchema } from "@/lib/validations/platforms";
import { invalidateEntity, revalidateTags } from "@/lib/cache";
import { getRequestMeta } from "@/lib/security/audit";

// PUT: update proposal
export const PUT = withAdminAuth(
  withValidation(updateProposalSchema, async (request, context, data) => {
    const { id } = await context.params;

    const existing = await db.proposal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Proposition non trouvée" }, { status: 404 });
    }

    const proposal = await db.proposal.update({
      where: { id },
      data: {
        position: data.position ?? existing.position,
        summary: data.summary ?? existing.summary,
        sourceExcerpt:
          data.sourceExcerpt !== undefined ? data.sourceExcerpt : existing.sourceExcerpt,
        sourceUrl: data.sourceUrl !== undefined ? data.sourceUrl : existing.sourceUrl,
        aiGenerated: data.aiGenerated ?? existing.aiGenerated,
        verifiedBy: data.verifiedBy !== undefined ? data.verifiedBy : existing.verifiedBy,
      },
    });

    const meta = getRequestMeta(request);
    await db.auditLog.create({
      data: {
        action: "UPDATE",
        entityType: "Proposal",
        entityId: id!,
        changes: data,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    invalidateEntity("party");
    revalidateTags(["platforms"]);

    return NextResponse.json(proposal);
  })
);

// DELETE: delete proposal
export const DELETE = withAdminAuth(async (request, context) => {
  const { id } = await context.params;

  const existing = await db.proposal.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Proposition non trouvée" }, { status: 404 });
  }

  await db.proposal.delete({ where: { id } });

  const meta = getRequestMeta(request);
  await db.auditLog.create({
    data: {
      action: "DELETE",
      entityType: "Proposal",
      entityId: id!,
      changes: { axis: existing.axis, platformId: existing.platformId },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    },
  });

  invalidateEntity("party");
  revalidateTags(["platforms"]);

  return NextResponse.json({ success: true });
});
