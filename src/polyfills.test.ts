// Полифилы для старых движков (Safari 15, Chromium 89): чего движок не знает,
// то дописывается; что знает — не трогается.

import { afterEach, describe, expect, it, vi } from 'vitest'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

async function loadPolyfills(): Promise<void> {
  vi.resetModules()
  await import('./polyfills')
}

describe('polyfills', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('без crypto.randomUUID появляется свой — UUID v4, каждый раз новый', async () => {
    const native = globalThis.crypto
    const oldCrypto: Partial<Crypto> = {
      getRandomValues: <T extends ArrayBufferView | null>(array: T): T =>
        native.getRandomValues(array as never) as T,
    }
    vi.stubGlobal('crypto', oldCrypto)
    await loadPolyfills()
    const randomUUID = oldCrypto.randomUUID!
    const first = randomUUID()
    expect(first).toMatch(UUID_V4)
    expect(randomUUID()).not.toBe(first)
  })

  it('свой crypto.randomUUID движка не подменяется', async () => {
    const own = (): `${string}-${string}-${string}-${string}-${string}` => 'a-b-c-d-e'
    const modernCrypto: Partial<Crypto> = {
      getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
      randomUUID: own,
    }
    vi.stubGlobal('crypto', modernCrypto)
    await loadPolyfills()
    expect(modernCrypto.randomUUID).toBe(own)
  })

  it('отмечает, что код приложения начал выполняться', async () => {
    await loadPolyfills()
    expect((globalThis as Record<string, unknown>).__bastyonBooted).toBe(true)
  })
})
