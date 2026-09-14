// TorWebSocket: подписки до invoke и OPEN по его завершении (V22), close() до
// открытия закрывает Rust-сторону (S3), серверный close/ошибка переводят в
// CLOSED (S60), при не готовом Tor сокет ждёт, а не идёт мимо (V20).

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Listener = (e: { payload: unknown }) => void

const tauri = vi.hoisted(() => {
  const listeners = new Map<string, Listener[]>()
  return {
    listeners,
    invoke: vi.fn(),
    listen: vi.fn(async (event: string, cb: Listener) => {
      const arr = listeners.get(event) ?? []
      arr.push(cb)
      listeners.set(event, arr)
      return () => {
        listeners.set(
          event,
          (listeners.get(event) ?? []).filter((l) => l !== cb)
        )
      }
    }),
    emit(event: string, payload: unknown) {
      for (const l of listeners.get(event) ?? []) l({ payload })
    },
  }
})
vi.mock('@tauri-apps/api/core', () => ({ invoke: tauri.invoke }))
vi.mock('@tauri-apps/api/event', () => ({ listen: tauri.listen }))

import { useTorStore } from '@/stores/tor-store'
import { TorWebSocket, pickWebSocketCtor } from './tor-websocket'

/** Динамические import'ы внутри _init идут макротасками — ждём условие, а не N микротасок. */
const waitUntil = async (cond: () => boolean, tries = 50): Promise<void> => {
  for (let i = 0; i < tries; i++) {
    if (cond()) return
    await new Promise((r) => setTimeout(r, 0))
  }
  throw new Error('waitUntil: condition not met')
}
const settle = () => new Promise((r) => setTimeout(r, 5))

function torStore(status: 'off' | 'bootstrapping' | 'ready' | 'failed') {
  const store = useTorStore()
  store.available = true
  store.enabled = true
  store.status = status
  return store
}

const connectCalls = () => tauri.invoke.mock.calls.filter((c) => c[0] === 'tor_ws_connect')
const closeCalls = () => tauri.invoke.mock.calls.filter((c) => c[0] === 'tor_ws_close')

