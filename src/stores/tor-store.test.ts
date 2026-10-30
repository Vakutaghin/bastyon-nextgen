// tor-store: медиа-политика при включении и перезагрузка при выключении (V21).

import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => {}) }))

import { TOR_MEDIA_META_ID } from '@/helpers/tor/tor-media-policy'
import { onTorEnabled, torStoreHooks, useTorStore } from './tor-store'

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

  it('перезапуск ни на миг не открывает прямой путь; Rust знает, что это перезапуск', async () => {
    const store = useTorStore()
    store.available = true
    await store.enable()
    const modes: string[] = []
    invoke.mockImplementation(async (cmd: string) => {
      modes.push(`${cmd}:${store.routingMode}`)
      if (cmd === 'tor_start') return snapshot('bootstrapping')
      return snapshot('off')
    })
    await store.applyAndRestart({ useBridges: true, kind: 'obfs4' })
    expect(invoke).toHaveBeenCalledWith('tor_stop', { restart: true })
    expect(modes.filter((m) => /^tor_(stop|start):/.test(m))).toEqual([
      'tor_stop:wait',
      'tor_start:wait',
    ])
    expect(store.routingMode).toBe('wait')
  })

  it('onTorEnabled — только при включении, не при запуске с уже включённым', async () => {
    const cb = vi.fn()
    const off = onTorEnabled(cb)
    try {
      const store = useTorStore()
      store.available = true
      store.enabled = false
      await store.enable()
      expect(cb).toHaveBeenCalledTimes(1)
      await store.enable()
      expect(cb).toHaveBeenCalledTimes(1)
    } finally {
      off()
    }
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

describe('tor-store bridges', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    invoke.mockReset()
  })

  it('кто мосты не выбирал, получает автоподбор', () => {
    const store = useTorStore()
    expect(store.bridgeKind).toBe('auto')
    expect(store.useBridges).toBe(true)
  })

  it('сохранённый выбор остаётся, незнакомое значение — автоподбор', () => {
    localStorage.setItem('tor:bridges:kind', 'none')
    expect(useTorStore().bridgeKind).toBe('none')
    expect(useTorStore().useBridges).toBe(false)

    setActivePinia(createPinia())
    localStorage.setItem('tor:bridges:kind', 'obfs3-legacy')
    expect(useTorStore().bridgeKind).toBe('auto')
  })

  it('pushBridges запоминает строки, которые бэкенд не признал мостом', async () => {
    const store = useTorStore()
    store.available = true
    invoke.mockImplementation(async (cmd: string) =>
      cmd === 'tor_set_bridges'
        ? { snapshot: snapshot('off'), rejected: ['garbage'] }
        : snapshot('off')
    )
    store.setBridgeConfig({ useBridges: true, kind: 'custom', customBridges: 'obfs4 x\ngarbage\n' })
    await store.pushBridges()
    expect(invoke).toHaveBeenCalledWith('tor_set_bridges', {
      payload: { use_bridges: true, kind: 'custom', custom_bridges: ['obfs4 x', 'garbage'] },
    })
    expect(store.rejectedBridges).toEqual(['garbage'])

    store.setBridgeConfig({ useBridges: true, kind: 'auto' })
    await store.pushBridges()
    expect(store.rejectedBridges).toEqual([])
  })

  it('снимок автоподбора доходит до стора', () => {
    const store = useTorStore()
    store.applySnapshot({
      ...snapshot('bootstrapping'),
      bridge_kind: 'auto',
      active_transport: 'webtunnel',
      attempt: 2,
      country: 'ru',
      stalled: true,
      fetching_bridges: false,
      error_code: null,
    } as never)
    expect(store.activeTransport).toBe('webtunnel')
    expect(store.attempt).toBe(2)
    expect(store.country).toBe('ru')
    expect(store.stalled).toBe(true)

    // Старый бэкенд без новых полей не ломает стор.
    store.applySnapshot(snapshot('ready') as never)
    expect(store.activeTransport).toBeNull()
    expect(store.stalled).toBe(false)
  })

  it('requestBridges отдаёт мосты от Moat', async () => {
    const store = useTorStore()
    store.available = true
    invoke.mockResolvedValue({ country: 'ru', bridges: ['webtunnel [2001:db8::1]:443 url=x'] })
    await expect(store.requestBridges()).resolves.toEqual({
      country: 'ru',
      bridges: ['webtunnel [2001:db8::1]:443 url=x'],
    })
    expect(invoke).toHaveBeenCalledWith('tor_request_bridges', undefined)
  })
})

describe('tor-store hydrate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    invoke.mockReset()
  })

  it('сохранённый выбор мостов переживает перезапуск Rust', async () => {
    localStorage.setItem('tor:bridges:kind', 'auto')
    // Rust только что запущен: мосты в его состоянии — по умолчанию.
    let rustKind = 'none'
    invoke.mockImplementation(async (cmd: string, args?: { payload?: { kind: string } }) => {
      if (cmd === 'tor_set_bridges') {
        rustKind = args!.payload!.kind
        return { snapshot: { ...snapshot('off'), bridge_kind: rustKind }, rejected: [] }
      }
      return { ...snapshot('off'), bridge_kind: rustKind }
    })
    const store = useTorStore()
    store.available = true
    await store.hydrate()
    expect(rustKind).toBe('auto')
    expect(store.bridgeKind).toBe('auto')
  })
})
