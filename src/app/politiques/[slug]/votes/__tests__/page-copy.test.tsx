import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findPolitician: vi.fn(),
  findVotes: vi.fn(),
  getCoverage: vi.fn(),
  getStats: vi.fn(),
  getCounts: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    politician: { findUnique: (...args: unknown[]) => mocks.findPolitician(...args) },
    vote: { findMany: (...args: unknown[]) => mocks.findVotes(...args) },
  },
}));
vi.mock("@/services/voteStats", () => ({
  getPoliticianVoteChamberCoverage: (...args: unknown[]) => mocks.getCoverage(...args),
  getPoliticianVotingStats: (...args: unknown[]) => mocks.getStats(...args),
  getPoliticianVoteTabCounts: (...args: unknown[]) => mocks.getCounts(...args),
}));
vi.mock("@/lib/seo/politician-index-signals", () => ({
  getPoliticianIndexSignals: vi.fn(async () => null),
}));
vi.mock("@/components/votes", () => ({
  VoteStats: () => null,
  VotePositionBadge: () => null,
  VotingResultBadge: () => null,
}));

import PoliticianVotesPage, { generateMetadata } from "@/app/politiques/[slug]/votes/page";

type Chamber = "AN" | "SENAT";
type Mandate = { type: string; isCurrent: boolean; role: string | null };

const cases: Array<{
  caseName: string;
  slug: string;
  chambers: Chamber[];
  mandates: Mandate[];
  totalVotes: number;
  title: string;
  descriptionChamber: string | null;
  heading: string;
  intro: string;
}> = [
  {
    caseName: "votes AN uniquement",
    slug: "camille-an",
    chambers: ["AN"],
    mandates: [{ type: "DEPUTE", isCurrent: true, role: null }],
    totalVotes: 4,
    title: "Votes de Camille Durand à l'Assemblée nationale",
    descriptionChamber: "Assemblée nationale",
    heading: "Votes de Camille Durand à l'Assemblée nationale",
    intro: "Au total, 4 votes de Camille Durand sont enregistrés à l'Assemblée nationale.",
  },
  {
    caseName: "votes Sénat uniquement",
    slug: "camille-senat",
    chambers: ["SENAT"],
    mandates: [{ type: "SENATEUR", isCurrent: true, role: null }],
    totalVotes: 4,
    title: "Votes de Camille Durand au Sénat",
    descriptionChamber: "Sénat",
    heading: "Votes de Camille Durand au Sénat",
    intro: "Au total, 4 votes de Camille Durand sont enregistrés au Sénat.",
  },
  {
    caseName: "votes AN et Sénat",
    slug: "camille-mixte",
    chambers: ["AN", "SENAT"],
    mandates: [],
    totalVotes: 4,
    title: "Votes parlementaires de Camille Durand",
    descriptionChamber: null,
    heading: "Votes parlementaires de Camille Durand",
    intro: "Au total, 4 votes de Camille Durand sont enregistrés.",
  },
  {
    caseName: "sénateur courant et ancien député avec corpus mixte",
    slug: "camille-senatrice",
    chambers: ["AN", "SENAT"],
    mandates: [
      { type: "DEPUTE", isCurrent: false, role: null },
      { type: "SENATEUR", isCurrent: true, role: null },
    ],
    totalVotes: 4,
    title: "Votes parlementaires de Camille Durand",
    descriptionChamber: null,
    heading: "Votes parlementaires de Camille Durand",
    intro: "Au total, 4 votes de Camille Durand sont enregistrés.",
  },
  {
    caseName: "député courant et ancien sénateur avec corpus mixte",
    slug: "camille-deputee",
    chambers: ["AN", "SENAT"],
    mandates: [
      { type: "SENATEUR", isCurrent: false, role: null },
      { type: "DEPUTE", isCurrent: true, role: null },
    ],
    totalVotes: 4,
    title: "Votes parlementaires de Camille Durand",
    descriptionChamber: null,
    heading: "Votes parlementaires de Camille Durand",
    intro: "Au total, 4 votes de Camille Durand sont enregistrés.",
  },
  {
    caseName: "aucun vote",
    slug: "camille-sans-vote",
    chambers: [],
    mandates: [{ type: "SENATEUR", isCurrent: true, role: null }],
    totalVotes: 0,
    title: "Votes parlementaires de Camille Durand",
    descriptionChamber: null,
    heading: "Votes parlementaires de Camille Durand",
    intro: "Aucun vote parlementaire n'est enregistré pour Camille Durand.",
  },
];

describe("/politiques/[slug]/votes copie fondée sur le corpus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findVotes.mockResolvedValue([]);
    mocks.getStats.mockResolvedValue({
      total: 0,
      pour: 0,
      contre: 0,
      abstention: 0,
      nonVotant: 0,
      eligibleScrutins: null,
      scrutinsSansVoteEnregistre: null,
      participationRate: null,
      participationStatus: "COMPUTATION_INCOMPLETE",
    });
  });

  it.each(cases)(
    "$caseName: title, description, H1 et intro restent factuels",
    async ({ slug, chambers, mandates, totalVotes, title, descriptionChamber, heading, intro }) => {
      mocks.findPolitician.mockResolvedValue({
        id: `politician-${slug}`,
        slug,
        fullName: "Camille Durand",
        firstName: "Camille",
        lastName: "Durand",
        photoUrl: null,
        civility: "Mme",
        currentParty: null,
        mandates,
      });
      mocks.getCoverage.mockResolvedValue(chambers);
      mocks.getCounts.mockResolvedValue({
        totalAll: totalVotes,
        amendmentCount: 0,
        nonAmendmentCount: totalVotes,
      });

      const props = {
        params: Promise.resolve({ slug }),
        searchParams: Promise.resolve({}),
      };
      const metadata = await generateMetadata(props);
      const view = render(await PoliticianVotesPage(props));

      expect(metadata.title).toBe(title);
      if (descriptionChamber) {
        expect(metadata.description).toContain(descriptionChamber);
      } else {
        expect(metadata.description).not.toContain("Assemblée nationale");
        expect(metadata.description).not.toContain("Sénat");
      }
      expect(view.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
      expect(view.getByText(intro)).toBeInTheDocument();
    }
  );
});
