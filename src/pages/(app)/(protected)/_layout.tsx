/**
 * Gated routes. Any file under src/pages/(app)/(protected)/ requires sign-in.
 * The `(protected)` folder is a Generouted route group — parentheses mean
 * it doesn't appear in the URL. For a dynamic page that does NOT require
 * sign-in, put it directly under src/pages/(app)/; for a static page, put it
 * at the top level of src/pages/.
 *
 * Children may call data hooks like `useUser()` safely because the parent
 * (app)/_layout.tsx mounts <RecordProvider> above this layout.
 *
 * The `fallback` keeps signed-out visitors inside the app's own chrome
 * (without it, AuthGate shows the SDK's full-screen, non-dismissible
 * overlay). The sign-in overlay opens on demand and can be dismissed.
 */

import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { AuthGate, AuthOverlay } from 'deepspace'
import { Button, buttonVariants } from '@/components/ui'
import { useAnnounceGatedSignInPanel } from '@/components/GatedSignIn'
import { isResumablePath } from '@/lib/resumablePath'
import { clearReturnTo, saveReturnTo } from '@/lib/returnTo'

export default function ProtectedLayout() {
  return (
    <AuthGate fallback={<SignedOutPanel />}>
      <SignedInOutlet />
    </AuthGate>
  )
}

/** Signed in on the page itself (e.g. email sign-in, no OAuth round trip):
 *  the pending return path is already satisfied, so drop it. */
function SignedInOutlet() {
  useEffect(() => clearReturnTo(), [])
  return <Outlet />
}

/**
 * OAuth buttons are our own links (not the SDK overlay's) so they can pass
 * `returnTo`: the worker keeps it in a short-lived cookie and oauth-complete
 * lands the user back on this room link (src/server/return-to-cookie.ts).
 * Email sign-in still uses the SDK overlay (email form only) and keeps the
 * sessionStorage hint as its fallback.
 */
function SignedOutPanel() {
  const [showEmailSignIn, setShowEmailSignIn] = useState(false)
  const { pathname } = useLocation()
  useAnnounceGatedSignInPanel() // hides the nav's "Sign in" while this panel is up
  const isRoomLink = isResumablePath(pathname)

  const oauthHref = (provider: 'google' | 'github') => {
    const params = new URLSearchParams({ provider })
    if (isRoomLink) params.set('returnTo', pathname)
    return `/api/auth/social-redirect?${params}`
  }

  function openEmailSignIn() {
    saveReturnTo(pathname)
    setShowEmailSignIn(true)
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-20">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold text-foreground">Sign in to continue</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {pathname.startsWith('/j/')
            ? "Sign in and we'll drop you straight into the room."
            : 'This page is only available to signed-in users.'}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {/* Plain links: a full-page navigation is what starts OAuth. */}
          <a href={oauthHref('google')} className={buttonVariants({ className: 'w-full' })}>
            Continue with Google
          </a>
          <a href={oauthHref('github')} className={buttonVariants({ variant: 'outline', className: 'w-full' })}>
            Continue with GitHub
          </a>
          <Button variant="ghost" className="w-full" onClick={openEmailSignIn}>
            Sign in with email
          </Button>
        </div>
        <Link
          to="/"
          className="mt-4 inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Back to home
        </Link>
      </div>

      {showEmailSignIn && (
        <AuthOverlay providers={[]} title="Sign in with email" description="" onClose={() => setShowEmailSignIn(false)} />
      )}
    </div>
  )
}
