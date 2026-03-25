/**
 * Press RSS sync service.
 *
 * Fetches articles from RSS feeds and matches mentioned politicians and parties.
 */

import { db } from "@/lib/db";
import { DataSource } from "@/generated/prisma";
import { RSSClient } from "@/lib/api";
import { RSS_RATE_LIMIT_MS } from "@/config/rate-limits";
import {
  buildPoliticianIndex,
  buildPartyIndex,
  findMentions,
  findPartyMentions,
} from "@/lib/name-matching";
import { loadMentionBlocklist } from "@/lib/identity/mention-blocklist";
import { verifyMentions } from "@/services/sync/press-mention-verify";
import { MANDATE_TYPE_LABELS } from "@/config/labels";
import type { MandateType } from "@/generated/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PressSyncOptions {
  dryRun?: boolean;
  limit?: number;
  feed?: string;
}

export interface PressSyncStats {
  feedsFetched: number;
  articlesTotal: number;
  articlesNew: number;
  articlesSkipped: number;
  mentionsCreated: number;
  mentionsBlocked: number;
  mentionsRejectedByAI: number;
  partyMentionsCreated: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Main service
// ---------------------------------------------------------------------------

export async function syncPress(options: PressSyncOptions = {}): Promise<PressSyncStats> {
  const { dryRun = false, limit, feed } = options;

  const stats: PressSyncStats = {
    feedsFetched: 0,
    articlesTotal: 0,
    articlesNew: 0,
    articlesSkipped: 0,
    mentionsCreated: 0,
    mentionsBlocked: 0,
    mentionsRejectedByAI: 0,
    partyMentionsCreated: 0,
    errors: [],
  };

  // Build indices + blocklist + role context for AI verification
  const parties = await buildPartyIndex();
  const politicians = await buildPoliticianIndex();
  const blocklist = await loadMentionBlocklist(DataSource.PRESS);

  // Build politician ID → role map for AI context
  const mandates = await db.mandate.findMany({
    where: { isCurrent: true },
    select: { politicianId: true, type: true },
  });
  const roleMap = new Map<string, string>();
  for (const m of mandates) {
    if (!roleMap.has(m.politicianId)) {
      roleMap.set(m.politicianId, MANDATE_TYPE_LABELS[m.type as MandateType] ?? m.type);
    }
  }

  // Fetch RSS feeds
  const rssClient = new RSSClient({ rateLimitMs: RSS_RATE_LIMIT_MS });
  const feedIds = feed ? [feed] : undefined;
  const feeds = await rssClient.fetchAllFeeds(feedIds);

  for (const [sourceId, feedData] of feeds) {
    stats.feedsFetched++;

    const items = limit ? feedData.items.slice(0, limit) : feedData.items;

    for (const item of items) {
      stats.articlesTotal++;

      try {
        // Check if article already exists
        const existing = await db.pressArticle.findUnique({
          where: {
            feedSource_externalId: {
              feedSource: sourceId,
              externalId: item.guid,
            },
          },
        });

        if (existing) {
          stats.articlesSkipped++;
          continue;
        }

        // Find politician and party mentions with false-positive filtering
        const searchText = `${item.title} ${item.description || ""}`;
        // Full-name-only matching: eliminates all last-name false positives
        // (e.g. "Patrick Bruel" article linked to Jérôme Bruel)
        const detectedMentions = findMentions(searchText, politicians, {
          fullNameOnly: true,
        });

        // Blocklist filter (manual admin unlinks)
        const afterBlocklist = detectedMentions.filter((m) => {
          if (blocklist.isBlocked(m.matchedName, m.politicianId)) {
            stats.mentionsBlocked++;
            return false;
          }
          return true;
        });

        // AI verification: confirm each mention refers to the right person
        let mentions = afterBlocklist;
        if (afterBlocklist.length > 0) {
          const verified = await verifyMentions({
            articleTitle: item.title,
            articleDescription: item.description || "",
            mentions: afterBlocklist.map((m) => ({
              politicianId: m.politicianId,
              matchedName: m.matchedName,
              role: roleMap.get(m.politicianId) ?? "politicien",
            })),
          });
          const rejected = verified.filter((v) => !v.confirmed);
          stats.mentionsRejectedByAI += rejected.length;
          const confirmedIds = new Set(
            verified.filter((v) => v.confirmed).map((v) => v.politicianId)
          );
          mentions = afterBlocklist.filter((m) => confirmedIds.has(m.politicianId));
        }

        const partyMentions = findPartyMentions(searchText, parties);

        if (dryRun) {
          stats.articlesNew++;
          stats.mentionsCreated += mentions.length;
          stats.partyMentionsCreated += partyMentions.length;
        } else {
          await db.pressArticle.create({
            data: {
              feedSource: sourceId,
              externalId: item.guid,
              title: item.title,
              description: item.description,
              url: item.link,
              imageUrl: item.imageUrl,
              publishedAt: item.pubDate,
              mentions: {
                create: mentions.map((m) => ({
                  politicianId: m.politicianId,
                  matchedName: m.matchedName,
                })),
              },
              partyMentions: {
                create: partyMentions.map((m) => ({
                  partyId: m.partyId,
                  matchedName: m.matchedName,
                })),
              },
            },
          });

          stats.articlesNew++;
          stats.mentionsCreated += mentions.length;
          stats.partyMentionsCreated += partyMentions.length;
        }
      } catch (error) {
        stats.errors.push(`Error processing article "${item.title}": ${error}`);
      }
    }
  }

  return stats;
}
