import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { themeFromSlug, getAllThemeSlugs, themeToSlug } from "@/lib/theme-utils";
import { VoteCard } from "@/components/votes";
import { ScrutinTypeTabs } from "@/components/votes/ScrutinTypeTabs";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SeoIntro } from "@/components/seo/SeoIntro";
import { THEME_CATEGORY_LABELS, THEME_CATEGORY_ICONS } from "@/config/labels";
import { formatDate } from "@/lib/utils";
import type { ScrutinType } from "@/generated/prisma";
import type { Prisma } from "@/generated/prisma";

export const revalidate = 3600;

const PAGE_SIZE = 20;

const TYPE_TAB_MAP: Record<string, { type?: ScrutinType; excludeType?: ScrutinType }> = {
  votes: { excludeType: "AMENDEMENT" },
  amendements: { type: "AMENDEMENT" },
};

export async function generateStaticParams() {
  return getAllThemeSlugs().map((theme) => ({ theme }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ theme: string }>;
  searchParams: Promise<{ type?: string }>;
}): Promise<Metadata> {
  const { theme: slug } = await params;
  const { type: typeTab } = await searchParams;
  const theme = themeFromSlug(slug);
  if (!theme) return { title: "Thème introuvable" };

  const label = THEME_CATEGORY_LABELS[theme];
  const canonical =
    typeTab && typeTab !== "votes"
      ? `/parlement/votes/themes/${slug}?type=${typeTab}`
      : `/parlement/votes/themes/${slug}`;

  return {
    title: `Votes ${label}`,
    description: `Tous les scrutins parlementaires sur le thème ${label}. Résultats des votes de l'Assemblée nationale et du Sénat.`,
    alternates: { canonical },
  };
}

