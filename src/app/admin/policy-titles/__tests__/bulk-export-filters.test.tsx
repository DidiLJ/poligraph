import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { QueueRow, QueueFilters } from "../_data/queue-query";

// Mock the server actions module so we can observe the export call without a DB.
const exportPolicyTitlesCsv = vi.fn(async (_filters: QueueFilters) => "scrutinId\n");
vi.mock("../actions", () => ({
  exportPolicyTitlesCsv: (filters: QueueFilters) => exportPolicyTitlesCsv(filters),
  batchApprove: vi.fn(),
  batchRegenerate: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

import { BulkActionsBar } from "../_components/BulkActionsBar";

function makeRow(scrutinId: string): QueueRow {
  return {
    scrutinId,
    scrutinExternalId: `EXT-${scrutinId}`,
    votingDate: new Date("2026-01-15T10:00:00Z"),
    officialTitleSnapshot: "Titre officiel",
    policyTitle: "Titre citoyen",
    proceduralLabel: "Vote solennel",
    status: "NEEDS_REVIEW",
    confidence: "LOW",
    generationSource: "MODEL",
    substanceDepth: "POLICY",
    evidenceCount: 2,
    warningCount: 0,
    hasBlocker: false,
    regenerationStatus: "NONE",
    isSubAmendment: false,
    result: "ADOPTED",
  };
}

beforeEach(() => {
  exportPolicyTitlesCsv.mockClear();
  // jsdom does not implement these; the export handler uses them to trigger a download.
  globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
  globalThis.URL.revokeObjectURL = vi.fn();
  // Stub the anchor click so jsdom does not warn about unimplemented navigation.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

describe("BulkActionsBar CSV export", () => {
  it("exports with the active on-screen filters, not a hardcoded status set", async () => {
    const filters: QueueFilters = {
      status: ["NEEDS_REVIEW"],
      confidence: ["LOW"],
      q: "marker-xyz",
    };
    render(
      <BulkActionsBar
        rows={[makeRow("S1")]}
        selectedIds={["S1"]}
        onClearSelection={() => {}}
        filters={filters}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Exporter CSV" }));

    await waitFor(() => expect(exportPolicyTitlesCsv).toHaveBeenCalledTimes(1));
    expect(exportPolicyTitlesCsv).toHaveBeenCalledWith(filters);
  });
});
