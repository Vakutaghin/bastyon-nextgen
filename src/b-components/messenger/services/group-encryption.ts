/**
 * Помощники для групповой шифровки/расшифровки в Matrix-комнатах bastyon-chat:
 *
 * - {@link computeGroupUsershash} — md5 от dbId-отсортированных id участников + suffix.
 *   Совместимо с usershashVersion=13, version=2 из bastyon-chat. Это «ID комплекта
 *   ключей», по которому ищем state-event общего секрета.
 *
 * - {@link findCommonKeyStateEvent} — ищет state-событие `m.room.encryption` с
 *   `state_key = pcrypto.<sender>.<hash>` в currentState комнаты.
 *
 * - {@link decryptGroupCommonKey} — расшифровывает state-событие через pcrypto,
 *   возвращает строку-секрет (которой далее AES-CBC дешифруется тело сообщения).
 *
 * - {@link isGroupEncryptedContent} — heuristic-признак group-encrypted m.room.message:
 *   есть content.hash и body выглядит как hex-AES-CBC ciphertext (длина кратна 32).
 *
 * - {@link collectPcryptoUsers} — собирает PcryptoUser[] по memberIds, подтягивая
 *   профили из profileCache (с lazy fetch) и пробрасывая локальные ключи для «me».
 */

import CryptoJS from 'crypto-js'
import type { PcryptoService, User as PcryptoUser } from './pcrypto'
import type { DecryptableEvent } from './pcrypto'
import { getAddressFromMatrixId, getMatrixId, parseProfileKeys } from '../helpers'
import { matrixService } from './matrix-service'

/**
 * Структурные (duck-typed) представления matrix-объектов, которые приходят из
 * сторов мессенджера. Намеренно НЕ импортируем SDK `Room`/`MatrixEvent` —
 * вызывающий код оперирует собственными узкими типами (`MxRoom`/`MxEvent`),
 * и строгие SDK-типы их бы отвергли. Описываем лишь читаемые поля.
 */
interface StateEventLike {
  getStateKey?: () => string | undefined
  getSender?: () => string | null | undefined
  getContent?: () => Record<string, unknown>
  event?: Record<string, unknown>
}

interface RoomStateLike {
  // Единая широкая сигнатура: SDK-перегрузки getStateEvents(type) / (type, key)
  // и узкие `MxRoomState` сторов сводятся к этому контракту.
  getStateEvents?: (
    type: string,
    stateKey?: string
  ) => StateEventLike | StateEventLike[] | null | undefined
}

interface RoomLike {
  currentState?: RoomStateLike
}

export interface ProfileCacheLike {
  userProfiles: Record<string, { k?: string; id?: number; [k: string]: unknown }>
  fetchProfiles: (addresses: string[]) => Promise<unknown>
}

/**
 * Совместимо с bastyon-chat: usershashVersion=13, version=2.
 * Сортировка по dbId asc; matrixId (вторичный ключ) — для детерминизма при равных dbId.
 * Из участников исключается локальный (myMatrixIdLocal), хэш — md5 от конкатенации
 * localPart matrix-id + суффикс _v13_2.
 */
export function computeGroupUsershash(users: PcryptoUser[], myMatrixIdLocal: string): string {
  const sorted = [...users].sort((a, b) => {
    const da = a.dbId || 0
    const db = b.dbId || 0
    if (da !== db) return da - db
    return a.id.localeCompare(b.id)
  })
  const otherIds = sorted.map((u) => getMatrixId(u.id)).filter((id) => id && id !== myMatrixIdLocal)
  return CryptoJS.MD5(otherIds.join('') + '_v13_2').toString()
}

export function findCommonKeyStateEvent(
  room: RoomLike | null | undefined,
  senderMatrixIdLocal: string,
  hash: string
): StateEventLike | null {
  if (!room?.currentState?.getStateEvents) return null
  const stateKey = `pcrypto.${senderMatrixIdLocal}.${hash}`
  const single = room.currentState.getStateEvents('m.room.encryption', stateKey)
  if (single && !Array.isArray(single)) return single
  const events = room.currentState.getStateEvents('m.room.encryption')
  if (!Array.isArray(events)) return null
  return (
    events.find((e: StateEventLike) => {
      const sk =
        typeof e.getStateKey === 'function' ? e.getStateKey() : (e.event?.state_key as string)
      return sk === stateKey
    }) || null
  )
}

