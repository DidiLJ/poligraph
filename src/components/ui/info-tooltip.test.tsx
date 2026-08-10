import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InfoTooltip } from "./info-tooltip";
import { TooltipProvider } from "@/components/ui/tooltip";

// jsdom doesn't ship ResizeObserver; Radix positions the tooltip content with it.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

/** A tap: `pointerdown`/`pointerup` with `pointerType: "touch"`, then the mouse events
 *  the browser emulates from it — including the focus that used to open the tooltip
 *  just before the click closed it again. */
function tap(user: ReturnType<typeof userEvent.setup>, target: HTMLElement) {
  return user.pointer({ target, keys: "[TouchA]" });
}

describe("InfoTooltip", () => {
  it("should render info button with aria-label", () => {
    renderWithTooltip(<InfoTooltip text="Some help text" />);
    expect(screen.getByRole("button", { name: /aide/i })).toBeInTheDocument();
  });

  it("should render nothing when no text or term", () => {
    const { container } = renderWithTooltip(<InfoTooltip />);
    expect(container.innerHTML).toBe("");
  });

  it("should render with glossary term", () => {
    renderWithTooltip(<InfoTooltip term="sursis" />);
    expect(screen.getByRole("button", { name: /aide : sursis/i })).toBeInTheDocument();
  });

  /**
   * Mobile has no hover. The definition has to survive the tap that asked for it,
   * where it used to flash and disappear within the same gesture.
   */
  it("garde la définition affichée après une tape au doigt", async () => {
    const user = userEvent.setup();
    renderWithTooltip(<InfoTooltip text="Une définition" />);

    await tap(user, screen.getByRole("button", { name: /aide/i }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Une définition");
  });

  it("referme la définition à la tape suivante", async () => {
    const user = userEvent.setup();
    renderWithTooltip(<InfoTooltip text="Une définition" />);
    const trigger = screen.getByRole("button", { name: /aide/i });

    await tap(user, trigger);
    await screen.findByRole("tooltip");
    await tap(user, trigger);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("ouvre toujours la définition au survol de la souris", async () => {
    const user = userEvent.setup();
    renderWithTooltip(<InfoTooltip text="Une définition" />);

    await user.hover(screen.getByRole("button", { name: /aide/i }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Une définition");
  });

  it("ouvre toujours la définition au clavier", async () => {
    const user = userEvent.setup();
    renderWithTooltip(<InfoTooltip text="Une définition" />);

    await user.tab();

    expect(screen.getByRole("button", { name: /aide/i })).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Une définition");
  });
});
