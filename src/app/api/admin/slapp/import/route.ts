import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { withAdminAuth } from "@/lib/api/with-admin-auth";
import { withValidation } from "@/lib/security/validate";
import { getRequestMeta } from "@/lib/security/audit";
import { db } from "@/lib/db";
import { parseCaseImport, CaseImportSchema } from "@/lib/slapp/import";
import { generateAffairSlug } from "@/lib/utils";

const BodySchema = z.object({
  cases: z.array(CaseImportSchema).min(1).max(100),
  dryRun: z.boolean().default(false),
});

type ImportResult = {
  caseReference?: string;
  affairTitle: string;
  status: "qualified" | "rejected" | "no_match";
  reason?: string;
  affairId?: string;
};

export const POST = withAdminAuth(
  withValidation(BodySchema, async (request, _context, body) => {
    const meta = getRequestMeta(request);
    const results: ImportResult[] = [];

    for (const caseInput of body.cases) {
      const parsed = parseCaseImport(caseInput);
      if (!parsed.success) {
        results.push({
          caseReference: caseInput.caseReference,
          affairTitle: caseInput.affairTitle,
          status: "rejected",
          reason: parsed.error,
        });
        continue;
      }

      const politician = await db.politician.findFirst({
        where: { slug: parsed.data.politicianSlug },
        select: { id: true, slug: true },
      });

      if (!politician) {
        results.push({
          caseReference: parsed.data.caseReference,
          affairTitle: parsed.data.affairTitle,
          status: "no_match",
          reason: `Politicien non trouvé pour slug: ${parsed.data.politicianSlug}`,
        });
        continue;
      }

      try {
        const existing = await db.affair.findFirst({
          where: {
            politicianId: politician.id,
            title: parsed.data.affairTitle,
          },
          select: { id: true },
        });

        if (body.dryRun) {
          results.push({
            caseReference: parsed.data.caseReference,
            affairTitle: parsed.data.affairTitle,
            status: "qualified",
            reason: existing ? "Existant (sera mis à jour)" : "Nouveau (sera créé)",
            affairId: existing?.id,
          });
          continue;
        }

        const affair = existing
          ? await db.affair.update({
              where: { id: existing.id },
              data: {
                isSlapp: true,
                slappCriteria: parsed.data.criteria,
                slappQualifiedAt: new Date(),
              },
              select: { id: true },
            })
          : await db.affair.create({
              data: {
                politicianId: politician.id,
                title: parsed.data.affairTitle,
                slug: generateAffairSlug(politician.slug, parsed.data.affairTitle),
                description: `Affaire importée depuis CASE Coalition${
                  parsed.data.caseReference ? ` (réf: ${parsed.data.caseReference})` : ""
                }. À enrichir éditorialement.`,
                status: "PROCES_EN_COURS",
                category: "DIFFAMATION",
                involvement: "MENTIONED_ONLY",
                publicationStatus: "DRAFT",
                isSlapp: true,
                slappCriteria: parsed.data.criteria,
                slappQualifiedAt: new Date(),
              },
              select: { id: true },
            });

        await db.auditLog.create({
          data: {
            action: existing ? "SLAPP_IMPORT_UPDATE" : "SLAPP_IMPORT_CREATE",
            entityType: "Affair",
            entityId: affair.id,
            changes: { caseReference: parsed.data.caseReference },
            ipAddress: meta.ip,
            userAgent: meta.userAgent,
          },
        });

        results.push({
          caseReference: parsed.data.caseReference,
          affairTitle: parsed.data.affairTitle,
          status: "qualified",
          affairId: affair.id,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({
          caseReference: parsed.data.caseReference,
          affairTitle: parsed.data.affairTitle,
          status: "rejected",
          reason: `Erreur DB lors du traitement : ${message}`,
        });
      }
    }

    return NextResponse.json({
      processed: body.cases.length,
      qualified: results.filter((r) => r.status === "qualified").length,
      rejected: results.filter((r) => r.status === "rejected").length,
      noMatch: results.filter((r) => r.status === "no_match").length,
      dryRun: body.dryRun,
      results,
    });
  })
);
