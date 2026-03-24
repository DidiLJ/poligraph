import { db } from "@/lib/db";
import { GOVERNMENT_GROUP_CODE, CURRENT_LEGISLATURE } from "@/config/scrutin-importance";

export function computeAverageCohesion(positions: Array<{ cohesionPct: number }>): number {
  if (positions.length === 0) return 0;
  const sum = positions.reduce((acc, p) => acc + p.cohesionPct, 0);
  return Math.round((sum / positions.length) * 10) / 10;
}

export function computeGovernmentAlignment(params: {
  groupPositions: Array<{ scrutinId: string; position: string }>;
  govGroupPositions: Array<{ scrutinId: string; position: string }>;
}): number {
  const { groupPositions, govGroupPositions } = params;
  if (govGroupPositions.length === 0) return 0;

  const govMap = new Map(govGroupPositions.map((p) => [p.scrutinId, p.position]));
  let matching = 0;
  let total = 0;

  for (const gp of groupPositions) {
    const govPos = govMap.get(gp.scrutinId);
    if (govPos === undefined) continue;
    total++;
    if (gp.position === govPos) matching++;
  }

  return total > 0 ? Math.round((matching / total) * 1000) / 10 : 0;
}

export async function computeGroupStats(): Promise<{
  groupsProcessed: number;
}> {
  const legislature = CURRENT_LEGISLATURE;

  const groups = await db.parliamentaryGroup.findMany({
    where: { legislature },
    select: { id: true, code: true },
  });

  const govGroup = groups.find((g) => g.code === GOVERNMENT_GROUP_CODE);
  const govPositions = govGroup
    ? await db.scrutinGroupPosition.findMany({
        where: { groupId: govGroup.id },
        select: { scrutinId: true, position: true },
      })
    : [];

  for (const group of groups) {
    const positions = await db.scrutinGroupPosition.findMany({
      where: { groupId: group.id },
      select: { scrutinId: true, position: true, cohesionPct: true },
    });

    const cohesionPct = computeAverageCohesion(positions);
    const governmentAlignmentPct = computeGovernmentAlignment({
      groupPositions: positions,
      govGroupPositions: govPositions,
    });

    const memberCount = await db.mandateParliamentary.count({
      where: {
        parliamentaryGroupId: group.id,
        mandate: { isCurrent: true },
      },
    });

    const scrutinCount = await db.scrutin.count({
      where: { legislature, chamber: "AN" },
    });
    const voteCount = await db.vote.count({
      where: {
        scrutin: { legislature, chamber: "AN" },
        politician: {
          mandates: {
            some: {
              parliamentaryData: { parliamentaryGroupId: group.id },
            },
          },
        },
        position: { in: ["POUR", "CONTRE", "ABSTENTION"] },
      },
    });
    const maxVotes = scrutinCount * memberCount;
    const averageParticipationPct =
      maxVotes > 0 ? Math.round((voteCount / maxVotes) * 1000) / 10 : 0;

    await db.parliamentaryGroupStats.upsert({
      where: {
        groupId_legislature: { groupId: group.id, legislature },
      },
      create: {
        groupId: group.id,
        legislature,
        cohesionPct,
        governmentAlignmentPct,
        averageParticipationPct,
      },
      update: {
        cohesionPct,
        governmentAlignmentPct,
        averageParticipationPct,
      },
    });
  }

  return { groupsProcessed: groups.length };
}
