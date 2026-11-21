/**
 * THROWAWAY — Day 1 step 2 verification of `read: 'team'` (see PLAN.md §6).
 * Delete this file once the check passes. It shows exactly what the DO sends
 * this signed-in user, so two browsers side by side reveal the isolation.
 */

import { useState } from 'react'
import { useAuth, useMutations, useQuery, useUserLookup } from 'deepspace'
import { Button } from '@/components/ui'
import { callAction } from '@/lib/actions'
import { MOODS, type Mood, type PreferenceData, type RoomData, type TeamMemberData } from '@/domain'

const field = 'rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground'

export default function TeamCheckPage() {
  const { userId } = useAuth()
  const { getName } = useUserLookup()
  const [panelKey, setPanelKey] = useState(0)
  const [log, setLog] = useState<string[]>([])
  const say = (line: string) => setLog((l) => [`${new Date().toLocaleTimeString()}  ${line}`, ...l].slice(0, 12))

  const [roomName, setRoomName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)

  async function create() {
    setBusy(true)
    const r = await callAction<{ roomId: string; joinCode: string }>('createRoom', { name: roomName })
    setBusy(false)
    if (r.success) {
      say(`created room "${roomName}" — join code ${r.data.joinCode}`)
      setRoomName('')
    } else say(`createRoom failed: ${r.error}`)
  }

  async function join() {
    setBusy(true)
    const r = await callAction<{ roomId: string; alreadyMember: boolean }>('joinRoom', { joinCode })
    setBusy(false)
    if (r.success) {
      say(`joined ${r.data.roomId}${r.data.alreadyMember ? ' (already a member)' : ''}`)
      setJoinCode('')
      setPanelKey((k) => k + 1) // remount subscriptions (works around the SDK resubscribe bug)
    } else say(`joinRoom failed: ${r.error}`)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 text-foreground">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">read: &apos;team&apos; check</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as <strong>{userId ? (getName(userId) ?? userId) : '—'}</strong>{' '}
          <code className="text-xs">{userId}</code>
        </p>
      </header>

      <section className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
        <div className="space-y-2">
          <h2 className="font-medium">Create a room (you become host)</h2>
          <div className="flex gap-2">
            <input className={`${field} flex-1`} value={roomName} placeholder="Room name"
              onChange={(e) => setRoomName(e.target.value)} />
            <Button disabled={busy || !roomName.trim()} onClick={create}>Create</Button>
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="font-medium">Join by code</h2>
          <div className="flex gap-2">
            <input className={`${field} flex-1 font-mono`} value={joinCode} placeholder="10-char code"
              onChange={(e) => setJoinCode(e.target.value)} />
            <Button disabled={busy || !joinCode.trim()} onClick={join}>Join</Button>
          </div>
        </div>
        {log.length > 0 && (
          <pre className="col-span-full max-h-40 overflow-auto rounded bg-muted p-2 text-xs">{log.join('\n')}</pre>
        )}
      </section>

      <DataPanels key={panelKey} myUserId={userId} />

      <section className="rounded-lg border border-border bg-card p-4 text-sm">
        <h2 className="mb-2 font-medium">What to verify (two accounts, A and B, in separate browsers)</h2>
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>A creates rooms <em>R1</em> and <em>R2</em>. <strong>B sees no rooms, members or preferences.</strong></li>
          <li>A sets a mood in R1. B still sees nothing.</li>
          <li>B joins R1 with its code. <strong>B now sees R1, both memberships and A&apos;s preference</strong> — but not R2.</li>
          <li>B sets a mood/note in R1 → it appears on A&apos;s screen live (no reload). A edits → appears on B&apos;s live.</li>
          <li>Reload B: still R1 only. Joining R2 with a bad code fails cleanly.</li>
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">
          If B sees nothing right after joining until a full reload, that is the known SDK resubscribe bug (PLAN.md risks),
          not a policy failure — note it and reload.
        </p>
      </section>
    </div>
  )
}

function DataPanels({ myUserId }: { myUserId: string | null }) {
  const { getName } = useUserLookup()
  const rooms = useQuery<RoomData>('rooms')
  const members = useQuery<TeamMemberData>('team_members')
  const prefs = useQuery<PreferenceData>('preferences')
  const name = (id: string | undefined) => (id ? (getName(id) ?? id.slice(0, 8)) : '—')

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Panel title={`Rooms I can see (${rooms.records.length})`} status={rooms.status}>
        {rooms.records.map((r) => (
          <li key={r.recordId} className="space-y-0.5">
            <div className="font-medium">{r.data.name}</div>
            <div className="text-xs text-muted-foreground">
              host {name(r.data.hostId)} · {r.data.status} · code <code>{r.data.joinCode}</code>
            </div>
          </li>
        ))}
      </Panel>

      <Panel title={`Memberships I can see (${members.records.length})`} status={members.status}>
        {members.records.map((m) => (
          <li key={m.recordId} className="text-xs">
            <strong>{name(m.data.userId)}</strong> in {roomLabel(rooms.records, m.data.teamId)} — {m.data.roomRole}, {m.data.status}
          </li>
        ))}
      </Panel>

      <Panel title={`Preferences I can see (${prefs.records.length})`} status={prefs.status}>
        {prefs.records.map((p) => (
          <li key={p.recordId} className="text-xs">
            <strong>{name(p.data.userId)}</strong> in {roomLabel(rooms.records, p.data.roomId)}: {p.data.mood ?? '—'}
            {p.data.note ? ` · “${p.data.note}”` : ''}
          </li>
        ))}
      </Panel>

      <div className="space-y-3 md:col-span-3">
        {rooms.records.map((r) => (
          <MyPreferenceEditor key={r.recordId} room={r.data}
            mine={prefs.records.find((p) => p.data.roomId === r.data.roomId && p.data.userId === myUserId)} />
        ))}
      </div>
    </div>
  )
}

function roomLabel(rooms: { data: RoomData }[], roomId: string) {
  return <em>{rooms.find((r) => r.data.roomId === roomId)?.data.name ?? `(unseen room ${roomId.slice(0, 6)})`}</em>
}

function Panel({ title, status, children }: { title: string; status: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-2 text-sm font-medium">{title} <span className="text-xs text-muted-foreground">[{status}]</span></h2>
      <ul className="space-y-2 text-sm">{children}</ul>
    </section>
  )
}

function MyPreferenceEditor({ room, mine }: {
  room: RoomData
  mine: { recordId: string; data: PreferenceData } | undefined
}) {
  const { ready, createConfirmed, put } = useMutations<PreferenceData>('preferences')
  const [note, setNote] = useState(mine?.data.note ?? '')

  async function save(patch: Partial<PreferenceData>) {
    if (mine) await put(mine.recordId, patch)
    // userId is userBound: the DO stamps the caller's verified id, so we don't send it.
    else await createConfirmed({ roomId: room.roomId, ...patch } as PreferenceData)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm">
      <span className="font-medium">My preference in “{room.name}”:</span>
      <select className={field} disabled={!ready} value={mine?.data.mood ?? ''}
        onChange={(e) => void save({ mood: e.target.value as Mood })}>
        <option value="" disabled>mood…</option>
        {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <input className={`${field} min-w-48 flex-1`} placeholder="note" value={note} maxLength={200}
        onChange={(e) => setNote(e.target.value)} />
      <Button size="sm" disabled={!ready} onClick={() => void save({ note })}>Save note</Button>
    </div>
  )
}
