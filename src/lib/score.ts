/**
 * Deterministic café scoring (PLAN.md §4 step 4). Pure — no I/O — so the
 * worker can use it to (a) shortlist candidates for Claude and (b) pick the
 * fallback top 3 if the AI call fails.
 *
 * Rules:
 * 1. Budget: drop cafés priced above the group's median `budgetMax` (members
 *    who set one). If that leaves fewer than `minResults`, keep every café and
 *    penalise each price level over the median instead, so the group always
 *    gets enough picks.
 * 2. Must-haves: +MUST_HAVE_POINTS for every (member, tag) the café has —
 *    a tag three people want counts three times.
 * 3. Mood: per member with a mood, +MOOD_TAG_POINTS per mood-typical tag the
 *    café has, +MOOD_NOISE_POINTS if its noise level suits the mood.
 * 4. Ties: lower price first, then id — fully deterministic.
 *
 * Input is treated as untrusted (preferences are client-written): unknown
 * moods/tags and out-of-range budgets are ignored, duplicate tags count once.
 */

import { CAFE_TAGS, MOODS, type Cafe, type CafeTag, type Mood, type PreferenceData, type PriceLevel } from '../domain'

export type ScoringPreference = Pick<PreferenceData, 'mood' | 'mustHave' | 'budgetMax'>

export interface ScoredCafe {
  cafe: Cafe
  score: number
  /** Must-have tags this café satisfies, with how many members asked for each. */
  mustHaveHits: Partial<Record<CafeTag, number>>
  /** Moods (with member counts) this café suits by tag or noise. */
  moodHits: Partial<Record<Mood, number>>
  /** True if the café is over the group's median budget (only possible after relaxing). */
  overBudget: boolean
}

export interface RankOptions {
  /** Max cafés returned. Default 12 (the AI shortlist size). */
  limit?: number
  /** Relax the budget filter if fewer than this many remain. Default 3. */
  minResults?: number
}

export const MUST_HAVE_POINTS = 2
export const MOOD_TAG_POINTS = 1
export const MOOD_NOISE_POINTS = 1
export const OVER_BUDGET_PENALTY = 3

const MOOD_PROFILE: Record<Mood, { tags: readonly CafeTag[]; noise: readonly Cafe['noise'][] }> = {
  focus: { tags: ['wifi', 'outlets', 'quiet'], noise: ['quiet'] },
  chat: { tags: ['spacious', 'outdoor', 'pastries'], noise: ['moderate', 'lively'] },
  date: { tags: ['specialty-coffee', 'pastries'], noise: ['quiet', 'moderate'] },
  cozy: { tags: ['quiet', 'pastries'], noise: ['quiet'] },
  quick: { tags: ['specialty-coffee'], noise: ['moderate', 'lively'] },
  treat: { tags: ['pastries', 'food', 'specialty-coffee'], noise: ['moderate', 'lively', 'quiet'] },
}

const VALID_MOODS = new Set<string>(MOODS)
const VALID_TAGS = new Set<string>(CAFE_TAGS)

function cleanMood(mood: unknown): Mood | undefined {
  return typeof mood === 'string' && VALID_MOODS.has(mood) ? (mood as Mood) : undefined
}

function cleanTags(tags: unknown): CafeTag[] {
  if (!Array.isArray(tags)) return []
  return [...new Set(tags.filter((t): t is CafeTag => typeof t === 'string' && VALID_TAGS.has(t)))]
}

function cleanBudget(budget: unknown): PriceLevel | undefined {
  return budget === 1 || budget === 2 || budget === 3 ? budget : undefined
}

/**
 * Median of the budgets members set; for an even count, the floor of the two
 * middle values' mean (so [1, 3] → 2). Undefined if nobody set a budget.
 */
export function groupBudget(prefs: readonly ScoringPreference[]): PriceLevel | undefined {
  const budgets = prefs
    .map((p) => cleanBudget(p.budgetMax))
    .filter((b): b is PriceLevel => b !== undefined)
    .sort((a, b) => a - b)
  if (budgets.length === 0) return undefined
  const mid = Math.floor(budgets.length / 2)
  const median = budgets.length % 2 === 1 ? budgets[mid] : Math.floor((budgets[mid - 1] + budgets[mid]) / 2)
  return median as PriceLevel
}

export function rankCafes(
  prefs: readonly ScoringPreference[],
  cafes: readonly Cafe[],
  { limit = 12, minResults = 3 }: RankOptions = {},
): ScoredCafe[] {
  const members = prefs.map((p) => ({ mood: cleanMood(p.mood), mustHave: cleanTags(p.mustHave) }))
  const budget = groupBudget(prefs)

  const withinBudget = budget === undefined ? cafes : cafes.filter((c) => c.priceLevel <= budget)
  const relaxed = withinBudget.length < Math.min(minResults, cafes.length)
  const candidates = relaxed ? cafes : withinBudget

  const scored = candidates.map((cafe): ScoredCafe => {
    const tags = new Set<CafeTag>(cafe.tags)
    const mustHaveHits: Partial<Record<CafeTag, number>> = {}
    const moodHits: Partial<Record<Mood, number>> = {}
    let score = 0

    for (const member of members) {
      for (const tag of member.mustHave) {
        if (tags.has(tag)) {
          score += MUST_HAVE_POINTS
          mustHaveHits[tag] = (mustHaveHits[tag] ?? 0) + 1
        }
      }
      if (member.mood) {
        const profile = MOOD_PROFILE[member.mood]
        const tagPoints = profile.tags.filter((t) => tags.has(t)).length * MOOD_TAG_POINTS
        const noisePoints = profile.noise.includes(cafe.noise) ? MOOD_NOISE_POINTS : 0
        score += tagPoints + noisePoints
        if (tagPoints + noisePoints > 0) moodHits[member.mood] = (moodHits[member.mood] ?? 0) + 1
      }
    }

    const overBudget = budget !== undefined && cafe.priceLevel > budget
    if (overBudget) score -= OVER_BUDGET_PENALTY * (cafe.priceLevel - budget)

    return { cafe, score, mustHaveHits, moodHits, overBudget }
  })

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.cafe.priceLevel - b.cafe.priceLevel ||
      (a.cafe.id < b.cafe.id ? -1 : a.cafe.id > b.cafe.id ? 1 : 0),
  )
  return scored.slice(0, Math.max(0, limit))
}
