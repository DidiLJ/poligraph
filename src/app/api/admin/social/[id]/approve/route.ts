import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";

export const POST = withAdminAuth(async (_request, context) => {
  const { id } = await context.params;

  const post = await db.socialPost.findUnique({ where: { id } });
  if (!post) {
    return NextResponse.json({ error: "Post non trouvé" }, { status: 404 });
  }
  if (post.status !== "PENDING_REVIEW") {
    return NextResponse.json({ error: `Statut invalide : ${post.status}` }, { status: 400 });
  }

  const updated = await db.socialPost.update({
    where: { id },
    data: { status: "APPROVED" },
  });

  return NextResponse.json({ post: updated });
});
