import { JSDOM, type ConstructorOptions, VirtualConsole } from "jsdom";

// Third-party pages we scrape ship malformed CSS, broken inline scripts, and
// other quirks that jsdom dutifully reports as "jsdomError". They flood the
// Vercel/Sentry logs (~57 hits per 24h) without giving us anything useful, so
// we route them to a silent VirtualConsole instead of the host process.
export function createSilentJSDOM(html: string, options: ConstructorOptions = {}): JSDOM {
  const virtualConsole = options.virtualConsole ?? new VirtualConsole();
  virtualConsole.on("jsdomError", () => {});
  return new JSDOM(html, { ...options, virtualConsole });
}
