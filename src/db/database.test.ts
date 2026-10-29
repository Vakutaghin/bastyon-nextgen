import Dexie from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isDbUnavailable,
  isFatalDbError,
  markDbUnavailable,
  resetDbAvailabilityForTests,
  withDb,
} from './database'

afterEach(() => {
  resetDbAvailabilityForTests()
})

// S61: упавший `open()` (VersionError после отката билда, приватный Firefox)
// превращал каждый промах кэша в unhandled rejection и тост раз в 30 секунд.
describe('isFatalDbError', () => {
  it('узнаёт ошибки, после которых база бесполезна', () => {
    expect(isFatalDbError(new Dexie.VersionError('x'))).toBe(true)
    expect(isFatalDbError(new Dexie.InvalidStateError('x'))).toBe(true)
    expect(isFatalDbError(new Dexie.DatabaseClosedError())).toBe(true)
  })

  // Повторный stop() у MediaRecorder, закрытая база Matrix: имя то же, база не наша.
  it('то же имя от другого API — не ошибка базы', () => {
    const recorder = new DOMException(
      "The MediaRecorder's state is 'inactive'.",
      'InvalidStateError'
    )
    expect(isFatalDbError(recorder)).toBe(false)
    expect(isFatalDbError(Object.assign(new Error('x'), { name: 'QuotaExceededError' }))).toBe(
      false
    )
  })

  it('обычная ошибка запроса фатальной не считается', () => {
    expect(isFatalDbError(new Error('boom'))).toBe(false)
    expect(isFatalDbError(null)).toBe(false)
  })
})

describe('withDb', () => {
  it('отдаёт значение, когда база работает', async () => {
    await expect(withDb('fallback', async () => 'ok')).resolves.toBe('ok')
  })

  it('фатальная ошибка выключает базу и отдаёт fallback', async () => {
    const fail = vi.fn(async () => {
      throw new Dexie.VersionError('schema')
    })

    await expect(withDb([], fail)).resolves.toEqual([])
    expect(isDbUnavailable()).toBe(true)

    // После этого к базе даже не ходим.
    await expect(withDb('fallback', fail)).resolves.toBe('fallback')
    expect(fail).toHaveBeenCalledTimes(1)
  })

  it('обычная ошибка запроса не выключает базу', async () => {
    await expect(
      withDb('fallback', async () => {
        throw new Error('single query failed')
      })
    ).resolves.toBe('fallback')
    expect(isDbUnavailable()).toBe(false)
  })

  it('markDbUnavailable запоминает первую причину', () => {
    markDbUnavailable(new Error('first'))
    markDbUnavailable(new Error('second'))
    expect(isDbUnavailable()).toBe(true)
  })
})
