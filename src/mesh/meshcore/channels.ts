/**
 * Каналы MeshCore — группы с общим 16-байтным ключом (docs/companion_protocol.md,
 * «Channel Types»):
 * - Public — ключ общеизвестен, всё написанное открыто;
 * - хэштег-канал `#тема` — ключ = первые 16 байт SHA-256 от имени с решёткой:
 *   его знает любой, кто угадал имя, это тоже открытый чат;
 * - приватный — случайный ключ, известный только участникам.
 *
 * Номер слота на радио может смениться (канал удалили и добавили заново),
 * поэтому канал в приложении опознаётся по хэшу ключа.
 */

import { fromHex, toHex, utf8 } from '../bytes'
import { CHANNEL_SECRET_SIZE, PUBLIC_CHANNEL_SECRET } from './constants'

export type ChannelKind = 'public' | 'hashtag' | 'private'

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  // Копия — в ArrayBuffer ровно этой длины (Uint8Array мог быть срезом).
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer)
  return new Uint8Array(digest)
}

/** Ключ хэштег-канала: `#test` → 9cd8fcf22a47333b591d96a2b848b73f. */
export async function hashtagSecret(name: string): Promise<string> {
  const tag = normalizeHashtag(name)
  return toHex((await sha256(utf8(tag))).slice(0, CHANNEL_SECRET_SIZE))
}

/** `Тема`, `#тема ` → `#тема`: решётка в начале, без пробелов по краям. */
export function normalizeHashtag(name: string): string {
  const bare = name.trim().replace(/^#+/, '')
  return `#${bare}`
}

export function randomChannelSecret(): string {
  const bytes = new Uint8Array(CHANNEL_SECRET_SIZE)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

/** Стабильный id канала: первые 8 байт SHA-256 ключа, hex. */
export async function channelId(secretHex: string): Promise<string> {
  return toHex((await sha256(fromHex(secretHex))).slice(0, 8))
}

export async function channelKind(name: string, secretHex: string): Promise<ChannelKind> {
  const secret = secretHex.toLowerCase()
  if (secret === PUBLIC_CHANNEL_SECRET) return 'public'
  if (name.trim().startsWith('#') && secret === (await hashtagSecret(name))) return 'hashtag'
  return 'private'
}
