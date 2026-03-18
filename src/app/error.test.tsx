import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ErrorPage from "./error";

const usePathnameMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

describe("app/error", () => {
  beforeEach(() => {
    usePathnameMock.mockReset();
  });

  it("renders the admin fallback for admin routes", () => {
    usePathnameMock.mockReturnValue("/admin/partis");

    render(
      <ErrorPage
        error={
          { name: "Error", message: "boom", digest: "digest-123" } as Error & {
            digest?: string;
          }
        }
        reset={vi.fn()}
      />
    );

    expect(
      screen.getByRole("heading", {
        name: "Cette page d'administration est momentanément indisponible",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Code : digest-123")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour au tableau de bord" })).toHaveAttribute(
      "href",
      "/admin"
    );
  });

  it("renders the public fallback for non-admin routes", () => {
    usePathnameMock.mockReturnValue("/partis");

    render(
      <ErrorPage
        error={{ name: "Error", message: "boom" } as Error & { digest?: string }}
        reset={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Une erreur est survenue" })).toBeInTheDocument();
    expect(screen.queryByText(/Code :/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour à l'accueil" })).toHaveAttribute("href", "/");
  });
});
