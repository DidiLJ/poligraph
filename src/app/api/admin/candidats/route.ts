import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { withValidation } from "@/lib/security/validate";
import { createCandidacyPresidentialFromPickerSchema } from "@/lib/security/schemas";
import { getRequestMeta } from "@/lib/security/audit";
import { getCandidates2027ForModeration } from "@/lib/data/candidates";
import { invalidateEntity } from "@/lib/cache";

export const GET = withAdminAuth(async () => {
  const items = await getCandidates2027ForModeration();
  return NextResponse.json({ items });
});

export const POST = withAdminAuth(
  withValidation(createCandidacyPresidentialFromPickerSchema, async (request, _ctx, data) => {
    const election = await db.election.findUnique({
      where: { slug: data.electionSlug },
      select: { id: true },
    });
    if (!election) {
      return NextResponse.json({ error: "Élection non trouvée" }, { status: 404 });
    }
    const politician = await db.politician.findUnique({
      where: { id: data.politicianId },
      select: { id: true, fullName: true, currentPartyId: true },
    });
    if (!politician) {
      return NextResponse.json({ error: "Politicien non trouvé" }, { status: 404 });
    }
    const existing = await db.candidacy.findFirst({
      where: { electionId: election.id, politicianId: politician.id },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "Candidature déjà enregistrée" }, { status: 409 });
    }

    const result = await db.$transaction(async (tx) => {
      const candidacy = await tx.candidacy.create({
        data: {
          electionId: election.id,
          politicianId: politician.id,
          partyId: politician.currentPartyId,
          candidateName: politician.fullName,
          status: data.status,
        },
      });
      const presidential = await tx.candidacyPresidential.create({
        data: {
          candidacyId: candidacy.id,
          slogan: data.slogan,
          accentColor: data.accentColor,
          declaredAt: data.declaredAt ? new Date(data.declaredAt) : undefined,
          withdrewAt: data.withdrewAt ? new Date(data.withdrewAt) : undefined,
          withdrewReason: data.withdrewReason,
          rank: data.rank,
          notes: data.notes,
        },
      });
      return { candidacy, presidential };
    });

    const meta = getRequestMeta(request);
    await db.auditLog.create({
      data: {
        action: "CREATE",
        entityType: "CandidacyPresidential",
        entityId: result.presidential.id,
        changes: {
          electionSlug: data.electionSlug,
          politicianId: politician.id,
          status: data.status,
        },
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    invalidateEntity("election");
    return NextResponse.json(
      { candidacy: result.candidacy, presidential: result.presidential },
      { status: 201 }
    );
  })
);
