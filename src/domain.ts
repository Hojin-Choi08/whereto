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
] as const
export type CafeTag = (typeof CAFE_TAGS)[number]

export const ROOM_STATUS = ['collecting', 'recommending', 'voting', 'decided'] as const
export type RoomStatus = (typeof ROOM_STATUS)[number]

export const MEMBER_STATUS = ['active', 'removed'] as const
export type MemberStatus = (typeof MEMBER_STATUS)[number]

export const ROOM_ROLES = ['host', 'member'] as const
export type RoomRole = (typeof ROOM_ROLES)[number]

export type PriceLevel = 1 | 2 | 3

export interface Cafe {
  id: string
  name: string
  neighborhood: string
  address: string
  mapsUrl?: string
  priceLevel: PriceLevel
  tags: readonly CafeTag[]
  noise: 'quiet' | 'moderate' | 'lively'
  hours: string
  /** One or two sentences — this is what Claude reads. */
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
