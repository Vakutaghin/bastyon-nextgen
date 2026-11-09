// Вход в Matrix: пароль из приватного ключа (как у bastyon-chat), адрес из hex,
// порядок способов входа (токен → ключ с авто-регистрацией → пароль) и что
// приватный ключ на сервер не уходит; ошибки сети и сервера на каждом шаге.

import { createHash } from 'node:crypto'
import { Buffer } from 'buffer'
import { describe, it, expect, vi } from 'vitest'
import type { MatrixClient as SdkMatrixClient } from 'matrix-js-sdk'

import type { KeyPair } from '@/blockchain/types/keys'
import { toBase58Check } from '@/blockchain/core/addresses/address-hash-utils'
import { deriveMatrixPassword, normalizeLoginAddress, performMatrixLogin } from './auth'

describe('deriveMatrixPassword', () => {
  it('детерминирован и даёт 64-символьный hex (двойной SHA256)', () => {
    const p = deriveMatrixPassword('abcd1234')
    expect(p).toMatch(/^[0-9a-f]{64}$/)
    expect(deriveMatrixPassword('abcd1234')).toBe(p)
  })

  it('разные приватные ключи → разные пароли', () => {
    expect(deriveMatrixPassword('aa')).not.toBe(deriveMatrixPassword('bb'))
  })

  it('совпадает с bastyon-chat: SHA256 от байтов SHA256(hex-строки ключа)', () => {
    // Сверка с node:crypto, без crypto-js: иначе прежний аккаунт не войдёт.
    const hex = '11'.repeat(32)
    const inner = createHash('sha256').update(hex, 'utf8').digest()
    const expected = createHash('sha256').update(inner).digest('hex')
    expect(deriveMatrixPassword(hex)).toBe(expected)
  })
})

describe('normalizeLoginAddress', () => {
  // Настоящий адрес Pocketnet с верной контрольной суммой (версия 0x37 → «P»).
  const ADDRESS = toBase58Check(Buffer.alloc(20, 0x01), 0x37)
  const ADDRESS_HEX = Buffer.from(ADDRESS, 'utf8').toString('hex')

  it('пустая строка возвращается как есть', () => {
    expect(normalizeLoginAddress('')).toBe('')
  })

  it('обрезает пробелы у не-hex входа (обычный адрес)', () => {
    expect(normalizeLoginAddress('  PEa7Xv9kE2bN1qS  ')).toBe('PEa7Xv9kE2bN1qS')
  })

  it('hex нечётной длины не декодируется — возвращается as-is', () => {
    expect(normalizeLoginAddress('abc')).toBe('abc')
  })

  it('even-hex, декодирующийся в невалидный адрес, возвращается as-is', () => {
    expect(normalizeLoginAddress('deadbeef')).toBe('deadbeef')
  })

  it('hex валидного адреса (любой регистр, с пробелами) — обратно в адрес', () => {
    expect(normalizeLoginAddress(ADDRESS_HEX)).toBe(ADDRESS)
    expect(normalizeLoginAddress(`  ${ADDRESS_HEX.toUpperCase()}\n`)).toBe(ADDRESS)
  })

  it('обычный адрес не трогается', () => {
    expect(normalizeLoginAddress(ADDRESS)).toBe(ADDRESS)
  })
})

