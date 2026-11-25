// Что видит человек: свой текст ошибки, слова про сеть — даже если она причина
// другой ошибки, — иначе слова того места, где сломалось. Английское
// техническое сообщение на экран не попадает.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { setI18nLocale } from '@/i18n'
import { OfflineError } from '@/helpers/api/offline'
import { UnreachableError } from '@/helpers/api/reachability'
import { TorNotReadyError } from '@/helpers/tor/tor-gate'
import { NodeRejectError } from '@/blockchain/core/transactions/node-reject'
import { UserError, userErrorText } from './user-error'

beforeAll(() => setI18nLocale('ru'))

beforeEach(() => void vi.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => void vi.restoreAllMocks())

const FALLBACK = 'Не удалось подписаться'

describe('userErrorText', () => {
  it('техническое сообщение, строка, объект ноды, пусто — слова места', () => {
    for (const e of [
      new Error('Failed to send transaction: Unexpected response'),
      new TypeError('Failed to fetch'),
      'some code',
      { error: { code: 18, message: 'score limit' } },
      null,
      undefined,
    ]) {
      expect(userErrorText(e, FALLBACK)).toBe(FALLBACK)
    }
  })

  it('текст для человека — как есть, вместе с отказом ноды', () => {
    expect(userErrorText(new UserError('Сначала войдите'), FALLBACK)).toBe('Сначала войдите')
    expect(userErrorText(new NodeRejectError(18, 'Лимит оценок'), FALLBACK)).toBe('Лимит оценок')
  })

  it('без сети, Bastyon не отвечает, Tor не готов — своими словами', () => {
    expect(userErrorText(new OfflineError('rpc'), FALLBACK)).toMatch(/^Нет сети/)
    expect(userErrorText(new UnreachableError('rpc'), FALLBACK)).toMatch(/^Сеть есть, но Bastyon/)
    expect(userErrorText(new TorNotReadyError('timeout'), FALLBACK)).toMatch(/^Tor ещё/)
    const all = Object.assign(new Error('All RPC servers failed. Last error: x'), {
      allErrors: [new TypeError('Failed to fetch')],
    })
    expect(userErrorText(all, FALLBACK)).toMatch(/^Сеть Bastyon не отвечает/)
  })

  it('причина внутри обёртки тоже считается, ближняя — главнее', () => {
    const wrapped = new Error('Failed to send transaction: No network connection', {
      cause: new OfflineError('rpc'),
    })
    expect(userErrorText(wrapped, FALLBACK)).toMatch(/^Нет сети/)
    const own = new UserError('Картинка не загрузилась', { cause: new OfflineError('img') })
    expect(userErrorText(own, FALLBACK)).toBe('Картинка не загрузилась')
  })

  it('причина остаётся в журнале — раз на ошибку; своя и сетевая туда не пишутся', () => {
    const e = new Error('Failed to send transaction')
    userErrorText(e, FALLBACK)
    userErrorText(e, FALLBACK)
    expect(console.error).toHaveBeenCalledTimes(1)
    userErrorText(new UserError('Сначала войдите'), FALLBACK)
    userErrorText(new OfflineError('rpc'), FALLBACK)
    userErrorText(null, FALLBACK)
    expect(console.error).toHaveBeenCalledTimes(1)
  })

  it('петля причин не вешает', () => {
    const a = new Error('a')
    const b = new Error('b', { cause: a })
    a.cause = b
    expect(userErrorText(a, FALLBACK)).toBe(FALLBACK)
  })
})
