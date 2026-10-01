// Копии своих событий, которые SDK показывает сразу при отправке (id
// `~<комната>:<txnId>`), а после ответа сервера переименовывает в настоящий
// `$…`. Лента следует за этой сменой: без неё сообщение жило с `~`-id (ни
// ответить, ни удалить), а при повторном открытии чата появлялось второй раз —
// рядом с настоящим событием из истории.

import { getEventId, getEventRoomId } from '../../helpers'
import { matrixService } from '../../services/matrix-service'
import { ENCRYPTED_MESSAGE_PLACEHOLDER } from '../consts'
import type { ChatContext, MxEvent } from './types'
import type { ChatCrypto } from './use-chat-crypto'
import type { MessageMapping } from './use-message-mapping'

/** Id копии события в SDK до ответа сервера. */
export const localEchoId = (roomId: string, txnId: string): string => `~${roomId}:${txnId}`

export function useLocalEcho(ctx: ChatContext, chatCrypto: ChatCrypto, mapping: MessageMapping) {
  const { messages } = ctx
  const { decryptionCache } = chatCrypto

  /** SDK сменил id копии `oldId` на настоящий: событие дошло до сервера. */
  const adoptLocalEcho = async (event: MxEvent, oldId: string | undefined): Promise<void> => {
    const newId = getEventId(event)
    if (!oldId || oldId === newId || !newId.startsWith('$')) return

    // Свой текст лежит в кэше расшифровок под локальным id — переносим под
    // настоящий, чтобы история показывала его без ключа комнаты.
    const text = decryptionCache.get(oldId)
    if (text !== undefined && !decryptionCache.has(newId)) {
      decryptionCache.set(newId, text)
      decryptionCache.persist(matrixService.getClient()?.getUserId(), newId, text)
    }

    const list = messages[getEventRoomId(event)]
    const idx = list ? list.findIndex((m) => m.id === oldId) : -1
    if (!list || idx === -1) return
    // Настоящее событие уже в ленте (синк обогнал ответ на отправку).
    if (list.some((m) => m.id === newId)) {
      list.splice(idx, 1)
      return
    }
    const local = list[idx]!
    local.id = newId
    if (local.status === 'sending') local.status = 'sent'
    if (local.text !== ENCRYPTED_MESSAGE_PLACEHOLDER) return
    const fresh = await mapping.mapEventToMessage(event)
    const at = list.findIndex((m) => m.id === newId)
    if (fresh && at !== -1) list.splice(at, 1, fresh)
  }

  return { adoptLocalEcho }
}

export type LocalEcho = ReturnType<typeof useLocalEcho>
