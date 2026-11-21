import type { CollectionSchema } from 'deepspace/schema'
import { MOODS } from '../domain'

/** One mood/constraints card per user per room, edited live by its owner. */
export const preferencesSchema: CollectionSchema = {
  name: 'preferences',
  columns: [
    { name: 'roomId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'mood', storage: 'text', interpretation: { kind: 'select', options: [...MOODS] } },
    { name: 'mustHave', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'budgetMax', storage: 'number', interpretation: 'plain' },
    { name: 'note', storage: 'text', interpretation: 'plain' },
  ],
  ownerField: 'userId',
  teamField: 'roomId',
  uniqueOn: ['roomId', 'userId'],
  permissions: {
    member: { read: 'team', create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
