import { useEffect, useRef, useState } from 'react'
import { useMutations, useUserLookup } from 'deepspace'
import { Avatar, AvatarFallback, AvatarImage, Badge, Textarea, cn, useToast } from '@/components/ui'
import { CAFE_TAGS, LIMITS, MOODS, hasPreference, type CafeTag, type Mood, type PreferenceData } from '@/domain'
import { MOOD_LABELS, TAG_LABELS } from '@/lib/labels'

type PrefRecord = { recordId: string; data: PreferenceData }

// ---------------------------------------------------------------------------
// Draft <-> record helpers
//
// No budget here: the café corpus has no prices, so the budget picker is
// hidden (PLAN.md "Next steps"). The `budgetMax` column is untouched, so
// bringing it back needs no migration.
// ---------------------------------------------------------------------------

interface Draft {
  mood?: Mood
  mustHave: CafeTag[]
  note: string
}

function draftFrom(record: PrefRecord | undefined): Draft {
  return {
    mood: record?.data.mood,
    mustHave: record?.data.mustHave ?? [],
    note: record?.data.note ?? '',
  }
}

/** The exact fields we write — normalised, so comparing against the server can't loop. */
function toPatch(d: Draft): Omit<PreferenceData, 'roomId' | 'userId' | 'budgetMax'> {
  return {
    mood: d.mood,
    mustHave: [...d.mustHave].sort(),
    note: d.note.trim().slice(0, LIMITS.noteMax),
  }
}

function matchesServer(d: Draft, server: PreferenceData): boolean {
  const p = toPatch(d)
  return (
    p.mood === server.mood &&
    p.note === (server.note ?? '') &&
    (p.mustHave ?? []).join(',') === [...(server.mustHave ?? [])].sort().join(',')
  )
}

function isEmpty(d: Draft): boolean {
  return !d.mood && d.mustHave.length === 0 && !d.note.trim()
}

// ---------------------------------------------------------------------------
// Your own card — local draft, debounced live sync
// ---------------------------------------------------------------------------

export function MyPreferenceCard({
  roomId,
  mine,
  preferencesReady,
}: {
  roomId: string
  mine: PrefRecord | undefined
  preferencesReady: boolean
}) {
  const { ready, put, createConfirmed } = useMutations<PreferenceData>('preferences')
  const { error } = useToast()
  const [draft, setDraft] = useState<Draft | null>(null)
  const creating = useRef(false)

  // Hydrate once, after the server snapshot arrives (so a reload restores your
  // card and we never create a duplicate row). Later server echoes don't
  // overwrite what you're typing.
  useEffect(() => {
    if (draft === null && preferencesReady) setDraft(draftFrom(mine))
  }, [draft, preferencesReady, mine])

  // Debounced sync: first write creates (confirmed), later writes patch.
  useEffect(() => {
    if (!draft || !ready) return
    if (mine ? matchesServer(draft, mine.data) : isEmpty(draft)) return
    const timer = setTimeout(async () => {
      if (mine) {
        void put(mine.recordId, toPatch(draft)) // rejections surface via onWriteError toasts
        return
      }
      if (creating.current) return // the new row's echo re-runs this effect
      creating.current = true
      try {
        // userId is userBound — the server stamps it.
        await createConfirmed({ roomId, ...toPatch(draft) } as PreferenceData)
      } catch (e) {
        error('Could not save your preferences', e instanceof Error ? e.message : undefined)
      } finally {
        creating.current = false
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [draft, mine, ready, put, createConfirmed, roomId, error])

  if (!draft) {
    return <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />
  }

  const saving = mine ? !matchesServer(draft, mine.data) : !isEmpty(draft)
  const update = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d))
  const toggleTag = (tag: CafeTag) =>
    update({ mustHave: draft.mustHave.includes(tag) ? draft.mustHave.filter((t) => t !== tag) : [...draft.mustHave, tag] })

  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">Your card</h2>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {saving ? 'Saving…' : mine ? 'Saved · everyone can see this' : 'Pick anything to start'}
        </span>
      </div>

      <Field label="What's the mood?">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {MOODS.map((m) => (
            <Chip key={m} selected={draft.mood === m} onClick={() => update({ mood: draft.mood === m ? undefined : m })}
              disabled={!ready} className="flex-col py-2">
              <span className="text-lg leading-none" aria-hidden>{MOOD_LABELS[m].emoji}</span>
              <span className="text-xs">{MOOD_LABELS[m].label}</span>
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Must have">
        <div className="flex flex-wrap gap-2">
          {CAFE_TAGS.map((t) => (
            <Chip key={t} selected={draft.mustHave.includes(t)} onClick={() => toggleTag(t)} disabled={!ready}>
              {TAG_LABELS[t]}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Anything else?" htmlFor="pref-note">
        <Textarea id="pref-note" rows={2} maxLength={LIMITS.noteMax} disabled={!ready}
          placeholder="e.g. I can only do 30 minutes, near the station please"
          value={draft.note} onChange={(e) => update({ note: e.target.value })} />
        <p className="mt-1 text-right text-[11px] text-muted-foreground">{draft.note.length}/{LIMITS.noteMax}</p>
      </Field>
    </section>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <label htmlFor={htmlFor} className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}

function Chip({ selected, className, ...props }: React.ComponentProps<'button'> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'inline-flex items-center justify-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors',
        'disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-foreground hover:bg-muted',
        className,
      )}
      {...props}
    />
  )
}

// ---------------------------------------------------------------------------
// Everyone else's cards — read-only, live
// ---------------------------------------------------------------------------

export function MemberCard({ userId, isHost, isYou, pref }: {
  userId: string
  isHost: boolean
  isYou: boolean
  pref: PreferenceData | undefined
}) {
  const { getUser } = useUserLookup()
  const user = getUser(userId)
  const name = user?.name || 'Someone'
  const filledIn = hasPreference(pref)

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <Avatar className="size-9">
          {user?.imageUrl && <AvatarImage src={user.imageUrl} alt="" />}
          <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {name}{isYou && <span className="text-muted-foreground"> (you)</span>}
          </p>
          {isHost && <Badge variant="secondary" size="sm">Host</Badge>}
        </div>
        {pref?.mood && (
          <span className="text-sm text-foreground" title={MOOD_LABELS[pref.mood].label}>
            <span aria-hidden>{MOOD_LABELS[pref.mood].emoji}</span> {MOOD_LABELS[pref.mood].label}
          </span>
        )}
      </div>

      {filledIn && pref ? (
        <div className="mt-3 space-y-2">
          {(pref.mustHave?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pref.mustHave?.map((t) => <Badge key={t} variant="outline">{TAG_LABELS[t] ?? t}</Badge>)}
            </div>
          )}
          {pref.note && <p className="text-sm text-muted-foreground">“{pref.note}”</p>}
        </div>
      ) : (
        <p className="mt-3 text-sm italic text-muted-foreground">Still deciding…</p>
      )}
    </li>
  )
}
