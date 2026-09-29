/**
 * Каналы Meshtastic: ключ (PSK), имя и то, насколько канал открыт.
 *
 * PSK на радио хранится как есть: пустой — без шифрования, один байт —
 * номер варианта общеизвестного ключа по умолчанию, 16 или 32 байта — AES.
 * Раскрытие как в прошивке (src/mesh/Channels.cpp, `getKey`).
 *
 * Без импорта протобуфов: модуль нужен и сторам, и тестам.
 */

import { concat, toHex, utf8 } from '../bytes'
import { presetName } from './constants'

/** Ключ по умолчанию («AQ==»): его знает любой Meshtastic-клиент. */
export const DEFAULT_PSK = Uint8Array.from([
  0xd4, 0xf1, 0xbb, 0x3a, 0x20, 0x29, 0x07, 0x59, 0xf0, 0xbc, 0xff, 0xab, 0xcf, 0x4e, 0x69, 0x01,
])

/**
 * Ключ дополнительного канала: пустой PSK у него значит «как у основного»
 * (Channels.cpp, `getKey`), а не «без шифрования».
 */
export function effectivePsk(
  channel: { role: string; psk: Uint8Array },
  primaryPsk: Uint8Array
): Uint8Array {
  return channel.role === 'secondary' && channel.psk.length === 0 ? primaryPsk : channel.psk
}

/** Настоящий ключ AES канала: пустой — канал не шифруется. */
export function expandPsk(psk: Uint8Array): Uint8Array {
  if (psk.length === 0) return new Uint8Array(0)
  if (psk.length === 1) {
    const index = psk[0]!
    if (index === 0) return new Uint8Array(0)
    const key = DEFAULT_PSK.slice()
    key[key.length - 1] = (key[key.length - 1]! + index - 1) & 0xff
    return key
  }
  // Короткий ключ прошивка дополняет нулями до 16 или 32 байт.
  if (psk.length < 16) return concat(psk, new Uint8Array(16 - psk.length))
  if (psk.length > 16 && psk.length < 32) return concat(psk, new Uint8Array(32 - psk.length))
  return psk.slice(0, 32)
}

function isDefaultDerived(key: Uint8Array): boolean {
  if (key.length !== DEFAULT_PSK.length) return false
  for (let i = 0; i < key.length - 1; i++) if (key[i] !== DEFAULT_PSK[i]) return false
  return true
}

/**
 * Канал открытый, если ключ знают все: шифрования нет или это вариант ключа
 * по умолчанию. Иначе — приватный (ключ знают только те, кому его дали).
 */
export function channelKindOf(psk: Uint8Array): 'public' | 'private' {
  const key = expandPsk(psk)
  return key.length === 0 || isDefaultDerived(key) ? 'public' : 'private'
}

/** Канал без шифрования: прочитать может любой, кто слышит эфир. */
export function isUnencrypted(psk: Uint8Array): boolean {
  return expandPsk(psk).length === 0
}

/**
 * Имя канала, как его показывают приложения: пустое имя основного канала —
 * имя пресета модема («LongFast»).
 */
export function displayChannelName(
  channel: { index: number; name: string; role: string },
  preset: { usePreset: boolean; modemPreset: number } | null
): string {
  if (channel.name) return channel.name
  if (channel.role === 'primary')
    return preset && !preset.usePreset ? 'Custom' : presetName(preset?.modemPreset ?? 0)
  return `#${channel.index}`
}

/**
 * Постоянный id канала для диалога: хэш имени и ключа. Номер слота на радио
 * меняется (канал удалили и добавили заново), а переписка должна остаться.
 */
export async function channelIdOf(name: string, psk: Uint8Array): Promise<string> {
  const data = concat(utf8(name), new Uint8Array([0]), expandPsk(psk))
  const digest = await crypto.subtle.digest('SHA-256', data as BufferSource)
  return toHex(new Uint8Array(digest).slice(0, 8))
}

/** Случайный ключ AES-256 для нового приватного канала. */
export function randomPsk(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32))
}

/** Однобайтный хэш канала в эфире (xor имени и ключа) — для подсказок. */
export function channelHash(name: string, psk: Uint8Array): number {
  let h = 0
  for (const b of utf8(name)) h ^= b
  for (const b of expandPsk(psk)) h ^= b
  return h & 0xff
}
