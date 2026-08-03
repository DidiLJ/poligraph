import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatsTabs } from "./StatsTabs";
import { STATS_TABS, DEFAULT_STATS_TAB, statsHref, type StatsTab } from "@/config/routes";

// jsdom doesn't ship ResizeObserver; Radix's TabsList uses it via `tabs.tsx`.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

const searchParamsRef: { current: URLSearchParams } = { current: new URLSearchParams() };

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsRef.current,
}));

/** Extract the query string a `statsHref` result carries, as the router would. */
function searchParamsFrom(href: string): URLSearchParams {
  return new URLSearchParams(href.split("?")[1] ?? "");
}

function renderAt(href: string) {
  searchParamsRef.current = searchParamsFrom(href);
  return render(
    <StatsTabs
      judicialContent={<p>panneau judiciaire</p>}
      factCheckContent={<p>panneau factchecks</p>}
      legislativeContent={<p>panneau legislatif</p>}
      participationContent={<p>panneau participation</p>}
    />
  );
}

beforeEach(() => {
  searchParamsRef.current = new URLSearchParams();
});

describe("StatsTabs", () => {
  // Round-trip guard: a tab listed in config must actually be rendered by the
  // component. Dropping a `TabsContent` while leaving the tab in `STATS_TABS`
  // is what let links to a removed tab survive as silent redirects to the
  // default tab.
  it.each(STATS_TABS)("opens the %s panel for the URL statsHref builds", (tab: StatsTab) => {
    renderAt(statsHref(tab));

    expect(screen.getByText(`panneau ${tab}`)).toBeInTheDocument();
  });

  it("falls back to the default tab for an unknown tab value", () => {
    renderAt("/statistiques?tab=votes");

    expect(screen.getByText(`panneau ${DEFAULT_STATS_TAB}`)).toBeInTheDocument();
  });

  it("keeps the chamber param usable alongside the participation tab", () => {
    const href = statsHref("participation", { chamber: "AN" });
    renderAt(href);

    expect(searchParamsFrom(href).get("chamber")).toBe("AN");
    expect(screen.getByText("panneau participation")).toBeInTheDocument();
  });
});
