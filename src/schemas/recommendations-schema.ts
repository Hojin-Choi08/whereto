import type { CollectionSchema } from 'deepspace/schema'
import { RECOMMENDATION_SOURCES } from '../domain'

/**
 * The 3 picks for a room. Written only by the `recommendCafes` action, with
 * recordId `${roomId}_${rank}` so a retried run overwrites rather than
 * duplicates.
 */
export const recommendationsSchema: CollectionSchema = {
  name: 'recommendations',
  columns: [
    { name: 'roomId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'rank', storage: 'number', interpretation: 'plain', required: true },
    { name: 'cafeId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'reason', storage: 'text', interpretation: 'plain' },
    {
      name: 'source',
      storage: 'text',
      interpretation: { kind: 'select', options: [...RECOMMENDATION_SOURCES] },
    },
  ],
  teamField: 'roomId',
  uniqueOn: ['roomId', 'rank'],
  permissions: {
    member: { read: 'team', create: false, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
