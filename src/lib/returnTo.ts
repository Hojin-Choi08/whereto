/**
 * FALLBACK ONLY — the email sign-in path.
 *
 * OAuth return-to is handled server-side by a short-lived cookie (see
 * src/server/return-to-cookie.ts). Email sign-in goes through the SDK overlay,
 * which can't carry a return URL, so we keep a sessionStorage hint for it;
 * <ResumeAfterSignIn> consumes it if a sign-in ever lands on /home.
 *
 * Only whereto's own room paths are accepted, entries expire after 10
 * minutes, and they are cleared once used.
 */

import { isResumablePath } from './resumablePath'

export { isResumablePath }

const KEY = 'whereto:returnTo'
const MAX_AGE_MS = 10 * 60 * 1000

interface Stored {
  path: string
  at: number
}

export function saveReturnTo(path: string): void {
  if (!isResumablePath(path)) return
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() } satisfies Stored))
  } catch {
    // storage blocked (private mode etc.) — the user just lands on /home
  }
}

/** The pending destination, if fresh and valid. Does not remove it. */
export function peekReturnTo(now = Date.now()): string | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as Partial<Stored>
    if (
      typeof stored.path !== 'string' ||
      typeof stored.at !== 'number' ||
      now - stored.at > MAX_AGE_MS ||
      !isResumablePath(stored.path)
    ) {
      sessionStorage.removeItem(KEY)
      return null
    }
    return stored.path
  } catch {
    return null
  }
}

export function clearReturnTo(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
