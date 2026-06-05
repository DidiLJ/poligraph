import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PolicyTitleEditor } from "../_components/PolicyTitleEditor";

describe("PolicyTitleEditor", () => {
  it("renders the initial title and updates the char count on typing", () => {
    render(
      <PolicyTitleEditor scrutinId="s1" initialTitle="Titre initial" initialSubtitle={null} />
    );
    const input = screen.getByLabelText("Titre public") as HTMLInputElement;
    expect(input.value).toBe("Titre initial");
    expect(screen.getByText("13 / 90")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Nouveau" } });
    expect(screen.getByText("7 / 90")).toBeInTheDocument();
  });

  it("disables Save and shows a red count when the title is over 140 chars", () => {
    const long = "a".repeat(141);
    render(<PolicyTitleEditor scrutinId="s1" initialTitle={long} initialSubtitle={null} />);
    const save = screen.getByRole("button", { name: "Enregistrer" });
    expect(save).toBeDisabled();
    const count = screen.getByText("141 / 90");
    expect(count.className).toContain("text-red-600");
  });

  it("restores the initial value when Réinitialiser au généré is clicked after an edit", () => {
    render(
      <PolicyTitleEditor scrutinId="s1" initialTitle="Titre généré" initialSubtitle="Sous-titre" />
    );
    const input = screen.getByLabelText("Titre public") as HTMLInputElement;

    // Reset link not shown until edited.
    expect(screen.queryByText("Réinitialiser au généré")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Titre modifié" } });
    expect(input.value).toBe("Titre modifié");

    fireEvent.click(screen.getByText("Réinitialiser au généré"));
    expect(input.value).toBe("Titre généré");
    expect(screen.queryByText("Réinitialiser au généré")).not.toBeInTheDocument();
  });

  it("calls onChange with the new values on every edit", () => {
    const onChange = vi.fn();
    render(
      <PolicyTitleEditor
        scrutinId="s1"
        initialTitle="Titre"
        initialSubtitle="Sous"
        onChange={onChange}
      />
    );
    const input = screen.getByLabelText("Titre public");
    fireEvent.change(input, { target: { value: "Titre X" } });
    expect(onChange).toHaveBeenLastCalledWith("Titre X", "Sous");

    const subtitle = screen.getByLabelText("Sous-titre");
    fireEvent.change(subtitle, { target: { value: "Sous Y" } });
    expect(onChange).toHaveBeenLastCalledWith("Titre X", "Sous Y");
  });
});
