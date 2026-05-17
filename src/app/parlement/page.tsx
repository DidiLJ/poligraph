import { Metadata } from "next";
import { ParlementHub, ScrutinsListing } from "@/components/parlement";
import { getHubStats } from "@/lib/data/scrutins";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { CollectionPageJsonLd } from "@/components/seo/JsonLd";

export const revalidate = 300;

interface PageProps {
  searchParams: Promise<{
    page?: string;
    result?: string;
    legislature?: string;
    chamber?: string;
    theme?: string;
    type?: string;
    search?: string;
  }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const hasFilters =
    params.search ||
    params.result ||
    params.legislature ||
    params.chamber ||
    params.theme ||
    params.type ||
    params.page;

  if (hasFilters) {
    const canonicalParams = new URLSearchParams();
    if (params.type) canonicalParams.set("type", params.type);
    if (params.theme) canonicalParams.set("theme", params.theme);
    if (params.legislature) canonicalParams.set("legislature", params.legislature);
    if (params.chamber) canonicalParams.set("chamber", params.chamber);
    if (params.result) canonicalParams.set("result", params.result);
    const qs = canonicalParams.toString();
    const chamberTitle =
      params.chamber === "AN"
        ? "Votes de l'Assemblée nationale"
        : params.chamber === "SENAT"
          ? "Votes du Sénat"
          : "Votes parlementaires";
    return {
      title: chamberTitle,
      description:
        "Suivez les votes de l'Assemblée nationale et du Sénat. Consultez les scrutins et découvrez comment votent vos représentants.",
      alternates: { canonical: `/parlement${qs ? `?${qs}` : ""}` },
    };
  }

  const stats = await getHubStats();
  return {
    title: "Parlement - Scrutins et travail législatif",
    description: `Suivez le travail parlementaire : ${stats.totalScrutins.toLocaleString("fr-FR")} scrutins et ${stats.totalDossiers.toLocaleString("fr-FR")} dossiers législatifs. Assemblée nationale et Sénat.`,
    alternates: { canonical: "/parlement" },
  };
}

export default async function ParlementPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const hasFilters =
    params.search ||
    params.result ||
    params.legislature ||
    params.chamber ||
    params.theme ||
    params.type ||
    params.page;

  const stats = await getHubStats();

  if (hasFilters) {
    return (
      <>
        <CollectionPageJsonLd
          name="Travail parlementaire"
          description="Suivez les scrutins et l'activité de l'Assemblée nationale et du Sénat."
          url="https://poligraph.fr/parlement"
          numberOfItems={stats.totalScrutins}
        />
        <Breadcrumb items={[{ label: "Parlement" }]} />
        <ScrutinsListing searchParams={params} />
      </>
    );
  }

  return (
    <>
      <CollectionPageJsonLd
        name="Travail parlementaire"
        description="Suivez les scrutins et l'activité de l'Assemblée nationale et du Sénat."
        url="https://poligraph.fr/parlement"
        numberOfItems={stats.totalScrutins}
      />
      <Breadcrumb items={[{ label: "Parlement" }]} />
      <ParlementHub />
    </>
  );
}
