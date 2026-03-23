import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

vi.mock("next/link", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("Breadcrumb", () => {
  it("renders Accueil as first item automatically", () => {
    render(<Breadcrumb items={[{ label: "Politiques" }]} />);
    const nav = screen.getByLabelText("Fil d'Ariane");
    expect(nav).toBeDefined();
    const links = nav.querySelectorAll("a");
    expect(links[0]?.textContent).toBe("Accueil");
    expect(links[0]?.getAttribute("href")).toBe("/");
  });

  it("renders last item without link and with aria-current", () => {
    render(
      <Breadcrumb
        items={[{ label: "Politiques", href: "/politiques" }, { label: "Marine Le Pen" }]}
      />
    );
    const current = screen.getByText("Marine Le Pen");
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(current.tagName).not.toBe("A");
  });

  it("renders intermediate items as links", () => {
    render(
      <Breadcrumb
        items={[
          { label: "Politiques", href: "/politiques" },
          { label: "Marine Le Pen", href: "/politiques/marine-le-pen" },
          { label: "Votes" },
        ]}
      />
    );
    const links = screen.getByLabelText("Fil d'Ariane").querySelectorAll("a");
    // Accueil + Politiques + Marine Le Pen = 3 links
    expect(links.length).toBe(3);
    expect(links[1]?.getAttribute("href")).toBe("/politiques");
    expect(links[2]?.getAttribute("href")).toBe("/politiques/marine-le-pen");
  });

  it("renders single item as current page (listing page)", () => {
    render(<Breadcrumb items={[{ label: "Statistiques" }]} />);
    const current = screen.getByText("Statistiques");
    expect(current.getAttribute("aria-current")).toBe("page");
    const links = screen.getByLabelText("Fil d'Ariane").querySelectorAll("a");
    expect(links.length).toBe(1); // only Accueil
  });

  it("renders JSON-LD structured data", () => {
    const { container } = render(
      <Breadcrumb
        items={[{ label: "Politiques", href: "/politiques" }, { label: "Marine Le Pen" }]}
      />
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeDefined();
    const jsonLd = JSON.parse(script!.textContent!);
    expect(jsonLd["@type"]).toBe("BreadcrumbList");
    expect(jsonLd.itemListElement).toHaveLength(3); // Accueil + Politiques + Marine Le Pen
    expect(jsonLd.itemListElement[0].name).toBe("Accueil");
    expect(jsonLd.itemListElement[1].name).toBe("Politiques");
    expect(jsonLd.itemListElement[2].name).toBe("Marine Le Pen");
  });
});
