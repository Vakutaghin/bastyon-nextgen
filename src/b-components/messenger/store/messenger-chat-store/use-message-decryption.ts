// Расшифровка текстовых событий: groupEncrypted (общий ключ комнаты) и
// pcrypto-секреты (личные/групповые с per-message ключом). Результат кэшируется
// в decryptionCache (в памяти + IndexedDB). См. use-chat-crypto для зависимостей.

import {
  getEventId,
  getEventContent,
  getEventType,
  getEventRoomId,
  getEventSender,
  getEventTs,
  getAddressFromMatrixId,
  getMatrixId,
  parseProfileKeys,
  applyBlockToContent,
  isTetatetchat,
} from '../../helpers'
import { matrixService } from '../../services/matrix-service'
import { decryptTextWithSecret } from '../../services/encryption-service'
import {
  findCommonKeyStateEvent,
  decryptGroupCommonKey,
  isGroupEncryptedContent,
} from '../../services/group-encryption'
import type { ChatContext, MxEvent, MxSecrets } from './types'
import type { ChatCrypto } from './use-chat-crypto'

export function useMessageDecryption(ctx: ChatContext, chatCrypto: ChatCrypto) {
  const { profileCache } = ctx
  const {
    pcryptoService,
    decryptionCache,
    getOrderedMemberIds,
    collectPcryptoUsers,
    getCurrentBlockHeight,
  } = chatCrypto

  const tryDecrypt = async (event: MxEvent): Promise<string | null> => {
    const eventId = getEventId(event)
    if (!pcryptoService.value) return null

    // Кэш: один раз расшифровали — больше не считаем.
    if (eventId && decryptionCache.has(eventId)) {
      return decryptionCache.get(eventId)!
    }

    const content = getEventContent(event)
    const isEncryptedType = getEventType(event) === 'm.room.encrypted'

    // Группа: m.room.message с msgtype 'm.encrypted', body=hex, content.hash
    if (isGroupEncryptedContent(content)) {
      try {
        const room = matrixService.getRoom(getEventRoomId(event))
        if (!room) return null

        const senderId = getEventSender(event)
        const senderLocal = getMatrixId(senderId)
        const stateEvent = findCommonKeyStateEvent(room, senderLocal, content.hash)
        if (!stateEvent) {
          // Без state-события `m.room.encryption` с подходящим state_key
          // расшифровать невозможно — отдаём placeholder, а не сырой hex.
          console.warn(
            `[ChatStore] Group msg ${eventId}: m.room.encryption state event not found for state_key "pcrypto.${senderLocal}.${content.hash}"`
          )
          return null
        }

        const memberIds = getOrderedMemberIds(room, getEventTs(event))
        const users = await collectPcryptoUsers(memberIds)

        if (!users.find((u) => u.id === senderId)) {
          const senderAddr = getAddressFromMatrixId(senderId)
          if (senderAddr) {
            await profileCache.fetchProfiles([senderAddr])
            const p = profileCache.userProfiles[senderAddr]
            if (p?.k) users.push({ id: senderId, keys: parseProfileKeys(p.k), dbId: p.id })
          }
          if (!users.find((u) => u.id === senderId)) return null
        }

        const commonSecret = await decryptGroupCommonKey(pcryptoService.value, stateEvent, users)
        if (!commonSecret) return null

        const decrypted = await decryptTextWithSecret(content.body, commonSecret)
        if (decrypted && eventId) {
          decryptionCache.set(eventId, decrypted)
          decryptionCache.persist(matrixService.getClient()?.getUserId(), eventId, decrypted)
        }
        return decrypted
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : e
        console.error(`[ChatStore] Ошибка дешифрования группового ${eventId}:`, msg)
        return null
      }
    }

    let secrets: MxSecrets | null =
      content.info?.secrets || content.pbody?.secrets || content.secrets || null

    // body может быть base64 JSON с секретами
    if (
      !secrets &&
      content.body &&
      typeof content.body === 'string' &&
      content.body.startsWith('ey')
    ) {
      try {
        const decoded = atob(content.body)
        if (
          decoded.startsWith('{') &&
          (decoded.includes('"encrypted"') ||
            (decoded.includes('"keys"') && decoded.includes('"cipher"')))
        ) {
          if (!content.info) content.info = {}
          content.info.secrets = {
            keys: content.body,
            block: content.block || content.info?.block || JSON.parse(decoded).block || 0,
          }
          secrets = content.info.secrets
        }
      } catch {
        /* ignore */
      }
    }

    if (!isEncryptedType && !secrets) return null

    try {
      const room = matrixService.getRoom(getEventRoomId(event))
      if (!room) return null

      const memberIds = getOrderedMemberIds(room, getEventTs(event))
      const isDirect = isTetatetchat(room)

      if (secrets && !secrets.block && content?.block) secrets.block = content.block

      let effectiveBlock = secrets?.block || content?.block || 0
      if ((!effectiveBlock || effectiveBlock === 0) && isDirect) {
        const currentBlock = await getCurrentBlockHeight()
        if (currentBlock) {
          effectiveBlock = currentBlock
          applyBlockToContent(content, currentBlock)
        }
      }
      if (effectiveBlock) applyBlockToContent(content, effectiveBlock)

      const users = await collectPcryptoUsers(memberIds)

      // Убедиться, что ключи отправителя доступны
      const sender = getEventSender(event)
      if (!users.find((u) => u.id === sender)) {
        const senderAddr = getAddressFromMatrixId(sender)
        if (senderAddr) {
          await profileCache.fetchProfiles([senderAddr])
          if (profileCache.userProfiles[senderAddr]) {
            const p = profileCache.userProfiles[senderAddr]
            users.push({ id: sender, keys: parseProfileKeys(p.k), dbId: p.id })
          }
        }
        if (!users.find((u) => u.id === sender)) return null
      }

      const version =
        content?.version ||
        content?.info?.secrets?.version ||
        content?.info?.secrets?.v ||
        content?.pbody?.secrets?.version ||
        content?.pbody?.secrets?.v ||
        content?.secrets?.version ||
        content?.secrets?.v
      if (version && version > 1) {
        users.sort((a, b) => {
          const dbIdA = a.dbId || 0
          const dbIdB = b.dbId || 0
          return dbIdA !== dbIdB ? dbIdA - dbIdB : a.id.localeCompare(b.id)
        })
      }

      const rawEvent = event.event ? { ...event.event, content } : { ...event, content }

      const decrypted = await pcryptoService.value.decryptEvent(rawEvent, users)
      if (decrypted && eventId) {
        decryptionCache.set(eventId, decrypted)
        decryptionCache.persist(matrixService.getClient()?.getUserId(), eventId, decrypted)
      }
      return decrypted
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : e
      console.error(`[ChatStore] Ошибка дешифрования ${eventId}:`, msg)
      return null
    }
  }

  return { tryDecrypt }
}

export type MessageDecryption = ReturnType<typeof useMessageDecryption>
