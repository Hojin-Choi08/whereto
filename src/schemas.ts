/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 *
 * Add schemas by creating a file in src/schemas/ and importing it here.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { usersSchema } from './schemas/users-schema'
import { roomsSchema } from './schemas/rooms-schema'
import { teamMembersSchema } from './schemas/team-members-schema'
import { preferencesSchema } from './schemas/preferences-schema'
import { recommendationsSchema } from './schemas/recommendations-schema'
import { votesSchema } from './schemas/votes-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  roomsSchema,
  teamMembersSchema,
  preferencesSchema,
  recommendationsSchema,
  votesSchema,
]
