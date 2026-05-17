#!/usr/bin/env tsx
import { fetchCriSeance, CRI_AN_DEMO_URL } from "@/services/promises/cri-source";

async function main() {
  console.log(`Fetching CRI sample: ${CRI_AN_DEMO_URL}`);
  try {
    const interventions = await fetchCriSeance(CRI_AN_DEMO_URL);
    console.log(`Parsed ${interventions.length} interventions`);
    console.log("Sample:", interventions.slice(0, 3));
  } catch (err) {
    console.error("Demo failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main().then(() => process.exit(0));
