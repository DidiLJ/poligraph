import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { withValidation } from "@/lib/security/validate";
import { updatePromiseSchema } from "@/lib/security/schemas";
import { getRequestMeta } from "@/lib/security/audit";

export const PATCH = withAdminAuth(
  withValidation(updatePromiseSchema, async (request, context, body) => {
    const { id } = await context.params;

    const existing = await db.promise.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Promesse non trouvée" }, { status: 404 });
    }

    if (Object.keys(body).length === 0) {
      return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
    }

    const updated = await db.promise.update({ where: { id }, data: body });

    const { ip, userAgent } = getRequestMeta(request);
    await db.auditLog.create({
      data: {
        action: "UPDATE",
        entityType: "Promise",
        entityId: id!,
        changes: body,
        ipAddress: ip,
        userAgent,
      },
    });

    return NextResponse.json(updated);
  })
);

export const DELETE = withAdminAuth(async (request, context) => {
  const { id } = await context.params;

  const existing = await db.promise.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Promesse non trouvée" }, { status: 404 });
  }

  await db.promise.delete({ where: { id } });

  const { ip, userAgent } = getRequestMeta(request);
  await db.auditLog.create({
    data: {
      action: "DELETE",
      entityType: "Promise",
      entityId: id!,
      changes: {},
      ipAddress: ip,
      userAgent,
    },
  });

  return NextResponse.json({ success: true });
});
