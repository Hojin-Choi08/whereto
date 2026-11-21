import type { CollectionSchema } from 'deepspace/schema'
import { MEMBER_STATUS, ROOM_ROLES } from '../domain'

/**
 * Room membership. The collection name and the teamId / userId / status
 * columns are what the SDK's 'team' permission level resolves against.
 * Written only by actions (recordId = `${roomId}_${userId}`), so userId is
 * deliberately not userBound.
 */
export const teamMembersSchema: CollectionSchema = {
  name: 'team_members',
  columns: [
    { name: 'teamId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: [...MEMBER_STATUS] },
      default: 'active',
    },
    {
      name: 'roomRole',
      storage: 'text',
      interpretation: { kind: 'select', options: [...ROOM_ROLES] },
      default: 'member',
    },
  ],
  teamField: 'teamId',
  uniqueOn: ['teamId', 'userId'],
  permissions: {
    member: { read: 'team', create: false, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
