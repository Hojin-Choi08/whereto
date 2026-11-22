import { describe, expect, it } from 'vitest'
import { mapsLink } from './maps'
import { tallyVotes } from './tally'

const picks = [
  { cafeId: 'b', rank: 2 },
  { cafeId: 'a', rank: 1 },
  { cafeId: 'c', rank: 3 },
]
const members = ['u1', 'u2', 'u3', 'u4']

describe('tallyVotes', () => {
  it('counts per pick in rank order with voter ids, and X of Y', () => {
    const t = tallyVotes(picks, [
      { userId: 'u1', cafeId: 'b' },
      { userId: 'u2', cafeId: 'b' },
      { userId: 'u3', cafeId: 'a' },
    ], members)
    expect(t.byCafe).toEqual([
      { cafeId: 'a', rank: 1, voters: ['u3'] },
      { cafeId: 'b', rank: 2, voters: ['u1', 'u2'] },
      { cafeId: 'c', rank: 3, voters: [] },
    ])
    expect([t.votedCount, t.memberCount]).toEqual([3, 4])
    expect(t.leader).toBe('b')
    expect(t.tieBrokenByRank).toBe(false)
  })

  it('breaks ties by rank', () => {
    const t = tallyVotes(picks, [
      { userId: 'u1', cafeId: 'c' },
      { userId: 'u2', cafeId: 'b' },
    ], members)
    expect(t.leader).toBe('b')
    expect(t.tieBrokenByRank).toBe(true)
  })

  it('gives a room with no votes to pick #1', () => {
    const t = tallyVotes(picks, [], members)
    expect(t.leader).toBe('a')
    expect(t.votedCount).toBe(0)
    expect(t.tieBrokenByRank).toBe(true)
  })

  it('ignores non-members, removed members, and votes for cafés that are not picks', () => {
    const t = tallyVotes(picks, [
      { userId: 'outsider', cafeId: 'c' },
      { userId: 'u1', cafeId: 'rooftop' },
      { userId: 'u2', cafeId: 'a' },
    ], members)
    expect(t.votedCount).toBe(1)
    expect(t.leader).toBe('a')
    expect(t.voteOf.has('outsider')).toBe(false)
    expect(t.voteOf.has('u1')).toBe(false)
  })

  it('has no leader without picks', () => {
    expect(tallyVotes([], [{ userId: 'u1', cafeId: 'a' }], members).leader).toBeNull()
  })
})

describe('mapsLink', () => {
  it('prefers the curated URL, otherwise searches name + address', () => {
    expect(mapsLink({ name: 'X', address: '1 St', mapsUrl: 'https://maps.example/x' })).toBe('https://maps.example/x')
    expect(mapsLink({ name: 'Moss & Mortar', address: '44 Chapel Ln' })).toBe(
      'https://www.google.com/maps/search/?api=1&query=Moss%20%26%20Mortar%2C%2044%20Chapel%20Ln',
    )
  })
})
