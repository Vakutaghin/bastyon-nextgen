// S20: ссылка, которой делятся, не должна вести на origin локальной оболочки
// (`tauri://localhost`, `https://localhost` в Capacitor).

import { describe, it, expect, afterEach, vi } from 'vitest'
import { publicShareOrigin, publicPostUrl, PUBLIC_WEB_ORIGIN } from './share-origin'

function setOrigin(origin: string): void {
  vi.stubGlobal('window', { location: { origin } } as unknown as Window)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('publicShareOrigin (S20)', () => {
  it('keeps a real web origin as is', () => {
    setOrigin('https://bastyon.com')
    expect(publicShareOrigin()).toBe('https://bastyon.com')
  })

  it('replaces the Tauri shell origin with the public web address', () => {
    setOrigin('tauri://localhost')
    expect(publicShareOrigin()).toBe(PUBLIC_WEB_ORIGIN)
  })

  it('replaces the Capacitor localhost origin', () => {
    vi.stubEnv('DEV', false)
    setOrigin('https://localhost')
    expect(publicShareOrigin()).toBe(PUBLIC_WEB_ORIGIN)
  })

  it('builds a shareable post link', () => {
    setOrigin('tauri://localhost')
    expect(publicPostUrl('abc123')).toBe(`${PUBLIC_WEB_ORIGIN}/post/abc123`)
  })
})
