import { ExternalLink, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui'
import { CAFES_BY_ID } from '@/data/cafes'
import type { RecommendationData } from '@/domain'
import { BUDGET_LABELS, TAG_LABELS } from '@/lib/labels'

type RecRecord = { recordId: string; data: RecommendationData }

export function PickCards({ picks }: { picks: RecRecord[] }) {
  const usedFallback = picks.some((p) => p.data.source === 'fallback')

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Three picks for the group</h2>
        <p className="text-sm text-muted-foreground">
          {usedFallback
            ? 'Matched from everyone’s preferences.'
            : 'Chosen by Claude from the curated list, based on everyone’s preferences.'}
        </p>
      </div>
      <ol className="grid gap-3 md:grid-cols-3">
        {picks.map((p) => (
          <PickCard key={p.recordId} pick={p.data} />
        ))}
      </ol>
    </section>
  )
}

function PickCard({ pick }: { pick: RecommendationData }) {
  const cafe = CAFES_BY_ID.get(pick.cafeId)

  if (!cafe) {
    return (
      <li className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        This café is no longer on the list.
      </li>
    )
  }

  return (
    <li className="flex flex-col rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">#{pick.rank}</p>
          <h3 className="text-base font-semibold leading-snug text-foreground">{cafe.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{cafe.neighborhood} · {cafe.address}</span>
          </p>
        </div>
        <span className="shrink-0 text-sm font-medium text-foreground" aria-label={`Price level ${cafe.priceLevel} of 3`}>
          {BUDGET_LABELS[cafe.priceLevel]}
        </span>
      </div>

      {pick.reason && <p className="mt-3 flex-1 text-sm text-foreground">{pick.reason}</p>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {cafe.tags.slice(0, 4).map((t) => (
          <Badge key={t} variant="outline">{TAG_LABELS[t]}</Badge>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{cafe.hours}</p>

      {cafe.mapsUrl && (
        <a href={cafe.mapsUrl} target="_blank" rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-4 hover:underline">
          Open in Maps <ExternalLink className="size-3" aria-hidden />
        </a>
      )}
    </li>
  )
}
