import { describe, expect, it } from 'vitest'
import { CAFES } from '@/data/cafes'
import type { Cafe } from '@/domain'
import { groupBudget, rankCafes, type ScoringPreference } from './score'

function cafe(id: string, overrides: Partial<Cafe> = {}): Cafe {
  return {
    id,
    name: id,
    neighborhood: 'Test',
    address: '1 Test St',
    priceLevel: 2,
    tags: [],
    noise: 'moderate',
    hours: 'always',
    blurb: '',
    ...overrides,
  }
}

const ids = (r: { cafe: Cafe }[]) => r.map((s) => s.cafe.id)

describe('groupBudget', () => {
  it('is undefined when nobody set a budget', () => {
    expect(groupBudget([{}, { mood: 'chat' }])).toBeUndefined()
  })
  it('takes the median, flooring the mean for even counts', () => {
    expect(groupBudget([{ budgetMax: 1 }, { budgetMax: 3 }, { budgetMax: 2 }])).toBe(2)
    expect(groupBudget([{ budgetMax: 1 }, { budgetMax: 3 }])).toBe(2)
    expect(groupBudget([{ budgetMax: 1 }, { budgetMax: 2 }])).toBe(1)
    expect(groupBudget([{ budgetMax: 3 }, { budgetMax: 3 }, { budgetMax: 1 }, {}])).toBe(3)
  })
})

describe('rankCafes — budget filter (considerBudget: true)', () => {
  const cafes = [
    cafe('cheap-a', { priceLevel: 1 }),
    cafe('cheap-b', { priceLevel: 1 }),
    cafe('mid', { priceLevel: 2 }),
    cafe('pricey', { priceLevel: 3 }),
  ]

  it('drops cafés above the group median budget', () => {
    const prefs: ScoringPreference[] = [{ budgetMax: 2 }, { budgetMax: 2 }, { budgetMax: 3 }]
    expect(ids(rankCafes(prefs, cafes, { considerBudget: true }))).not.toContain('pricey')
    expect(rankCafes(prefs, cafes, { considerBudget: true })).toHaveLength(3)
  })

  it('relaxes to a penalty when too few cafés fit, keeping in-budget ones first', () => {
    const prefs: ScoringPreference[] = [{ budgetMax: 1 }, { budgetMax: 1 }]
    const ranked = rankCafes(prefs, [cafe('cheap', { priceLevel: 1 }), ...cafes.slice(2)], { considerBudget: true })
    expect(ids(ranked)).toEqual(['cheap', 'mid', 'pricey'])
    expect(ranked.map((r) => r.overBudget)).toEqual([false, true, true])
    expect(ranked[1].score).toBeLessThan(ranked[0].score)
  })

  it('ignores budgets by default (no price data yet): nothing dropped, no penalty', () => {
    const ranked = rankCafes([{ budgetMax: 1 }, { budgetMax: 1 }], cafes)
    expect(ranked).toHaveLength(4)
    expect(ranked.every((r) => !r.overBudget)).toBe(true)
  })

  it('ignores the budget entirely when nobody set one', () => {
    expect(rankCafes([{ mood: 'chat' }], cafes, { considerBudget: true })).toHaveLength(4)
  })
})

describe('rankCafes — tag and mood scoring', () => {
  it('ranks the café matching more members’ must-haves first', () => {
    const cafes = [
      cafe('has-wifi', { tags: ['wifi'] }),
      cafe('has-outdoor', { tags: ['outdoor'] }),
      cafe('has-nothing'),
    ]
    const prefs: ScoringPreference[] = [
      { mustHave: ['wifi'] },
      { mustHave: ['wifi', 'outdoor'] },
      { mustHave: ['wifi'] },
    ]
    const ranked = rankCafes(prefs, cafes)
    expect(ids(ranked)).toEqual(['has-wifi', 'has-outdoor', 'has-nothing'])
    expect(ranked[0].mustHaveHits).toEqual({ wifi: 3 })
  })

  it('uses mood to prefer fitting tags and noise', () => {
    const cafes = [
      cafe('loud-bar', { tags: ['food'], noise: 'lively' }),
      cafe('study-spot', { tags: ['wifi', 'outlets', 'quiet'], noise: 'quiet' }),
    ]
    const ranked = rankCafes([{ mood: 'focus' }, { mood: 'focus' }], cafes)
    expect(ids(ranked)).toEqual(['study-spot', 'loud-bar'])
    expect(ranked[0].moodHits).toEqual({ focus: 2 })
    expect(ranked[1].moodHits).toEqual({})
  })
})

