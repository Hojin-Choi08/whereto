/**
 * Guards for the curated corpus: right set of cafés, valid vocabulary, and
 * nothing invented that the source doesn't have (prices, hours, map links).
 */

import { describe, expect, it } from 'vitest'
import { CAFE_TAGS } from '../domain'
import { CAFES, CAFES_BY_ID } from './cafes'

describe('CAFES corpus', () => {
  it('has the 28 verified cafés with unique ids, and excludes the unverified one', () => {
    expect(CAFES).toHaveLength(28)
    expect(CAFES_BY_ID.size).toBe(28)
    expect(CAFES_BY_ID.has('caffe-ladro-kirkland')).toBe(false)
    expect(CAFES.filter((c) => c.address.includes('Kirkland'))).toHaveLength(9)
    expect(CAFES.filter((c) => c.address.includes('Bellevue'))).toHaveLength(19)
  })

  it('uses only known tags, once each', () => {
    const valid = new Set<string>(CAFE_TAGS)
    for (const c of CAFES) {
      for (const t of c.tags) expect(valid.has(t), `${c.id}: ${t}`).toBe(true)
      expect(new Set(c.tags).size, c.id).toBe(c.tags.length)
    }
  })

  it('invents no prices, hours or map links (the source has none)', () => {
    for (const c of CAFES) {
      expect(c.priceLevel, c.id).toBeUndefined()
      expect(c.hours, c.id).toBeUndefined()
      expect(c.mapsUrl, c.id).toBeUndefined()
    }
  })

  it('tags only what the source says (locked: changing a set should be deliberate)', () => {
    const withTag = (t: string) => CAFES.filter((c) => (c.tags as readonly string[]).includes(t)).map((c) => c.id).sort()
    // The literal word "specialty" only — no roasting/single-origin inference.
    expect(withTag('specialty-coffee')).toEqual(['203f-kirkland', 'diwan-bellevue', 'story-coffee-tea-bellevue'])
    expect(withTag('tea')).toEqual([
      '203f-kirkland', 'chicha-san-chen-bellevue', 'copper-kettle-botanical', 'heytea-bellevue', 'molly-tea-bellevue',
      'omo-thai-tea-bellevue', 'sconers-bellevue', 'story-coffee-tea-bellevue', 'thruline-kirkland', 'ug-tea-bellevue',
      'zoka-kirkland',
    ])
    expect(withTag('matcha')).toEqual([
      '203f-kirkland', 'bellden-bellevue', 'diwan-bellevue', 'last-frontier-eastgate', 'nanas-green-tea-bellevue',
      'semicolon-bellevue', 'third-culture-bellevue', 'ug-tea-bellevue',
    ])
    expect(withTag('desserts')).toEqual([
      'nanas-green-tea-bellevue', 'omo-thai-tea-bellevue', 'semicolon-bellevue', 'story-coffee-tea-bellevue',
    ])
    // "open into the evening" is not "open late".
    expect(withTag('late')).toEqual(['heytea-bellevue', 'molly-tea-bellevue', 'ug-tea-bellevue'])
  })

  it('sets noise only where the source says calm/busy', () => {
    expect(CAFES.filter((c) => c.noise).map((c) => [c.id, c.noise])).toEqual([
      ['diwan-bellevue', 'quiet'],
      ['five-stones-bellevue-college', 'quiet'],
    ])
  })

  it('has a name, neighborhood, address and a 1–2 sentence blurb for every café', () => {
    for (const c of CAFES) {
      expect(c.name && c.neighborhood && c.address, c.id).toBeTruthy()
      const sentences = c.blurb.split(/(?<=[.!?])\s+/).filter(Boolean)
      expect(sentences.length, `${c.id}: ${c.blurb}`).toBeGreaterThanOrEqual(1)
      expect(sentences.length, `${c.id}: ${c.blurb}`).toBeLessThanOrEqual(2)
    }
  })
})
