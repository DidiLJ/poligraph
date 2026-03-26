import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { withValidation } from "@/lib/security/validate";
import { updatePlatformSchema } from "@/lib/validations/platforms";
import { invalidateEntity } from "@/lib/cache";
import { getRequestMeta } from "@/lib/security/audit";

// GET: single platform with proposals
export const GET = withAdminAuth(async (_request, context) => {
  const { id } = await context.params;

  const platform = await db.platform.findUnique({
    where: { id },
    include: {
      proposals: { orderBy: { axis: "asc" } },
      party: { select: { slug: true, name: true, shortName: true } },
      election: { select: { slug: true, title: true, type: true } },
    },
  });

  if (!platform) {
    return NextResponse.json({ error: "Programme non trouvé" }, { status: 404 });
  }

  return NextResponse.json(platform);
});

// PUT: update platform
export const PUT = withAdminAuth(
  withValidation(updatePlatformSchema, async (request, context, data) => {
    const { id } = await context.params;

    const existing = await db.platform.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Programme non trouvé" }, { status: 404 });
    }

    const platform = await db.platform.update({
      where: { id },
      data: {
        sourceUrl: data.sourceUrl ?? existing.sourceUrl,
        publicationStatus: data.publicationStatus ?? existing.publicationStatus,
      },
    });

    const meta = getRequestMeta(request);
    await db.auditLog.create({
      data: {
        action: "UPDATE",
        entityType: "Platform",
        entityId: id!,
        changes: data,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    invalidateEntity("party");
    revalidateTag("platforms", "minutes");

    return NextResponse.json(platform);
  })
);

// DELETE: delete platform and its proposals
export const DELETE = withAdminAuth(async (request, context) => {
  const { id } = await context.params;

  const existing = await db.platform.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Programme non trouvé" }, { status: 404 });
  }

  await db.platform.delete({ where: { id } });

  const meta = getRequestMeta(request);
  await db.auditLog.create({
    data: {
      action: "DELETE",
      entityType: "Platform",
      entityId: id!,
      changes: { partyId: existing.partyId, electionId: existing.electionId },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    },
  });

  invalidateEntity("party");
  revalidateTag("platforms", "minutes");

  return NextResponse.json({ success: true });
});