describe('rankCafes — determinism and edge cases', () => {
  it('breaks ties by price, then id', () => {
    const cafes = [cafe('b', { priceLevel: 2 }), cafe('c', { priceLevel: 1 }), cafe('a', { priceLevel: 2 })]
    expect(ids(rankCafes([], cafes))).toEqual(['c', 'a', 'b'])
  })

  it('handles an empty group: every café, score 0, deterministic order, limit respected', () => {
    const ranked = rankCafes([], CAFES, { limit: 5 })
    expect(ranked).toHaveLength(5)
    expect(ranked.every((r) => r.score === 0)).toBe(true)
    expect(ids(rankCafes([], CAFES, { limit: 5 }))).toEqual(ids(ranked))
  })

  it('handles an empty café list', () => {
    expect(rankCafes([{ mood: 'cozy' }], [])).toEqual([])
  })

  it('ignores unknown moods/tags, bad budgets, and duplicate tags (client-written input)', () => {
    const cafes = [cafe('x', { tags: ['wifi'] }), cafe('y', { priceLevel: 3 })]
    const junk = [
      { mood: 'party', mustHave: ['wifi', 'wifi', 'helipad', 42], budgetMax: 7 },
    ] as unknown as ScoringPreference[]
    const ranked = rankCafes(junk, cafes, { considerBudget: true })
    expect(ids(ranked)).toEqual(['x', 'y']) // budget 7 ignored → nothing filtered
    expect(ranked[0].mustHaveHits).toEqual({ wifi: 1 }) // duplicate counted once
  })

  it('returns a full shortlist of distinct real cafés by default', () => {
    const ranked = rankCafes([{ mood: 'focus', mustHave: ['wifi'], budgetMax: 2 }, { mood: 'chat' }], CAFES)
    expect(ranked.length).toBeGreaterThanOrEqual(3)
    expect(ranked.length).toBeLessThanOrEqual(12)
    expect(new Set(ids(ranked)).size).toBe(ranked.length)
    // Real data has no prices: unknown is never filtered out, known must fit.
    expect(ranked.every((r) => r.cafe.priceLevel === undefined || r.cafe.priceLevel <= 2)).toBe(true)
  })
})

describe('rankCafes — unknown price and noise (real corpus has neither)', () => {
  it('never drops or penalises a café with an unknown price', () => {
    const cafes = [
      cafe('unknown', { priceLevel: undefined }),
      cafe('cheap', { priceLevel: 1 }),
      cafe('pricey', { priceLevel: 3 }),
      cafe('cheap-2', { priceLevel: 1 }),
    ]
    const ranked = rankCafes([{ budgetMax: 1 }, { budgetMax: 1 }], cafes, { considerBudget: true })
    expect(ids(ranked)).toEqual(['cheap', 'cheap-2', 'unknown']) // pricey dropped; unknown kept
    expect(ranked.find((r) => r.cafe.id === 'unknown')).toMatchObject({ score: 0, overBudget: false })
  })

  it('keeps unknown-price cafés when relaxing the budget, without a penalty', () => {
    const ranked = rankCafes([{ budgetMax: 1 }], [cafe('unknown', { priceLevel: undefined }), cafe('pricey', { priceLevel: 3 })], { considerBudget: true })
    expect(ids(ranked)).toEqual(['unknown', 'pricey'])
    expect(ranked.map((r) => r.overBudget)).toEqual([false, true])
  })

  it('sorts unknown prices after known ones only on a tie', () => {
    const cafes = [cafe('a-unknown', { priceLevel: undefined }), cafe('z-known', { priceLevel: 3 })]
    expect(ids(rankCafes([], cafes))).toEqual(['z-known', 'a-unknown'])
    const better = [cafe('a-unknown', { priceLevel: undefined, tags: ['wifi'] }), cafe('z-known', { priceLevel: 1 })]
    expect(ids(rankCafes([{ mustHave: ['wifi'] }], better))).toEqual(['a-unknown', 'z-known'])
  })

  it('gives no noise points when noise is unknown', () => {
    const cafes = [cafe('unknown-noise', { noise: undefined }), cafe('quiet', { noise: 'quiet' })]
    const ranked = rankCafes([{ mood: 'focus' }], cafes)
    expect(ids(ranked)).toEqual(['quiet', 'unknown-noise'])
    expect(ranked[1]).toMatchObject({ score: 0, moodHits: {} })
  })
})
