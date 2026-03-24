import { cache } from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { RelationsClient } from "./RelationsClient";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

export const revalidate = 3600; // ISR: revalidate every hour

export async function generateStaticParams() {
  const politicians = await db.politician.findMany({
    select: { slug: true },
    orderBy: { prominenceScore: "desc" },
    take: 50,
  });
  return politicians.map((p) => ({ slug: p.slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

const getPoliticianBasic = cache(async function getPoliticianBasic(slug: string) {
  return db.politician.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      fullName: true,
      photoUrl: true,
      currentParty: {
        select: { shortName: true, color: true },
      },
    },
  });
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const politician = await getPoliticianBasic(slug);

  if (!politician) {
    return { title: "Non trouvé" };
  }

  return {
    title: `Relations de ${politician.fullName} | Poligraph`,
    description: `Découvrez les relations politiques de ${politician.fullName} : gouvernement, entreprises, département, parcours partisan.`,
    alternates: { canonical: `/politiques/${slug}/relations` },
  };
}

export default async function RelationsPage({ params }: PageProps) {
  const { slug } = await params;

  const politician = await getPoliticianBasic(slug);

  if (!politician) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumb
        items={[
          { label: "Politiques", href: "/politiques" },
          { label: politician.fullName, href: `/politiques/${slug}` },
          { label: "Relations" },
        ]}
      />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-display font-extrabold tracking-tight mb-2">
          Relations de {politician.fullName}
        </h1>
        <p className="text-muted-foreground">
          Visualisez les connexions politiques : gouvernement, entreprises en commun, département,
          parcours partisan
        </p>
      </div>

      {/* Client component with graph */}
      <RelationsClient slug={slug} politicianName={politician.fullName} />
    </div>
  );
}
