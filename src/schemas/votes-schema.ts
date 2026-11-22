import type { CollectionSchema } from 'deepspace/schema'

/**
 * One vote per member per room; changing your vote is a `put` on cafeId.
 * `userId` is stamped by the server (userBound) and is the ownerField, so a
 * member can only ever edit their own vote. Validity (active member, cafeId
 * is one of the room's picks, room is voting) is enforced where it counts:
 * the tally in `closeVoting` (PLAN.md §2).
 */
export const votesSchema: CollectionSchema = {
  name: 'votes',
  columns: [
    { name: 'roomId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'cafeId', storage: 'text', interpretation: 'plain', required: true },
  ],
  ownerField: 'userId',
  teamField: 'roomId',
  uniqueOn: ['roomId', 'userId'],
  permissions: {
    member: {
      read: 'team',
      create: true,
      update: 'own',
      delete: 'own',
      writableFields: ['roomId', 'cafeId'],
    },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
