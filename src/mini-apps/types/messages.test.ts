import { describe, it, expect } from 'vitest'
import {
  parseIncomingMessage,
  rpcSuccess,
  rpcError,
  pushEvent,
  fetchResponseOk,
  fetchResponseError,
} from './messages'

describe('parseIncomingMessage', () => {
  // ─── happy paths ──────────────────────────────────────────────────────────

  it('parses an RPC request', () => {
    const result = parseIncomingMessage({ id: 'abc', action: 'account', data: {} })
    expect(result?.kind).toBe('rpc')
    if (result?.kind === 'rpc') {
      expect(result.message.id).toBe('abc')
      expect(result.message.action).toBe('account')
    }
  })

  it('parses an RPC request without data field', () => {
    const result = parseIncomingMessage({ id: 'abc', action: 'appinfo' })
    expect(result?.kind).toBe('rpc')
  })

  it('parses a listener registration', () => {
    const result = parseIncomingMessage({ id: 'reg-1', listener: 'listen-abc' })
    expect(result?.kind).toBe('listener')
    if (result?.kind === 'listener') {
      expect(result.message.listener).toBe('listen-abc')
    }
  })

  it('parses a fire-and-forget event', () => {
    const result = parseIncomingMessage({ event: 'loaded', data: { foo: 1 } })
    expect(result?.kind).toBe('event')
    if (result?.kind === 'event') {
      expect(result.message.event).toBe('loaded')
    }
  })

  it('parses a FETCH_REQUEST', () => {
    const result = parseIncomingMessage({
      type: 'FETCH_REQUEST',
      requestId: 'req-1',
      request: { url: 'https://example.com', method: 'GET' },
    })
    expect(result?.kind).toBe('fetch')
  })

  // ─── invalid inputs return null silently ──────────────────────────────────

  it('returns null for null / undefined', () => {
    expect(parseIncomingMessage(null)).toBeNull()
    expect(parseIncomingMessage(undefined)).toBeNull()
  })

  it('returns null for primitives', () => {
    expect(parseIncomingMessage('hello')).toBeNull()
    expect(parseIncomingMessage(42)).toBeNull()
    expect(parseIncomingMessage(true)).toBeNull()
  })

  it('returns null for empty object', () => {
    expect(parseIncomingMessage({})).toBeNull()
  })

  it('returns null for RPC without id', () => {
    expect(parseIncomingMessage({ action: 'account' })).toBeNull()
  })

  it('returns null for RPC without action', () => {
    expect(parseIncomingMessage({ id: 'abc' })).toBeNull()
  })

  it('returns null for listener without id', () => {
    expect(parseIncomingMessage({ listener: 'l-1' })).toBeNull()
  })

  it('returns null for fetch with bad url', () => {
    expect(
      parseIncomingMessage({
        type: 'FETCH_REQUEST',
        requestId: 'r1',
        request: { url: 'not-a-url' },
      })
    ).toBeNull()
  })

  // ─── discrimination edge cases (legacy compatibility) ─────────────────────

  it('prefers listener over RPC when both id+listener present but no action', () => {
    const result = parseIncomingMessage({ id: 'x', listener: 'l-1' })
    expect(result?.kind).toBe('listener')
  })

  it('treats id+listener+action as RPC (action takes precedence over listener if both)', () => {
    // Legacy actually doesn't combine these. Our dispatcher rejects messages
    // that have both action and listener. We discriminate to listener because
    // we check listener first when there's no action. With action present → RPC.
    const result = parseIncomingMessage({ id: 'x', listener: 'l-1', action: 'account' })
    expect(result?.kind).toBe('rpc')
  })

  it('FETCH_REQUEST takes precedence over other discriminators', () => {
    const result = parseIncomingMessage({
      type: 'FETCH_REQUEST',
      requestId: 'r1',
      request: { url: 'https://example.com' },
      // даже если бы здесь были action/listener — это всё равно fetch
      action: 'should-be-ignored',
      id: 'x',
    })
    expect(result?.kind).toBe('fetch')
  })

  it('does not throw on circular references', () => {
    const circular: Record<string, unknown> = { id: 'x', action: 'account' }
    circular.self = circular
    // Zod will handle this gracefully (it doesn't recurse into unknown).
    expect(() => parseIncomingMessage(circular)).not.toThrow()
  })

  it('rejects oversized id (potential DoS)', () => {
    const huge = 'a'.repeat(1000)
    expect(parseIncomingMessage({ id: huge, action: 'account' })).toBeNull()
  })
})

describe('outgoing message builders', () => {
  it('rpcSuccess', () => {
    expect(rpcSuccess('id-1', { foo: 1 })).toEqual({ response: 'id-1', data: { foo: 1 } })
  })

  it('rpcError', () => {
    expect(rpcError('id-1', { message: 'bad', code: 'BAD' })).toEqual({
      response: 'id-1',
      error: { message: 'bad', code: 'BAD' },
    })
  })

  it('pushEvent', () => {
    expect(pushEvent('listen-1', 'theme', { theme: 'dark' })).toEqual({
      listener: 'listen-1',
      key: 'theme',
      data: { theme: 'dark' },
    })
  })

  it('fetchResponseOk', () => {
    const r = fetchResponseOk('req-1', { status: 200, statusText: 'OK', headers: {}, body: [] })
    expect(r.type).toBe('FETCH_RESPONSE')
    expect(r.success).toBe(true)
    expect(r.requestId).toBe('req-1')
  })

  it('fetchResponseError', () => {
    const r = fetchResponseError('req-1', 'network down')
    expect(r.success).toBe(false)
    expect(r.error).toBe('network down')
  })
})
