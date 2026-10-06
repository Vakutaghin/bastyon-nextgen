import { beforeEach, describe, expect, it } from 'vitest'

import { clearRecentErrors, recentErrors, rememberError, scrubForReport } from './recent-errors'

beforeEach(() => clearRecentErrors())

describe('scrubForReport', () => {
  it('вырезает адреса, идентификаторы Matrix, хэши, почту и IP', () => {
    const text = [
      'profile PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D failed',
      'user @3a4b5c6d7e:matrix.pocketnet.app in !AbCdEf123:matrix.pocketnet.app',
      'event $Abcdefghijklmnopqrstuvwxyz0123',
      'tx 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      'mail me@example.com from 192.168.1.20',
    ].join('\n')
    const out = scrubForReport(text)
    expect(out).toContain('profile <address> failed')
    expect(out).toContain('user <user> in <room>')
    expect(out).toContain('event <event>')
    expect(out).toContain('tx <hex>')
    expect(out).toContain('mail <email> from <ip>')
  })

  it('прячет параметры ссылок и имя пользователя в путях', () => {
    expect(scrubForReport('GET https://node.example/rpc/getuser?address=abc&sig=1 500')).toBe(
      'GET https://node.example/rpc/getuser?… 500'
    )
    expect(scrubForReport('open /Users/alex/Library/x.bin')).toBe(
      'open /Users/<user>/Library/x.bin'
    )
    expect(scrubForReport('C:\\Users\\Иван\\AppData\\x')).toBe('C:\\Users\\<user>\\AppData\\x')
  })

  it('фразу восстановления не пропускает', () => {
    const phrase =
      'abandon ability able about above absent absorb abstract absurd abuse access accident'
    expect(scrubForReport(`bad mnemonic: ${phrase}`)).toBe('bad mnemonic: <words>')
  })

  it('обычный текст ошибки оставляет как есть', () => {
    const text = "TypeError: Cannot read properties of undefined (reading 'map')"
    expect(scrubForReport(text)).toBe(text)
  })
})

describe('rememberError', () => {
  it('склеивает аргументы, повторы подряд считает одной записью', () => {
    const at = new Date('2026-10-06T10:00:00Z')
    rememberError(['[feed] failed:', new TypeError('Failed to fetch')], at)
    rememberError(['[feed] failed:', new TypeError('Failed to fetch')], at)
    rememberError([{ message: 'sync error' }, { big: 'object' }], at)
    expect(recentErrors()).toEqual([
      {
        at: '2026-10-06T10:00:00.000Z',
        count: 2,
        message: '[feed] failed: TypeError: Failed to fetch',
      },
      { at: '2026-10-06T10:00:00.000Z', count: 1, message: 'sync error [object]' },
    ])
  })

  it('хранит только последние 20', () => {
    for (let i = 0; i < 25; i++) rememberError([`error ${i}`])
    const list = recentErrors()
    expect(list).toHaveLength(20)
    expect(list[0]!.message).toBe('error 5')
  })

  it('длинное режет по слову: половина адреса не проскочит мимо фильтра', () => {
    const address = 'PXXwfNRT7hD6UYeQQMBXSoLsJH4xDdGc4D'
    rememberError([`${'x '.repeat(298)}${address}`])
    const [entry] = recentErrors()
    expect(entry!.message).not.toMatch(/PXXwf/)
    expect(entry!.message.length).toBeLessThanOrEqual(301)
  })
})
