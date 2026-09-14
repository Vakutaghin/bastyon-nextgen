// appFetch при включённом Tor: ждёт готовности, при failed бросает, при
// выключении во время ожидания уходит обычным путём (V20).

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  torFetch: vi.fn(),
  tauriFetch: vi.fn(),
}))
vi.mock('./request-tor', async (importOriginal) => {
  const orig = await importOriginal<typeof import('./request-tor')>()
  return {
    ...orig,
    torFetch: mocks.torFetch,
    getTauriFetch: async () => mocks.tauriFetch,
  }
})

import { isTorNotReadyError } from '@/helpers/tor/tor-gate'
import { useTorStore } from '@/stores/tor-store'
import { appFetch } from './fetch-strategies'

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

  it('пользователь выключил Tor во время ожидания — запрос идёт обычным путём', async () => {
    const store = torStore('off')
    const p = appFetch('https://1.pocketnet.app:8899/rpc/x')
    store.enabled = false
    await expect((await p).text()).resolves.toBe('direct')
  })

  it('same-origin всегда через глобальный fetch (dev-proxy)', async () => {
    torStore('bootstrapping')
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('same'))
    const res = await appFetch('/rpc/x')
    await expect(res.text()).resolves.toBe('same')
    spy.mockRestore()
  })
})
