import type { CountryAdapter } from "./types";
import { FrenchAdapter } from "./fr";

const adapters = new Map<string, CountryAdapter>();

/** Register a country adapter */
export function registerAdapter(adapter: CountryAdapter): void {
  adapters.set(adapter.countryCode, adapter);
}

/** Get adapter by country code. Throws if not registered. */
export function getAdapter(countryCode: string): CountryAdapter {
  const adapter = adapters.get(countryCode);
  if (!adapter) {
    throw new Error(`No adapter registered for country code: ${countryCode}`);
  }
  return adapter;
}

/** Get the default adapter (French for Poligraph) */
export function getDefaultAdapter(): CountryAdapter {
  return FrenchAdapter;
}

// Auto-register French adapter
registerAdapter(FrenchAdapter);
