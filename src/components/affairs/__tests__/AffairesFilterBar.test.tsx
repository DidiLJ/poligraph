import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { updateParams } = vi.hoisted(() => ({ updateParams: vi.fn() }));

vi.mock("@/hooks/useFilterParams", () => ({
  useFilterParams: () => ({
    updateParams,
    searchParams: new URLSearchParams(),
    isPending: false,
  }),
}));

import { AffairesFilterBar } from "@/components/affairs/AffairesFilterBar";

const parties = [{ slug: "rn", shortName: "RN", name: "Rassemblement National", count: 5 }];
const emptyFilters = {
  search: "",
  sort: "",
  certainty: "",
  parti: "",
  category: "",
  supercat: "",
};
const baseProps = {
  currentFilters: emptyFilters,
  parties,
  certaintyCounts: {},
  superCounts: {},
};

describe("AffairesFilterBar", () => {
  beforeEach(() => updateParams.mockClear());

  it("does not render a Parti select in the panel", () => {
    render(<AffairesFilterBar {...baseProps} />);
    expect(screen.queryByLabelText("Parti")).toBeNull();
    // The editorial axes remain
    expect(screen.getByLabelText("Catégorie d'infraction")).toBeInTheDocument();
    expect(screen.getByLabelText("Infraction précise")).toBeInTheDocument();
  });

  it("disables the Infraction select until a Famille is chosen", () => {
    render(<AffairesFilterBar {...baseProps} />);
    expect(screen.getByLabelText("Infraction précise")).toBeDisabled();
  });

  it("enables the Infraction select when a Famille is selected", () => {
    render(
      <AffairesFilterBar {...baseProps} currentFilters={{ ...emptyFilters, supercat: "PROBITE" }} />
    );
    expect(screen.getByLabelText("Infraction précise")).toBeEnabled();
  });

  it("keeps a legacy ?category= (no supercat) infraction visible and removable", () => {
    render(
      <AffairesFilterBar
        {...baseProps}
        currentFilters={{ ...emptyFilters, category: "CORRUPTION" }}
      />
    );
    // Family inferred from the category -> infraction select is usable
    expect(screen.getByLabelText("Infraction précise")).toBeEnabled();
    // The infraction chip is present and removable
    fireEvent.click(screen.getByRole("button", { name: /^Retirer le filtre/ }));
    expect(updateParams).toHaveBeenCalledWith({ category: "" }, { mode: "replace" });
  });

  it("applies the manual search only on submit, never while typing", () => {
    render(<AffairesFilterBar {...baseProps} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "dupont" } });
    expect(updateParams).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Rechercher" }));
    expect(updateParams).toHaveBeenCalledWith({ search: "dupont" }, { mode: "replace" });
  });

  it("removing the Famille chip also clears the category", () => {
    render(
      <AffairesFilterBar {...baseProps} currentFilters={{ ...emptyFilters, supercat: "PROBITE" }} />
    );
    fireEvent.click(screen.getByRole("button", { name: /^Retirer le filtre/ }));
    expect(updateParams).toHaveBeenCalledWith({ supercat: "", category: "" }, { mode: "replace" });
  });

  it("renders a removable Parti chip for a legacy ?parti= URL", () => {
    render(<AffairesFilterBar {...baseProps} currentFilters={{ ...emptyFilters, parti: "rn" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Retirer le filtre Parti : RN" }));
    expect(updateParams).toHaveBeenCalledWith({ parti: "" }, { mode: "replace" });
  });

  it("'Tout effacer' clears every filter but leaves mode untouched", () => {
    render(<AffairesFilterBar {...baseProps} currentFilters={{ ...emptyFilters, parti: "rn" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Tout effacer" }));
    expect(updateParams).toHaveBeenCalledWith(
      { search: "", supercat: "", category: "", certainty: "", parti: "", sort: "" },
      { mode: "replace" }
    );
  });

  it("shows a Tri chip when a non-default sort is active", () => {
    render(
      <AffairesFilterBar {...baseProps} currentFilters={{ ...emptyFilters, sort: "certainty" }} />
    );
    expect(screen.getByText("Tri : Par certitude")).toBeInTheDocument();
  });

  it("does not show a stale Famille chip when supercat contradicts the category", () => {
    // category CORRUPTION belongs to PROBITE; supercat=FINANCES is incoherent
    render(
      <AffairesFilterBar
        {...baseProps}
        currentFilters={{ ...emptyFilters, supercat: "FINANCES", category: "CORRUPTION" }}
      />
    );
    expect(screen.queryByText("Infractions financières")).toBeNull();
  });
});