export async function decryptGroupCommonKey(
  pcryptoService: PcryptoService | null,
  stateEvent: StateEventLike | null,
  users: PcryptoUser[]
): Promise<string | null> {
  if (!pcryptoService || !stateEvent) return null
  const raw = stateEvent.event
  const senderId =
    typeof stateEvent.getSender === 'function'
      ? stateEvent.getSender()
      : (raw?.sender as string | undefined)
  const content =
    typeof stateEvent.getContent === 'function'
      ? (stateEvent.getContent() as DecryptableEvent['content'])
      : (raw?.content as DecryptableEvent['content'])
  if (!content?.keys) return null
  const fakeStateEvent: DecryptableEvent = {
    type: 'm.room.encryption',
    sender: senderId ?? undefined,
    content,
  }
  try {
    return await pcryptoService.decryptEvent(fakeStateEvent, users)
  } catch {
    return null
  }
}

/**
 * Раньше требовали msgtype === 'm.encrypted', но это ломалось на исторических
 * сообщениях, где старые клиенты могли отправлять без явного msgtype или с другим.
 * Достаточный сигнал: есть content.hash и body выглядит как hex-кодированный
 * AES-CBC ciphertext (только hex-символы, длина кратна 32 — 1 блок = 16 байт = 32 hex).
 */
export function isGroupEncryptedContent(
  content: { hash?: unknown; body?: unknown } | null | undefined
): boolean {
  if (!content) return false
  if (typeof content.hash !== 'string' || content.hash.length === 0) return false
  if (typeof content.body !== 'string' || content.body.length === 0) return false
  if (content.body.length % 32 !== 0) return false
  return /^[0-9a-fA-F]+$/.test(content.body)
}

export interface CollectPcryptoUsersOptions {
  profileCache: ProfileCacheLike
  /** Локальные ключи мессенджера (deriveMessengerKeys). Используются для «me» как fallback. */
  localMessengerKeys: { private: string; public: string }[] | null
}

/**
 * Собирает PcryptoUser[] для шифрования/дешифрования по участникам комнаты.
 * Подтягивает недостающие профили через profileCache.fetchProfiles.
 * Для «me» приоритет — k из профиля, fallback — локальные ключи.
 */
export async function collectPcryptoUsers(
  memberIds: string[],
  opts: CollectPcryptoUsersOptions
): Promise<PcryptoUser[]> {
  const myMatrixId = matrixService.getClient()?.getUserId()
  const addressesToFetch: string[] = []

  for (const memberId of memberIds) {
    const address = getAddressFromMatrixId(memberId)
    if (address && !opts.profileCache.userProfiles[address]) addressesToFetch.push(address)
  }
  const myAddress = myMatrixId ? getAddressFromMatrixId(myMatrixId) : null
  if (myAddress && !opts.profileCache.userProfiles[myAddress]) addressesToFetch.push(myAddress)

  if (addressesToFetch.length > 0) await opts.profileCache.fetchProfiles(addressesToFetch)

  const users: PcryptoUser[] = []
  for (const memberId of memberIds) {
    const address = getAddressFromMatrixId(memberId)
    const isMe = !!myMatrixId && memberId === myMatrixId

    if (isMe) {
      if (address && opts.profileCache.userProfiles[address]?.k) {
        users.push({
          id: memberId,
          keys: parseProfileKeys(opts.profileCache.userProfiles[address].k as string),
          dbId: opts.profileCache.userProfiles[address].id,
        })
        continue
      }
      if (opts.localMessengerKeys) {
        users.push({
          id: memberId,
          keys: opts.localMessengerKeys.map((k) => k.public),
          dbId:
            address && opts.profileCache.userProfiles[address]
              ? opts.profileCache.userProfiles[address].id
              : undefined,
        })
        continue
      }
    }

    if (address && opts.profileCache.userProfiles[address]?.k) {
      users.push({
        id: memberId,
        keys: parseProfileKeys(opts.profileCache.userProfiles[address].k as string),
        dbId: opts.profileCache.userProfiles[address].id,
      })
    }
  }
  return users
}
