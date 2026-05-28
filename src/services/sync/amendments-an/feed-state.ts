import { syncMetadata } from "@/lib/sync";

export interface FeedState {
  etag?: string;
  lastModified?: string;
  contentHash?: string;
  contentLength?: number;
  lastSuccessfulSyncAt?: string; // ISO string
}

export const amendmentsFeedKey = (legislature: number) => `amendments-an-zip:${legislature}`;

/**
 * Load persisted feed state for the amendments ZIP of a given legislature.
 *
 * Maps the dedicated SyncMetadata columns (etag, lastModified, contentHash) to
 * matching FeedState fields, and reads amendment-specific fields
 * (contentLength, lastSuccessfulSyncAt) from the JSON `extra` bag.
 */
export async function loadFeedState(legislature: number): Promise<FeedState | null> {
  const state = await syncMetadata.get(amendmentsFeedKey(legislature));
  if (!state) return null;

  const extra = state.extra ?? {};
  const contentLengthRaw = extra["contentLength"];
  const lastSuccessfulSyncAtRaw = extra["lastSuccessfulSyncAt"];

  return {
    etag: state.etag ?? undefined,
    lastModified: state.lastModified ?? undefined,
    contentHash: state.contentHash ?? undefined,
    contentLength: typeof contentLengthRaw === "number" ? contentLengthRaw : undefined,
    lastSuccessfulSyncAt:
      typeof lastSuccessfulSyncAtRaw === "string" ? lastSuccessfulSyncAtRaw : undefined,
  };
}

/**
 * Persist feed state for the amendments ZIP of a given legislature.
 *
 * Writes etag/lastModified/contentHash to the dedicated SyncMetadata columns,
 * and the amendment-specific fields (contentLength, lastSuccessfulSyncAt) into
 * the JSON `extra` bag so the helper's typed shape is not polluted.
 */
export async function saveFeedState(legislature: number, state: FeedState): Promise<void> {
  const extra: Record<string, unknown> = {};
  if (state.contentLength !== undefined) extra["contentLength"] = state.contentLength;
  if (state.lastSuccessfulSyncAt !== undefined)
    extra["lastSuccessfulSyncAt"] = state.lastSuccessfulSyncAt;

  await syncMetadata.set(amendmentsFeedKey(legislature), {
    etag: state.etag ?? null,
    lastModified: state.lastModified ?? null,
    contentHash: state.contentHash ?? null,
    extra,
  });
}
