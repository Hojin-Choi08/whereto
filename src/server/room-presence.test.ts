/**
 * Room presence is members-only. Drives the real `/ws/presence/:scopeId`
 * route (real JWT verification with a throwaway ES256 key) against fake
 * record and presence Durable Objects.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import type { AppContext, Env } from '../../worker'
import { registerRealtimeRoutes } from './realtime-routes'
import { isActiveMembershipResult, roomIdFromPresenceScope } from './room-presence'

const ISSUER = 'test-issuer'
const ROOM = '3f1c9a2e-0d4b-4c8e-9a51-2b7f6c1d0e99'

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString('base64url')

let publicPem = ''
let privateKey: CryptoKey

async function token(sub: string): Promise<string> {
  const enc = (o: object) => b64url(new TextEncoder().encode(JSON.stringify(o)))
  const now = Math.floor(Date.now() / 1000)
  const data = `${enc({ alg: 'ES256', typ: 'JWT' })}.${enc({ sub, iss: ISSUER, iat: now, exp: now + 300 })}`
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, new TextEncoder().encode(data))
  return `${data}.${b64url(sig)}` // WebCrypto's raw r||s is exactly JWS ES256
}

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  privateKey = pair.privateKey
  const spki = Buffer.from(await crypto.subtle.exportKey('spki', pair.publicKey)).toString('base64')
  publicPem = `-----BEGIN PUBLIC KEY-----\n${spki.match(/.{1,64}/g)!.join('\n')}\n-----END PUBLIC KEY-----`
})

/** Memberships keyed `${roomId}_${userId}` → status. */
function harness(memberships: Record<string, string | null>) {
  const presenceHits: string[] = []
  const namespace = (fetch: (name: string, req: Request) => Promise<Response>) => ({
    idFromName: (name: string) => name,
    get: (name: string) => ({ fetch: (req: Request) => fetch(name, req) }),
  })
  const env = {
    AUTH_JWT_PUBLIC_KEY: publicPem,
    AUTH_JWT_ISSUER: ISSUER,
    DEEPSPACE_APP_ID: 'app_test',
    RECORD_ROOMS: namespace(async (_name, req) => {
      const { params } = (await req.json()) as { params: { collection: string; recordId: string } }
      const status = memberships[params.recordId]
      return Response.json(
        status === undefined
          ? { success: false, error: 'Record not found' }
          : { success: true, data: { record: { recordId: params.recordId, data: { status: status ?? undefined } } } },
      )
    }),
    PRESENCE_ROOMS: namespace(async (name) => {
      presenceHits.push(name)
      return new Response('presence-ok')
    }),
  } as unknown as Env

  const app = new Hono<AppContext>()
  registerRealtimeRoutes(app)
  const open = async (scope: string, tok?: string) => {
    const qs = tok ? `?token=${encodeURIComponent(tok)}` : ''
    return app.request(`/ws/presence/${encodeURIComponent(scope)}${qs}`, { headers: { Upgrade: 'websocket' } }, env)
  }
  return { open, presenceHits }
}

describe('room presence gate', () => {
  it('admits an active member to their room', async () => {
    const h = harness({ [`${ROOM}_amy`]: 'active' })
    const res = await h.open(`room:${ROOM}`, await token('amy'))
    expect(res.status).toBe(200)
    expect(h.presenceHits).toEqual([`room:${ROOM}`])
  })

  it('refuses a signed-in non-member (403) without touching presence', async () => {
    const h = harness({ [`${ROOM}_amy`]: 'active' })
    const res = await h.open(`room:${ROOM}`, await token('mallory'))
    expect(res.status).toBe(403)
    expect(h.presenceHits).toEqual([])
  })

  it('refuses a removed member', async () => {
    const h = harness({ [`${ROOM}_ben`]: 'removed' })
    expect((await h.open(`room:${ROOM}`, await token('ben'))).status).toBe(403)
  })

  it('refuses no token or a bad token (401)', async () => {
    const h = harness({ [`${ROOM}_amy`]: 'active' })
    expect((await h.open(`room:${ROOM}`)).status).toBe(401)
    // Tamper mid-signature: the LAST base64url char of a 64-byte signature
    // carries padding bits, so flipping it can decode to the same bytes.
    const good = await token('amy')
    const i = good.lastIndexOf('.') + 10
    const forged = good.slice(0, i) + (good[i] === 'A' ? 'B' : 'A') + good.slice(i + 1)
    expect((await h.open(`room:${ROOM}`, forged)).status).toBe(401)
    expect(h.presenceHits).toEqual([])
  })

  it('does not let membership of one room open another room', async () => {
    const h = harness({ [`${ROOM}_amy`]: 'active' })
    expect((await h.open('room:some-other-room', await token('amy'))).status).toBe(403)
  })

  it('leaves non-room scopes on the scaffold behaviour', async () => {
    const h = harness({})
    expect((await h.open('canvas:abc')).status).toBe(200)
    expect(h.presenceHits).toEqual(['canvas:abc'])
  })
})

describe('room presence helpers', () => {
  it('parses only well-formed room scopes', () => {
    expect(roomIdFromPresenceScope(`room:${ROOM}`)).toBe(ROOM)
    for (const bad of ['room:', 'room:a/b', 'rooms:x', 'canvas:x', `room:${'x'.repeat(65)}`]) {
      expect(roomIdFromPresenceScope(bad)).toBeNull()
    }
  })

  it('treats active or unset status as a member, anything else not', () => {
    const rec = (status: unknown) => ({ success: true, data: { record: { data: { status } } } })
    expect(isActiveMembershipResult(rec('active'))).toBe(true)
    expect(isActiveMembershipResult(rec(undefined))).toBe(true)
    expect(isActiveMembershipResult(rec('removed'))).toBe(false)
    expect(isActiveMembershipResult({ success: false, error: 'Record not found' })).toBe(false)
    expect(isActiveMembershipResult(null)).toBe(false)
  })
})
