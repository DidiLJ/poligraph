import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWeeklyRecap, getWeekStart, getISOWeekNumber } from "@/lib/data/recap";
import { renderNewsletterHtml } from "@/lib/email/render-recap";
import type { PoliticianOfWeek } from "@/lib/email/render-recap";

export const revalidate = 300;

/**
 * GET /recap/newsletter — renders the weekly newsletter as a web page.
 * Used as "View in browser" link from emails.
 *
 * Query params:
 *   ?week=YYYY-MM-DD  — specific week (defaults to last week)
 *   ?format=text      — plain text version
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const weekParam = url.searchParams.get("week");
  const format = url.searchParams.get("format");

  // Determine which week to show
  const now = new Date();
  const lastMonday = getWeekStart(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  const weekStart = weekParam ? getWeekStart(new Date(weekParam + "T00:00:00Z")) : lastMonday;

  // Fetch recap data
  const recap = await getWeeklyRecap(weekStart);

  // Look for existing newsletter edition (has politician data)
  let politician: PoliticianOfWeek | null = null;
  const edition = await db.newsletterEdition.findUnique({
    where: { weekStart },
    include: {
      politician: {
        select: {
          slug: true,
          fullName: true,
          photoUrl: true,
          blobPhotoUrl: true,
          currentParty: { select: { shortName: true } },
          mandates: {
            where: { isCurrent: true },
            take: 1,
            select: { title: true },
          },
        },
      },
    },
  });

  if (edition?.politician) {
    const p = edition.politician;
    politician = {
      slug: p.slug,
      fullName: p.fullName,
      photoUrl: p.blobPhotoUrl || p.photoUrl,
      partyShortName: p.currentParty?.shortName ?? null,
      mandateTitle: p.mandates[0]?.title ?? null,
      bio: buildStaticBio(p.fullName, p.mandates[0]?.title, p.currentParty?.shortName),
    };
  }

  // Build a static editorial summary (no AI call for the web preview)
  const weekNum = getISOWeekNumber(weekStart);
  const editorialIntro = buildStaticEditorial(recap, weekNum);

  const { html, text } = renderNewsletterHtml({
    recap,
    editorialIntro,
    politician,
  });

  if (format === "text") {
    return new NextResponse(text, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// ---------------------------------------------------------------------------
// Static content builders (no AI dependency)
// ---------------------------------------------------------------------------

function buildStaticEditorial(
  recap: Awaited<ReturnType<typeof getWeeklyRecap>>,
  weekNum: number
): string {
  const parts: string[] = [];

  if (recap.votes.total > 0) {
    parts.push(
      `${recap.votes.total} scrutins ont été examinés en semaine ${weekNum}, dont ${recap.votes.adopted} adopté${recap.votes.adopted > 1 ? "s" : ""} et ${recap.votes.rejected} rejeté${recap.votes.rejected > 1 ? "s" : ""}.`
    );
  }

  if (recap.affairs.total > 0) {
    parts.push(
      `${recap.affairs.total} affaire${recap.affairs.total > 1 ? "s" : ""} judiciaire${recap.affairs.total > 1 ? "s" : ""} ${recap.affairs.total > 1 ? "ont" : "a"} été signalée${recap.affairs.total > 1 ? "s" : ""}.`
    );
  }

  if (recap.press.articleCount > 0) {
    parts.push(`${recap.press.articleCount} articles de presse ont couvert la vie politique.`);
  }

  if (parts.length === 0) {
    parts.push("Semaine calme sur la scène parlementaire.");
  }

  return parts.join(" ");
}

function buildStaticBio(
  fullName: string,
  mandateTitle: string | null | undefined,
  partyShortName: string | null | undefined
): string {
  const parts = [fullName];
  if (mandateTitle) parts.push(mandateTitle);
  if (partyShortName) parts.push(`membre du ${partyShortName}`);
  return parts.join(", ") + ".";
}
