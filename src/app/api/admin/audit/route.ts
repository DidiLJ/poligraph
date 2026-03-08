import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import type { Prisma } from "@/generated/prisma";
import { parsePagination } from "@/lib/api/pagination";

const VALID_ENTITY_TYPES = new Set([
  "Politician",
  "Affair",
  "Party",
  "Mandate",
  "FactCheck",
  "Scrutin",
  "SocialPost",
  "PressArticle",
]);
const VALID_ACTIONS = new Set(["CREATE", "UPDATE", "DELETE", "PUBLISH", "REJECT", "ARCHIVE"]);

export const GET = withAdminAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const entityTypeParam = searchParams.get("entityType");
  const entityType =
    entityTypeParam && VALID_ENTITY_TYPES.has(entityTypeParam) ? entityTypeParam : undefined;
  const actionParam = searchParams.get("action");
  const action = actionParam && VALID_ACTIONS.has(actionParam) ? actionParam : undefined;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const search = searchParams.get("search");
  const { page, limit, skip } = parsePagination(searchParams);

  const where: Prisma.AuditLogWhereInput = {};

  if (entityType) where.entityType = entityType;
  if (action) where.action = action;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  if (search) {
    where.OR = [
      { entityId: { contains: search, mode: "insensitive" } },
      { entityType: { contains: search, mode: "insensitive" } },
    ];
  }

  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    data: entries,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});
