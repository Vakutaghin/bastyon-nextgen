import { describe, it, expect } from 'vitest'
import { ACTION_NAMES, isKnownAction, parseActionParams } from './_schema'

describe('action schemas', () => {
  it('lists all known actions', () => {
    // Спот-проверка: каждый из ключевых action из §0.2 присутствует
    const required = [
      'appinfo',
      'account',
      'sign',
      'rpc',
      'payment',
      'ext',
      'authFetch',
      'balance',
      'zaddress',
      'fromToTransactions',
      'get.feed',
      'open.post',
      'chat.send',
      'barteron.offer',
      'images.upload',
    ]
    for (const action of required) {
      expect(ACTION_NAMES).toContain(action)
    }
  })

  it('isKnownAction discriminates known vs unknown', () => {
    expect(isKnownAction('account')).toBe(true)
    expect(isKnownAction('chat.send')).toBe(true)
    expect(isKnownAction('chat.unknown')).toBe(false)
    expect(isKnownAction('')).toBe(false)
  })

  describe('parseActionParams', () => {
    it('accepts empty data for parameter-less actions', () => {
      expect(parseActionParams('appinfo', undefined)).not.toBeNull()
      expect(parseActionParams('account', {})).not.toBeNull()
    })

    it('validates sign params (string is optional)', () => {
      expect(parseActionParams('sign', {})).not.toBeNull()
      expect(parseActionParams('sign', { string: 'hello' })).not.toBeNull()
      expect(parseActionParams('sign', { string: 123 })).toBeNull()
    })

    it('rejects rpc without method', () => {
      expect(parseActionParams('rpc', { parameters: [] })).toBeNull()
    })

    it('accepts rpc with method only', () => {
      expect(parseActionParams('rpc', { method: 'getnodeinfo' })).not.toBeNull()
    })

    it('accepts rpc with full params', () => {
      const r = parseActionParams('rpc', {
        method: 'getrawtransaction',
        parameters: ['txid'],
        options: { fnode: 'node:8081', cachetime: 60 },
      })
      expect(r).not.toBeNull()
    })

    it('rejects authFetch with non-URL', () => {
      expect(parseActionParams('authFetch', { url: 'not-url' })).toBeNull()
    })

    it('accepts authFetch with valid URL', () => {
      expect(parseActionParams('authFetch', { url: 'https://api.example.com' })).not.toBeNull()
    })

    it('rejects unknown actions', () => {
      // @ts-expect-error — намеренно передаём невалидное имя
      expect(parseActionParams('garbage.action', {})).toBeNull()
    })

    it('payment requires recievers (legacy spelling preserved)', () => {
      expect(parseActionParams('payment', { feemode: 'fast' })).toBeNull()
      expect(
        parseActionParams('payment', { recievers: [{ address: 'a', amount: 1 }] })
      ).not.toBeNull()
    })

    it('ext requires non-empty hash', () => {
      expect(parseActionParams('ext', { ext: '' })).toBeNull()
      expect(parseActionParams('ext', { ext: '_abc' })).not.toBeNull()
    })

    it('open.post requires txid', () => {
      expect(parseActionParams('open.post', {})).toBeNull()
      expect(parseActionParams('open.post', { txid: 'abc' })).not.toBeNull()
    })

    it('checkPermission requires permission name', () => {
      expect(parseActionParams('checkPermission', {})).toBeNull()
      expect(parseActionParams('checkPermission', { permission: 'account' })).not.toBeNull()
    })

    it('barteron.* accepts arbitrary data (validation downstream)', () => {
      expect(parseActionParams('barteron.offer', { foo: 'bar' })).not.toBeNull()
      expect(parseActionParams('barteron.offer', null)).not.toBeNull()
    })

    it('openExternalLink rejects non-URL', () => {
      expect(parseActionParams('openExternalLink', { url: 'javascript:alert(1)' })).toBeNull()
      expect(parseActionParams('openExternalLink', { url: 'https://example.com' })).not.toBeNull()
    })
  })
})
