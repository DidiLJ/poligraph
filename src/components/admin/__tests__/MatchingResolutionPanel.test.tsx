import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MatchingResolutionPanel } from "@/components/admin/MatchingResolutionPanel";
import type { BlockingDecision } from "@/lib/affairs/blocking-decisions";

/**
 * Le panneau de résolution vit à deux endroits (fiche affaire et page modifier), donc il
 * est extrait. Ce qui compte : il rend l'extrait à juger, propose « Oui / Non » au nom du
 * politicien, et signale la fin une fois la dernière décision tranchée.
 */
const DECISION: BlockingDecision = {
  id: "dec_1",
  judgment: "SAME",
  provenance: "ASSISTED",
  reviewedBy: "auto-triage",
  source: "Le Monde",
  sourceRef: "https://lemonde.fr/a",
  excerpt: "Christian Estrosi a été renvoyé devant le tribunal.",
  candidates: [
    {
      politicianId: "pol_1",
      fullName: "Christian Estrosi",
      score: 5.2,
      supporting: ["nom exact"],
      opposing: [],
    },
  ],
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("MatchingResolutionPanel", () => {
  it("rend l'extrait et un bouton de validation au nom du politicien", () => {
    render(
      <MatchingResolutionPanel
        politicianId="pol_1"
        politicianName="Christian Estrosi"
        decisions={[DECISION]}
      />
    );
    expect(screen.getByText(/renvoyé devant le tribunal/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Oui, c'est Christian Estrosi/ })
    ).toBeInTheDocument();
  });

  it("confirme via /confirm et signale la fin quand la dernière décision est tranchée", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const onAllResolved = vi.fn();

    render(
      <MatchingResolutionPanel
        politicianId="pol_1"
        politicianName="Christian Estrosi"
        decisions={[DECISION]}
        onAllResolved={onAllResolved}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Oui, c'est Christian Estrosi/ }));

    await waitFor(() => expect(onAllResolved).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/affair-matching/confirm",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ decisionId: "dec_1", chosenPoliticianId: "pol_1" }),
      })
    );
  });

  it("ne signale pas la fin s'il reste une décision à trancher", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const onAllResolved = vi.fn();
    const second: BlockingDecision = { ...DECISION, id: "dec_2" };

    render(
      <MatchingResolutionPanel
        politicianId="pol_1"
        politicianName="Christian Estrosi"
        decisions={[DECISION, second]}
        onAllResolved={onAllResolved}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Oui, c'est Christian Estrosi/ })[0]!);

    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /Oui, c'est Christian Estrosi/ })).toHaveLength(
        1
      )
    );
    expect(onAllResolved).not.toHaveBeenCalled();
  });
});
