import "dotenv/config";
import { revalidateRemoteCache } from "./lib/revalidate-cache";

async function main() {
  const tags = process.argv.slice(2).filter(Boolean);
  await revalidateRemoteCache(tags);
  console.log(`Cache revalidation completed for: ${tags.join(", ")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
