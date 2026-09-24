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
    expect(isFatalDbError(Object.assign(new Error('x'), { name: 'VersionError' }))).toBe(true)
    expect(isFatalDbError(Object.assign(new Error('x'), { name: 'InvalidStateError' }))).toBe(true)
    expect(isFatalDbError(Object.assign(new Error('x'), { name: 'DatabaseClosedError' }))).toBe(
      true
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
      throw Object.assign(new Error('schema'), { name: 'VersionError' })
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
