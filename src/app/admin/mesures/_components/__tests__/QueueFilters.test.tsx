import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MeasureQueueResult } from "../../_data/queue-query";
import { QueueFilters, type QueueFilterState } from "../QueueFilters";

const RESULT: MeasureQueueResult = {
  rows: [],
  total: 0,
  counts: { EMPTY: 0, DRAFT: 0, REVIEWED: 0, PUBLISHED: 0, DEPUBLISHED: 0 },
  anomalyCount: 0,
  withdrawnCount: 0,
  scanCapped: false,
};

const CURRENT: QueueFilterState = {
  publication: ["REVIEWED"],
  theme: ["SANTE"],
  candidacyId: undefined,
  anomaliesOnly: false,
  withdrawn: "exclude",
  q: "hôpital",
};

const CANDIDATES = [
  {
    id: "candidature-1",
    candidateName: "Alix Démonstration",
    electionTitle: "Élection présidentielle de 2027",
  },
  {
    id: "candidature-2",
    candidateName: "Camille Exemple",
    electionTitle: "Élection présidentielle de 2027",
  },
];

describe("QueueFilters", () => {
  it("propose un filtre candidat accessible et conserve les autres critères", () => {
    render(<QueueFilters current={CURRENT} result={RESULT} candidates={CANDIDATES} />);

    expect(screen.getByText("Candidat")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Camille Exemple" });
    const href = link.getAttribute("href") ?? "";

    expect(href).toContain("candidat=candidature-2");
    expect(href).toContain("etat=REVIEWED");
    expect(href).toContain("theme=SANTE");
    expect(href).toContain("retrait=exclude");
    expect(href).toContain("q=h%C3%B4pital");
  });

  it("conserve la candidature lorsqu'une recherche textuelle est soumise", () => {
    const { container } = render(
      <QueueFilters
        current={{ ...CURRENT, candidacyId: "candidature-1" }}
        result={RESULT}
        candidates={CANDIDATES}
      />
    );

    expect(container.querySelector('input[name="candidat"]')).toHaveValue("candidature-1");
    expect(screen.getByRole("link", { name: "Alix Démonstration" })).toHaveAttribute(
      "aria-current",
      "true"
    );
  });
});
