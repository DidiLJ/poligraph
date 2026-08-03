import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LegislativeSection } from "./LegislativeSection";
import type { LegislativeStatsResult, ThemeDistribution, KeyVote } from "@/services/voteStats";

const LONG_TITLE =
  "Projet de loi de financement de la sécurité sociale pour 2026, après engagement " +
  "de la procédure accordée en application de l'article 49 alinéa 3 de la Constitution";

function theme(overrides: Partial<ThemeDistribution> = {}): ThemeDistribution {
  return {
    theme: "ECONOMIE_BUDGET",
    label: "Économie et budget",
    icon: "💰",
    count: 42,
    ...overrides,
  };
}

function keyVote(overrides: Partial<KeyVote> = {}): KeyVote {
  return {
    id: "v1",
    slug: "pflss-2026",
    title: LONG_TITLE,
    votingDate: "2026-01-15",
    theme: "ECONOMIE_BUDGET",
    themeLabel: "Économie et budget",
    themeIcon: "💰",
    votesFor: 240,
    votesAgainst: 238,
    votesAbstain: 12,
    result: "ADOPTED",
    contestationScore: 0.9,
    ...overrides,
  };
}

function stats(overrides: Partial<LegislativeStatsResult> = {}): LegislativeStatsResult {
  return {
    kpi: { scrutinsAnalyses: 1234, dossiersEnDiscussion: 56, textesAdoptes: 78 },
    themesAN: [theme()],
    themesSENAT: [],
    pipeline: [],
    keyVotesAN: [keyVote()],
    keyVotesSENAT: [],
    ...overrides,
  };
}

function renderSection(result: LegislativeStatsResult = stats()) {
  return render(<LegislativeSection stats={result} dynamicsAN={[]} dynamicsSENAT={[]} />);
}

describe("LegislativeSection", () => {
  describe("internal linking", () => {
    it("links each priority theme to its votes page", () => {
      renderSection();

      const link = screen.getByRole("link", { name: /Économie et budget/ });
      expect(link).toHaveAttribute("href", "/parlement/votes/themes/economie-budget");
    });

    it("leaves a theme unlinked when its key is no longer a known category", () => {
      // Snapshot blobs can outlive a renamed category; a dead link is worse
      // than a plain bar.
      renderSection(stats({ themesAN: [theme({ theme: "THEME_SUPPRIME", label: "Obsolète" })] }));

      expect(screen.queryByRole("link", { name: /Obsolète/ })).not.toBeInTheDocument();
      // Rendered twice on purpose: the visible bar plus the sr-only data table.
      expect(screen.getAllByText(/Obsolète/)).toHaveLength(2);
    });

    it("leaves the KPI cards as plain figures, not links", () => {
      renderSection();

      expect(screen.getByText("Scrutins analysés")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /Scrutins analysés/ })).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: /Dossiers en discussion/ })
      ).not.toBeInTheDocument();
    });
  });

  describe("no truncation", () => {
    it("renders a long vote title in full, unclamped", () => {
      renderSection();

      const title = screen.getByRole("link", { name: LONG_TITLE });
      expect(title).toBeInTheDocument();
      expect(title.className).not.toMatch(/line-clamp|truncate/);
    });
  });
});
