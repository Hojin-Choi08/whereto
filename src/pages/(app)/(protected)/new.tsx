import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Label } from '@/components/ui'
import { LIMITS } from '@/domain'
import { callAction } from '@/lib/actions'

export default function NewRoomPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [area, setArea] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await callAction<{ roomId: string }>('createRoom', { name, area })
    if (res.success) {
      navigate(`/r/${res.data.roomId}`)
    } else {
      setError(res.error)
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 text-foreground sm:py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Start a room</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        You&apos;ll get a link to share. Everyone adds what they&apos;re in the mood for, then you pick together.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="room-name">Room name</Label>
          <Input id="room-name" required autoFocus maxLength={LIMITS.roomNameMax}
            placeholder="Saturday study crew" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="room-area">
            Area <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input id="room-area" maxLength={LIMITS.areaMax} placeholder="e.g. near Old Town"
            value={area} onChange={(e) => setArea(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" loading={busy} disabled={busy || !name.trim()}>
          Create room
        </Button>
      </form>
    </div>
  )
}
