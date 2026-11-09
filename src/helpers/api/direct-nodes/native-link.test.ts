// Прямой запрос к ноде мимо WebView: что уходит в Rust (десктоп) и в плагин
// NodeLink (Android), чужой сертификат — NodePinMismatchError, отмена снимает
// и нативный запрос, в браузере прямого пути нет.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const env = vi.hoisted(() => ({
  tauri: false,
  native: false,
  plugin: false,
  invoke: vi.fn(),
  request: vi.fn(),
  cancel: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: env.invoke }))
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => env.native,
    isPluginAvailable: (name: string) => env.plugin && name === 'NodeLink',
  },
  registerPlugin: () => ({ request: env.request, cancel: env.cancel }),
}))
vi.mock('../request-tor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../request-tor')>()),
  isTauriEnv: () => env.tauri,
}))

import {
  isNodeLinkAvailable,
  nodeLinkRequest,
  NodePinMismatchError,
  type NodeLinkRequest,
} from './native-link'

const REQ: NodeLinkRequest = {
  host: '1.2.3.4',
  port: 38881,
  path: '/public/',
  body: '{"method":"getnodeinfo"}',
  pin: 'ab'.repeat(32),
  timeoutMs: 8000,
}
const OK = { status: 200, body: '{"result":1}', fingerprint: 'cd'.repeat(32) }

beforeEach(() => {
  env.tauri = false
  env.native = false
  env.plugin = false
  env.invoke.mockReset()
  env.request.mockReset()
  env.cancel.mockReset().mockResolvedValue(undefined)
})

describe('isNodeLinkAvailable', () => {
  it('есть в десктопе и в Android с плагином; в браузере и без плагина — нет', () => {
    expect(isNodeLinkAvailable()).toBe(false)
    env.native = true
    expect(isNodeLinkAvailable()).toBe(false)
    env.plugin = true
    expect(isNodeLinkAvailable()).toBe(true)
    env.native = false
    env.tauri = true
    expect(isNodeLinkAvailable()).toBe(true)
  })
})

describe('nodeLinkRequest — десктоп (Rust)', () => {
  beforeEach(() => {
    env.tauri = true
  })

  it('отдаёт в node_fetch адрес TLS-порта, тело, запомненный отпечаток и предел', async () => {
    env.invoke.mockResolvedValue(OK)
    expect(await nodeLinkRequest(REQ)).toEqual(OK)
    expect(env.invoke).toHaveBeenCalledWith('node_fetch', {
      req: {
        url: 'https://1.2.3.4:38881/public/',
        body: REQ.body,
        pin: REQ.pin,
        timeout_ms: 8000,
      },
    })
  })

  it('первая встреча с нодой — без отпечатка', async () => {
    env.invoke.mockResolvedValue(OK)
    await nodeLinkRequest({ ...REQ, pin: null, path: '/post/' })
    expect(env.invoke.mock.calls[0]![1]).toMatchObject({
      req: { url: 'https://1.2.3.4:38881/post/', pin: null },
    })
  })

  it('сертификат сменился — NodePinMismatchError с адресом ноды', async () => {
    env.invoke.mockRejectedValue('pin_mismatch: expected ab.., got ef..')
    const err = await nodeLinkRequest(REQ).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(NodePinMismatchError)
    expect((err as NodePinMismatchError).host).toBe('1.2.3.4')
  })

  it('прочие ошибки Rust проходят как есть', async () => {
    env.invoke.mockRejectedValue('connect timeout')
    await expect(nodeLinkRequest(REQ)).rejects.toBe('connect timeout')
  })

  it('отмена во время запроса — AbortError, ответ Rust уже не нужен', async () => {
    let finish: (v: unknown) => void = () => {}
    env.invoke.mockReturnValue(new Promise((r) => (finish = r)))
    const ctrl = new AbortController()
    const pending = nodeLinkRequest({ ...REQ, signal: ctrl.signal })
    await Promise.resolve()
    ctrl.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    finish(OK)
  })
})

describe('nodeLinkRequest — Android (NodeLink)', () => {
  beforeEach(() => {
    env.native = true
    env.plugin = true
  })

  it('отдаёт плагину адрес, тело, отпечаток, предел и свой id запроса', async () => {
    env.request.mockResolvedValue(OK)
    expect(await nodeLinkRequest(REQ)).toEqual(OK)
    const [options] = env.request.mock.calls[0]!
    expect(options).toMatchObject({
      url: 'https://1.2.3.4:38881/public/',
      body: REQ.body,
      pin: REQ.pin,
      timeoutMs: 8000,
    })
    expect(options.id).toMatch(/^n[0-9a-z]+-\d+$/)
  })

  it('у каждого запроса свой id — отмена одного не задевает другой', async () => {
    env.request.mockResolvedValue(OK)
    await nodeLinkRequest(REQ)
    await nodeLinkRequest(REQ)
    expect(env.request.mock.calls[0]![0].id).not.toBe(env.request.mock.calls[1]![0].id)
  })

  it('сертификат сменился (code pin_mismatch) — NodePinMismatchError', async () => {
    env.request.mockRejectedValue(Object.assign(new Error('pin'), { code: 'pin_mismatch' }))
    await expect(nodeLinkRequest(REQ)).rejects.toBeInstanceOf(NodePinMismatchError)
  })

  it('прочие ошибки плагина проходят как есть', async () => {
    const failure = Object.assign(new Error('timeout'), { code: 'timeout' })
    env.request.mockRejectedValue(failure)
    await expect(nodeLinkRequest(REQ)).rejects.toBe(failure)
    expect(env.cancel).not.toHaveBeenCalled()
  })

  it('отмена — AbortError и cancel того же id на нативной стороне', async () => {
    let fail: (e: unknown) => void = () => {}
    env.request.mockReturnValue(new Promise((_, reject) => (fail = reject)))
    const ctrl = new AbortController()
    const pending = nodeLinkRequest({ ...REQ, signal: ctrl.signal })
    ctrl.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(env.cancel).toHaveBeenCalledWith({ id: env.request.mock.calls[0]![0].id })
    // Поздний отказ отменённого запроса не всплывает необработанным.
    fail(new Error('cancelled'))
    await Promise.resolve()
  })

  it('отмена не падает, если плагин не смог отменить', async () => {
    env.request.mockReturnValue(new Promise(() => {}))
    env.cancel.mockRejectedValue(new Error('no such request'))
    const ctrl = new AbortController()
    const pending = nodeLinkRequest({ ...REQ, signal: ctrl.signal })
    ctrl.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('nodeLinkRequest — общее', () => {
  it('уже отменённый запрос никуда не уходит', async () => {
    env.tauri = true
    const ctrl = new AbortController()
    ctrl.abort()
    await expect(nodeLinkRequest({ ...REQ, signal: ctrl.signal })).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(env.invoke).not.toHaveBeenCalled()
  })

  it('в браузере — понятная ошибка, а не запрос через WebView', async () => {
    await expect(nodeLinkRequest(REQ)).rejects.toThrow(
      'direct node connection is not available here'
    )
    env.native = true // Android без плагина — так же
    await expect(nodeLinkRequest(REQ)).rejects.toThrow('not available')
    expect(env.request).not.toHaveBeenCalled()
  })
})
