// appFetch при включённом Tor: ждёт готовности, при failed бросает, при
// выключении во время ожидания тоже бросает — собранный для Tor запрос
// напрямую не уходит (V20).

import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  torFetch: vi.fn(),
  tauriFetch: vi.fn(),
  nativeFetch: vi.fn(),
  native: false,
}))
vi.mock('./request-tor', async (importOriginal) => {
  const orig = await importOriginal<typeof import('./request-tor')>()
  return {
    ...orig,
    torFetch: mocks.torFetch,
    getTauriFetch: async () => mocks.tauriFetch,
  }
})

vi.mock('./request-native', () => ({
  isNativeMatrixRequest: () => mocks.native,
  nativeFetch: mocks.nativeFetch,
}))

import { isTorNotReadyError } from '@/helpers/tor/tor-gate'
import { useTorStore } from '@/stores/tor-store'
import { appFetch, matrixFetch } from './fetch-strategies'

describe('appFetch × Tor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.torFetch.mockReset().mockResolvedValue(new Response('tor'))
    mocks.tauriFetch.mockReset().mockResolvedValue(new Response('direct'))
  })

  function torStore(status: 'off' | 'bootstrapping' | 'ready' | 'failed') {
    const store = useTorStore()
    store.available = true
    store.enabled = true
    store.status = status
    return store
  }

  it('Tor выключен — plugin-http/fetch напрямую', async () => {
    const store = useTorStore()
    store.available = true
    store.enabled = false
    const res = await appFetch('https://1.pocketnet.app:8899/rpc/x')
    await expect(res.text()).resolves.toBe('direct')
    expect(mocks.torFetch).not.toHaveBeenCalled()
  })

  it('Tor ready — torFetch', async () => {
    torStore('ready')
    const res = await appFetch('https://1.pocketnet.app:8899/rpc/x')
    await expect(res.text()).resolves.toBe('tor')
    expect(mocks.tauriFetch).not.toHaveBeenCalled()
  })

  it('бутстрап: запрос ждёт ready и уходит через Tor, а не напрямую', async () => {
    const store = torStore('bootstrapping')
    const p = appFetch('https://1.pocketnet.app:8899/rpc/x')
    await Promise.resolve()
    expect(mocks.tauriFetch).not.toHaveBeenCalled()
    expect(mocks.torFetch).not.toHaveBeenCalled()
    store.status = 'ready'
    await expect((await p).text()).resolves.toBe('tor')
    expect(mocks.tauriFetch).not.toHaveBeenCalled()
  })

  it('бутстрап + abort вызывающего — AbortError, напрямую не идём', async () => {
    torStore('bootstrapping')
    const ctrl = new AbortController()
    const p = appFetch('https://1.pocketnet.app:8899/rpc/x', { signal: ctrl.signal })
    ctrl.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
    expect(mocks.tauriFetch).not.toHaveBeenCalled()
  })

  it('failed — TorNotReadyError без прямого запроса', async () => {
    torStore('failed')
    const err = await appFetch('https://1.pocketnet.app:8899/rpc/x').catch((e) => e)
    expect(isTorNotReadyError(err)).toBe(true)
    expect(mocks.tauriFetch).not.toHaveBeenCalled()
  })

  it('Tor выключили во время ожидания — ошибка, а не прямой запрос', async () => {
    const store = torStore('off')
    const p = appFetch('https://1.pocketnet.app:8899/rpc/x')
    await new Promise((r) => setTimeout(r, 0)) // запрос уже ждёт Tor
    store.enabled = false
    expect(isTorNotReadyError(await p.catch((e) => e))).toBe(true)
    expect(mocks.tauriFetch).not.toHaveBeenCalled()
    // Следующий запрос — уже без Tor.
    await expect((await appFetch('https://1.pocketnet.app:8899/rpc/x')).text()).resolves.toBe(
      'direct'
    )
  })

  it('перезапуск Tor с новыми мостами: ждавший запрос уходит через Tor', async () => {
    const store = torStore('bootstrapping')
    const p = appFetch('https://1.pocketnet.app:8899/rpc/x')
    store.status = 'off'
    await Promise.resolve()
    store.status = 'starting'
    store.status = 'ready'
    await expect((await p).text()).resolves.toBe('tor')
    expect(mocks.tauriFetch).not.toHaveBeenCalled()
  })

  it('свой предел времени доходит до torFetch', async () => {
    torStore('ready')
    await appFetch(
      'https://matrix.pocketnet.app/_matrix/media/v3/upload',
      { method: 'POST' },
      {
        timeoutMs: 600_000,
      }
    )
    expect(mocks.torFetch.mock.lastCall![2]).toEqual({ timeoutMs: 600_000 })
  })

  it('same-origin всегда через глобальный fetch (dev-proxy)', async () => {
    torStore('bootstrapping')
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('same'))
    const res = await appFetch('/rpc/x')
    await expect(res.text()).resolves.toBe('same')
    spy.mockRestore()
  })
})

// Android: JSON-API чатов — нативным HTTP; под Tor плагин идёт через Tor и
// ждёт его так же, как appFetch.
describe('matrixFetch × Tor на Android', () => {
  const SYNC = 'https://matrix.pocketnet.app/_matrix/client/v3/sync'

  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.native = true
    mocks.torFetch.mockReset()
    mocks.nativeFetch.mockReset().mockResolvedValue(new Response('native'))
  })
  afterEach(() => {
    mocks.native = false
  })

  function torStore(enabled: boolean, status: 'off' | 'bootstrapping' | 'ready' | 'failed') {
    const store = useTorStore()
    store.available = true
    store.enabled = enabled
    store.status = status
    return store
  }

  it('без Tor — сразу нативный запрос', async () => {
    torStore(false, 'off')
    await expect((await matrixFetch(SYNC)).text()).resolves.toBe('native')
  })

  it('Tor подключается — нативный запрос ждёт готовности', async () => {
    const store = torStore(true, 'bootstrapping')
    const p = matrixFetch(SYNC)
    await Promise.resolve()
    expect(mocks.nativeFetch).not.toHaveBeenCalled()
    store.status = 'ready'
    await expect((await p).text()).resolves.toBe('native')
    expect(mocks.torFetch).not.toHaveBeenCalled()
  })

  it('Tor не смог — ошибка, а не запрос', async () => {
    torStore(true, 'failed')
    const err = await matrixFetch(SYNC).catch((e: unknown) => e)
    expect(isTorNotReadyError(err)).toBe(true)
    expect(mocks.nativeFetch).not.toHaveBeenCalled()
  })
})
