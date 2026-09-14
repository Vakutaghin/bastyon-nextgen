// torFetch: abort-сигнал прерывает ожидание invoke (S1), Rust `tor_not_ready`
// и `used_tor=false` превращаются в TorNotReadyError (V20), redirect:'manual'
// уходит как no_redirect (V25).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('./request-debug', () => ({ recordTorRequest: vi.fn() }))

import { isTorNotReadyError } from '@/helpers/tor/tor-gate'
import { torFetch } from './request-tor'

const okResponse = (body = 'hi') => ({
  status: 200,
  status_text: 'OK',
  headers: [['content-type', 'text/plain']],
  body_b64: btoa(body),
  final_url: 'https://example.org/',
  used_tor: true,
})

describe('torFetch', () => {
  beforeEach(() => {
    invoke.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('передаёт запрос в tor_fetch и собирает Response', async () => {
    invoke.mockResolvedValue(okResponse('pong'))
    const res = await torFetch('https://example.org/x', {
      method: 'post',
      headers: { 'x-a': '1' },
      body: 'ping',
    })
    expect(res.status).toBe(200)
    await expect(res.text()).resolves.toBe('pong')
    const [cmd, args] = invoke.mock.calls[0]!
    expect(cmd).toBe('tor_fetch')
    expect(args.req).toMatchObject({
      url: 'https://example.org/x',
      method: 'POST',
      headers: { 'x-a': '1' },
      body_b64: btoa('ping'),
      no_redirect: false,
    })
  })

  it("redirect: 'manual' → no_redirect: true", async () => {
    invoke.mockResolvedValue(okResponse())
    await torFetch('https://example.org/', { redirect: 'manual' })
    expect(invoke.mock.calls[0]![1].req.no_redirect).toBe(true)
  })

  it('abort во время invoke — AbortError сразу, не ждём Rust (S1)', async () => {
    vi.useFakeTimers()
    let settle: (v: unknown) => void = () => {}
    invoke.mockImplementation(() => new Promise((r) => (settle = r)))
    const ctrl = new AbortController()
    const p = torFetch('https://example.org/', { signal: ctrl.signal })
    const assertion = expect(p).rejects.toMatchObject({ name: 'AbortError' })
    setTimeout(() => ctrl.abort(), 100)
    await vi.advanceTimersByTimeAsync(100)
    await assertion
    settle(okResponse()) // поздний ответ Rust никого не ломает
  })

  it('уже сработавший сигнал — без invoke', async () => {
    const ctrl = new AbortController()
    ctrl.abort()
    await expect(torFetch('https://example.org/', { signal: ctrl.signal })).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(invoke).not.toHaveBeenCalled()
  })

  it('Rust tor_not_ready → TorNotReadyError, а не обычная ошибка', async () => {
    invoke.mockRejectedValue('tor_not_ready: status=Bootstrapping')
    const err = await torFetch('https://example.org/').catch((e) => e)
    expect(isTorNotReadyError(err)).toBe(true)
  })

  it('used_tor=false от старого бэкенда → TorNotReadyError (V20)', async () => {
    invoke.mockResolvedValue({ ...okResponse(), used_tor: false })
    const err = await torFetch('https://example.org/').catch((e) => e)
    expect(isTorNotReadyError(err)).toBe(true)
  })
})
