import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HUB_LEDE, HUB_LEDE_PAST, HUB_TITLE, HUB_TITLE_PAST } from "../../_content";
import { MunicipalBridge } from "../MunicipalBridge";

const NATIONAL_HERO_VARIANTS = [HUB_TITLE, HUB_TITLE_PAST, HUB_LEDE, HUB_LEDE_PAST];

describe("MunicipalBridge", () => {
  it("ne rattache aucun collège national de 2026 au conseil personnel du lecteur", () => {
    for (const copy of NATIONAL_HERO_VARIANTS) {
      expect(copy).not.toMatch(/votre (?:conseil|vote|délégué)/i);
    }
  });

  it("garde les ledes avant et après scrutin sur le même périmètre de série 2", () => {
    for (const lede of [HUB_LEDE, HUB_LEDE_PAST]) {
      expect(lede).toMatch(/178 sièges de la série 2/i);
      expect(lede).toMatch(/conseils municipaux concernés/i);
      expect(lede).not.toMatch(/départements concernés/i);
    }
  });

  it("décrit 93 469 comme l'effectif du collège, jamais comme une participation", () => {
    for (const lede of [HUB_LEDE, HUB_LEDE_PAST]) {
      expect(lede).not.toMatch(/93 469[^.]{0,120}(?:particip|vot)/i);
    }
    expect(HUB_LEDE_PAST).toMatch(/collège électoral[^.]*comptait 93 469/i);
  });

  it("explique le calendrier propre à chaque série", () => {
    render(<MunicipalBridge />);

    expect(screen.getByText(/série 2 les ont désignés le 5 juin 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/série 1, cette étape aura lieu.*2029/i)).toBeInTheDocument();
    expect(screen.getByText(/série 2 élus en 2026 siègent jusqu'en 2032/i)).toBeInTheDocument();
    expect(screen.getByText(/série 1 élus en 2029 siègent jusqu'en 2035/i)).toBeInTheDocument();
  });

  it("ne présente pas 2032 comme l'horizon de tout conseil élu en 2026", () => {
    render(<MunicipalBridge />);

    const bridge = screen.getByRole("region", { name: /des conseils municipaux au sénat/i });
    expect(bridge).not.toHaveTextContent(/un conseil municipal.*jusqu'en 2032/i);
    expect(bridge).toHaveTextContent(/2032.*série 1.*2035/i);
  });
});