describe('performMatrixLogin', () => {
  const USER = '50414c494345'
  const PRIVATE_HEX = '7f'.repeat(32)
  const keyPair = {
    privateKey: Buffer.from(PRIVATE_HEX, 'hex'),
    publicKey: Buffer.alloc(33, 2),
  } as unknown as KeyPair
  const DERIVED = deriveMatrixPassword(PRIVATE_HEX)
  const OK = { access_token: 'tok', user_id: `@${USER}:srv`, device_id: 'DEV' }

  function fakeSdk() {
    return {
      login: vi.fn(async (..._args: unknown[]): Promise<Record<string, unknown>> => OK),
      isUsernameAvailable: vi.fn(async (..._args: unknown[]) => false),
      register: vi.fn(
        async (..._args: unknown[]): Promise<Record<string, unknown>> => ({
          access_token: 'new-tok',
          user_id: `@${USER}:srv`,
          device_id: 'NEW',
        })
      ),
    }
  }
  const asSdk = (c: ReturnType<typeof fakeSdk>) => c as unknown as SdkMatrixClient
  /** Всё, что ушло на сервер, одной строкой — чтобы искать утечки. */
  const wire = (c: ReturnType<typeof fakeSdk>) =>
    JSON.stringify([c.login.mock.calls, c.isUsernameAvailable.mock.calls, c.register.mock.calls])

  it('по одноразовому токену — m.login.token; ключ и пароль при этом не используются', async () => {
    const sdk = fakeSdk()
    const res = await performMatrixLogin(asSdk(sdk), {
      userHex: USER,
      password: 'pw',
      keyPair,
      loginToken: 'sso-token',
    })
    expect(res).toEqual(OK)
    expect(sdk.login).toHaveBeenCalledTimes(1)
    expect(sdk.login).toHaveBeenCalledWith('m.login.token', { token: 'sso-token', user: USER })
    expect(sdk.register).not.toHaveBeenCalled()
  })

  it('по ключу — m.login.password с выведенным паролем; приватный ключ на сервер не уходит', async () => {
    const sdk = fakeSdk()
    const res = await performMatrixLogin(asSdk(sdk), { userHex: USER, password: '', keyPair })

    expect(res).toEqual(OK)
    expect(sdk.login).toHaveBeenCalledWith('m.login.password', {
      user: USER,
      password: DERIVED,
      initial_device_display_name: 'Bastyon Web',
    })
    expect(sdk.isUsernameAvailable).not.toHaveBeenCalled()
    expect(sdk.register).not.toHaveBeenCalled()
    expect(wire(sdk)).not.toContain(PRIVATE_HEX)
  })

  it('первый вход по ключу: логин отклонён, имя свободно — регистрирует тем же паролем', async () => {
    const sdk = fakeSdk()
    sdk.login.mockRejectedValueOnce(new Error('M_FORBIDDEN'))
    sdk.isUsernameAvailable.mockResolvedValueOnce(true)

    const res = await performMatrixLogin(asSdk(sdk), { userHex: USER, password: '', keyPair })

    expect(res).toMatchObject({ access_token: 'new-tok', device_id: 'NEW' })
    expect(sdk.isUsernameAvailable).toHaveBeenCalledWith(USER)
    expect(sdk.register).toHaveBeenCalledWith(USER, DERIVED, null, { type: 'm.login.dummy' })
    expect(wire(sdk)).not.toContain(PRIVATE_HEX)
  })

  it('ответ логина без access_token тоже ведёт к проверке имени и регистрации', async () => {
    const sdk = fakeSdk()
    sdk.login.mockResolvedValueOnce({ user_id: `@${USER}:srv` })
    sdk.isUsernameAvailable.mockResolvedValueOnce(true)

    const res = await performMatrixLogin(asSdk(sdk), { userHex: USER, password: '', keyPair })
    expect(res?.access_token).toBe('new-tok')
  })

  it('логин отклонён, а имя занято (чужой ключ к существующему аккаунту) — без регистрации, undefined', async () => {
    const sdk = fakeSdk()
    sdk.login.mockRejectedValueOnce(new Error('M_FORBIDDEN'))
    sdk.isUsernameAvailable.mockResolvedValueOnce(false)

    await expect(
      performMatrixLogin(asSdk(sdk), { userHex: USER, password: '', keyPair })
    ).resolves.toBeUndefined()
    expect(sdk.register).not.toHaveBeenCalled()
  })

  it('сеть упала на проверке имени или регистрации — undefined, без исключения', async () => {
    const offline = fakeSdk()
    offline.login.mockRejectedValueOnce(new Error('Failed to fetch'))
    offline.isUsernameAvailable.mockRejectedValueOnce(new Error('Failed to fetch'))
    await expect(
      performMatrixLogin(asSdk(offline), { userHex: USER, password: '', keyPair })
    ).resolves.toBeUndefined()
    expect(offline.register).not.toHaveBeenCalled()

    // Имя успели занять между проверкой и регистрацией.
    const raced = fakeSdk()
    raced.login.mockRejectedValueOnce(new Error('M_FORBIDDEN'))
    raced.isUsernameAvailable.mockResolvedValueOnce(true)
    raced.register.mockRejectedValueOnce(new Error('M_USER_IN_USE'))
    await expect(
      performMatrixLogin(asSdk(raced), { userHex: USER, password: '', keyPair })
    ).resolves.toBeUndefined()
  })

  it('по готовому паролю — m.login.password как есть, без регистрации', async () => {
    const sdk = fakeSdk()
    const res = await performMatrixLogin(asSdk(sdk), {
      userHex: USER,
      password: 'plain-pw',
      keyPair: null,
    })
    expect(res).toEqual(OK)
    expect(sdk.login).toHaveBeenCalledWith('m.login.password', { user: USER, password: 'plain-pw' })
    expect(sdk.isUsernameAvailable).not.toHaveBeenCalled()
  })

  it('ошибка входа по токену или паролю доходит до вызывающего (фасад сам вернёт false)', async () => {
    const byToken = fakeSdk()
    byToken.login.mockRejectedValueOnce(new Error('M_UNKNOWN_TOKEN'))
    await expect(
      performMatrixLogin(asSdk(byToken), {
        userHex: USER,
        password: '',
        keyPair: null,
        loginToken: 't',
      })
    ).rejects.toThrow('M_UNKNOWN_TOKEN')

    const byPassword = fakeSdk()
    byPassword.login.mockRejectedValueOnce(new Error('M_FORBIDDEN'))
    await expect(
      performMatrixLogin(asSdk(byPassword), { userHex: USER, password: 'bad', keyPair: null })
    ).rejects.toThrow('M_FORBIDDEN')
    expect(byPassword.register).not.toHaveBeenCalled()
  })

  it('ни токена, ни ключа, ни пароля — на сервер ничего не уходит', async () => {
    const sdk = fakeSdk()
    await expect(
      performMatrixLogin(asSdk(sdk), { userHex: USER, password: '', keyPair: null })
    ).resolves.toBeUndefined()
    expect(sdk.login).not.toHaveBeenCalled()
    expect(sdk.register).not.toHaveBeenCalled()
  })
})
