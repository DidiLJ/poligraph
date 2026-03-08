import { db } from "@/lib/db";

export interface RecentlyPosted {
  entityIds: Set<string>;
}

/** Extract a canonical entity ID from a Poligraph link */
export function extractEntityId(link: string | undefined | null): string | null {
  if (!link) return null;
  const match = link.match(/poligraph\.fr\/(politiques|affaires|votes|elections)\/([^/?#]+)/);
  if (!match) return null;
  return `${match[1]}:${match[2]}`;
}

/** Load entities posted in the last N days */
export async function getRecentlyPosted(days = 7): Promise<RecentlyPosted> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const recent = await db.socialPost.findMany({
    where: {
      createdAt: { gte: since },
      status: { in: ["PENDING_REVIEW", "APPROVED", "POSTED"] },
    },
    select: { entityId: true, link: true },
  });

  const entityIds = new Set<string>();
  for (const post of recent) {
    if (post.entityId) {
      entityIds.add(post.entityId);
    } else {
      const extracted = extractEntityId(post.link);
      if (extracted) entityIds.add(extracted);
    }
  }

  return { entityIds };
}

/** Check if an entity was recently posted */
export function wasRecentlyPosted(recent: RecentlyPosted, entityId: string | null): boolean {
  if (!entityId) return false;
  return recent.entityIds.has(entityId);
}
