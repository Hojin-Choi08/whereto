import { describe, expect, it } from 'vitest'
import type { Env } from '../../worker'
import { fakeTools, type FakeTools } from './testing/fakeTools'
import { closeVoting } from './voting'

const ROOM = 'room-1'
const env = {} as Env

function seed(t: FakeTools, opts: { status?: string; votes?: Record<string, string>; members?: string[] } = {}) {
  const { status = 'voting', votes = {}, members = ['host', 'amy', 'ben', 'cal'] } = opts
  t.coll('rooms').set(ROOM, { recordId: ROOM, data: { name: 'R', hostId: 'host', roomId: ROOM, joinCode: 'abcdefghjk', status } })
  for (const u of members) {
    t.coll('team_members').set(`${ROOM}_${u}`, { recordId: `${ROOM}_${u}`, data: { teamId: ROOM, userId: u, status: 'active' } })
  }
  ;['first', 'second', 'third'].forEach((cafeId, i) =>
    t.coll('recommendations').set(`${ROOM}_${i + 1}`, {
      recordId: `${ROOM}_${i + 1}`,
      data: { roomId: ROOM, rank: i + 1, cafeId, reason: 'r', source: 'ai' },
    }),
  )
  for (const [userId, cafeId] of Object.entries(votes)) {
    t.coll('votes').set(`v_${userId}`, { recordId: `v_${userId}`, data: { roomId: ROOM, userId, cafeId } })
  }
}

const run = (t: FakeTools, userId: string) =>
  closeVoting({ userId, params: { roomId: ROOM }, tools: t.tools, env, callerJwt: 'jwt' })
const room = (t: FakeTools) => t.coll('rooms').get(ROOM)!.data

describe('closeVoting', () => {
  it('refuses a non-host and leaves the room voting', async () => {
    const t = fakeTools(); seed(t)
    expect(await run(t, 'amy')).toEqual({ success: false, error: 'Only the host can close voting.' })
    expect(room(t).status).toBe('voting')
  })

  it.each([
    ['collecting', 'Voting hasn’t started yet.'],
    ['recommending', 'Voting hasn’t started yet.'],
    ['decided', 'Voting is already closed.'],
  ])('refuses when the room is %s', async (status, error) => {
    const t = fakeTools(); seed(t, { status })
    expect(await run(t, 'host')).toEqual({ success: false, error })
    expect(t.statusLog).toEqual([])
  })

  it('declares the most-voted pick and records decidedAt', async () => {
    const t = fakeTools(); seed(t, { votes: { host: 'third', amy: 'third', ben: 'first' } })
    expect(await run(t, 'host')).toEqual({ success: true, data: { winnerCafeId: 'third', votedCount: 3, memberCount: 4 } })
    expect(room(t)).toMatchObject({ status: 'decided', winnerCafeId: 'third' })
    expect(Number.isNaN(Date.parse(String(room(t).decidedAt)))).toBe(false)
  })

  it('breaks a tie by the better AI rank', async () => {
    const t = fakeTools(); seed(t, { votes: { host: 'third', amy: 'second' } })
    const res = await run(t, 'host')
    expect(res.success && res.data).toMatchObject({ winnerCafeId: 'second' })
  })

  it('ignores votes from non-members and for cafés that are not picks', async () => {
    const t = fakeTools()
    seed(t, { votes: { outsider: 'third', stranger: 'third', amy: 'rooftop', ben: 'second' } })
    const res = await run(t, 'host')
    expect(res.success && res.data).toMatchObject({ winnerCafeId: 'second', votedCount: 1 })
  })

  it('can close with no votes — pick #1 wins', async () => {
    const t = fakeTools(); seed(t)
    const res = await run(t, 'host')
    expect(res.success && res.data).toMatchObject({ winnerCafeId: 'first', votedCount: 0 })
  })

  it('cannot be closed twice', async () => {
    const t = fakeTools(); seed(t, { votes: { amy: 'second' } })
    expect((await run(t, 'host')).success).toBe(true)
    expect(await run(t, 'host')).toEqual({ success: false, error: 'Voting is already closed.' })
  })
})
