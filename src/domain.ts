/**
 * Shared vocabulary for whereto. Imported by schemas (select options), the
 * worker (scoring + AI prompt) and the UI, so the three can never drift.
 */

export const MOODS = ['focus', 'chat', 'date', 'cozy', 'quick', 'treat'] as const
export type Mood = (typeof MOODS)[number]

export const CAFE_TAGS = [
  'wifi',
  'outlets',
  'quiet',
  'outdoor',
  'vegan',
  'pastries',
  'late',
  'spacious',
  'specialty-coffee',
  'food',
  'tea',
  'matcha',
  'desserts',
] as const
export type CafeTag = (typeof CAFE_TAGS)[number]

export const ROOM_STATUS = ['collecting', 'recommending', 'voting', 'decided'] as const
export type RoomStatus = (typeof ROOM_STATUS)[number]

export const MEMBER_STATUS = ['active', 'removed'] as const
export type MemberStatus = (typeof MEMBER_STATUS)[number]

export const ROOM_ROLES = ['host', 'member'] as const
export type RoomRole = (typeof ROOM_ROLES)[number]

export const RECOMMENDATION_SOURCES = ['ai', 'fallback'] as const
export type RecommendationSource = (typeof RECOMMENDATION_SOURCES)[number]

/** The host can ask for picks once at least this many members have filled in a card. */
export const MIN_PREFS_TO_RECOMMEND = 2

export type PriceLevel = 1 | 2 | 3

export interface Cafe {
  id: string
  name: string
  neighborhood: string
  address: string
  mapsUrl?: string
  /** Unknown when the source doesn't say. The scorer never drops a café for an unknown price. */
  priceLevel?: PriceLevel
  tags: readonly CafeTag[]
  /** Only when the source says so ("calm" → quiet, "busy" → lively). */
  noise?: 'quiet' | 'moderate' | 'lively'
  /** Not stored by the source corpus; hidden in the UI when missing. */
  hours?: string
  /** One or two sentences, written only from the source's drinks + vibe. This is what Claude reads. */
  blurb: string
}

export const LIMITS = {
  roomNameMax: 60,
  areaMax: 60,
  noteMax: 200,
  joinCodeLength: 10,
} as const

/** Record shapes (the `data` part of each envelope). */
export interface RoomData {
  name: string
  hostId: string
  roomId: string
  joinCode: string
  status: RoomStatus
  area?: string
  winnerCafeId?: string
  decidedAt?: string
}

export interface TeamMemberData {
  teamId: string
  userId: string
  status: MemberStatus
  roomRole: RoomRole
}

export interface PreferenceData {
  roomId: string
  userId: string
  mood?: Mood
  mustHave?: CafeTag[]
  budgetMax?: PriceLevel
  note?: string
}

export interface VoteData {
  roomId: string
  userId: string
  cafeId: string
}

export interface RecommendationData {
  roomId: string
  rank: number
  cafeId: string
  reason?: string
  source?: RecommendationSource
}

/**
 * Whether a member has actually said something. One definition, used by the
 * room UI's counts and by `recommendCafes`' "at least 2" gate, so the button
 * and the server can't disagree.
 *
 * `budgetMax` doesn't count: the café corpus has no prices, so the budget
 * picker is hidden and budget is ignored everywhere (PLAN.md "Next steps").
 */
export function hasPreference(p: Partial<PreferenceData> | undefined): boolean {
  if (!p) return false
  return Boolean(p.mood || (Array.isArray(p.mustHave) && p.mustHave.length > 0) || p.note?.trim())
}
