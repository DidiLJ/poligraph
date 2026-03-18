import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SectionErrorPage } from "./SectionErrorPage";

describe("SectionErrorPage", () => {
  it("renders the provided title", () => {
    render(
      <SectionErrorPage
        title="Erreur dans la section Politiciens"
        backHref="/politiques"
        backLabel="Retour aux politiciens"
        onReset={vi.fn()}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Erreur dans la section Politiciens" })
    ).toBeInTheDocument();
  });

  it("renders the back link with the expected label and href", () => {
    render(
      <SectionErrorPage
        title="Erreur"
        backHref="/affaires"
        backLabel="Retour aux affaires"
        onReset={vi.fn()}
      />
    );

    expect(screen.getByRole("link", { name: "Retour aux affaires" })).toHaveAttribute(
      "href",
      "/affaires"
    );
  });

  it("calls onReset when the retry button is clicked", () => {
    const onReset = vi.fn();

    render(
      <SectionErrorPage
        title="Erreur"
        backHref="/politiques"
        backLabel="Retour"
        onReset={onReset}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(onReset).toHaveBeenCalledOnce();
  });

  it("uses the default description when none is provided", () => {
    render(<SectionErrorPage title="Erreur" backHref="/" backLabel="Retour" onReset={vi.fn()} />);

    expect(
      screen.getByText(
        "Quelque chose s'est mal passé. Vous pouvez réessayer ou revenir à la section précédente."
      )
    ).toBeInTheDocument();
  });

  it("shows the admin digest when provided", () => {
    render(
      <SectionErrorPage
        title="Erreur administration"
        backHref="/admin"
        backLabel="Retour au tableau de bord"
        variant="admin"
        errorDigest="abc123xyz"
        onReset={vi.fn()}
      />
    );

    expect(screen.getByText("Code : abc123xyz")).toBeInTheDocument();
  });

  it("does not show the admin digest when absent", () => {
    render(
      <SectionErrorPage
        title="Erreur administration"
        backHref="/admin"
        backLabel="Retour au tableau de bord"
        variant="admin"
        onReset={vi.fn()}
      />
    );

    expect(screen.queryByText(/Code :/i)).not.toBeInTheDocument();
  });
});
