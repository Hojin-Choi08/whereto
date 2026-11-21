import type { CafeTag, Mood, PriceLevel } from '@/domain'

export const MOOD_LABELS: Record<Mood, { label: string; emoji: string }> = {
  focus: { label: 'Focus', emoji: '💻' },
  chat: { label: 'Catch up', emoji: '💬' },
  date: { label: 'Date', emoji: '🕯️' },
  cozy: { label: 'Cozy', emoji: '🧣' },
  quick: { label: 'Quick', emoji: '⚡' },
  treat: { label: 'Treat', emoji: '🍰' },
}

export const TAG_LABELS: Record<CafeTag, string> = {
  wifi: 'Wi-Fi',
  outlets: 'Outlets',
  quiet: 'Quiet',
  outdoor: 'Outdoor',
  vegan: 'Vegan',
  pastries: 'Pastries',
  late: 'Open late',
  spacious: 'Roomy',
  'specialty-coffee': 'Great coffee',
  food: 'Real food',
}

export const BUDGET_LABELS: Record<PriceLevel, string> = { 1: '$', 2: '$$', 3: '$$$' }
