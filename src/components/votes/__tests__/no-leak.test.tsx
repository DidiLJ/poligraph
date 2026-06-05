import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VoteCard } from "@/components/votes/VoteCard";
import { KeyVoteCard } from "@/components/votes/KeyVoteCard";
import { HeroSpotlight } from "@/components/votes/HeroSpotlight";
import type { PolicyForView } from "@/lib/votes/to-public-title-view";
import type { PolicyTitleStatus } from "@/generated/prisma";

const OFFICIAL = "Titre officiel du scrutin numero 1";
const LEAK = "FUITE titre non approuve qui ne doit jamais apparaitre";
const APPROVED_TITLE = "Augmenter le budget de l'education nationale";

function policyOf(status: PolicyTitleStatus, title: string | null): PolicyForView {
  return {
    status,
    policyTitle: title,
    policySubtitle: null,
    officialSourceUrl: null,
    proceduralLabel: "Vote solennel",
  };
}

function renderCard(name: string, policy: PolicyForView | null) {
  if (name === "VoteCard") {
    return render(
      <VoteCard
        id="s1"
        externalId="VTANR5L17V1"
        slug="scrutin-1"
        title={OFFICIAL}
        votingDate={new Date("2026-01-15T10:00:00Z")}
        legislature={17}
        chamber="AN"
        votesFor={100}
        votesAgainst={50}
        votesAbstain={10}
        result="ADOPTED"
        sourceUrl={null}
        theme={null}
        type={null}
        policy={policy}
      />
    );
  }
  if (name === "KeyVoteCard") {
    return render(
      <KeyVoteCard
        id="s1"
        slug="scrutin-1"
        title={OFFICIAL}
        votingDate={new Date("2026-01-15T10:00:00Z")}
        votesFor={100}
        votesAgainst={50}
        votesAbstain={10}
        result="ADOPTED"
        theme={null}
        summary={null}
        citizenImpact={null}
        policy={policy}
      />
    );
  }
  return render(
    <HeroSpotlight
      id="s1"
      slug="scrutin-1"
      title={OFFICIAL}
      votingDate={new Date("2026-01-15T10:00:00Z")}
      votesFor={100}
      votesAgainst={50}
      votesAbstain={10}
      result="ADOPTED"
      theme={null}
      summary={null}
      citizenImpact={null}
      policy={policy}
    />
  );
}

const SURFACES = ["VoteCard", "KeyVoteCard", "HeroSpotlight"] as const;
const NON_DISPLAYABLE: PolicyTitleStatus[] = ["DRAFT", "NEEDS_REVIEW", "REJECTED", "STALE"];

describe("public no-leak: vote title cards", () => {
  for (const surface of SURFACES) {
    describe(surface, () => {
      it.each(NON_DISPLAYABLE)("%s + valid title → official only, no leak, no badge", (status) => {
        const { container, unmount } = renderCard(surface, policyOf(status, LEAK));
        expect(screen.getByText(new RegExp(OFFICIAL))).toBeTruthy();
        expect(container.textContent).not.toContain(LEAK);
        expect(screen.queryByText(/Titre explicatif/i)).toBeNull();
        unmount();
      });

      it("APPROVED + null/empty title → official only", () => {
        const { unmount } = renderCard(surface, policyOf("APPROVED", "   "));
        expect(screen.getByText(new RegExp(OFFICIAL))).toBeTruthy();
        expect(screen.queryByText(/Titre explicatif/i)).toBeNull();
        unmount();
        const r2 = renderCard(surface, policyOf("APPROVED", null));
        expect(screen.getByText(new RegExp(OFFICIAL))).toBeTruthy();
        r2.unmount();
      });

      it("no policy row → official only", () => {
        const { unmount } = renderCard(surface, null);
        expect(screen.getByText(new RegExp(OFFICIAL))).toBeTruthy();
        expect(screen.queryByText(/Titre explicatif/i)).toBeNull();
        unmount();
      });

      it("APPROVED + valid title → policy title shown + badge (the only policy case)", () => {
        const { container, unmount } = renderCard(surface, policyOf("APPROVED", APPROVED_TITLE));
        expect(screen.getByText(new RegExp(APPROVED_TITLE))).toBeTruthy();
        expect(screen.getByText(/Titre explicatif/i)).toBeTruthy();
        expect(container.textContent).not.toContain(OFFICIAL);
        unmount();
      });
    });
  }
});
