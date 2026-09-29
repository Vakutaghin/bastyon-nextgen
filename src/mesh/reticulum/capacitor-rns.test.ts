// Узел Reticulum на Android через плагин MeshRns: те же вызовы, что у команд
// десктопа, события — потоком `rns`, отказ плагина — кодом, как у десктопа.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const listeners: Array<(ev: unknown) => void> = []
  const plugin = {
    setNotice: vi.fn(async () => {}),
    start: vi.fn(async (_o: unknown) => ({
      address: 'aa'.repeat(16),
      identityHash: 'bb'.repeat(16),
    })),
    stop: vi.fn(async () => {}),
    send: vi.fn(async (_o: unknown) => ({ id: 'm1' })),
    page: vi.fn(async (_o: unknown): Promise<{ content: string; binary: boolean }> => {
      throw Object.assign(new Error('rns_timeout: no answer'), { code: 'rns_timeout' })
    }),
    addListener: vi.fn(async (_e: string, cb: (ev: unknown) => void) => {
      listeners.push(cb)
      return {
        remove: vi.fn(async () => {
          listeners.splice(listeners.indexOf(cb), 1)
        }),
      }
    }),
  }
  return { plugin, listeners }
})

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android', isPluginAvailable: () => true },
  registerPlugin: () => h.plugin,
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

import { page, send, start, stop } from './capacitor-rns'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('capacitor-rns', () => {
  it('starts with the options as JSON-friendly data and passes events on', async () => {
    const events: unknown[] = []
    const started = await start(
      {
        identity: new Uint8Array([1, 2, 3]),
        displayName: 'Алиса',
        interfaces: [{ kind: 'tcp', host: 'hub.example', port: 4242 }],
        propagationNode: null,
      },
      (ev) => events.push(ev)
    )
    expect(started.address).toBe('aa'.repeat(16))
    expect(h.plugin.setNotice).toHaveBeenCalledWith({
      title: 'mesh.android.rnsServiceTitle',
      text: 'mesh.android.rnsServiceText',
      channel: 'mesh.android.serviceChannel',
    })
    expect(h.plugin.start).toHaveBeenCalledWith({
      options: {
        identity: [1, 2, 3],
        displayName: 'Алиса',
        interfaces: [{ kind: 'tcp', host: 'hub.example', port: 4242 }],
        propagationNode: null,
      },
    })
    h.listeners.forEach((cb) => cb({ kind: 'interface', name: 'hub.example:4242', online: true }))
    expect(events).toEqual([{ kind: 'interface', name: 'hub.example:4242', online: true }])

    // Повторный старт не удваивает события.
    await start(
      { identity: new Uint8Array(64), displayName: '', interfaces: [], propagationNode: null },
      () => {}
    )
    expect(h.listeners).toHaveLength(1)
    await stop()
    expect(h.listeners).toHaveLength(0)
  })

  it('sends and reports the plugin refusal by code', async () => {
    expect(await send('cc'.repeat(16), 'привет', 'auto', '')).toEqual({ id: 'm1' })
    expect(h.plugin.send).toHaveBeenCalledWith({
      to: 'cc'.repeat(16),
      content: 'привет',
      title: '',
      method: 'auto',
      attachments: [],
    })
    await expect(page('dd'.repeat(16), '/page/index.mu', {})).rejects.toMatchObject({
      code: 'rns_timeout',
    })
  })
})
