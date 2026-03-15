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

async function resolveEntityLabels(
  entries: Array<{ entityType: string; entityId: string }>
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  const byType = new Map<string, string[]>();

  for (const e of entries) {
    const ids = byType.get(e.entityType) || [];
    ids.push(e.entityId);
    byType.set(e.entityType, ids);
  }

  const queries: Promise<void>[] = [];

  const politicianIds = byType.get("Politician");
  if (politicianIds?.length) {
    queries.push(
      db.politician
        .findMany({
          where: { id: { in: politicianIds } },
          select: { id: true, fullName: true },
        })
        .then((rows) => rows.forEach((r) => labels.set(r.id, r.fullName)))
    );
  }

  const affairIds = byType.get("Affair");
  if (affairIds?.length) {
    queries.push(
      db.affair
        .findMany({
          where: { id: { in: affairIds } },
          select: { id: true, title: true },
        })
        .then((rows) => rows.forEach((r) => labels.set(r.id, r.title)))
    );
  }

  const partyIds = byType.get("Party");
  if (partyIds?.length) {
    queries.push(
      db.party
        .findMany({
          where: { id: { in: partyIds } },
          select: { id: true, name: true },
        })
        .then((rows) => rows.forEach((r) => labels.set(r.id, r.name)))
    );
  }

  const flagIds = byType.get("FeatureFlag");
  if (flagIds?.length) {
    queries.push(
      db.featureFlag
        .findMany({
          where: { id: { in: flagIds } },
          select: { id: true, name: true, label: true },
        })
        .then((rows) => rows.forEach((r) => labels.set(r.id, r.label || r.name)))
    );
  }

  const dossierIds = byType.get("Dossier");
  if (dossierIds?.length) {
    queries.push(
      db.legislativeDossier
        .findMany({
          where: { id: { in: dossierIds } },
          select: { id: true, title: true },
        })
        .then((rows) => rows.forEach((r) => labels.set(r.id, r.title)))
    );
  }

  const mandateIds = byType.get("Mandate");
  if (mandateIds?.length) {
    queries.push(
      db.mandate
        .findMany({
          where: { id: { in: mandateIds } },
          select: { id: true, type: true, politician: { select: { fullName: true } } },
        })
        .then((rows) =>
          rows.forEach((r) => labels.set(r.id, `${r.type} - ${r.politician.fullName}`))
        )
    );
  }

  const factCheckIds = byType.get("FactCheck");
  if (factCheckIds?.length) {
    queries.push(
      db.factCheck
        .findMany({
          where: { id: { in: factCheckIds } },
          select: { id: true, title: true },
        })
        .then((rows) => rows.forEach((r) => labels.set(r.id, r.title)))
    );
  }

  const pressIds = byType.get("PressArticle");
  if (pressIds?.length) {
    queries.push(
      db.pressArticle
        .findMany({
          where: { id: { in: pressIds } },
          select: { id: true, title: true },
        })
        .then((rows) => rows.forEach((r) => labels.set(r.id, r.title)))
    );
  }

  const socialIds = byType.get("SocialPost");
  if (socialIds?.length) {
    queries.push(
      db.socialPost
        .findMany({
          where: { id: { in: socialIds } },
          select: { id: true, content: true },
        })
        .then((rows) =>
          rows.forEach((r) =>
            labels.set(r.id, r.content.slice(0, 60) + (r.content.length > 60 ? "…" : ""))
          )
        )
    );
  }

  const scrutinIds = byType.get("Scrutin");
  if (scrutinIds?.length) {
    queries.push(
      db.scrutin
        .findMany({
          where: { id: { in: scrutinIds } },
          select: { id: true, title: true },
        })
        .then((rows) => rows.forEach((r) => labels.set(r.id, r.title)))
    );
  }

  await Promise.all(queries);
  return labels;
}

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

  const labels = await resolveEntityLabels(entries);

  const enrichedEntries = entries.map((e) => ({
    ...e,
    entityLabel: labels.get(e.entityId) || null,
  }));

  return NextResponse.json({
    data: enrichedEntries,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});
