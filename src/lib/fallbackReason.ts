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

  // Price is mentioned only when the source knows it — never guessed.
  const price = cafe.priceLevel ? BUDGET_LABELS[cafe.priceLevel] : undefined
  if (!parts.length) {
    return `A solid all-rounder in ${cafe.neighborhood}.${price && !overBudget ? ` ${price}.` : ''}${overBudgetNote(price, overBudget)}`
  }
  const lead = `${capitalize(parts.join(' and '))}.`
  if (overBudget) return `${lead} ${cafe.neighborhood}.${overBudgetNote(price, overBudget)}`
  return `${lead} ${price ? `${price}, ` : ''}${cafe.neighborhood}.`
}

function overBudgetNote(price: string | undefined, overBudget: boolean): string {
  return overBudget && price ? ` It's a little above the group's budget (${price}).` : ''
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
