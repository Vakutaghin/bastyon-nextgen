// Текст ошибки для экрана: ошибка RPC — её сообщение; без сети и «ни один
// сервер не ответил по сети» — словами, а не технической строкой.

import { beforeAll, describe, expect, it } from 'vitest'

import { setI18nLocale } from '@/i18n'
import { OfflineError } from '@/helpers/api/offline'
import { UnreachableError } from '@/helpers/api/reachability'
import { extractErrorMessage } from './extract-error-message'

beforeAll(() => setI18nLocale('ru'))

function allFailed(errors: unknown[]): Error {
  const err = new Error('All RPC servers failed. Last error: Failed to fetch') as Error & {
    allErrors: unknown[]
  }
  err.allErrors = errors
  return err
}

describe('extractErrorMessage', () => {
  it('без сети — «Нет сети…»', () => {
    expect(extractErrorMessage(new OfflineError('rpc'))).toMatch(/^Нет сети/)
  })

  it('сеть есть, а прокси молчат и на пинг — про гостевой Wi-Fi и что загрузится само', () => {
    const text = extractErrorMessage(
      new UnreachableError('feed', allFailed([new TypeError('Failed to fetch')]))
    )
    expect(text).toMatch(/^Сеть есть, но Bastyon не отвечает/)
    expect(text).toMatch(/Wi-Fi/)
    expect(text).toMatch(/Загрузится само/)
  })

  it('все серверы молчат по сети — «Сеть Bastyon не отвечает…»', () => {
    expect(extractErrorMessage(allFailed([new TypeError('Failed to fetch')]))).toMatch(
      /^Сеть Bastyon не отвечает/
    )
  })

  it('сервер ответил ошибкой (есть HTTP-статус) — как было', () => {
    const err = allFailed([{ httpStatus: 500, message: 'boom' }])
    expect(extractErrorMessage(err)).toBe(err.message)
  })

  it('ошибка RPC в обёртке и строка — как было', () => {
    expect(extractErrorMessage({ error: { error: { code: 18, message: 'score limit' } } })).toBe(
      'score limit'
    )
    expect(extractErrorMessage('text')).toBe('text')
    expect(extractErrorMessage(new Error('Пользователь не найден'))).toBe('Пользователь не найден')
  })
})
