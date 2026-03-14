import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { withValidation, getRequestMeta } from "@/lib/security";
import { promoteMaireSchema } from "@/lib/security/schemas/maire";
import { promoteMaire } from "@/services/admin/promote-maire";
import { db } from "@/lib/db";
import type { z } from "zod/v4";

type Body = z.infer<typeof promoteMaireSchema>;

export const POST = withAdminAuth(
  withValidation(promoteMaireSchema, async (request: NextRequest, context, body: Body) => {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

    const result = await promoteMaire(id, {
      wikidataId: body.wikidataId,
    });

    const meta = getRequestMeta(request);
    await db.auditLog.create({
      data: {
        action: "CREATE",
        entityType: "Politician",
        entityId: result.politicianId,
        changes: {
          promotedFrom: "LocalOfficial",
          localOfficialId: id,
          wikidataId: result.wikidataId,
        },
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    return NextResponse.json(result, { status: 201 });
  })
);
