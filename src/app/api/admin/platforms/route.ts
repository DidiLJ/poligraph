import { NextResponse } from "next/server";
import { updateTag } from "next/cache";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { withValidation } from "@/lib/security/validate";
import { createPlatformSchema } from "@/lib/validations/platforms";
import { invalidateEntity } from "@/lib/cache";
import { getRequestMeta } from "@/lib/security/audit";

// GET: list all platforms (admin)
export const GET = withAdminAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const electionId = searchParams.get("electionId");
  const partyId = searchParams.get("partyId");

  const where: Record<string, string> = {};
  if (electionId) where.electionId = electionId;
  if (partyId) where.partyId = partyId;

  const platforms = await db.platform.findMany({
    where,
    include: {
      party: { select: { slug: true, name: true, shortName: true } },
      election: { select: { slug: true, title: true, type: true } },
      _count: { select: { proposals: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(platforms);
});

// POST: create a platform
export const POST = withAdminAuth(
  withValidation(createPlatformSchema, async (request, _context, data) => {
    // Validate that exactly one of partyId or electoralListId is set
    if ((!data.partyId && !data.electoralListId) || (data.partyId && data.electoralListId)) {
      return NextResponse.json(
        { error: "Exactement un de partyId ou electoralListId doit être renseigné" },
        { status: 400 }
      );
    }

    const platform = await db.platform.create({
      data: {
        partyId: data.partyId,
        electoralListId: data.electoralListId,
        electionId: data.electionId,
        sourceUrl: data.sourceUrl ?? null,
        publicationStatus: data.publicationStatus || "DRAFT",
      },
    });

    const meta = getRequestMeta(request);
    await db.auditLog.create({
      data: {
        action: "CREATE",
        entityType: "Platform",
        entityId: platform.id,
        changes: { partyId: data.partyId, electionId: data.electionId },
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    invalidateEntity("party");
    updateTag("platforms");

    return NextResponse.json(platform, { status: 201 });
  })
);
