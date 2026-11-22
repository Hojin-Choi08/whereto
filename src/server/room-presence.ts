/**
 * Membership gate for room presence (`/ws/presence/room:<roomId>`).
 *
 * The presence socket carries the caller's JWT as `?token=`. For a room scope
 * we require a valid token AND an active `team_members` row for that room
 * before the socket reaches the PresenceRoom DO — the same boundary as the
 * room's records (`read: 'team'`). Membership rows have the deterministic id
 * `${roomId}_${userId}` (src/actions/rooms.ts), so this is one lookup.
 */

import { membershipId } from '../actions/rooms.js'
import type { Env } from '../../worker.js'

const ROOM_SCOPE = /^room:([A-Za-z0-9_-]{1,64})$/

/** The room id of a `room:<id>` presence scope, or null for any other scope. */
export function roomIdFromPresenceScope(scopeId: string): string | null {
  return ROOM_SCOPE.exec(scopeId)?.[1] ?? null
}

/** True if a records.get result is an active membership (SDK rule: 'active' or unset). */
export function isActiveMembershipResult(json: unknown): boolean {
  const r = json as { success?: boolean; data?: { record?: { data?: { status?: unknown } } } }
  if (!r?.success || !r.data?.record?.data) return false
  const status = r.data.record.data.status
  return status === 'active' || status === undefined || status === null
}

export async function isActiveRoomMember(env: Env, roomId: string, userId: string): Promise<boolean> {
  const stub = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`app:${env.DEEPSPACE_APP_ID}`))
  try {
    const res = await stub.fetch(
      new Request('https://internal/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId, 'X-App-Action': 'true' },
        body: JSON.stringify({
          tool: 'records.get',
          params: { collection: 'team_members', recordId: membershipId(roomId, userId) },
        }),
      }),
    )
    return isActiveMembershipResult(await res.json())
  } catch {
    return false // fail closed
  }
}
