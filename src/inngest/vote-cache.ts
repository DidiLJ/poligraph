import { revalidateTags } from "@/lib/cache";

/**
 * Run a scrutin sync and invalidate cached vote-derived views only after the
 * database write completed successfully.
 */
export async function runVoteSyncWithCacheInvalidation<T>(sync: () => Promise<T>): Promise<T> {
  const result = await sync();
  revalidateTags(["votes"], "max");
  return result;
}
