// Код замка: подпись проверяется только тем же кодом и тем же секретом сейфа,
// сам код на диск не попадает, битая запись = замка нет, паузы после ошибок
// растут, выход из всех аккаунтов стирает замок.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memStorage } from '@/blockchain/storage/vault/test-mem-storage'
import { APP_LOCK_ATTEMPTS_KEY, APP_LOCK_KEY } from '@/blockchain/constants/storage'
import { clearAllUserData } from '@/blockchain/storage/storage-manager'
import {
  clearLockConfig,
  createLockConfig,
  patternToCode,
  pauseAfter,
  readLockAttempts,
  readLockConfig,
  recordLockFailure,
  verifyLockCode,
  writeLockConfig,
} from './app-lock-config'

const SECRET = 'c2VjcmV0LXNlY3JldC1zZWNyZXQtc2VjcmV0LXNlY3I='
const OTHER_SECRET = 'b3RoZXItb3RoZXItb3RoZXItb3RoZXItb3RoZXItb3Q='

beforeEach(() => {
  vi.stubGlobal('localStorage', memStorage())
  vi.stubGlobal('sessionStorage', memStorage())
})
afterEach(() => vi.unstubAllGlobals())

describe('подпись кода', () => {
  it('пин-код: верный проходит, неверный и чужой сейф — нет', async () => {
    const config = await createLockConfig(SECRET, 'pin', '2580', 'min5')
    expect(config).toMatchObject({ v: 1, kind: 'pin', digits: 4, autoLock: 'min5' })
    expect(await verifyLockCode(config, SECRET, '2580')).toBe(true)
    expect(await verifyLockCode(config, SECRET, '2581')).toBe(false)
    expect(await verifyLockCode(config, SECRET, '258')).toBe(false)
    expect(await verifyLockCode(config, OTHER_SECRET, '2580')).toBe(false)
  })

  it('графический ключ: порядок точек важен', async () => {
    const code = patternToCode([0, 1, 2, 5, 8])
    const config = await createLockConfig(SECRET, 'pattern', code, 'never')
    expect(config.digits).toBeUndefined()
    expect(await verifyLockCode(config, SECRET, code)).toBe(true)
    expect(await verifyLockCode(config, SECRET, patternToCode([8, 5, 2, 1, 0]))).toBe(false)
  })

  it('та же цифровая строка пин-кодом и ключом — разные коды', async () => {
    const pin = await createLockConfig(SECRET, 'pin', '0125', 'min1')
    const asPattern = { ...pin, kind: 'pattern' as const }
    expect(await verifyLockCode(asPattern, SECRET, '0125')).toBe(false)
  })

  it('на диске нет самого кода, соль у каждого кода своя', async () => {
    const a = await createLockConfig(SECRET, 'pin', '135790', 'min1')
    const b = await createLockConfig(SECRET, 'pin', '135790', 'min1')
    writeLockConfig(a)
    expect(localStorage.getItem(APP_LOCK_KEY)).not.toContain('135790')
    expect(a.salt).not.toBe(b.salt)
    expect(a.mac).not.toBe(b.mac)
    expect(readLockConfig()).toEqual(a)
    expect(readLockConfig()?.digits).toBe(6)
  })
})

describe('запись на диске', () => {
  it('битая или чужая запись — замка нет', () => {
    localStorage.setItem(APP_LOCK_KEY, '{oops')
    expect(readLockConfig()).toBeNull()
    localStorage.setItem(
      APP_LOCK_KEY,
      JSON.stringify({ v: 1, kind: 'pin', digits: 5, salt: 'a', mac: 'b', autoLock: 'min1' })
    )
    expect(readLockConfig()).toBeNull()
    localStorage.setItem(
      APP_LOCK_KEY,
      JSON.stringify({ v: 1, kind: 'pattern', salt: 'a', mac: 'b', autoLock: 'soon' })
    )
    expect(readLockConfig()).toBeNull()
  })

  it('clearLockConfig стирает и замок, и счётчик ошибок', async () => {
    writeLockConfig(await createLockConfig(SECRET, 'pin', '1111', 'min1'))
    recordLockFailure()
    clearLockConfig()
    expect(readLockConfig()).toBeNull()
    expect(localStorage.getItem(APP_LOCK_ATTEMPTS_KEY)).toBeNull()
  })

  it('выход из всех аккаунтов стирает замок вместе с сейфом', async () => {
    writeLockConfig(await createLockConfig(SECRET, 'pin', '1111', 'min1'))
    recordLockFailure()
    clearAllUserData()
    expect(localStorage.getItem(APP_LOCK_KEY)).toBeNull()
    expect(localStorage.getItem(APP_LOCK_ATTEMPTS_KEY)).toBeNull()
  })
})

describe('паузы после ошибок', () => {
  it('четыре ошибки без паузы, дальше 30 с, 1, 2 и по 5 минут', () => {
    expect([1, 2, 3, 4].map(pauseAfter)).toEqual([0, 0, 0, 0])
    expect(pauseAfter(5)).toBe(30_000)
    expect(pauseAfter(6)).toBe(60_000)
    expect(pauseAfter(7)).toBe(120_000)
    expect(pauseAfter(8)).toBe(300_000)
    expect(pauseAfter(40)).toBe(300_000)
  })

  it('счётчик копится на диске и переживает перезапуск', () => {
    for (let i = 0; i < 4; i++) recordLockFailure(1_000)
    expect(readLockAttempts()).toEqual({ failures: 4, until: 1_000 })
    expect(recordLockFailure(1_000)).toEqual({ failures: 5, until: 31_000 })
    expect(readLockAttempts()).toEqual({ failures: 5, until: 31_000 })
  })
})
