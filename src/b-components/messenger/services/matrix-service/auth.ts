/**
 * Аутентификация в Matrix: вывод пароля из приватного ключа (двойной SHA256 —
 * единственная CryptoJS-обёртка matrix-service), нормализация адреса и протокол
 * login → (fallback) register. Вынесено из `MatrixService` чистыми функциями,
 * чтобы покрыть тестами без поднятия SDK-клиента (см. CODE_AUDIT.md §1).
 */
import CryptoJS from 'crypto-js'

import type { KeyPair } from '@/blockchain/types/keys'
import { isValidAddress } from '@/blockchain/core/addresses'
import { Buffer } from 'buffer'
import type { MatrixClient as SdkMatrixClient } from 'matrix-js-sdk'

/**
 * Пароль Matrix = SHA256(SHA256(privateKeyHex)). Совпадает с bastyon-chat:
 * сервер хранит хэш, приватный ключ наружу не уходит.
 */
export function deriveMatrixPassword(privateKeyHex: string): string {
  return CryptoJS.SHA256(CryptoJS.SHA256(privateKeyHex)).toString(CryptoJS.enc.Hex)
}

/**
 * Если адрес пришёл как hex-кодированная строка валидного Pocketnet-адреса —
 * декодирует обратно в адрес; иначе возвращает as-is (trimmed).
 */
export function normalizeLoginAddress(address: string): string {
  if (!address) return address
  const trimmed = address.trim()
  const looksHex = /^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0
  if (!looksHex) return trimmed
  try {
    const decoded = Buffer.from(trimmed, 'hex').toString('utf8')
    if (decoded && isValidAddress(decoded)) return decoded
  } catch {
    return trimmed
  }
  return trimmed
}

/** Подмножество ответа login/register, которое читает MatrixService. */
export interface MatrixLoginResponse {
  access_token?: string
  user_id?: string
  device_id?: string
}

export interface MatrixLoginParams {
  /** hex(адрес).toLowerCase() — имя пользователя в Matrix. */
  userHex: string
  /** Готовый пароль (если логин по паролю напрямую). */
  password: string
  /** KeyPair — пароль выведется из приватного ключа, с fallback на register. */
  keyPair: KeyPair | null
  /** SSO/одноразовый токен (приоритетнее keyPair/password). */
  loginToken?: string
}

/**
 * Выполняет вход на `client` (временный SDK-клиент) по одному из способов:
 * m.login.token, либо m.login.password из KeyPair (с авто-register, если юзера
 * ещё нет), либо прямой пароль. Возвращает ответ сервера или undefined.
 */
export async function performMatrixLogin(
  client: SdkMatrixClient,
  params: MatrixLoginParams
): Promise<MatrixLoginResponse | undefined> {
  const { userHex, password, keyPair, loginToken } = params
  let response: MatrixLoginResponse | undefined

  if (loginToken) {
    response = await client.login('m.login.token', {
      token: loginToken,
      user: userHex,
    })
  } else if (keyPair) {
    const privateKeyHex = keyPair.privateKey.toString('hex')
    const passwordHash = deriveMatrixPassword(privateKeyHex)

    const loginParams: {
      user: string
      password: string
      initial_device_display_name: string
    } = {
      user: userHex,
      password: passwordHash,
      initial_device_display_name: 'Bastyon Web',
    }
    try {
      response = await client.login('m.login.password', loginParams)
    } catch {
      response = undefined
    }

    if (!response?.access_token) {
      try {
        const available = await client.isUsernameAvailable(loginParams.user)

        if (available) {
          response = await client.register(loginParams.user, loginParams.password, null, {
            type: 'm.login.dummy',
          })
        }
      } catch {
        response = undefined
      }
    }
  } else if (password) {
    response = await client.login('m.login.password', {
      user: userHex,
      password,
    })
  }

  return response
}
