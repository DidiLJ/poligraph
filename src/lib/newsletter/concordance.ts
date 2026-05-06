type Position = "POUR" | "CONTRE" | "ABSTENTION";

export interface UserAnswer {
  scrutinId: string;
  position: Position;
}

export interface DeputyVote {
  scrutinId: string;
  position: Position;
}

/**
 * Compute weekly concordance between a user's stated positions and a deputy's votes.
 *
 * - Returns null when fewer than 2 mappable votes (insufficient signal).
 * - ABSTENTION on either side counts as half-agreement against the other position.
 * - Result is rounded to a 0-100 integer percentage.
 */
export function computeWeeklyConcordance(
  userAnswers: UserAnswer[],
  deputyVotes: DeputyVote[]
): number | null {
  const userMap = new Map(userAnswers.map((a) => [a.scrutinId, a.position]));
  const matched = deputyVotes.filter((v) => userMap.has(v.scrutinId));
  if (matched.length < 2) return null;

  let score = 0;
  for (const vote of matched) {
    const userPos = userMap.get(vote.scrutinId)!;
    if (userPos === vote.position) {
      score += 1;
    } else if (userPos === "ABSTENTION" || vote.position === "ABSTENTION") {
      score += 0.5;
    }
  }
  return Math.round((score / matched.length) * 100);
}
