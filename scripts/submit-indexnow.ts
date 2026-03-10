import "dotenv/config";
import { submitRecentToIndexNow } from "../src/lib/indexnow";

async function main() {
  const result = await submitRecentToIndexNow();
  console.log(`\nTotal: ${result.submitted} URLs submitted to IndexNow`);
}

main().catch((err) => {
  console.error("IndexNow submission failed:", err);
  process.exit(1);
});
