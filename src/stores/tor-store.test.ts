// tor-store: медиа-политика при включении и перезагрузка при выключении (V21).

import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => {}) }))

import { TOR_MEDIA_META_ID } from '@/helpers/tor/tor-media-policy'
import { torStoreHooks, useTorStore } from './tor-store'

const snapshot = (status: string) => ({
  status,
  bootstrap_pct: 0,
  message: null,
  socks_port: 9250,
  control_port: 9251,
  use_bridges: false,
  bridge_kind: 'none',
})

describe('tor-store media policy', () => {
  let reload: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setActivePinia(createPinia())
    document.getElementById(TOR_MEDIA_META_ID)?.remove()
    document.documentElement.classList.remove('tor-media-blocked')
    invoke.mockReset()
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'tor_start') return snapshot('bootstrapping')
      if (cmd === 'tor_stop') return snapshot('off')
      return snapshot('off')
    })
    reload = vi.fn()
    torStoreHooks.reload = reload
  })
  afterEach(() => {
    document.getElementById(TOR_MEDIA_META_ID)?.remove()
  })

  it('enable() применяет CSP до tor_start', async () => {
    const store = useTorStore()
    store.available = true
    let cspAtStart = false
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'tor_start') cspAtStart = !!document.getElementById(TOR_MEDIA_META_ID)
      return snapshot('bootstrapping')
    })
    await store.enable()
    expect(cspAtStart).toBe(true)
    expect(store.wantsTor).toBe(true)
    expect(store.routingMode).toBe('wait')
  })

  it('disable() после применённой политики перезагружает документ', async () => {
    const store = useTorStore()
    store.available = true
    await store.enable()
    await store.disable()
    expect(invoke).toHaveBeenCalledWith('tor_stop', undefined)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(store.routingMode).toBe('direct')
  })

  it('disable() без политики (Tor не включался) не перезагружает', async () => {
    const store = useTorStore()
    store.available = true
    await store.disable()
    expect(reload).not.toHaveBeenCalled()
  })

  it('applyAndRestart (мосты) не перезагружает — политика остаётся', async () => {
    const store = useTorStore()
    store.available = true
    await store.enable()
    await store.applyAndRestart({ useBridges: true, kind: 'snowflake' })
    expect(reload).not.toHaveBeenCalled()
    expect(store.enabled).toBe(true)
    expect(document.getElementById(TOR_MEDIA_META_ID)).not.toBeNull()
  })

  it('failed — routingMode failed, не direct', async () => {
    const store = useTorStore()
    store.available = true
    invoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'tor_start') throw new Error('SHA256 mismatch')
      return snapshot('off')
    })
    await store.enable()
    expect(store.status).toBe('failed')
    expect(store.routingMode).toBe('failed')
  })
})
