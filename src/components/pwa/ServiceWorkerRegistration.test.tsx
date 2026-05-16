import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { ServiceWorkerRegistration } from "./ServiceWorkerRegistration";

describe("ServiceWorkerRegistration", () => {
  const register = vi.fn();

  beforeEach(() => {
    register.mockReset();
    vi.stubEnv("NODE_ENV", "production");
    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: { register, ready: Promise.resolve({}) },
    });
  });

  afterEach(() => {
    // @ts-expect-error reset for next test
    delete window.navigator.serviceWorker;
    vi.unstubAllEnvs();
  });

  it("enregistre /sw.js au mount", async () => {
    register.mockResolvedValue({ scope: "/" });
    render(<ServiceWorkerRegistration />);
    await new Promise((r) => setTimeout(r, 0));
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("ne fait rien si serviceWorker absent", async () => {
    // @ts-expect-error simulate no SW support
    delete window.navigator.serviceWorker;
    render(<ServiceWorkerRegistration />);
    await new Promise((r) => setTimeout(r, 0));
    expect(register).not.toHaveBeenCalled();
  });

  it("ne plante pas si register reject", async () => {
    register.mockRejectedValue(new Error("boom"));
    expect(() => render(<ServiceWorkerRegistration />)).not.toThrow();
  });
});
