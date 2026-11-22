/**
 * Live presence for a room: who's here now, and who's editing their card.
 *
 * Backed by `usePresenceRoom('room:<id>')` — an in-memory PresenceRoom DO,
 * nothing persisted. The worker only admits active room members to that
 * scope (src/server/room-presence.ts). Mount the provider only once the room
 * has loaded, so non-members never open the socket.
 *
 * `markEditing()` sends `editing: true` on the first change and `false` after
 * IDLE_MS without changes — one message per transition, not per keystroke.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { usePresenceRoom } from 'deepspace'

const IDLE_MS = 3000

interface RoomPresence {
  /** False until the presence socket is up — callers show no dots rather than "everyone offline". */
  connected: boolean
  /** Other members currently in the room (excludes you). */
  online: ReadonlySet<string>
  /** Other members currently editing their card. */
  editing: ReadonlySet<string>
  /** Call on every edit to your own card. */
  markEditing: () => void
}

const EMPTY: ReadonlySet<string> = new Set()
const RoomPresenceContext = createContext<RoomPresence>({
  connected: false,
  online: EMPTY,
  editing: EMPTY,
  markEditing: () => {},
})

export function RoomPresenceProvider({ roomId, children }: { roomId: string; children: ReactNode }) {
  const { peers, connected, updateState } = usePresenceRoom(`room:${roomId}`)
  const isEditing = useRef(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Keep the latest updateState without re-creating markEditing on every render.
  const send = useRef(updateState)
  useEffect(() => {
    send.current = updateState
  }, [updateState])

  const markEditing = useCallback(() => {
    if (!isEditing.current) {
      isEditing.current = true
      send.current({ editing: true })
    }
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => {
      isEditing.current = false
      send.current({ editing: false })
    }, IDLE_MS)
  }, [])

  useEffect(() => () => clearTimeout(idleTimer.current), [])

  const value = useMemo<RoomPresence>(
    () => ({
      connected,
      online: new Set(peers.map((p) => p.userId)),
      editing: new Set(peers.filter((p) => p.state.editing === true).map((p) => p.userId)),
      markEditing,
    }),
    [connected, peers, markEditing],
  )

  return <RoomPresenceContext.Provider value={value}>{children}</RoomPresenceContext.Provider>
}

export function useRoomPresence(): RoomPresence {
  return useContext(RoomPresenceContext)
}
