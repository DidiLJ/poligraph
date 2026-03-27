import { Metadata } from "next";
import { ScrutinsListing } from "@/components/parlement";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

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
    alternates: { canonical: `/parlement/votes${qs ? `?${qs}` : ""}` },
  };
}

export default async function VotesListingPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <>
      <Breadcrumb items={[{ label: "Parlement", href: "/parlement" }, { label: "Votes" }]} />
      <ScrutinsListing searchParams={params} />
    </>
  );
}
