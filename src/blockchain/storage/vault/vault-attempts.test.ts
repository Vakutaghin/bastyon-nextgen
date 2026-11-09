// Троттлинг ввода passphrase сейфа: 3 бесплатные попытки, затем 5/15/30/60 с;
// счётчик переживает перезагрузку (localStorage), а битая или чужая запись
// не должна запирать пользователя.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VAULT_ATTEMPTS_KEY } from '../../constants/storage'
import { clearAttempts, getAttemptState, recordFailedAttempt } from './vault-attempts'
import { memStorage } from './test-mem-storage'

const NOW = 1_700_000_000_000

function failTimes(n: number) {
  let last = getAttemptState()
  for (let i = 0; i < n; i++) last = recordFailedAttempt()
  return last
}

describe('vault-attempts: троттлинг ввода passphrase', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('без записи — ноль попыток и никакого ожидания', () => {
    expect(getAttemptState()).toEqual({ attempts: 0, cooldownUntil: 0 })
  })

  it('первые три промаха не заставляют ждать', () => {
    for (let i = 1; i <= 3; i++) {
      const st = recordFailedAttempt()
      expect(st.attempts).toBe(i)
      expect(st.cooldownUntil).toBe(NOW)
    }
  })

  it.each([
    [4, 5_000],
    [5, 15_000],
    [6, 30_000],
    [7, 60_000],
  ])('после %i-го промаха ждать %i мс', (n, wait) => {
    const st = failTimes(n)
    expect(st.attempts).toBe(n)
    expect(st.cooldownUntil - NOW).toBe(wait)
  })

  it('дальше пауза не растёт сверх минуты', () => {
    expect(failTimes(25).cooldownUntil - NOW).toBe(60_000)
  })

  it('пауза отсчитывается от момента промаха, а не от первого сбоя', () => {
    failTimes(4)
    vi.setSystemTime(NOW + 10_000)
    expect(recordFailedAttempt().cooldownUntil).toBe(NOW + 10_000 + 15_000)
  })

  it('счётчик переживает перезагрузку: в localStorage лежат только счётчик и срок', () => {
    failTimes(5)
    const raw = localStorage.getItem(VAULT_ATTEMPTS_KEY)
    // Ничего, кроме двух чисел, — ни пароля, ни его производных.
    expect(JSON.parse(raw!)).toEqual({ attempts: 5, cooldownUntil: NOW + 15_000 })
    expect(getAttemptState()).toEqual({ attempts: 5, cooldownUntil: NOW + 15_000 })
  })

  it('успешный вход сбрасывает счётчик: следующий промах снова бесплатный', () => {
    failTimes(6)
    clearAttempts()
    expect(localStorage.getItem(VAULT_ATTEMPTS_KEY)).toBeNull()
    expect(getAttemptState()).toEqual({ attempts: 0, cooldownUntil: 0 })
    expect(recordFailedAttempt()).toEqual({ attempts: 1, cooldownUntil: NOW })
  })

  it.each([
    ['битый JSON', '{"attempts":7,'],
    ['JSON null', 'null'],
    ['строки вместо чисел', '{"attempts":"99","cooldownUntil":"99999999999999"}'],
    ['пустой объект', '{}'],
  ])('%s в хранилище — как чистый лист, пользователь не заперт', (_label, raw) => {
    localStorage.setItem(VAULT_ATTEMPTS_KEY, raw)
    expect(getAttemptState()).toEqual({ attempts: 0, cooldownUntil: 0 })
    // Следующий промах считается с нуля и перезаписывает мусор валидной записью.
    expect(recordFailedAttempt()).toEqual({ attempts: 1, cooldownUntil: NOW })
    expect(JSON.parse(localStorage.getItem(VAULT_ATTEMPTS_KEY)!)).toEqual({
      attempts: 1,
      cooldownUntil: NOW,
    })
  })

  it('частично валидная запись: годное поле берётся, негодное — ноль', () => {
    localStorage.setItem(VAULT_ATTEMPTS_KEY, '{"attempts":3,"cooldownUntil":"later"}')
    expect(getAttemptState()).toEqual({ attempts: 3, cooldownUntil: 0 })
  })

  it('хранилище не принимает запись (квота) — промах всё равно считается, без исключения', () => {
    const mem = memStorage()
    mem.setItem(VAULT_ATTEMPTS_KEY, '{"attempts":4,"cooldownUntil":0}')
    mem.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    vi.stubGlobal('localStorage', mem)
    try {
      expect(recordFailedAttempt()).toEqual({ attempts: 5, cooldownUntil: NOW + 15_000 })
      // Запись не удалась — в хранилище прежнее значение.
      expect(getAttemptState().attempts).toBe(4)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('сброс при недоступном хранилище не бросает', () => {
    const mem = memStorage()
    mem.setItem(VAULT_ATTEMPTS_KEY, '{"attempts":5,"cooldownUntil":0}')
    mem.removeItem = () => {
      throw new Error('SecurityError')
    }
    vi.stubGlobal('localStorage', mem)
    try {
      expect(() => clearAttempts()).not.toThrow()
      expect(getAttemptState().attempts).toBe(5)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('без localStorage (SSR/приватный режим) — ноль попыток, промах считается в памяти вызова', () => {
    localStorage.setItem(VAULT_ATTEMPTS_KEY, '{"attempts":9,"cooldownUntil":0}')
    vi.stubGlobal('localStorage', undefined)
    try {
      expect(getAttemptState()).toEqual({ attempts: 0, cooldownUntil: 0 })
      expect(recordFailedAttempt()).toEqual({ attempts: 1, cooldownUntil: NOW })
      expect(() => clearAttempts()).not.toThrow()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
