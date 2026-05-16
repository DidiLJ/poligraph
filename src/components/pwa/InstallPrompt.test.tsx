import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { InstallPrompt } from "./InstallPrompt";

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }),
  });
}

interface FakePromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function dispatchBeforeInstallPrompt(outcome: "accepted" | "dismissed" = "accepted") {
  const event = new Event("beforeinstallprompt") as FakePromptEvent;
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome, platform: "android" });
  Object.defineProperty(event, "preventDefault", { value: vi.fn() });
  window.dispatchEvent(event);
  return event;
}

describe("InstallPrompt", () => {
  beforeEach(() => {
    localStorage.clear();
    mockMatchMedia(true);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("incrémente le visit count au mount", () => {
    render(<InstallPrompt />);
    expect(localStorage.getItem("pwa-visit-count")).toBe("1");
    act(() => {
      render(<InstallPrompt />);
    });
    expect(localStorage.getItem("pwa-visit-count")).toBe("2");
  });

  it("n'affiche rien sans event beforeinstallprompt", () => {
    render(<InstallPrompt />);
    expect(screen.queryByRole("button", { name: /installer/i })).toBeNull();
  });

  it("affiche le banner après 3 visites + event", async () => {
    localStorage.setItem("pwa-visit-count", "2");
    render(<InstallPrompt />);
    await act(async () => {
      dispatchBeforeInstallPrompt();
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: /installer/i })).toBeInTheDocument();
  });

  it("masque le banner après clic sur Plus tard et stocke la date dismiss", async () => {
    localStorage.setItem("pwa-visit-count", "10");
    render(<InstallPrompt />);
    await act(async () => {
      dispatchBeforeInstallPrompt();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: /plus tard/i }));
    expect(screen.queryByRole("button", { name: /installer/i })).toBeNull();
    expect(Number(localStorage.getItem("pwa-prompt-dismissed-until"))).toBeGreaterThan(Date.now());
  });

  it("appelle prompt() au clic sur Installer", async () => {
    localStorage.setItem("pwa-visit-count", "10");
    render(<InstallPrompt />);
    let captured: FakePromptEvent | undefined;
    await act(async () => {
      captured = dispatchBeforeInstallPrompt();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: /installer/i }));
    expect(captured?.prompt).toHaveBeenCalled();
  });

  it("ferme le banner sur Escape", async () => {
    localStorage.setItem("pwa-visit-count", "10");
    render(<InstallPrompt />);
    await act(async () => {
      dispatchBeforeInstallPrompt();
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: /installer/i })).toBeInTheDocument();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(screen.queryByRole("button", { name: /installer/i })).toBeNull();
    expect(Number(localStorage.getItem("pwa-prompt-dismissed-until"))).toBeGreaterThan(Date.now());
  });

  it("ne s'affiche pas si pas mobile", async () => {
    mockMatchMedia(false);
    localStorage.setItem("pwa-visit-count", "10");
    render(<InstallPrompt />);
    await act(async () => {
      dispatchBeforeInstallPrompt();
      await Promise.resolve();
    });
    expect(screen.queryByRole("button", { name: /installer/i })).toBeNull();
  });
});
