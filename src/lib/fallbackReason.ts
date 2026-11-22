import type { CafeTag, Mood } from '../domain'
import { BUDGET_LABELS, MOOD_LABELS, TAG_LABELS } from './labels'
import type { ScoredCafe } from './score'

/**
 * A plain-language reason for a scorer-picked café, used when the AI call
 * fails. Built only from what the scorer actually matched — never invented.
 */
export function fallbackReason({ cafe, mustHaveHits, moodHits, overBudget }: ScoredCafe): string {
  const parts: string[] = []

  const tags = (Object.entries(mustHaveHits) as [CafeTag, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([tag, n]) => (n > 1 ? `${TAG_LABELS[tag].toLowerCase()} (${n} of you)` : TAG_LABELS[tag].toLowerCase()))
  if (tags.length) parts.push(`Has ${joinList(tags)}`)

  const moods = (Object.entries(moodHits) as [Mood, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([mood]) => MOOD_LABELS[mood].label.toLowerCase())
  if (moods.length) parts.push(`suits a ${joinList(moods)} mood`)

  const lead = parts.length ? `${capitalize(parts.join(' and '))}.` : `A solid all-rounder in ${cafe.neighborhood}.`
  const price = overBudget
    ? ` It's a little above the group's budget (${BUDGET_LABELS[cafe.priceLevel]}).`
    : ` ${BUDGET_LABELS[cafe.priceLevel]}, ${cafe.neighborhood}.`
  return lead + price
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
