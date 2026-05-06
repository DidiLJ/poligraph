import { NextRequest, NextResponse } from "next/server";
import { withPublicRoute } from "@/lib/api/with-public-route";
import { db } from "@/lib/db";
import { inngest } from "@/inngest/client";

export const GET = withPublicRoute(async (request: NextRequest) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/recap?error=invalid-confirmation", url));
  }

  const subscriber = await db.subscriber.findUnique({
    where: { confirmationToken: token },
  });
  if (!subscriber) {
    return NextResponse.redirect(new URL("/recap?error=invalid-confirmation", url));
  }

  if (subscriber.status === "PENDING_CONFIRMATION") {
    await db.subscriber.update({
      where: { id: subscriber.id },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });
    await inngest.send({
      name: "subscriber/confirmed",
      data: { subscriberId: subscriber.id },
    });
  }

  return NextResponse.redirect(new URL("/recap/bienvenue", url));
});
