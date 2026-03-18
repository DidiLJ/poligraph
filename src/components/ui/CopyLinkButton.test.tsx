import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CopyLinkButton } from "./CopyLinkButton";

describe("CopyLinkButton", () => {
  const mockWriteText = vi.fn().mockResolvedValue(undefined);
  let originalLocation: Location;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("navigator", {
      clipboard: { writeText: mockWriteText },
    });
    originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { href: "https://example.com/politiques/jean-dupont" },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    vi.useRealTimers();
    vi.unstubAllGlobals();
    mockWriteText.mockClear();
  });

  it("should render button with aria-label 'Copier le lien'", () => {
    render(<CopyLinkButton />);
    expect(screen.getByRole("button", { name: /copier le lien/i })).toBeInTheDocument();
  });

  it("should call navigator.clipboard.writeText with window.location.href on click", async () => {
    render(<CopyLinkButton />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /copier le lien/i }));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(mockWriteText).toHaveBeenCalledWith("https://example.com/politiques/jean-dupont");
  });

  it("should call clipboard.writeText with provided url prop when given", async () => {
    const customUrl = "https://poligraph.fr/politiques/marie-martin";
    render(<CopyLinkButton url={customUrl} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /copier le lien/i }));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(mockWriteText).toHaveBeenCalledWith(customUrl);
  });

  it("should change aria-label to 'Lien copié' after click", async () => {
    render(<CopyLinkButton />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /copier le lien/i }));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByRole("button", { name: /lien copié/i })).toBeInTheDocument();
  });

  it("should revert to initial aria-label after 2 seconds", async () => {
    render(<CopyLinkButton />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /copier le lien/i }));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole("button", { name: /lien copié/i })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.getByRole("button", { name: /copier le lien/i })).toBeInTheDocument();
  });

  it("should not set copied state when clipboard.writeText rejects", async () => {
    mockWriteText.mockRejectedValueOnce(new Error("Denied"));

    render(<CopyLinkButton />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /copier le lien/i }));
      await vi.advanceTimersByTimeAsync(0);
    });

    // aria-label should remain "Copier le lien" (no success state)
    expect(screen.getByRole("button", { name: /copier le lien/i })).toBeInTheDocument();
  });
});
