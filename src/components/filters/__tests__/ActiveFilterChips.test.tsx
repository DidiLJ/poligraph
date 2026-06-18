import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActiveFilterChips } from "@/components/filters/ActiveFilterChips";

describe("ActiveFilterChips", () => {
  it("renders nothing when there are no filters", () => {
    const { container } = render(
      <ActiveFilterChips filters={[]} onRemove={() => {}} onClearAll={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("calls onRemove with the filter key when the × is clicked", () => {
    const onRemove = vi.fn();
    render(
      <ActiveFilterChips
        filters={[{ key: "parti", label: "RN" }]}
        onRemove={onRemove}
        onClearAll={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Retirer le filtre RN" }));
    expect(onRemove).toHaveBeenCalledWith("parti");
  });

  it("calls onClearAll when 'Tout effacer' is clicked", () => {
    const onClearAll = vi.fn();
    render(
      <ActiveFilterChips
        filters={[{ key: "parti", label: "RN" }]}
        onRemove={() => {}}
        onClearAll={onClearAll}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Tout effacer" }));
    expect(onClearAll).toHaveBeenCalled();
  });

  it("exposes an explicit aria-label on each remove button", () => {
    render(
      <ActiveFilterChips
        filters={[{ key: "certainty", label: "Établi" }]}
        onRemove={() => {}}
        onClearAll={() => {}}
      />
    );
    expect(screen.getByLabelText("Retirer le filtre Établi")).toBeInTheDocument();
  });
});
