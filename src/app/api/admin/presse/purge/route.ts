import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { getRequestMeta } from "@/lib/security/audit";

export const POST = withAdminAuth(async (request) => {
  const { ip, userAgent } = getRequestMeta(request);

  // Safety buffer: 1 hour to avoid race with ongoing analysis
  const safetyThreshold = new Date(Date.now() - 60 * 60 * 1000);

  // Count eligible articles first
  const eligibleCount = await db.pressArticle.count({
    where: {
      aiAnalyzedAt: { not: null, lt: safetyThreshold },
      mentions: { none: {} },
      partyMentions: { none: {} },
    },
  });

  if (eligibleCount === 0) {
    return NextResponse.json({ deleted: 0, message: "Aucun article à purger" });
  }

  // Delete in batches of 500
  let totalDeleted = 0;
  const BATCH_SIZE = 500;

  while (totalDeleted < eligibleCount) {
    const batch = await db.pressArticle.findMany({
      where: {
        aiAnalyzedAt: { not: null, lt: safetyThreshold },
        mentions: { none: {} },
        partyMentions: { none: {} },
      },
      select: { id: true },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    const ids = batch.map((a) => a.id);
    const { count } = await db.pressArticle.deleteMany({
      where: { id: { in: ids } },
    });

    totalDeleted += count;
  }

  // Audit log
  await db.auditLog.create({
    data: {
      action: "DELETE",
      entityType: "PressArticle",
      entityId: "bulk-purge",
      changes: { purged: totalDeleted, criteria: "analyzed-without-mentions" },
      ipAddress: ip,
      userAgent,
    },
  });

  return NextResponse.json({
    deleted: totalDeleted,
    message: `${totalDeleted} article${totalDeleted > 1 ? "s" : ""} supprimé${totalDeleted > 1 ? "s" : ""}`,
  });
});
