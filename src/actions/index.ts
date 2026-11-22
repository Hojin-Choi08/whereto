import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { createRoom, joinRoom } from './rooms'
import { recommendCafes } from './recommend'
import { castVote, closeVoting } from './voting'

export const actions: Record<string, ActionHandler<Env>> = {
  createRoom,
  joinRoom,
  recommendCafes,
  castVote,
  closeVoting,
}
