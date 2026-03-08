import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";

export const GET = withAdminAuth(async (request) => {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  const posts = await db.socialPost.findMany({
    where: status
      ? { status: status as "PENDING_REVIEW" | "APPROVED" | "POSTED" | "REJECTED" }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(posts);
});
