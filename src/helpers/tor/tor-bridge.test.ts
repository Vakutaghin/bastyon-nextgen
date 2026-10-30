// Tor на Android: те же команды и события через плагин Tor, окно — через Tor
// (без запрета медиа), а включённый Tor Android помнит сам.

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({
  call: vi.fn(),
  guard: vi.fn(async () => {}),
  listener: null as null | ((e: { event: string; payload: unknown }) => void),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    isPluginAvailable: (name: string) => name === 'Tor',
  },
  registerPlugin: () => ({
    call: native.call,
    guard: native.guard,
    addListener: async (_: string, cb: (e: { event: string; payload: unknown }) => void) => {
      native.listener = cb
      return { remove: async () => {} }
    },
  }),
}))
const tauri = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: tauri.invoke }))

import { TOR_MEDIA_META_ID } from './tor-media-policy'
import { torInvoke, torListen } from './tor-bridge'
import { useTorStore } from '@/stores/tor-store'

const snapshot = (status: string) => ({
  status,
  bootstrap_pct: 0,
  socks_port: 9250,
  control_port: 9251,
  use_bridges: true,
  bridge_kind: 'auto',
})

describe('tor-bridge на Android', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    native.call.mockReset()
    native.guard.mockClear()
    tauri.invoke.mockReset()
    localStorage.clear()
    document.getElementById(TOR_MEDIA_META_ID)?.remove()
  })

  it('команда — в плагин с аргументами invoke, ответ — его value', async () => {
    native.call.mockResolvedValue({ value: snapshot('ready') })
    const snap = await torInvoke<{ status: string }>('tor_stop', { restart: true })
    expect(snap.status).toBe('ready')
    expect(native.call).toHaveBeenCalledWith({ command: 'tor_stop', args: { restart: true } })
    expect(tauri.invoke).not.toHaveBeenCalled()
  })

  it('отказ — строка ошибки Rust, как у invoke Tauri', async () => {
    native.call.mockRejectedValue(new Error('tor_not_ready: status=Bootstrapping'))
    await expect(torInvoke('tor_fetch', { req: {} })).rejects.toBe(
      'tor_not_ready: status=Bootstrapping'
    )
  })

  it('события плагина раздаются по именам, отписка работает', async () => {
    const a = vi.fn()
    const b = vi.fn()
    const offA = await torListen('tor:ws:1:message', a)
    await torListen('tor:state', b)
    native.listener?.({ event: 'tor:ws:1:message', payload: { kind: 'text', data: 'hi' } })
    native.listener?.({ event: 'tor:state', payload: snapshot('ready') })
    expect(a).toHaveBeenCalledWith({ kind: 'text', data: 'hi' })
    expect(b).toHaveBeenCalledWith(snapshot('ready'))
    offA()
    native.listener?.({ event: 'tor:ws:1:message', payload: { kind: 'text', data: 'again' } })
    expect(a).toHaveBeenCalledTimes(1)
  })

  it('Tor встроен: доступен, не удаляется, медиа под ним не запрещены', async () => {
    native.call.mockImplementation(async ({ command }: { command: string }) => ({
      value:
        command === 'tor_set_bridges'
          ? { snapshot: snapshot('off'), rejected: [] }
          : snapshot('bootstrapping'),
    }))
    const store = useTorStore()
    expect(store.available).toBe(true)
    expect(store.builtin).toBe(true)
    await store.enable()
    expect(native.guard).toHaveBeenCalled()
    // Прокси окна включается раньше, чем Tor запускают.
    const guardOrder = native.guard.mock.invocationCallOrder[0]!
    const startCall = native.call.mock.calls.findIndex((c) => c[0].command === 'tor_start')
    expect(guardOrder).toBeLessThan(native.call.mock.invocationCallOrder[startCall]!)
    expect(store.wantsTor).toBe(true)
    expect(store.mediaBypassesTor).toBe(false)
    expect(document.getElementById(TOR_MEDIA_META_ID)).toBeNull()
    expect(await store.uninstall()).toBe(false)
  })

  it('hydrate с выключенным Tor выключает и тот, что помнит Android', async () => {
    native.call.mockImplementation(async ({ command }: { command: string }) => ({
      value:
        command === 'tor_set_bridges'
          ? { snapshot: snapshot('off'), rejected: [] }
          : snapshot('off'),
    }))
    await useTorStore().hydrate()
    const commands = native.call.mock.calls.map((c) => c[0].command)
    expect(commands).toContain('tor_stop')
    expect(commands).not.toContain('tor_start')
  })
})
