import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MiniAppsBridge } from './bridge'
import { createInMemoryResolver } from './origin-guard'
import type { InstalledApp } from '../types/app'
import type { ParsedManifest } from '../types/manifest'

const APP_ORIGIN = 'https://demo.app.com'
const APP: InstalledApp = {
  manifest: { id: 'demo.app', name: 'Demo' } as ParsedManifest,
  scope: 'demo.app.com',
  icon: '',
  source: 'built-in',
  installedAt: 0,
}

/** Эмулирует окно iframe: ловит исходящие сообщения и опционально targetOrigin. */
function makeFakeWindow() {
  const sent: Array<{ message: unknown; targetOrigin: unknown }> = []
  const win = {
    postMessage(message: unknown, optsOrOrigin: unknown): void {
      sent.push({ message, targetOrigin: optsOrOrigin })
    },
  }
  return { win, sent }
}

/** Шлёт MessageEvent в `window` от лица фейкового iframe. */
function dispatchFromIframe(opts: { source: object; origin: string; data: unknown }): void {
  const event = new MessageEvent('message', {
    data: opts.data,
    origin: opts.origin,
    source: opts.source as MessageEventSource,
  })
  window.dispatchEvent(event)
}

/** Ждёт ближайший микротаск (для async-handle в bridge). */
async function tick(times = 2): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve()
  }
}

