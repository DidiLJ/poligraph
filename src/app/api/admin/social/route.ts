import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { SocialPostStatus } from "@/generated/prisma";

const VALID_SOCIAL_STATUSES = new Set(Object.values(SocialPostStatus));

export const GET = withAdminAuth(async (request) => {
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const status =
    statusParam && VALID_SOCIAL_STATUSES.has(statusParam as SocialPostStatus)
      ? (statusParam as SocialPostStatus)
      : undefined;

  const posts = await db.socialPost.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(posts);
});
