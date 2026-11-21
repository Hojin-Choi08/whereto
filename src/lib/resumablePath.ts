/**
 * The only paths a sign-in may return to: whereto's own room links.
 * Shared by the worker (return-to cookie) and the browser (email fallback),
 * so both validate identically. Anything else — other pages, protocol-relative
 * `//host`, query strings — is rejected, so this can't become an open redirect.
 */
const RESUMABLE_PATH = /^\/(j|r)\/[A-Za-z0-9_-]{1,64}$/

export function isResumablePath(path: unknown): path is string {
  return typeof path === 'string' && RESUMABLE_PATH.test(path)
}
