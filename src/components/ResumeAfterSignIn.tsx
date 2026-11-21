/**
 * After OAuth the worker lands everyone on /home (see src/lib/returnTo.ts).
 * If a room link was pending, cover /home with a "Joining…" screen and send
 * the user on to it. Mounted once in (app)/_layout.tsx, inside AuthBoot, so
 * auth state is already resolved here.
 */

import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from 'deepspace'
import { clearReturnTo, peekReturnTo } from '@/lib/returnTo'
import { Spinner } from '@/components/Spinner'

const LANDING_PATH = '/home'

export function ResumeAfterSignIn() {
  const { isSignedIn } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // Read synchronously on first render so /home never flashes before the redirect.
  const [target, setTarget] = useState(() => peekReturnTo())

  const active = isSignedIn && pathname === LANDING_PATH && target !== null

  useEffect(() => {
    if (!active || !target) return
    clearReturnTo()
    setTarget(null)
    navigate(target, { replace: true })
  }, [active, target, navigate])

  if (!active || !target) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <Spinner label={target.startsWith('/j/') ? 'Joining room…' : 'Opening room…'} />
    </div>
  )
}
