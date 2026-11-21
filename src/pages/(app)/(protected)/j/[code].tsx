/**
 * Invite link landing: /j/:code. <AuthGate> (the (protected) layout) has
 * already made the visitor sign in; we join and hand off to the room page.
 * Navigating after the join also means the room's subscriptions open only
 * once membership exists (sidesteps the SDK resubscribe bug — PLAN.md risks).
 */

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { buttonVariants } from '@/components/ui'
import { Spinner } from '@/components/Spinner'
import { callAction } from '@/lib/actions'

export default function JoinPage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false) // StrictMode runs effects twice in dev

  useEffect(() => {
    if (started.current) return
    started.current = true
    void callAction<{ roomId: string }>('joinRoom', { joinCode: code }).then((res) => {
      if (res.success) navigate(`/r/${res.data.roomId}`, { replace: true })
      else setError(res.error)
    })
  }, [code, navigate])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      {error ? (
        <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-center">
          <h1 className="text-lg font-semibold text-foreground">Couldn&apos;t join</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Link to="/new" className={buttonVariants({ className: 'mt-6 w-full' })}>Start your own room</Link>
        </div>
      ) : (
        <Spinner label="Joining room…" />
      )}
    </div>
  )
}
