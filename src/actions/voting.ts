/**
 * closeVoting — host-only; ends voting and records the winner.
 *
 * Runs with RBAC OFF, so the gates here are the real boundary. The winner is
 * computed with the same `tallyVotes` the UI shows live (active members only,
 * votes for the room's picks only, ties → lower AI rank), from a fresh read at
 * close time.
 */

import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import type { RecommendationData, RoomData, TeamMemberData, VoteData } from '../domain'
import { tallyVotes } from '../lib/tally'

/** A member may cast or change their vote only while the room is voting. */
export const castVote: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const roomId = typeof params.roomId === 'string' ? params.roomId : ''
  const cafeId = typeof params.cafeId === 'string' ? params.cafeId : ''
  if (!roomId || !cafeId) return { success: false, error: 'Missing room or café.' }

  const roomRes = await tools.get<RoomData & Record<string, unknown>>('rooms', roomId)
  if (!roomRes.success) return { success: false, error: 'Room not found.' }
  if (roomRes.data.record.data.status !== 'voting') {
    return { success: false, error: 'Voting is closed.' }
  }

  const memberId = `${roomId}_${userId}`
  const memberRes = await tools.get<TeamMemberData & Record<string, unknown>>('team_members', memberId)
  if (!memberRes.success || memberRes.data.record.data.status !== 'active') {
    return { success: false, error: 'You are not an active member of this room.' }
  }

  const picksRes = await tools.query<RecommendationData & Record<string, unknown>>(
    'recommendations', { where: { roomId }, limit: 10 },
  )
  if (!picksRes.success) return { success: false, error: picksRes.error }
  if (!picksRes.data.records.some((pick) => pick.data.cafeId === cafeId)) {
    return { success: false, error: 'That café is not one of this room’s picks.' }
  }

  const voteId = `${roomId}_${userId}`
  const result = await tools.create('votes', { roomId, userId, cafeId }, voteId)
  if (!result.success) return { success: false, error: result.error }
  return { success: true, data: { cafeId } }
}

export const closeVoting: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const roomId = typeof params.roomId === 'string' ? params.roomId : ''
  if (!roomId) return { success: false, error: 'Missing room.' }

  const roomRes = await tools.get<RoomData & Record<string, unknown>>('rooms', roomId)
  if (!roomRes.success) return { success: false, error: 'Room not found.' }
  const room = roomRes.data.record.data
  if (room.hostId !== userId) return { success: false, error: 'Only the host can close voting.' }
  if (room.status === 'decided') return { success: false, error: 'Voting is already closed.' }
  if (room.status !== 'voting') return { success: false, error: 'Voting hasn’t started yet.' }

  const [recsRes, membersRes, votesRes] = await Promise.all([
    tools.query<RecommendationData & Record<string, unknown>>('recommendations', { where: { roomId }, limit: 10 }),
    tools.query<TeamMemberData & Record<string, unknown>>('team_members', {
      where: { teamId: roomId, status: 'active' },
      limit: 100,
    }),
    tools.query<VoteData & Record<string, unknown>>('votes', { where: { roomId }, limit: 200 }),
  ])
  if (!recsRes.success) return { success: false, error: recsRes.error }
  if (!membersRes.success) return { success: false, error: membersRes.error }
  if (!votesRes.success) return { success: false, error: votesRes.error }

  const tally = tallyVotes(
    recsRes.data.records.map((r) => ({ cafeId: r.data.cafeId, rank: r.data.rank })),
    votesRes.data.records.map((v) => ({ userId: v.data.userId, cafeId: v.data.cafeId })),
    membersRes.data.records.map((m) => m.data.userId),
  )
  if (!tally.leader) return { success: false, error: 'This room has no picks to choose from.' }

  const decided = await tools.update('rooms', roomId, {
    status: 'decided',
    winnerCafeId: tally.leader,
    decidedAt: new Date().toISOString(),
  })
  if (!decided.success) return { success: false, error: decided.error }

  console.info(
    `[closeVoting] room=${roomId} winner=${tally.leader} votes=${tally.votedCount}/${tally.memberCount} tieByRank=${tally.tieBrokenByRank}`,
  )
  return {
    success: true,
    data: { winnerCafeId: tally.leader, votedCount: tally.votedCount, memberCount: tally.memberCount },
  }
}
