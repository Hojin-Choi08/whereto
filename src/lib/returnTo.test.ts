import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearReturnTo, isResumablePath, peekReturnTo, saveReturnTo } from './returnTo'

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() { return map.size },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  }
}

beforeEach(() => vi.stubGlobal('sessionStorage', memoryStorage()))
afterEach(() => vi.unstubAllGlobals())

describe('returnTo', () => {
  it('accepts only whereto room paths', () => {
    expect(isResumablePath('/j/abcdefghjk')).toBe(true)
    expect(isResumablePath('/r/3f1c9a2e-0d4b-4c8e-9a51-2b7f6c1d0e99')).toBe(true)
    for (const bad of ['/home', '/new', '//evil.com', '/j/', '/j/a/b', 'https://evil.com/j/x', '/r/x?y=1']) {
      expect(isResumablePath(bad)).toBe(false)
    }
  })

  it('round-trips a valid path and ignores invalid ones', () => {
    saveReturnTo('/settings')
    expect(peekReturnTo()).toBeNull()
    saveReturnTo('/j/abcdefghjk')
    expect(peekReturnTo()).toBe('/j/abcdefghjk')
  })

  it('expires after 10 minutes', () => {
    saveReturnTo('/r/room-1')
    expect(peekReturnTo(Date.now() + 9 * 60_000)).toBe('/r/room-1')
    expect(peekReturnTo(Date.now() + 11 * 60_000)).toBeNull()
    expect(peekReturnTo()).toBeNull() // the expired entry was removed
  })

  it('clears', () => {
    saveReturnTo('/r/room-1')
    clearReturnTo()
    expect(peekReturnTo()).toBeNull()
  })

  it('rejects tampered storage', () => {
    sessionStorage.setItem('whereto:returnTo', JSON.stringify({ path: '//evil.com', at: Date.now() }))
    expect(peekReturnTo()).toBeNull()
    sessionStorage.setItem('whereto:returnTo', 'not json')
    expect(peekReturnTo()).toBeNull()
  })

  it('survives blocked storage', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
    })
    expect(() => saveReturnTo('/r/room-1')).not.toThrow()
    expect(peekReturnTo()).toBeNull()
    expect(() => clearReturnTo()).not.toThrow()
  })
})