export default async function ThemePage({
  params,
  searchParams,
}: {
  params: Promise<{ theme: string }>;
  searchParams: Promise<{ page?: string; type?: string }>;
}) {
  const { theme: slug } = await params;
  const { page: pageParam, type: typeTab = "votes" } = await searchParams;
  const theme = themeFromSlug(slug);
  if (!theme) notFound();

  const page = Math.max(1, parseInt(pageParam || "1", 10));
  const skip = (page - 1) * PAGE_SIZE;
  const label = THEME_CATEGORY_LABELS[theme];
  const icon = THEME_CATEGORY_ICONS[theme];

  const typeFilter = TYPE_TAB_MAP[typeTab] ?? {};
  const where: Prisma.ScrutinWhereInput = {
    theme,
    ...(typeFilter.type && { type: typeFilter.type }),
    ...(typeFilter.excludeType && { type: { not: typeFilter.excludeType } }),
  };

  const [scrutins, total, resultStats, lastScrutin, typeCounts] = await Promise.all([
    db.scrutin.findMany({
      where,
      orderBy: { votingDate: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    db.scrutin.count({ where }),
    db.scrutin.groupBy({
      by: ["result"],
      where,
      _count: true,
    }),
    db.scrutin.findFirst({
      where,
      orderBy: { votingDate: "desc" },
      select: { votingDate: true },
    }),
    db.scrutin.groupBy({
      by: ["type"],
      where: { theme },
      _count: true,
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const stats = resultStats.reduce(
    (acc, s) => {
      acc[s.result] = s._count;
      return acc;
    },
    {} as Record<string, number>
  );

  const adopted = stats.ADOPTED || 0;
  const rejected = stats.REJECTED || 0;
  const adoptedPercent = total > 0 ? Math.round((adopted / total) * 100) : 0;

  const introText = [
    `${total.toLocaleString("fr-FR")} scrutins sur le thème ${label}.`,
    total > 0 ? `${adoptedPercent}% adoptés.` : "",
    lastScrutin ? `Dernier vote : ${formatDate(lastScrutin.votingDate)}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Type tab counts
  const typeCountMap = new Map(typeCounts.map((c) => [c.type, c._count]));
  const totalAll = typeCounts.reduce((sum, c) => sum + c._count, 0);
  const amendementCount = typeCountMap.get("AMENDEMENT") ?? 0;
  const votesCount = totalAll - amendementCount;

  const buildPageUrl = (p: number, currentTypeTab: string) => {
    const base = `/parlement/votes/themes/${themeToSlug(theme)}`;
    const params = new URLSearchParams();
    if (currentTypeTab && currentTypeTab !== "votes") params.set("type", currentTypeTab);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const buildTypeUrl = (tabKey: string) => {
    const base = `/parlement/votes/themes/${themeToSlug(theme)}`;
    if (tabKey === "votes") return base;
    return `${base}?type=${tabKey}`;
  };

  const tabs = [
    { key: "votes", label: "Textes de loi", count: votesCount, href: buildTypeUrl("votes") },
    {
      key: "amendements",
      label: "Amendements",
      count: amendementCount,
      href: buildTypeUrl("amendements"),
    },
    { key: "tous", label: "Tous", count: totalAll, href: buildTypeUrl("tous") },
  ];

  return (
    <div className="container mx-auto px-4 pt-4 pb-8">
      <Breadcrumb
        items={[
          { label: "Parlement", href: "/parlement" },
          { label: "Votes", href: "/parlement/votes" },
          { label: "Thématiques", href: "/parlement/votes/themes" },
          { label },
        ]}
      />

      <h1 className="text-3xl font-display font-extrabold tracking-tight mb-2">
        {icon} {label}
      </h1>
      <SeoIntro text={introText} />

      {/* Type tabs */}
      <ScrutinTypeTabs tabs={tabs} activeKey={typeTab} />

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-muted rounded-lg p-4 text-center">
          <p className="text-2xl font-bold">{total.toLocaleString("fr-FR")}</p>
          <p className="text-sm text-muted-foreground">Scrutins</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{adopted}</p>
          <p className="text-sm text-muted-foreground">Adoptés</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{rejected}</p>
          <p className="text-sm text-muted-foreground">Rejetés</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-primary">{adoptedPercent}%</p>
          <p className="text-sm text-muted-foreground">Taux d&apos;adoption</p>
        </div>
      </div>

      {/* Adopted/Rejected bar */}
      {total > 0 && (
        <div className="mb-8">
          <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${(adopted / total) * 100}%` }}
              title={`Adoptes: ${adopted}`}
            />
            <div
              className="bg-red-500 transition-all"
              style={{ width: `${(rejected / total) * 100}%` }}
              title={`Rejetes: ${rejected}`}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span className="text-green-600">
              Adoptés : {adopted} ({adoptedPercent}%)
            </span>
            <span className="text-red-600">
              Rejetés : {rejected} ({total > 0 ? Math.round((rejected / total) * 100) : 0}%)
            </span>
          </div>
        </div>
      )}

      {/* Scrutin list */}
      <h2 className="text-lg font-semibold mb-4">Scrutins {label}</h2>
      {scrutins.length > 0 ? (
        <div className="space-y-4">
          {scrutins.map((scrutin) => (
            <VoteCard
              key={scrutin.id}
              id={scrutin.id}
              externalId={scrutin.externalId}
              slug={scrutin.slug}
              title={scrutin.title}
              votingDate={scrutin.votingDate}
              legislature={scrutin.legislature}
              chamber={scrutin.chamber}
              votesFor={scrutin.votesFor}
              votesAgainst={scrutin.votesAgainst}
              votesAbstain={scrutin.votesAbstain}
              result={scrutin.result}
              sourceUrl={scrutin.sourceUrl}
              theme={scrutin.theme}
              type={scrutin.type}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p>Aucun scrutin trouvé pour cette thématique.</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex justify-center gap-2 mt-8">
          {page > 1 && (
            <Link
              href={buildPageUrl(page - 1, typeTab)}
              className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80"
            >
              Précédent
            </Link>
          )}
          <span className="px-4 py-2 text-muted-foreground">
            Page {page} sur {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildPageUrl(page + 1, typeTab)}
              className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80"
            >
              Suivant
            </Link>
          )}
        </nav>
      )}

      {/* Back link */}
      <div className="mt-8 text-center">
        <Link href="/parlement/votes/themes" className="text-primary hover:underline text-sm">
          Voir toutes les thématiques
        </Link>
      </div>

      {/* Source */}
      <div className="mt-4 text-center text-sm text-muted-foreground">
        <p>
          Données issues de{" "}
          <a
            href="https://data.assemblee-nationale.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            data.assemblee-nationale.fr
          </a>{" "}
          et{" "}
          <a
            href="https://www.senat.fr/scrutin-public/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            senat.fr
          </a>{" "}
          (Open Data officiel)
        </p>
      </div>
    </div>
  );
}
