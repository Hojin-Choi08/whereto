/**
 * The room: /r/:roomId. Everything here is live via useQuery; what arrives is
 * already limited to members by `read: 'team'`. Phases follow rooms.status:
 * collecting → recommending (everyone sees "thinking") → voting (3 picks).
 */

import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useAuth } from 'deepspace'
import { Badge, Button, buttonVariants, useToast } from '@/components/ui'
import { PickCards } from '@/components/room/PickCards'
import { MemberCard, MyPreferenceCard } from '@/components/room/PreferenceCards'
import { ShareLink } from '@/components/room/ShareLink'
import { VotingPanel, WinnerCard } from '@/components/room/Voting'
import { Spinner } from '@/components/Spinner'
import { MIN_PREFS_TO_RECOMMEND, hasPreference, type RoomStatus } from '@/domain'
import { callAction } from '@/lib/actions'
import { tallyVotes } from '@/lib/tally'
import { useRoom } from '@/lib/useRoom'

const STATUS_LABEL: Record<RoomStatus, string> = {
  collecting: 'Adding preferences',
  recommending: 'Finding cafés…',
  voting: 'Voting',
  decided: 'Decided',
}

export default function RoomPage() {
  const { roomId = '' } = useParams()
  const { userId } = useAuth()
  const { status, room, members, preferences, preferencesReady, recommendations, votes } = useRoom(roomId)
  const tally = useMemo(
    () =>
      tallyVotes(
        recommendations.map((r) => ({ cafeId: r.data.cafeId, rank: r.data.rank })),
        votes.map((v) => ({ userId: v.data.userId, cafeId: v.data.cafeId })),
        members.map((m) => m.data.userId),
      ),
    [recommendations, votes, members],
  )

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
  const filledCount = members.filter((m) => hasPreference(prefByUser.get(m.data.userId)?.data)).length
  const phase = room.data.status

  const everyone = (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {phase === 'collecting' ? 'Everyone' : 'What everyone asked for'}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {members.map((m) => (
          <MemberCard key={m.recordId} userId={m.data.userId} isHost={m.data.userId === room.data.hostId}
            isYou={m.data.userId === userId} pref={prefByUser.get(m.data.userId)?.data} />
        ))}
      </ul>
    </section>
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 text-foreground sm:py-10">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{room.data.name}</h1>
          <Badge variant={phase === 'decided' ? 'success' : 'secondary'}>{STATUS_LABEL[phase] ?? phase}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {room.data.area ? `${room.data.area} · ` : ''}
          {members.length} {members.length === 1 ? 'person' : 'people'} · {filledCount} added preferences
        </p>
      </header>

      {phase === 'collecting' && (
        <>
          {isHost && <ShareLink joinCode={room.data.joinCode} roomName={room.data.name} />}
          <MyPreferenceCard roomId={roomId} mine={mine} preferencesReady={preferencesReady} />
          {everyone}
          {isHost ? (
            <FindCafeButton roomId={roomId} filledCount={filledCount} />
          ) : (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              When everyone is in, the host will find three cafés for the group.
            </p>
          )}
        </>
      )}

      {phase === 'recommending' && (
        <>
          <div className="flex min-h-48 items-center justify-center rounded-lg border border-border bg-card p-8">
            <Spinner label="Finding three cafés for the group…" />
          </div>
          {everyone}
        </>
      )}

      {(phase === 'voting' || phase === 'decided') && recommendations.length === 0 && (
        <div className="flex min-h-32 items-center justify-center rounded-lg border border-border bg-card p-6">
          <Spinner label="Loading picks…" />
        </div>
      )}

      {phase === 'voting' && recommendations.length > 0 && (
        <>
          <VotingPanel roomId={roomId} picks={recommendations} votes={votes} tally={tally}
            myUserId={userId} isHost={isHost} />
          {everyone}
        </>
      )}

      {phase === 'decided' && recommendations.length > 0 && (
        <>
          {/* rooms.winnerCafeId is the server's decision; the tally is shown for context. */}
          {room.data.winnerCafeId && <WinnerCard winnerCafeId={room.data.winnerCafeId} tally={tally} />}
          <PickCards picks={recommendations} tally={tally} myUserId={userId}
            winnerCafeId={room.data.winnerCafeId} heading="How everyone voted" />
          {everyone}
        </>
      )}
    </div>
  )
}

/** Host-only. The server re-checks every gate; this just avoids pointless clicks. */
function FindCafeButton({ roomId, filledCount }: { roomId: string; filledCount: number }) {
  const [busy, setBusy] = useState(false)
  const { error } = useToast()
  const ready = filledCount >= MIN_PREFS_TO_RECOMMEND

  async function find() {
    setBusy(true)
    const res = await callAction<{ source: string }>('recommendCafes', { roomId })
    // On success the room flips to `voting` via the live subscription and this
    // component unmounts; only failures need handling here.
    if (!res.success) {
      error('Couldn’t find cafés', res.error)
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <p className="text-sm text-muted-foreground">
        {ready
          ? 'Everyone in? Get three cafés picked for the group. You can only do this once.'
          : `Waiting for at least ${MIN_PREFS_TO_RECOMMEND} people to add preferences (${filledCount} so far).`}
      </p>
      <Button className="mt-3 w-full sm:mt-0 sm:w-auto" onClick={find} disabled={!ready || busy} loading={busy}>
        {!busy && <Sparkles aria-hidden />} Find our café
      </Button>
    </div>
  )
}
