// Сокет к ноде через Rust (десктоп): подписки на события до node_ws_connect,
// отпечаток сертификата запоминается, close() до открытия закрывает и
// нативную сторону, обрыв со стороны сервера — onclose.

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Listener = (e: { payload: unknown }) => void

const tauri = vi.hoisted(() => {
  const listeners = new Map<string, Listener[]>()
  return {
    listeners,
    invoke: vi.fn(),
    listen: vi.fn(async (event: string, cb: Listener) => {
      listeners.set(event, [...(listeners.get(event) ?? []), cb])
      return () =>
        listeners.set(
          event,
          (listeners.get(event) ?? []).filter((l) => l !== cb)
        )
    }),
    emit(event: string, payload: unknown) {
      for (const l of listeners.get(event) ?? []) l({ payload })
    },
  }
})
vi.mock('@tauri-apps/api/core', () => ({ invoke: tauri.invoke }))
vi.mock('@tauri-apps/api/event', () => ({ listen: tauri.listen }))
vi.mock('../request-tor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../request-tor')>()),
  isTauriEnv: () => true,
}))

import { pinOf, rememberPin, resetPinsForTests } from './node-pins'
import { NodeWebSocket } from './node-websocket'

const waitUntil = async (cond: () => boolean): Promise<void> => {
  for (let i = 0; i < 50; i++) {
    if (cond()) return
    await new Promise((r) => setTimeout(r, 0))
  }
  throw new Error('condition not met')
}

describe('NodeWebSocket (Tauri)', () => {
  beforeEach(() => {
    tauri.invoke.mockReset()
    tauri.listeners.clear()
    resetPinsForTests()
  })

  it('открывается, запоминает сертификат WSS и принимает сообщения', async () => {
    tauri.invoke.mockResolvedValue({ fingerprint: 'cd'.repeat(32) })
    const ws = new NodeWebSocket('1.2.3.4', 8887)
    const messages: string[] = []
    ws.onmessage = (e) => void messages.push(e.data)
    await waitUntil(() => ws.readyState === NodeWebSocket.OPEN)

    const [cmd, args] = tauri.invoke.mock.calls[0]!
    expect(cmd).toBe('node_ws_connect')
    expect(args).toMatchObject({ url: 'wss://1.2.3.4:8887/ws', pin: null })
    // Подписки на события — до connect.
    const id = (args as { id: string }).id
    expect(tauri.listeners.has(`node:ws:${id}:message`)).toBe(true)
    expect(pinOf('1.2.3.4:8887')).toBe('cd'.repeat(32))

    tauri.emit(`node:ws:${id}:message`, { kind: 'text', data: '{"x":1}' })
    expect(messages).toEqual(['{"x":1}'])

    ws.send('hello')
    await waitUntil(() => tauri.invoke.mock.calls.some(([c]) => c === 'node_ws_send'))
    expect(tauri.invoke).toHaveBeenCalledWith('node_ws_send', { id, data: 'hello' })

    const closed = vi.fn()
    ws.onclose = closed
    tauri.emit(`node:ws:${id}:close`, { code: 1006, reason: 'connection lost' })
    expect(closed).toHaveBeenCalledWith({ code: 1006, reason: 'connection lost' })
    expect(ws.readyState).toBe(NodeWebSocket.CLOSED)
  })

  it('знакомая нода — с запомненным отпечатком; close() до открытия закрывает Rust-сторону', async () => {
    rememberPin('1.2.3.4:8887', 'ef'.repeat(32))
    let open!: (v: unknown) => void
    tauri.invoke.mockImplementation((cmd: string) =>
      cmd === 'node_ws_connect' ? new Promise((r) => (open = r)) : Promise.resolve()
    )
    const ws = new NodeWebSocket('1.2.3.4', 8887)
    await waitUntil(() => tauri.invoke.mock.calls.length > 0)
    expect(tauri.invoke.mock.calls[0]![1]).toMatchObject({ pin: 'ef'.repeat(32) })
    ws.close()
    open({ fingerprint: 'ef'.repeat(32) })
    await waitUntil(() => tauri.invoke.mock.calls.some(([c]) => c === 'node_ws_close'))
    expect(ws.readyState).toBe(NodeWebSocket.CLOSED)
  })

  it('не открылся — ошибка и onclose', async () => {
    tauri.invoke.mockRejectedValue('pin_mismatch: certificate changed')
    const ws = new NodeWebSocket('1.2.3.4', 8887)
    const errors: string[] = []
    ws.onerror = (e) => void errors.push(e.message)
    await waitUntil(() => ws.readyState === NodeWebSocket.CLOSED)
    expect(errors[0]).toContain('pin_mismatch')
  })
})
