export function trackUmami(event: string, data?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    umami?: { track: (event: string, data?: Record<string, unknown>) => void };
  };
  w.umami?.track(event, data);
}
