import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { withValidation } from "@/lib/security/validate";
import { createPromiseSchema } from "@/lib/security/schemas";
import { getRequestMeta } from "@/lib/security/audit";
import { getPromisesForModeration } from "@/lib/data/promises";
import type { PromiseExtractionStatus, ThemeCategory } from "@/types";

export const GET = withAdminAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const result = await getPromisesForModeration({
    status: (searchParams.get("status") as PromiseExtractionStatus | null) ?? undefined,
    theme: (searchParams.get("theme") as ThemeCategory | null) ?? undefined,
    politicianSlug: searchParams.get("politicianSlug") ?? undefined,
    page: Number(searchParams.get("page") ?? 1),
    pageSize: Number(searchParams.get("pageSize") ?? 25),
  });
  return NextResponse.json(result);
});

export const POST = withAdminAuth(
  withValidation(createPromiseSchema, async (request, _ctx, data) => {
    const promise = await db.promise.create({
      data: {
        politicianId: data.politicianId,
        text: data.text,
        context: data.context,
        theme: data.theme,
        sourceKind: data.sourceKind,
        sourceUrl: data.sourceUrl,
        sourceLabel: data.sourceLabel,
        publishedAt: new Date(data.publishedAt),
        extractionStatus: "EXTRACTED",
        extractionMethod: "manual",
      },
    });

    const meta = getRequestMeta(request);
    await db.auditLog.create({
      data: {
        action: "CREATE",
        entityType: "Promise",
        entityId: promise.id,
        changes: data,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    return NextResponse.json({ promise }, { status: 201 });
  })
);
