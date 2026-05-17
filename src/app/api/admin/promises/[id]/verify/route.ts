import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { getRequestMeta } from "@/lib/security/audit";

export const POST = withAdminAuth(async (request, context) => {
  const { id } = await context.params;

  const existing = await db.promise.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Promesse non trouvée" }, { status: 404 });
  }

  const updated = await db.promise.update({
    where: { id },
    data: {
      extractionStatus: "PUBLISHED",
      verifiedAt: new Date(),
      verifiedBy: "Poligraph Moderation",
    },
  });

  const { ip, userAgent } = getRequestMeta(request);
  await db.auditLog.create({
    data: {
      action: "UPDATE",
      entityType: "Promise",
      entityId: id!,
      changes: { extractionStatus: "PUBLISHED" },
      ipAddress: ip,
      userAgent,
    },
  });

  return NextResponse.json(updated);
});
