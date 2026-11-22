/**
 * The one vote-counting rule, shared by the live UI and `closeVoting`, so the
 * tallies people watch and the winner the server declares can't disagree.
 *
 * A vote counts only if its author is an active member and its cafeId is one
 * of the room's picks (votes are client-written — PLAN.md §2). Each member
 * counts once. Winner: most votes; ties go to the better (lower) AI rank, so
 * a room with no votes at all goes to pick #1.
 */

export interface TallyPick {
  cafeId: string
  rank: number
}

export interface TallyVote {
  userId: string
  cafeId: string
}

export interface Tally {
  /** Voter ids per pick, in pick-rank order. */
  byCafe: { cafeId: string; rank: number; voters: string[] }[]
  /** Active members with a valid vote. */
  votedCount: number
  /** Active members. */
  memberCount: number
  /** Leading pick by the rule above; null only if there are no picks. */
  leader: string | null
  /** The leader's margin is a tie broken by rank. */
  tieBrokenByRank: boolean
  /** Each active member's counted choice. */
  voteOf: ReadonlyMap<string, string>
}

export function tallyVotes(
  picks: readonly TallyPick[],
  votes: readonly TallyVote[],
  activeMemberIds: Iterable<string>,
): Tally {
  const active = new Set(activeMemberIds)
  const ordered = [...picks].sort((a, b) => a.rank - b.rank)
  const pickIds = new Set(ordered.map((p) => p.cafeId))

  const voteOf = new Map<string, string>()
  for (const v of votes) {
    if (active.has(v.userId) && pickIds.has(v.cafeId)) voteOf.set(v.userId, v.cafeId)
  }

  const byCafe = ordered.map((p) => ({
    cafeId: p.cafeId,
    rank: p.rank,
    voters: [...voteOf].filter(([, cafeId]) => cafeId === p.cafeId).map(([userId]) => userId).sort(),
  }))

  // `ordered` is rank-ascending, so the first max wins ties.
  let leader: (typeof byCafe)[number] | null = null
  for (const p of byCafe) if (!leader || p.voters.length > leader.voters.length) leader = p
  const tieBrokenByRank =
    !!leader && byCafe.some((p) => p !== leader && p.voters.length === leader!.voters.length)

  return {
    byCafe,
    votedCount: voteOf.size,
    memberCount: active.size,
    leader: leader?.cafeId ?? null,
    tieBrokenByRank,
    voteOf,
  }
}