describe('TorWebSocket', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    tauri.listeners.clear()
    tauri.invoke.mockReset().mockResolvedValue(undefined)
    tauri.listen.mockClear()
  })

  it('подписывается на события ДО tor_ws_connect и открывается по его завершении', async () => {
    torStore('ready')
    let resolveConnect: () => void = () => {}
    tauri.invoke.mockImplementation((cmd: string) =>
      cmd === 'tor_ws_connect'
        ? new Promise<void>((r) => (resolveConnect = r))
        : Promise.resolve(undefined)
    )
    const ws = new TorWebSocket('wss://1.pocketnet.app:8099')
    const onopen = vi.fn()
    ws.onopen = onopen
    await waitUntil(() => connectCalls().length === 1)

    const [, args] = connectCalls()[0]!
    expect(args.url).toBe('wss://1.pocketnet.app:8099')
    expect(typeof args.id).toBe('string')
    expect(args.id).toMatch(/^[A-Za-z0-9-]+$/)
    // Подписки уже стоят, пока invoke в полёте.
    expect(tauri.listeners.get(`tor:ws:${args.id}:message`)).toHaveLength(1)
    expect(ws.readyState).toBe(WebSocket.CONNECTING)

    resolveConnect()
    await waitUntil(() => ws.readyState === WebSocket.OPEN)
    expect(onopen).toHaveBeenCalledTimes(1)

    // Сообщение доходит через подписку.
    const onmessage = vi.fn()
    ws.onmessage = onmessage
    tauri.emit(`tor:ws:${args.id}:message`, { kind: 'text', data: '{"msg":"new block"}' })
    expect(onmessage).toHaveBeenCalledTimes(1)
    expect(onmessage.mock.calls[0]![0].data).toBe('{"msg":"new block"}')
  })

  it('close() до завершения tor_ws_connect закрывает Rust-сторону (S3)', async () => {
    torStore('ready')
    let resolveConnect: () => void = () => {}
    tauri.invoke.mockImplementation((cmd: string) =>
      cmd === 'tor_ws_connect'
        ? new Promise<void>((r) => (resolveConnect = r))
        : Promise.resolve(undefined)
    )
    const ws = new TorWebSocket('wss://1.pocketnet.app:8099')
    const onclose = vi.fn()
    ws.onclose = onclose
    await waitUntil(() => connectCalls().length === 1)
    ws.close()
    expect(ws.readyState).toBe(WebSocket.CLOSED)
    expect(onclose).toHaveBeenCalledTimes(1)

    resolveConnect()
    await waitUntil(() => closeCalls().length === 1)
    await settle()
    const id = connectCalls()[0]![1].id
    expect(closeCalls().map((c) => c[1].id)).toEqual([id])
    // Подписок не осталось.
    expect(tauri.listeners.get(`tor:ws:${id}:message`)).toHaveLength(0)
  })

  it('серверный close переводит в CLOSED без повторного tor_ws_close (S60)', async () => {
    torStore('ready')
    const ws = new TorWebSocket('wss://1.pocketnet.app:8099')
    const onclose = vi.fn()
    ws.onclose = onclose
    await waitUntil(() => ws.readyState === WebSocket.OPEN)
    const id = connectCalls()[0]![1].id
    tauri.emit(`tor:ws:${id}:close`, { code: 1001, reason: 'going away' })
    expect(ws.readyState).toBe(WebSocket.CLOSED)
    expect(onclose.mock.calls[0]![0].code).toBe(1001)
    ws.close()
    await settle()
    expect(closeCalls()).toHaveLength(0)
  })

  it('close() открытого сокета шлёт Close-фрейм и tor_ws_close, затем CLOSED', async () => {
    torStore('ready')
    const ws = new TorWebSocket('wss://1.pocketnet.app:8099')
    const onclose = vi.fn()
    ws.onclose = onclose
    await waitUntil(() => ws.readyState === WebSocket.OPEN)
    ws.close(1000, 'bye')
    expect(ws.readyState).toBe(WebSocket.CLOSING)
    await waitUntil(() => ws.readyState === WebSocket.CLOSED)
    const id = connectCalls()[0]![1].id
    const sends = tauri.invoke.mock.calls.filter((c) => c[0] === 'tor_ws_send')
    expect(sends[0]![1]).toEqual({ id, payload: { kind: 'close', code: 1000, reason: 'bye' } })
    expect(closeCalls()).toHaveLength(1)
    expect(ws.readyState).toBe(WebSocket.CLOSED)
    expect(onclose).toHaveBeenCalledTimes(1)
  })

  it('Tor бутстрапится: connect не вызывается, пока не ready (V20)', async () => {
    const store = torStore('bootstrapping')
    const ws = new TorWebSocket('wss://1.pocketnet.app:8099')
    await settle()
    expect(connectCalls()).toHaveLength(0)
    expect(ws.readyState).toBe(WebSocket.CONNECTING)
    store.status = 'ready'
    await waitUntil(() => ws.readyState === WebSocket.OPEN)
    expect(connectCalls()).toHaveLength(1)
  })

  it('Tor failed: сокет закрывается с ошибкой, нативного соединения нет', async () => {
    torStore('failed')
    const ws = new TorWebSocket('wss://1.pocketnet.app:8099')
    const onerror = vi.fn()
    const onclose = vi.fn()
    ws.onerror = onerror
    ws.onclose = onclose
    await waitUntil(() => ws.readyState === WebSocket.CLOSED)
    expect(connectCalls()).toHaveLength(0)
    expect(onerror).toHaveBeenCalledTimes(1)
    expect(onclose.mock.calls[0]![0].code).toBe(1006)
  })

  it('ошибка tor_ws_connect → error + close 1006', async () => {
    torStore('ready')
    tauri.invoke.mockImplementation((cmd: string) =>
      cmd === 'tor_ws_connect' ? Promise.reject('socks error: refused') : Promise.resolve()
    )
    const ws = new TorWebSocket('wss://1.pocketnet.app:8099')
    const onclose = vi.fn()
    ws.onclose = onclose
    await waitUntil(() => ws.readyState === WebSocket.CLOSED)
    expect(onclose.mock.calls[0]![0].code).toBe(1006)
  })
})

describe('pickWebSocketCtor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('Tor включён (даже не ready) — TorWebSocket, иначе нативный', async () => {
    const store = useTorStore()
    store.available = true
    store.enabled = true
    store.status = 'bootstrapping'
    expect(await pickWebSocketCtor()).toBe(TorWebSocket)
    store.status = 'failed'
    expect(await pickWebSocketCtor()).toBe(TorWebSocket)
    store.enabled = false
    expect(await pickWebSocketCtor()).toBe(WebSocket)
  })
})
