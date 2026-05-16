import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { withValidation } from "@/lib/security/validate";
import { getRequestMeta } from "@/lib/security/audit";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import { evaluateQualification } from "@/lib/slapp/qualification";
import type { SlappCriteriaPayload } from "@/config/slapp";

const BodySchema = z.object({
  asymmetry: z.object({ met: z.boolean(), note: z.string().optional() }),
  publicInterest: z.object({ met: z.boolean(), note: z.string().optional() }),
  disproportion: z.object({ met: z.boolean(), note: z.string().optional() }),
  outcomeUnfavorable: z.object({ met: z.boolean(), note: z.string().optional() }),
  externalQualification: z.object({
    met: z.boolean(),
    note: z.string().optional(),
    source: z.string().url().optional(),
    qualifierName: z.string().optional(),
  }),
});

export const POST = withAdminAuth(
  withValidation(BodySchema, async (request, context, body) => {
    const { id } = await context.params;

    const criteria: SlappCriteriaPayload = {
      ...body,
      qualificationRule: "3of5",
    };

    const evaluation = evaluateQualification(criteria);
    if (!evaluation.qualified) {
      return NextResponse.json(
        {
          error: "Critères insuffisants pour qualifier en SLAPP",
          metCount: evaluation.metCount,
        },
        { status: 400 }
      );
    }

    criteria.qualificationRule = evaluation.rule!;

    const affair = await db.affair.update({
      where: { id },
      data: {
        isSlapp: true,
        slappCriteria: criteria,
        slappQualifiedAt: new Date(),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        isSlapp: true,
        slappQualifiedAt: true,
      },
    });

    const meta = getRequestMeta(request);
    await db.auditLog.create({
      data: {
        action: "SLAPP_TAG",
        entityType: "Affair",
        entityId: affair.id,
        changes: { isSlapp: true, qualificationRule: criteria.qualificationRule },
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    return NextResponse.json({
      affair,
      qualification: evaluation,
    });
  })
);

export const DELETE = withAdminAuth(async (request, context) => {
  const { id } = await context.params;

  const affair = await db.affair.update({
    where: { id },
    data: {
      isSlapp: false,
      slappCriteria: Prisma.JsonNull,
      slappQualifiedAt: null,
    },
    select: { id: true, slug: true },
  });

  const meta = getRequestMeta(request);
  await db.auditLog.create({
    data: {
      action: "SLAPP_UNTAG",
      entityType: "Affair",
      entityId: affair.id,
      changes: { isSlapp: false },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    },
  });

  return NextResponse.json({ affair });
});
