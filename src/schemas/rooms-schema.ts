import type { CollectionSchema } from 'deepspace/schema'
import { ROOM_STATUS } from '../domain'

/**
 * A whereto room. Created only by the `createRoom` action (with the host's
 * team_members row). `hostId` is the ownerField, so 'own' == "is host".
 * `roomId` duplicates recordId because the per-record 'team' check reads
 * record.data[teamField].
 */
export const roomsSchema: CollectionSchema = {
  name: 'rooms',
  columns: [
    { name: 'name', storage: 'text', interpretation: 'plain', required: true },
    { name: 'hostId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'roomId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'joinCode', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: [...ROOM_STATUS] },
      default: 'collecting',
    },
    { name: 'area', storage: 'text', interpretation: 'plain' },
    { name: 'winnerCafeId', storage: 'text', interpretation: 'plain' },
    { name: 'decidedAt', storage: 'text', interpretation: { kind: 'datetime' } },
  ],
  ownerField: 'hostId',
  teamField: 'roomId',
  permissions: {
    member: {
      read: 'team',
      create: false,
      update: 'own',
      delete: false,
      writableFields: ['name', 'area'],
    },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
