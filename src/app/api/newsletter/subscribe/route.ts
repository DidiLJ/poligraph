import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { withPublicRoute } from "@/lib/api/with-public-route";
import { withValidation } from "@/lib/security/validate";
import { subscribeSchema } from "@/lib/security/schemas/newsletter";
import { upsertSubscriber } from "@/lib/newsletter/subscribe";

export const POST = withPublicRoute(
  withValidation(subscribeSchema, async (_req, _ctx, body) => {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    const userAgent = h.get("user-agent") ?? undefined;

    const email = body.email.toLowerCase().trim();

    const result = await upsertSubscriber({
      email,
      source: body.source,
      postalCode: body.postalCode,
      deputySlug: body.deputySlug,
      boussoleProfile: body.boussoleProfile,
      consentedAt: new Date(),
      ip,
      userAgent,
    });

    if (result.alreadyConfirmed) {
      return NextResponse.json({
        success: true,
        alreadyConfirmed: true,
        message: "Tu es déjà abonné, à dimanche !",
      });
    }

    if (result.alreadyPending) {
      return NextResponse.json({
        success: true,
        alreadyPending: true,
        message: "Vérifie ta boîte mail pour confirmer ton inscription.",
      });
    }

    try {
      const { subscribeToNewsletter, setMailjetCustomField } = await import("@/lib/email/mailjet");
      await subscribeToNewsletter(email);
      if (result.confirmationToken) {
        await setMailjetCustomField(email, "poligraph_token", result.confirmationToken);
      }
    } catch (error) {
      console.error("[Newsletter] Mailjet sync error:", error);
      return NextResponse.json(
        { error: "Impossible de traiter votre inscription. Réessayez plus tard." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      created: result.created,
      reactivated: result.reactivated,
      message: "Un email de confirmation vous a été envoyé.",
    });
  })
);

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "https://boussole.poligraph.fr",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
