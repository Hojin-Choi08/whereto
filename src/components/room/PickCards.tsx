import { Check, ExternalLink, MapPin, Trophy } from 'lucide-react'
import { useUserLookup } from 'deepspace'
import { Badge, cn } from '@/components/ui'
import { CAFES_BY_ID } from '@/data/cafes'
import type { RecommendationData } from '@/domain'
import { BUDGET_LABELS, TAG_LABELS } from '@/lib/labels'
import { mapsLink } from '@/lib/maps'
import type { Tally } from '@/lib/tally'

type RecRecord = { recordId: string; data: RecommendationData }

interface PickCardsProps {
  picks: RecRecord[]
  /** Live tally — shows vote counts and voter names on each card. */
  tally?: Tally
  /** The viewer's id, to label their own vote "You". */
  myUserId?: string | null
  /** Voting mode: cards become buttons. */
  onVote?: (cafeId: string) => void
  /** The café whose vote is being saved right now. */
  pendingCafeId?: string | null
  /** Decided mode: highlight the winner. */
  winnerCafeId?: string
  heading?: string
}

export function PickCards({ picks, tally, myUserId, onVote, pendingCafeId, winnerCafeId, heading }: PickCardsProps) {
  const usedFallback = picks.some((p) => p.data.source === 'fallback')
  const votersOf = new Map(tally?.byCafe.map((c) => [c.cafeId, c.voters]))
  const myVote = myUserId ? tally?.voteOf.get(myUserId) : undefined

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{heading ?? 'Three picks for the group'}</h2>
        {!winnerCafeId && (
          <p className="text-sm text-muted-foreground">
            {onVote
              ? 'Tap a café to vote. You can change your vote until the host closes voting.'
              : usedFallback
                ? 'Matched from everyone’s preferences.'
                : 'Chosen by Claude from the curated list, based on everyone’s preferences.'}
          </p>
        )}
      </div>
      <ol className="grid gap-3 md:grid-cols-3">
        {picks.map((p) => (
          <PickCard
            key={p.recordId}
            pick={p.data}
            voters={tally ? (votersOf.get(p.data.cafeId) ?? []) : undefined}
            myUserId={myUserId}
            isMyVote={myVote === p.data.cafeId}
            onVote={onVote}
            pending={pendingCafeId === p.data.cafeId}
            disabled={!!pendingCafeId}
            isWinner={winnerCafeId === p.data.cafeId}
            dimmed={!!winnerCafeId && winnerCafeId !== p.data.cafeId}
          />
        ))}
      </ol>
    </section>
  )
}

function PickCard({
  pick, voters, myUserId, isMyVote, onVote, pending, disabled, isWinner, dimmed,
}: {
  pick: RecommendationData
  voters?: string[]
  myUserId?: string | null
  isMyVote: boolean
  onVote?: (cafeId: string) => void
  pending: boolean
  disabled: boolean
  isWinner: boolean
  dimmed: boolean
}) {
  const cafe = CAFES_BY_ID.get(pick.cafeId)

  if (!cafe) {
    return (
      <li className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        This café is no longer on the list.
      </li>
    )
  }

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            {isWinner ? <><Trophy className="size-3" aria-hidden /> Winner</> : `#${pick.rank}`}
          </p>
          <h3 className="text-base font-semibold leading-snug text-foreground">{cafe.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{cafe.neighborhood} · {cafe.address}</span>
          </p>
        </div>
        {cafe.priceLevel && (
          <span className="shrink-0 text-sm font-medium text-foreground" aria-label={`Price level ${cafe.priceLevel} of 3`}>
            {BUDGET_LABELS[cafe.priceLevel]}
          </span>
        )}
      </div>

      {pick.reason && <p className="mt-3 flex-1 text-sm text-foreground">{pick.reason}</p>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {cafe.tags.slice(0, 4).map((t) => (
          <Badge key={t} variant="outline">{TAG_LABELS[t]}</Badge>
        ))}
      </div>
      {cafe.hours && <p className="mt-2 text-xs text-muted-foreground">{cafe.hours}</p>}

      {voters && <Voters voters={voters} myUserId={myUserId} />}

      {onVote && (
        <span
          className={cn(
            'mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-md border text-sm font-medium',
            isMyVote ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground',
          )}
        >
          {pending ? 'Saving…' : isMyVote ? <><Check className="size-4" aria-hidden /> Your vote</> : 'Vote for this'}
        </span>
      )}
    </>
  )

  const cardClass = cn(
    'flex h-full flex-col rounded-lg border bg-card p-4 text-left transition-colors',
    isMyVote || isWinner ? 'border-primary ring-1 ring-primary' : 'border-border',
    dimmed && 'opacity-70',
  )

  return (
    <li className="flex flex-col">
      {onVote ? (
        <button
          type="button"
          aria-pressed={isMyVote}
          disabled={disabled}
          onClick={() => onVote(pick.cafeId)}
          className={cn(cardClass, 'hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait')}
        >
          {body}
        </button>
      ) : (
        <div className={cardClass}>
          {body}
          <a href={mapsLink(cafe)} target="_blank" rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-4 hover:underline">
            Open in Maps <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
      )}
    </li>
  )
}

function Voters({ voters, myUserId }: { voters: string[]; myUserId?: string | null }) {
  const { getName } = useUserLookup()
  const names = voters
    .map((id) => (id === myUserId ? 'You' : (getName(id)?.split(/\s+/)[0] ?? 'Someone')))
    .sort((a, b) => (a === 'You' ? -1 : b === 'You' ? 1 : a.localeCompare(b)))

  return (
    <div className="mt-3 border-t border-border pt-3" aria-live="polite">
      <p className="text-sm font-medium text-foreground">
        {voters.length} {voters.length === 1 ? 'vote' : 'votes'}
      </p>
      {names.length > 0 && <p className="mt-0.5 text-xs text-muted-foreground">{names.join(', ')}</p>}
    </div>
  )
}
