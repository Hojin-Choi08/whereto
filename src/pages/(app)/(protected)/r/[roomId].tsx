/**
 * The room: /r/:roomId. Everything here is live via useQuery; what arrives is
 * already limited to members by `read: 'team'`. Day 1 implements the
 * `collecting` phase; recommending / voting / decided land on Day 2.
 */

import { Link, useParams } from 'react-router-dom'
import { useAuth } from 'deepspace'
import { Badge, buttonVariants } from '@/components/ui'
import { MemberCard, MyPreferenceCard } from '@/components/room/PreferenceCards'
import { ShareLink } from '@/components/room/ShareLink'
import { Spinner } from '@/components/Spinner'
import { useRoom } from '@/lib/useRoom'
import type { RoomStatus } from '@/domain'

const STATUS_LABEL: Record<RoomStatus, string> = {
  collecting: 'Adding preferences',
  recommending: 'Finding cafés…',
  voting: 'Voting',
  decided: 'Decided',
}

const MIN_PREFS_TO_RECOMMEND = 2

export default function RoomPage() {
  const { roomId = '' } = useParams()
  const { userId } = useAuth()
  const { status, room, members, preferences, preferencesReady } = useRoom(roomId)

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label="Opening room…" />
      </div>
    )
  }

  if (!room) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-center">
          <h1 className="text-lg font-semibold text-foreground">Room not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            It may not exist, or you haven&apos;t joined it. Ask the host for the invite link.
          </p>
          <Link to="/new" className={buttonVariants({ className: 'mt-6 w-full' })}>Start your own room</Link>
        </div>
      </div>
    )
  }

  const isHost = room.data.hostId === userId
  const prefByUser = new Map(preferences.map((p) => [p.data.userId, p]))
  const mine = userId ? prefByUser.get(userId) : undefined
  const filledCount = members.filter((m) => prefByUser.has(m.data.userId)).length

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 text-foreground sm:py-10">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{room.data.name}</h1>
          <Badge variant={room.data.status === 'decided' ? 'success' : 'secondary'}>
            {STATUS_LABEL[room.data.status] ?? room.data.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {room.data.area ? `${room.data.area} · ` : ''}
          {members.length} {members.length === 1 ? 'person' : 'people'} · {filledCount} added preferences
        </p>
      </header>

      {room.data.status === 'collecting' ? (
        <>
          {isHost && <ShareLink joinCode={room.data.joinCode} roomName={room.data.name} />}

          <MyPreferenceCard roomId={roomId} mine={mine} preferencesReady={preferencesReady} />

          <section className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Everyone</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {members.map((m) => (
                <MemberCard key={m.recordId} userId={m.data.userId} isHost={m.data.userId === room.data.hostId}
                  isYou={m.data.userId === userId} pref={prefByUser.get(m.data.userId)?.data} />
              ))}
            </ul>
          </section>

          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            {isHost
              ? filledCount >= MIN_PREFS_TO_RECOMMEND
                ? 'Enough people have weighed in to find a café.'
                : `Waiting for at least ${MIN_PREFS_TO_RECOMMEND} people to add preferences before finding a café.`
              : 'When everyone is in, the host will find three cafés for the group to vote on.'}
          </p>
        </>
      ) : (
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          This room has moved on to: {STATUS_LABEL[room.data.status] ?? room.data.status}.
        </p>
      )}
    </div>
  )
}
