#!/usr/bin/env tsx
import { ingestPromisesFromPress } from "@/services/promises/press-source";

async function main() {
  const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 10);
  const dryRun = process.argv.includes("--dry-run");

  console.log(`Ingestion promesses depuis PressArticle (limit=${limit}, dryRun=${dryRun})`);
  const result = await ingestPromisesFromPress({ limit, dryRun });
  console.log("Résultat :", result);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Erreur ingestion :", err);
    process.exit(1);
  });
