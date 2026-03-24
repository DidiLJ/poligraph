import { cache } from "react";
import { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarkdownText } from "@/components/ui/markdown";
import {
  StatusBadge,
  CategoryBadge,
  DossierTimeline,
  DossierAuthors,
} from "@/components/legislation";
import type { DossierTimelineEntry } from "@/types/legislation";
import { AMENDMENT_STATUS_LABELS, AMENDMENT_STATUS_COLORS } from "@/config/labels";
import { VotingResultBadge } from "@/components/votes";
import { ExternalLink, Calendar, FileText, Vote } from "lucide-react";
import { LegislationJsonLd } from "@/components/seo/JsonLd";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SITE_URL } from "@/config/site";
import { formatDate } from "@/lib/utils";
import type { MandateType } from "@/generated/prisma";

export const revalidate = 3600; // ISR: revalidate every hour

export async function generateStaticParams() {
  const dossiers = await db.legislativeDossier.findMany({
    select: { slug: true },
    orderBy: { filingDate: "desc" },
    take: 50,
  });
  return dossiers.map((d) => ({ slug: d.slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

const includeOptions = {
  amendments: {
    orderBy: { number: "asc" },
    take: 50,
  },
  authors: {
    select: {
      role: true,
      chamber: true,
      commission: true,
      politician: {
        select: {
          slug: true,
          fullName: true,
          photoUrl: true,
          civility: true,
          currentParty: { select: { shortName: true, color: true } },
          mandates: {
            where: {
              type: { in: ["DEPUTE", "SENATEUR"] as MandateType[] },
              parliamentaryData: { isNot: null },
            },
            orderBy: { startDate: "desc" as const },
            take: 1,
            select: {
              parliamentaryData: {
                select: {
                  parliamentaryGroup: {
                    select: { code: true, name: true, shortName: true, color: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  scrutins: {
    select: {
      slug: true,
      title: true,
      votingDate: true,
      result: true,
      votesFor: true,
      votesAgainst: true,
      votesAbstain: true,
    },
    orderBy: { votingDate: "desc" },
  },
} as const;

/**
 * Get dossier with redirect support for legacy URLs
 * Returns { dossier, redirect } where redirect is the slug to redirect to
 */
const getDossierWithRedirect = cache(async function getDossierWithRedirect(slugOrId: string) {
  // 1. Try by slug first (canonical URL - most common case)
  let dossier = await db.legislativeDossier.findUnique({
    where: { slug: slugOrId },
    include: includeOptions,
  });
  if (dossier) {
    return { dossier, redirect: null };
  }

  // 2. Try by internal ID (CUID) - legacy URL
  dossier = await db.legislativeDossier.findUnique({
    where: { id: slugOrId },
    include: includeOptions,
  });
  if (dossier) {
    return { dossier, redirect: dossier.slug };
  }

  // 3. Try by externalId (e.g., DLR5L17N12345) - legacy URL
  dossier = await db.legislativeDossier.findUnique({
    where: { externalId: slugOrId },
    include: includeOptions,
  });
  if (dossier) {
    return { dossier, redirect: dossier.slug };
  }

  // 4. Try by exact number (e.g., "PPL 3196") - legacy URL
  dossier = await db.legislativeDossier.findFirst({
    where: { number: slugOrId },
    include: includeOptions,
  });
  if (dossier) {
    return { dossier, redirect: dossier.slug };
  }

  // 5. Try by partial number match (e.g., "3196" matches "PPL 3196") - legacy URL
  // This handles cases where the chatbot extracts just the numeric part
  if (/^\d+$/.test(slugOrId)) {
    dossier = await db.legislativeDossier.findFirst({
      where: {
        number: { endsWith: slugOrId },
      },
      include: includeOptions,
    });
    if (dossier) {
      return { dossier, redirect: dossier.slug };
    }
  }

  return { dossier: null, redirect: null };
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { dossier } = await getDossierWithRedirect(slug);

  if (!dossier) {
    return { title: "Dossier non trouvé" };
  }

  return {
    title: dossier.shortTitle || dossier.title,
    description: dossier.summary || `Dossier législatif ${dossier.number || dossier.externalId}`,
    alternates: { canonical: `/parlement/dossiers/${dossier.slug}` },
  };
}

export default async function DossierDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const { dossier, redirect } = await getDossierWithRedirect(slug);

  // Redirect legacy URLs to canonical slug URL
  if (redirect && redirect !== slug) {
    permanentRedirect(`/parlement/dossiers/${redirect}`);
  }

  if (!dossier) {
    notFound();
  }

  return (
    <>
      <LegislationJsonLd
        name={dossier.shortTitle || dossier.title}
        description={dossier.summary || undefined}
        datePublished={dossier.filingDate?.toISOString().split("T")[0]}
        legislationIdentifier={dossier.number || dossier.externalId}
        url={`${SITE_URL}/parlement/dossiers/${dossier.slug || dossier.externalId}`}
      />
      <div className="container mx-auto px-4 py-8">
        <Breadcrumb
          items={[
            { label: "Parlement", href: "/parlement" },
            { label: "Dossiers législatifs", href: "/parlement/dossiers" },
            { label: dossier.shortTitle || dossier.title },
          ]}
        />

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {dossier.number && (
              <Badge variant="secondary" className="font-mono text-base">
                {dossier.number}
              </Badge>
            )}
            <StatusBadge status={dossier.status} showIcon />
            <CategoryBadge category={dossier.category} theme={dossier.theme} />
          </div>

          <h1 className="text-2xl md:text-3xl font-display font-extrabold tracking-tight mb-4">
            {dossier.shortTitle || dossier.title}
          </h1>

          {dossier.shortTitle && dossier.shortTitle !== dossier.title && (
            <p className="text-muted-foreground mb-4">{dossier.title}</p>
          )}

          {/* Dates */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {dossier.filingDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Déposé le {formatDate(dossier.filingDate)}
              </div>
            )}
            {dossier.adoptionDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Adopté le {formatDate(dossier.adoptionDate)}
              </div>
            )}
          </div>
        </div>

        {/* Authors */}
        <DossierAuthors authors={dossier.authors} />

        {/* Summary */}
        {dossier.summary && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg">En bref</CardTitle>
            </CardHeader>
            <CardContent>
              <MarkdownText className="text-foreground">{dossier.summary}</MarkdownText>
              {dossier.summaryDate && (
                <p className="text-xs text-muted-foreground mt-4">
                  Résumé généré le {formatDate(dossier.summaryDate)}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Legislative Timeline */}
        <div className="mb-8">
          <DossierTimeline
            entries={(dossier.timeline as unknown as DossierTimelineEntry[]) ?? []}
          />
        </div>

        {/* Related votes */}
        {dossier.scrutins.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Vote className="h-5 w-5" />
                Votes liés ({dossier.scrutins.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dossier.scrutins.map((scrutin) => {
                  const total = scrutin.votesFor + scrutin.votesAgainst + scrutin.votesAbstain;
                  const forPct = total > 0 ? (scrutin.votesFor / total) * 100 : 0;
                  const againstPct = total > 0 ? (scrutin.votesAgainst / total) * 100 : 0;
                  const abstainPct = total > 0 ? (scrutin.votesAbstain / total) * 100 : 0;

                  return (
                    <Link
                      key={scrutin.slug}
                      href={`/parlement/votes/${scrutin.slug}`}
                      prefetch={false}
                      className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="text-sm font-medium flex-1 min-w-0 leading-snug">
                          {scrutin.title}
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {formatDate(scrutin.votingDate)}
                          </span>
                          <VotingResultBadge result={scrutin.result} />
                        </div>
                      </div>
                      {total > 0 && (
                        <div className="flex h-2 rounded-full overflow-hidden">
                          <div className="bg-green-500" style={{ width: `${forPct}%` }} />
                          <div className="bg-red-500" style={{ width: `${againstPct}%` }} />
                          <div className="bg-yellow-500" style={{ width: `${abstainPct}%` }} />
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Amendments */}
        {dossier.amendments.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Amendements ({dossier.amendments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dossier.amendments.map((amendment) => (
                  <div
                    key={amendment.id}
                    className="flex items-start justify-between gap-4 py-3 border-b last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="font-mono">
                          N° {amendment.number}
                        </Badge>
                        <Badge className={AMENDMENT_STATUS_COLORS[amendment.status]}>
                          {AMENDMENT_STATUS_LABELS[amendment.status]}
                        </Badge>
                      </div>
                      {amendment.authorName && (
                        <p className="text-sm text-muted-foreground">
                          Par {amendment.authorName}
                          {amendment.authorType && ` (${amendment.authorType})`}
                        </p>
                      )}
                      {amendment.article && (
                        <p className="text-sm text-muted-foreground">Article {amendment.article}</p>
                      )}
                      {amendment.summary && <p className="text-sm mt-2">{amendment.summary}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* External link */}
        {dossier.sourceUrl && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium mb-1">Consulter le dossier complet</h3>
                  <p className="text-sm text-muted-foreground">
                    Retrouvez tous les détails sur le site de l&apos;Assemblée nationale
                  </p>
                </div>
                <a
                  href={dossier.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Voir sur AN.fr
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info */}
        <p className="text-xs text-muted-foreground mt-8 text-center">
          Données issues du portail Open Data de l&apos;Assemblée nationale
          (data.assemblee-nationale.fr)
        </p>
      </div>
    </>
  );
}