describe('MiniAppsBridge', () => {
  let bridge: MiniAppsBridge

  beforeEach(() => {
    bridge = new MiniAppsBridge()
  })

  afterEach(() => {
    bridge.stop()
  })

  // ─── origin guard ─────────────────────────────────────────────────────────

  it('ignores messages from unknown origin silently', async () => {
    const dispatch = vi.fn()
    bridge.start({
      resolver: createInMemoryResolver([APP]),
      dispatchRpc: dispatch,
    })

    const { win } = makeFakeWindow()
    dispatchFromIframe({
      source: win,
      origin: 'https://evil.com',
      data: { id: 'r1', action: 'account' },
    })

    await tick()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('processes messages from known origin', async () => {
    const dispatch = vi.fn().mockResolvedValue({ address: 'PR7...' })
    bridge.start({
      resolver: createInMemoryResolver([APP]),
      dispatchRpc: dispatch,
    })

    const { win, sent } = makeFakeWindow()
    dispatchFromIframe({
      source: win,
      origin: APP_ORIGIN,
      data: { id: 'r1', action: 'account' },
    })

    await tick()
    expect(dispatch).toHaveBeenCalledOnce()
    expect(sent).toHaveLength(1)
    expect(sent[0]?.message).toEqual({ response: 'r1', data: { address: 'PR7...' } })
  })

  // ─── targetOrigin (closes 1.2) ────────────────────────────────────────────

  it('replies with canonical origin in targetOrigin (not "*")', async () => {
    bridge.start({
      resolver: createInMemoryResolver([APP]),
      dispatchRpc: vi.fn().mockResolvedValue({}),
    })

    const { win, sent } = makeFakeWindow()
    dispatchFromIframe({
      source: win,
      origin: APP_ORIGIN,
      data: { id: 'r1', action: 'appinfo' },
    })

    await tick()
    expect(sent[0]?.targetOrigin).toEqual({ targetOrigin: APP_ORIGIN })
  })

  // ─── listener registration ────────────────────────────────────────────────

  it('registers listener and replies with "registered"', async () => {
    const onRegistered = vi.fn()
    bridge.start({
      resolver: createInMemoryResolver([APP]),
      dispatchRpc: vi.fn(),
      onListenerRegistered: onRegistered,
    })

    const { win, sent } = makeFakeWindow()
    dispatchFromIframe({
      source: win,
      origin: APP_ORIGIN,
      data: { id: 'reg-1', listener: 'listen-abc' },
    })

    await tick()
    expect(sent[0]?.message).toEqual({ response: 'reg-1', data: 'registered' })
    expect(onRegistered).toHaveBeenCalledWith(APP, 'listen-abc')
  })

  it('push() works after listener is registered', async () => {
    bridge.start({
      resolver: createInMemoryResolver([APP]),
      dispatchRpc: vi.fn(),
    })

    const { win, sent } = makeFakeWindow()
    dispatchFromIframe({
      source: win,
      origin: APP_ORIGIN,
      data: { id: 'reg-1', listener: 'listen-abc' },
    })
    await tick()
    sent.length = 0 // сбрасываем подтверждение

    const delivered = bridge.push('demo.app', 'theme', { theme: 'dark' })
    expect(delivered).toBe(true)
    expect(sent[0]?.message).toEqual({
      listener: 'listen-abc',
      key: 'theme',
      data: { theme: 'dark' },
    })
    expect(sent[0]?.targetOrigin).toEqual({ targetOrigin: APP_ORIGIN })
  })

  it('push() returns false when listener not registered', () => {
    bridge.start({
      resolver: createInMemoryResolver([APP]),
      dispatchRpc: vi.fn(),
    })
    expect(bridge.push('demo.app', 'theme', {})).toBe(false)
  })

  // ─── fire-and-forget events ───────────────────────────────────────────────

  it('routes iframe events to onIframeEvent', async () => {
    const onEvent = vi.fn()
    bridge.start({
      resolver: createInMemoryResolver([APP]),
      dispatchRpc: vi.fn(),
      onIframeEvent: onEvent,
    })

    const { win } = makeFakeWindow()
    dispatchFromIframe({
      source: win,
      origin: APP_ORIGIN,
      data: { event: 'loaded', data: { ok: true } },
    })

    await tick()
    expect(onEvent).toHaveBeenCalledWith(APP, 'loaded', { ok: true })
  })

  // ─── RPC errors ───────────────────────────────────────────────────────────

  it('replies with error when dispatchRpc rejects', async () => {
    bridge.start({
      resolver: createInMemoryResolver([APP]),
      dispatchRpc: vi.fn().mockRejectedValue(new Error('boom')),
    })

    const { win, sent } = makeFakeWindow()
    dispatchFromIframe({
      source: win,
      origin: APP_ORIGIN,
      data: { id: 'r1', action: 'account' },
    })

    await tick()
    const msg = sent[0]?.message as { response: string; error: { message: string } }
    expect(msg.response).toBe('r1')
    expect(msg.error.message).toBe('boom')
  })

  // ─── timeout via AbortSignal (closes 1.3) ─────────────────────────────────

  it('aborts RPC and replies with timeout error after rpcTimeoutMs', async () => {
    const abortSignals: AbortSignal[] = []
    bridge.start({
      resolver: createInMemoryResolver([APP]),
      rpcTimeoutMs: 10,
      dispatchRpc: ({ signal }) => {
        abortSignals.push(signal)
        return new Promise((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')))
        })
      },
    })

    const { win, sent } = makeFakeWindow()
    dispatchFromIframe({
      source: win,
      origin: APP_ORIGIN,
      data: { id: 'r1', action: 'account' },
    })

    await new Promise((r) => setTimeout(r, 30))
    expect(abortSignals[0]?.aborted).toBe(true)
    const msg = sent[0]?.message as { response: string; error: { code: string } }
    expect(msg.error.code).toBe('timeout')
  })

  // ─── FETCH tunnel ─────────────────────────────────────────────────────────

  it('rejects FETCH_REQUEST when handler not configured', async () => {
    bridge.start({
      resolver: createInMemoryResolver([APP]),
      dispatchRpc: vi.fn(),
    })

    const { win, sent } = makeFakeWindow()
    dispatchFromIframe({
      source: win,
      origin: APP_ORIGIN,
      data: {
        type: 'FETCH_REQUEST',
        requestId: 'f1',
        request: { url: 'https://api.example.com' },
      },
    })

    await tick()
    expect(sent[0]?.message).toEqual({
      type: 'FETCH_RESPONSE',
      requestId: 'f1',
      success: false,
      error: 'fetch_tunnel_not_configured',
    })
  })

  it('routes FETCH_REQUEST to onFetchRequest', async () => {
    const onFetch = vi.fn().mockResolvedValue({
      type: 'FETCH_RESPONSE',
      requestId: 'f1',
      success: true,
      data: { status: 200, statusText: 'OK', headers: {}, body: [] },
    })
    bridge.start({
      resolver: createInMemoryResolver([APP]),
      dispatchRpc: vi.fn(),
      onFetchRequest: onFetch,
    })

    const { win, sent } = makeFakeWindow()
    dispatchFromIframe({
      source: win,
      origin: APP_ORIGIN,
      data: {
        type: 'FETCH_REQUEST',
        requestId: 'f1',
        request: { url: 'https://api.example.com' },
      },
    })

    await tick()
    expect(onFetch).toHaveBeenCalledOnce()
    expect((sent[0]?.message as { success: boolean }).success).toBe(true)
  })

  // ─── lifecycle ────────────────────────────────────────────────────────────

  it('stop() removes listener — no more dispatching', async () => {
    const dispatch = vi.fn().mockResolvedValue({})
    bridge.start({
      resolver: createInMemoryResolver([APP]),
      dispatchRpc: dispatch,
    })
    bridge.stop()

    const { win } = makeFakeWindow()
    dispatchFromIframe({
      source: win,
      origin: APP_ORIGIN,
      data: { id: 'r1', action: 'account' },
    })

    await tick()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('start() twice is a no-op (does not double-subscribe)', async () => {
    const dispatch = vi.fn().mockResolvedValue({})
    bridge.start({ resolver: createInMemoryResolver([APP]), dispatchRpc: dispatch })
    bridge.start({ resolver: createInMemoryResolver([APP]), dispatchRpc: dispatch })

    const { win } = makeFakeWindow()
    dispatchFromIframe({
      source: win,
      origin: APP_ORIGIN,
      data: { id: 'r1', action: 'account' },
    })

    await tick()
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('unregisterApp() removes connection — push stops delivering', async () => {
    bridge.start({
      resolver: createInMemoryResolver([APP]),
      dispatchRpc: vi.fn(),
    })

    const { win } = makeFakeWindow()
    dispatchFromIframe({
      source: win,
      origin: APP_ORIGIN,
      data: { id: 'reg', listener: 'l-1' },
    })
    await tick()

    expect(bridge.activeApps()).toContain('demo.app')
    bridge.unregisterApp('demo.app')
    expect(bridge.activeApps()).not.toContain('demo.app')
    expect(bridge.push('demo.app', 'theme', {})).toBe(false)
  })
})
