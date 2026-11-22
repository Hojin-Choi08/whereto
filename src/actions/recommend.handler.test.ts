/**
 * recommendCafes end to end against an in-memory ActionTools fake. The AI is
 * pointed at a dead port, so it exercises the fallback path with no spend;
 * the real AI path is covered by recommend.live.test.ts (LIVE_AI=1).
 */

import { describe, expect, it } from 'vitest'
import type { Env } from '../../worker'
import { recommendCafes } from './recommend'
import { fakeTools, type FakeTools } from './testing/fakeTools'

const env = { APP_OWNER_JWT: 'x', API_WORKER_URL: 'http://127.0.0.1:9' } as unknown as Env
const ROOM = 'room-1'

function seed(t: FakeTools, opts: { status?: string; filled?: string[]; members?: string[]; strays?: string[] } = {}) {
  const { status = 'collecting', members = ['host', 'amy', 'ben'], filled = ['host', 'amy'], strays = [] } = opts
  t.coll('rooms').set(ROOM, { recordId: ROOM, data: { name: 'R', hostId: 'host', roomId: ROOM, joinCode: 'abcdefghjk', status } })
  for (const u of members) {
    t.coll('team_members').set(`${ROOM}_${u}`, { recordId: `${ROOM}_${u}`, data: { teamId: ROOM, userId: u, status: 'active' } })
    t.coll('users').set(u, { recordId: u, data: { name: `${u[0].toUpperCase()}${u.slice(1)} Lastname`, email: `${u}@secret.test` } })
  }
  for (const u of [...filled, ...strays]) {
    t.coll('preferences').set(`p_${u}`, { recordId: `p_${u}`, data: { roomId: ROOM, userId: u, mood: 'focus', mustHave: ['wifi'] } })
  }
}

const run = (t: FakeTools, userId: string, roomId = ROOM) =>
  recommendCafes({ userId, params: { roomId }, tools: t.tools, env, callerJwt: 'jwt' })

describe('recommendCafes gates', () => {
  it('refuses a non-host', async () => {
    const t = fakeTools(); seed(t)
    expect(await run(t, 'amy')).toEqual({ success: false, error: 'Only the host can find cafés.' })
    expect(t.statusLog).toEqual([])
  })

  it('refuses an unknown room', async () => {
    const t = fakeTools(); seed(t)
    expect((await run(t, 'host', 'nope')).success).toBe(false)
  })

  it.each(['recommending', 'voting', 'decided'])('refuses a second run (status %s)', async (status) => {
    const t = fakeTools(); seed(t, { status })
    expect(await run(t, 'host')).toEqual({ success: false, error: 'This room already has its picks.' })
    expect(t.statusLog).toEqual([])
  })

  it('needs 2 active members with a filled-in card; stray non-member rows do not count', async () => {
    const t = fakeTools(); seed(t, { filled: ['host'], strays: ['outsider'] })
    const res = await run(t, 'host')
    expect(res.success).toBe(false)
    expect(res.error).toMatch(/At least 2 people/)
    expect(t.statusLog).toEqual([])
  })
})

describe('recommendCafes run', () => {
  it('locks, writes 3 picks (fallback when AI is down), and opens voting', async () => {
    const t = fakeTools(); seed(t)
    const res = await run(t, 'host')
    expect(res).toEqual({ success: true, data: { source: 'fallback' } })
    expect(t.statusLog).toEqual(['recommending', 'voting'])
    const recs = [...t.coll('recommendations').values()].sort((a, b) => Number(a.data.rank) - Number(b.data.rank))
    expect(recs.map((r) => r.recordId)).toEqual([`${ROOM}_1`, `${ROOM}_2`, `${ROOM}_3`])
    expect(new Set(recs.map((r) => r.data.cafeId)).size).toBe(3)
    expect(recs.every((r) => r.data.source === 'fallback' && typeof r.data.reason === 'string')).toBe(true)
  }, 15_000)

  it('never sticks: a write failure deletes partial picks and resets to collecting', async () => {
    let calls = 0
    const t = fakeTools({ failCreate: (c) => c === 'recommendations' && ++calls === 2 })
    seed(t)
    const res = await run(t, 'host')
    expect(res.success).toBe(false)
    expect(t.statusLog).toEqual(['recommending', 'collecting'])
    expect(t.coll('recommendations').size).toBe(0)
    // ...and the host can simply try again.
    expect((await run(t, 'host')).success).toBe(true)
  }, 20_000)
})
