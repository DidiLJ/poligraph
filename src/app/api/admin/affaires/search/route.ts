import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { db } from "@/lib/db";

export const GET = withAdminAuth(async (request: NextRequest) => {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").slice(0, 100);
  const excludeId = url.searchParams.get("excludeId") || undefined;
  const id = url.searchParams.get("id") || undefined;

  if (id) {
    const affair = await db.affair.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        slug: true,
        involvement: true,
        linkedAffairId: true,
        politician: { select: { id: true, fullName: true, slug: true } },
      },
    });
    return NextResponse.json({ results: affair ? [affair] : [] });
  }

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const affairs = await db.affair.findMany({
    where: {
      title: { contains: q, mode: "insensitive" },
      ...(excludeId && { id: { not: excludeId } }),
    },
    select: {
      id: true,
      title: true,
      slug: true,
      involvement: true,
      linkedAffairId: true,
      politician: { select: { id: true, fullName: true, slug: true } },
    },
    take: 10,
    orderBy: { title: "asc" },
  });

  return NextResponse.json({ results: affairs });
});
