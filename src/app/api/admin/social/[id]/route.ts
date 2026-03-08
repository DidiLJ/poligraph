import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { withValidation } from "@/lib/security/validate";
import { z } from "zod/v4";

const editSchema = z.object({
  content: z.string().min(1).max(500).optional(),
  link: z.string().url().optional(),
});

export const PATCH = withAdminAuth(
  withValidation(editSchema, async (_request, context, body) => {
    const { id } = await context.params;

    const post = await db.socialPost.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: "Post non trouvé" }, { status: 404 });
    }
    if (post.status !== "PENDING_REVIEW") {
      return NextResponse.json(
        { error: "Seuls les posts en attente peuvent être édités" },
        { status: 400 }
      );
    }

    const updated = await db.socialPost.update({
      where: { id },
      data: {
        content: body.content ?? undefined,
        link: body.link ?? undefined,
      },
    });

    return NextResponse.json({ post: updated });
  })
);
