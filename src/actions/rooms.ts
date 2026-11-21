/**
 * Room lifecycle actions. These run with RBAC OFF (see the trust-model note in
 * src/server/action-routes.ts), so every check here is the real boundary.
 */

import type { ActionHandler, ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { LIMITS, type RoomData, type TeamMemberData } from '../domain'

const JOIN_CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789' // no 0/o/1/l/i
const JOIN_CODE_RE = new RegExp(`^[${JOIN_CODE_ALPHABET}]{${LIMITS.joinCodeLength}}$`)

export function membershipId(roomId: string, userId: string): string {
  return `${roomId}_${userId}`
}

function randomJoinCode(): string {
  // Rejection sampling: 248 is the largest multiple of 31 below 256, so every
  // character is equally likely.
  const out: string[] = []
  while (out.length < LIMITS.joinCodeLength) {
    const bytes = crypto.getRandomValues(new Uint8Array(LIMITS.joinCodeLength * 2))
    for (const b of bytes) {
      if (b < 248 && out.length < LIMITS.joinCodeLength) {
        out.push(JOIN_CODE_ALPHABET[b % JOIN_CODE_ALPHABET.length])
      }
    }
  }
  return out.join('')
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null
}

type RoomLookup =
  | { ok: true; room: { recordId: string; data: RoomData } | null }
  | { ok: false; error: string }

async function findRoomByJoinCode(tools: ActionTools, joinCode: string): Promise<RoomLookup> {
  const res = await tools.query<RoomData & Record<string, unknown>>('rooms', {
    where: { joinCode },
    limit: 1,
  })
  if (!res.success) return { ok: false, error: res.error }
  return { ok: true, room: res.data.records[0] ?? null }
}

async function addMember(
  tools: ActionTools,
  roomId: string,
  userId: string,
  roomRole: TeamMemberData['roomRole'],
): Promise<ActionResult<unknown>> {
  const data: TeamMemberData = { teamId: roomId, userId, status: 'active', roomRole }
  return tools.create('team_members', { ...data }, membershipId(roomId, userId))
}

export const createRoom: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const name = cleanText(params.name, LIMITS.roomNameMax)
  if (!name) return { success: false, error: `Room name must be 1–${LIMITS.roomNameMax} characters.` }
  const area = params.area == null || params.area === '' ? undefined : cleanText(params.area, LIMITS.areaMax)
  if (area === null) return { success: false, error: `Area must be at most ${LIMITS.areaMax} characters.` }

  // A 10-char code from 31 symbols makes collisions vanishingly rare; check anyway.
  let joinCode = ''
  for (let attempt = 0; attempt < 3 && !joinCode; attempt++) {
    const candidate = randomJoinCode()
    const existing = await findRoomByJoinCode(tools, candidate)
    if (!existing.ok) return { success: false, error: existing.error }
    if (!existing.room) joinCode = candidate
  }
  if (!joinCode) return { success: false, error: 'Could not allocate a join code. Try again.' }

  const roomId = crypto.randomUUID()
  const room: RoomData = {
    name,
    hostId: userId,
    roomId,
    joinCode,
    status: 'collecting',
    ...(area ? { area } : {}),
  }
  const created = await tools.create('rooms', { ...room }, roomId)
  if (!created.success) return created

  const member = await addMember(tools, roomId, userId, 'host')
  if (!member.success) {
    await tools.remove('rooms', roomId) // don't leave a room nobody can see
    return { success: false, error: member.error }
  }

  return { success: true, data: { roomId, joinCode } }
}

export const joinRoom: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const joinCode = typeof params.joinCode === 'string' ? params.joinCode.trim().toLowerCase() : ''
  if (!JOIN_CODE_RE.test(joinCode)) return { success: false, error: 'That invite link is not valid.' }

  const found = await findRoomByJoinCode(tools, joinCode)
  if (!found.ok) return { success: false, error: found.error }
  if (!found.room) return { success: false, error: 'Room not found. Ask the host for a new link.' }
  const { roomId, status } = found.room.data

  const existing = await tools.get<TeamMemberData & Record<string, unknown>>(
    'team_members',
    membershipId(roomId, userId),
  )
  if (existing.success) {
    if (existing.data.record.data.status === 'removed') {
      return { success: false, error: 'You were removed from this room.' }
    }
    return { success: true, data: { roomId, alreadyMember: true } } // re-entry is always allowed
  }

  if (status !== 'collecting') {
    return { success: false, error: 'This room has already started voting.' }
  }

  const member = await addMember(tools, roomId, userId, 'member')
  if (!member.success) return { success: false, error: member.error }
  return { success: true, data: { roomId, alreadyMember: false } }
}
