import { describe, expect, it } from 'vitest'
import { CAFES } from '../data/cafes'
import type { RoomData } from '../domain'
import { fallbackReason } from '../lib/fallbackReason'
import { rankCafes } from '../lib/score'
import { buildPromptData, validatePicks } from './recommend'

const shortlist = new Map(CAFES.slice(0, 5).map((c) => [c.id, c]))
const [a, b, c, d] = [...shortlist.keys()]

describe('validatePicks', () => {
  it('accepts exactly 3 distinct shortlisted ids with reasons, marked ai', () => {
    const out = validatePicks(
      [{ cafeId: a, reason: ' Great wifi. ' }, { cafeId: b, reason: 'Pastries.' }, { cafeId: c, reason: 'Quiet.' }],
      shortlist,
    )
    expect(out).toEqual([
      { cafeId: a, reason: 'Great wifi.', source: 'ai' },
      { cafeId: b, reason: 'Pastries.', source: 'ai' },
      { cafeId: c, reason: 'Quiet.', source: 'ai' },
    ])
  })

  it.each([
    ['too few', [{ cafeId: a, reason: 'x' }, { cafeId: b, reason: 'y' }]],
    ['too many', [a, b, c, d].map((cafeId) => ({ cafeId, reason: 'x' }))],
    ['duplicate', [{ cafeId: a, reason: 'x' }, { cafeId: a, reason: 'y' }, { cafeId: b, reason: 'z' }]],
    ['not shortlisted', [{ cafeId: a, reason: 'x' }, { cafeId: b, reason: 'y' }, { cafeId: 'rooftop', reason: 'z' }]],
    ['empty reason', [{ cafeId: a, reason: 'x' }, { cafeId: b, reason: '  ' }, { cafeId: c, reason: 'z' }]],
  ])('rejects %s', (_label, picks) => {
    expect(validatePicks(picks, shortlist)).toBeNull()
  })

  it('caps long reasons', () => {
    const long = 'x'.repeat(1000)
    const out = validatePicks([a, b, c].map((cafeId) => ({ cafeId, reason: long })), shortlist)
    expect(out?.[0].reason).toHaveLength(280)
  })
})

describe('buildPromptData', () => {
  const room: RoomData = { name: 'R', hostId: 'u1', roomId: 'r1', joinCode: 'abcdefghjk', status: 'collecting', area: 'Old Town' }

  it('sends first names and preferences only — no user ids — and trims notes', () => {
    const data = buildPromptData(
      room,
      [
        { userId: 'user_secret_1', firstName: 'Sam', pref: { roomId: 'r1', userId: 'user_secret_1', mood: 'focus', mustHave: ['wifi'], note: ` ${'n'.repeat(300)} ` } },
        { userId: 'user_secret_2', firstName: 'Ana', pref: { roomId: 'r1', userId: 'user_secret_2', budgetMax: 1 } },
      ],
      CAFES.slice(0, 2),
    )
    const json = JSON.stringify(data)
    expect(json).not.toContain('user_secret')
    expect(data.area).toBe('Old Town')
    expect(data.MEMBERS).toEqual([
      { name: 'Sam', mood: 'focus', mustHave: ['wifi'], note: 'n'.repeat(200) },
      { name: 'Ana', budgetMax: 1 },
    ])
    expect(data.CANDIDATES.map((x) => x.id)).toEqual(CAFES.slice(0, 2).map((x) => x.id))
  })
})

describe('fallbackReason', () => {
  it('describes only what the scorer matched', () => {
    const [top] = rankCafes(
      [{ mood: 'focus', mustHave: ['wifi', 'outlets'] }, { mood: 'focus', mustHave: ['wifi'] }],
      CAFES,
    )
    const reason = fallbackReason(top)
    expect(reason).toMatch(/^Has wi-fi \(2 of you\)/)
    expect(reason).toContain('focus mood')
    expect(reason).toContain(top.cafe.neighborhood)
  })

  it('has a neutral line when nothing matched, and flags over-budget picks', () => {
    const [plain] = rankCafes([], CAFES)
    expect(fallbackReason(plain)).toMatch(/^A solid all-rounder in /)
    expect(fallbackReason({ ...plain, overBudget: true })).toContain('above the group')
  })
})
