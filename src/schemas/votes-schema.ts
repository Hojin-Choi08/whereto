import type { CollectionSchema } from 'deepspace/schema'

/**
 * One vote per member per room. Writes go through `castVote`, which verifies
 * active membership, the room's voting status, and that the café is a pick.
 */
export const votesSchema: CollectionSchema = {
  name: 'votes',
  columns: [
    { name: 'roomId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', immutable: true },
    { name: 'cafeId', storage: 'text', interpretation: 'plain', required: true },
  ],
  ownerField: 'userId',
  teamField: 'roomId',
  uniqueOn: ['roomId', 'userId'],
  permissions: {
    member: {
      read: 'team',
      create: false,
      update: false,
      delete: false,
    },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
