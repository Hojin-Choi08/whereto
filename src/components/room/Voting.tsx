import { useState } from 'react'
import { ExternalLink, MapPin, PartyPopper } from 'lucide-react'
import { useMutations } from 'deepspace'
import { Button, ConfirmModal, buttonVariants, useToast } from '@/components/ui'
import { CAFES_BY_ID } from '@/data/cafes'
import type { RecommendationData, VoteData } from '@/domain'
import { callAction } from '@/lib/actions'
import { BUDGET_LABELS } from '@/lib/labels'
import { mapsLink } from '@/lib/maps'
import type { Tally } from '@/lib/tally'
import { PickCards } from './PickCards'

type RecRecord = { recordId: string; data: RecommendationData }
type VoteRecord = { recordId: string; data: VoteData }

// ---------------------------------------------------------------------------
// Voting phase
// ---------------------------------------------------------------------------

export function VotingPanel({ roomId, picks, votes, tally, myUserId, isHost }: {
  roomId: string
  picks: RecRecord[]
  votes: VoteRecord[]
  tally: Tally
  myUserId: string | null
  isHost: boolean
}) {
  const { ready, createConfirmed, putConfirmed } = useMutations<VoteData>('votes')
  const { error } = useToast()
  const [pending, setPending] = useState<string | null>(null)
  const myVoteRow = votes.find((v) => v.data.userId === myUserId)

  async function vote(cafeId: string) {
    if (!ready || pending || myVoteRow?.data.cafeId === cafeId) return
    setPending(cafeId)
    try {
      if (myVoteRow) await putConfirmed(myVoteRow.recordId, { cafeId })
      // userId is userBound — the server stamps it.
      else await createConfirmed({ roomId, cafeId } as VoteData)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      // A double tap can race two creates; uniqueOn refuses the second and
      // the first one's echo already shows the vote. Anything else is real.
      if (!msg.includes('Duplicate')) error('Couldn’t save your vote', msg || undefined)
    } finally {
      setPending(null)
    }
  }

  const allVoted = tally.memberCount > 0 && tally.votedCount === tally.memberCount

  return (
    <div className="space-y-4">
      <VoteProgress voted={tally.votedCount} total={tally.memberCount} />
      <PickCards picks={picks} tally={tally} myUserId={myUserId} onVote={vote} pendingCafeId={pending}
        heading="Vote for your favourite" />
      {isHost ? (
        <CloseVotingButton roomId={roomId} allVoted={allVoted} voted={tally.votedCount} total={tally.memberCount} />
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {allVoted ? 'Everyone has voted — waiting for the host to reveal the winner.' : 'The host will close voting once everyone is in.'}
        </p>
      )}
    </div>
  )
}

function VoteProgress({ voted, total }: { voted: number; total: number }) {
  const pct = total > 0 ? Math.round((voted / total) * 100) : 0
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-foreground" aria-live="polite">{voted} of {total} voted</span>
        {voted === total && total > 0 && <span className="text-muted-foreground">Everyone’s in</span>}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0}
        aria-valuemax={total} aria-valuenow={voted} aria-label="Votes cast">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/** Host-only. Asks first if not everyone has voted. The server re-checks everything. */
function CloseVotingButton({ roomId, allVoted, voted, total }: {
  roomId: string
  allVoted: boolean
  voted: number
  total: number
}) {
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const { error } = useToast()

  async function close() {
    setBusy(true)
    const res = await callAction<{ winnerCafeId: string }>('closeVoting', { roomId })
    // Success flips the room to `decided` live and unmounts this.
    if (!res.success) {
      error('Couldn’t close voting', res.error)
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <p className="text-sm text-muted-foreground">
        {allVoted ? 'Everyone has voted. Reveal the winner?' : `${voted} of ${total} have voted so far.`}
      </p>
      <Button className="mt-3 w-full sm:mt-0 sm:w-auto" loading={busy} disabled={busy}
        onClick={() => (allVoted ? void close() : setConfirming(true))}>
        Close voting
      </Button>
      <ConfirmModal
        open={confirming}
        onClose={() => !busy && setConfirming(false)}
        onConfirm={() => void close()}
        title="Close voting now?"
        description={`Only ${voted} of ${total} have voted. Votes are final once you close — ties go to the higher-ranked pick.`}
        confirmText="Close voting"
        loading={busy}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Decided phase
// ---------------------------------------------------------------------------

export function WinnerCard({ winnerCafeId, tally }: { winnerCafeId: string; tally: Tally }) {
  const cafe = CAFES_BY_ID.get(winnerCafeId)
  const winnerVotes = tally.byCafe.find((c) => c.cafeId === winnerCafeId)?.voters.length ?? 0

  if (!cafe) {
    return (
      <section className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        The winning café is no longer on the list.
      </section>
    )
  }

  return (
    <section className="rounded-xl border-2 border-primary bg-card p-6 text-center sm:p-8">
      <PartyPopper className="mx-auto size-8 text-primary" aria-hidden />
      <p className="mt-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">You’re going to</p>
      <h2 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{cafe.name}</h2>
      <p className="mt-2 flex items-center justify-center gap-1 text-sm text-muted-foreground">
        <MapPin className="size-4 shrink-0" aria-hidden />
        {cafe.address} · {cafe.neighborhood}
      </p>
      {(cafe.priceLevel || cafe.hours) && (
        <p className="mt-1 text-sm text-muted-foreground">
          {[cafe.priceLevel && BUDGET_LABELS[cafe.priceLevel], cafe.hours].filter(Boolean).join(' · ')}
        </p>
      )}
      <p className="mt-3 text-sm text-foreground">
        {winnerVotes} of {tally.memberCount} {winnerVotes === 1 ? 'vote' : 'votes'}
        {tally.tieBrokenByRank && ' · tie broken by Claude’s ranking'}
      </p>
      <a href={mapsLink(cafe)} target="_blank" rel="noreferrer"
        className={buttonVariants({ size: 'lg', className: 'mt-6 w-full sm:w-auto' })}>
        Open in Maps <ExternalLink aria-hidden />
      </a>
    </section>
  )
}
