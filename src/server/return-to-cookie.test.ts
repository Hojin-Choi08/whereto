import { describe, expect, it } from 'vitest'
import {
  RETURN_TO_COOKIE,
  clearReturnToCookie,
  readReturnTo,
  redirectWithCookies,
  setReturnToCookie,
} from './return-to-cookie'

describe('return-to cookie', () => {
  it('sets a short-lived, locked-down cookie for room paths only', () => {
    const cookie = setReturnToCookie('/j/abcdefghjk')
    expect(cookie).toBe(
      `${RETURN_TO_COOKIE}=%2Fj%2Fabcdefghjk; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    )
    for (const bad of [undefined, '', '/home', '//evil.com', 'https://evil.com/j/x', '/r/x?next=//evil']) {
      expect(setReturnToCookie(bad)).toBeNull()
    }
  })

  it('clears with matching attributes', () => {
    expect(clearReturnToCookie()).toBe(
      `${RETURN_TO_COOKIE}=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    )
  })

  it('reads and re-validates the value from a Cookie header', () => {
    const header = `ds_session=abc; ${RETURN_TO_COOKIE}=%2Fr%2Froom-1; other=1`
    expect(readReturnTo(header)).toBe('/r/room-1')
    expect(readReturnTo(`${RETURN_TO_COOKIE}=%2F%2Fevil.com`)).toBeNull() // tampered
    expect(readReturnTo(`${RETURN_TO_COOKIE}=%E0%A4%A`)).toBeNull() // malformed encoding
    expect(readReturnTo('ds_session=abc')).toBeNull()
    expect(readReturnTo(undefined)).toBeNull()
  })

  it('redirects with every cookie as its own Set-Cookie header', () => {
    const res = redirectWithCookies('https://app.example/r/room-1', ['a=1; Path=/', clearReturnToCookie()])
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('https://app.example/r/room-1')
    expect(res.headers.getSetCookie()).toHaveLength(2)
  })
})
