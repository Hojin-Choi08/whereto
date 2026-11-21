/**
 * Server-side "return to" across the OAuth hop.
 *
 * /api/auth/social-redirect stores a validated room path in a first-party
 * cookie; /api/auth/oauth-complete reads it, always clears it, and redirects
 * there instead of /home. The auth worker returns to oauth-complete with a
 * top-level GET, which carries SameSite=Lax cookies — unlike sessionStorage
 * this survives incognito, in-app browsers and OAuth in another tab.
 *
 * Path=/api/auth: only the auth routes ever see it. HttpOnly: page script
 * can't read or plant it. Max-Age=600: a 10-minute window.
 */

import { isResumablePath } from '../lib/resumablePath.js'

export const RETURN_TO_COOKIE = 'whereto_return_to'
export const RETURN_TO_MAX_AGE_SECONDS = 600
const ATTRIBUTES = 'Path=/api/auth; HttpOnly; Secure; SameSite=Lax'

/** Set-Cookie value storing `path`, or null if the path is not resumable. */
export function setReturnToCookie(path: unknown): string | null {
  if (!isResumablePath(path)) return null
  return `${RETURN_TO_COOKIE}=${encodeURIComponent(path)}; ${ATTRIBUTES}; Max-Age=${RETURN_TO_MAX_AGE_SECONDS}`
}

/** Set-Cookie value that deletes the cookie (attributes must match the set). */
export function clearReturnToCookie(): string {
  return `${RETURN_TO_COOKIE}=; ${ATTRIBUTES}; Max-Age=0`
}

/** The validated path from a request's Cookie header, or null. */
export function readReturnTo(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1 || part.slice(0, eq).trim() !== RETURN_TO_COOKIE) continue
    try {
      const value = decodeURIComponent(part.slice(eq + 1).trim())
      return isResumablePath(value) ? value : null
    } catch {
      return null
    }
  }
  return null
}

/** A 302 that can carry several Set-Cookie headers. */
export function redirectWithCookies(location: string, cookies: string[]): Response {
  const headers = new Headers({ Location: location })
  for (const cookie of cookies) headers.append('Set-Cookie', cookie)
  return new Response(null, { status: 302, headers })
}
