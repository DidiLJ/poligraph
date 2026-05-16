import "dotenv/config";
import { getBioQualityBreakdown } from "../src/lib/data/bio-quality";
import { db } from "../src/lib/db";

async function main() {
  const data = await getBioQualityBreakdown();
  console.log(`# Audit biographies : ${new Date().toISOString().slice(0, 10)}\n`);
  console.log(`Total politiciens: ${data.totalPoliticians.toLocaleString("fr-FR")}`);
  console.log(`Total avec mandat actif: ${data.totalWithCurrentMandate.toLocaleString("fr-FR")}\n`);
  console.table(
    data.buckets.map((b) => ({
      bucket: b.label,
      publishedCount: b.publishedCount,
      draftCount: b.draftCount,
      currentMandateCount: b.currentMandateCount,
    }))
  );
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
