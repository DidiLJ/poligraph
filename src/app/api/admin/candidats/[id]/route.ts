import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { withValidation } from "@/lib/security/validate";
import { updateCandidatePresidentialSchema } from "@/lib/security/schemas";
import { getRequestMeta } from "@/lib/security/audit";
import { invalidateEntity } from "@/lib/cache";

export const PATCH = withAdminAuth(
  withValidation(updateCandidatePresidentialSchema, async (request, context, body) => {
    const { id } = await context.params;
    const existing = await db.candidacyPresidential.findUnique({
      where: { id },
      select: { id: true, candidacyId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Métadonnées candidature non trouvées" }, { status: 404 });
    }
    if (Object.keys(body).length === 0) {
      return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
    }
    const updateData = {
      ...body,
      declaredAt: body.declaredAt ? new Date(body.declaredAt) : body.declaredAt,
      withdrewAt: body.withdrewAt ? new Date(body.withdrewAt) : body.withdrewAt,
    };
    const updated = await db.candidacyPresidential.update({
      where: { id: id! },
      data: updateData,
    });
    const meta = getRequestMeta(request);
    await db.auditLog.create({
      data: {
        action: "UPDATE",
        entityType: "CandidacyPresidential",
        entityId: id!,
        changes: body,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    });
    invalidateEntity("election");
    return NextResponse.json(updated);
  })
);

export const DELETE = withAdminAuth(async (request, context) => {
  const { id } = await context.params;
  const existing = await db.candidacyPresidential.findUnique({
    where: { id },
    select: { id: true, candidacyId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Métadonnées candidature non trouvées" }, { status: 404 });
  }
  await db.candidacyPresidential.delete({ where: { id: id! } });
  // NB: on ne supprime PAS la Candidacy associée. Si l'admin veut retirer
  // entièrement le candidat de l'élection, il passe par /admin/candidats UI
  // qui supprime la Candidacy elle-même (Task 4).
  const meta = getRequestMeta(request);
  await db.auditLog.create({
    data: {
      action: "DELETE",
      entityType: "CandidacyPresidential",
      entityId: id!,
      changes: {},
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    },
  });
  invalidateEntity("election");
  return NextResponse.json({ success: true });
});
