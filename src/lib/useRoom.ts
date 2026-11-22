import { useMemo } from 'react'
import { useQuery } from 'deepspace'
import type { PreferenceData, RecommendationData, RoomData, TeamMemberData } from '@/domain'

export type LoadStatus = 'loading' | 'ready' | 'error'

/**
 * Everything the room page needs, live. Visibility is enforced server-side by
 * `read: 'team'`; the filtering here is only "active members" (a removed
 * member's or stray non-member's preference row is never shown — PLAN.md §2).
 */
export function useRoom(roomId: string) {
  const rooms = useQuery<RoomData>('rooms', { where: { roomId } })
  const members = useQuery<TeamMemberData>('team_members', { where: { teamId: roomId } })
  const prefs = useQuery<PreferenceData>('preferences', { where: { roomId } })
  const recs = useQuery<RecommendationData>('recommendations', { where: { roomId } })

  return useMemo(() => {
    const statuses = [rooms.status, members.status, prefs.status, recs.status]
    const status: LoadStatus = statuses.includes('error')
      ? 'error'
      : statuses.every((s) => s === 'ready')
        ? 'ready'
        : 'loading'

    const activeMembers = members.records
      .filter((m) => (m.data.status ?? 'active') === 'active')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const activeIds = new Set(activeMembers.map((m) => m.data.userId))

    return {
      status,
      room: rooms.records[0] ?? null,
      members: activeMembers,
      preferences: prefs.records.filter((p) => activeIds.has(p.data.userId)),
      preferencesReady: prefs.status === 'ready',
      recommendations: [...recs.records].sort((a, b) => a.data.rank - b.data.rank),
    }
  }, [rooms.status, rooms.records, members.status, members.records, prefs.status, prefs.records, recs.status, recs.records])
}
