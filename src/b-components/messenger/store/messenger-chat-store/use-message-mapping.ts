// Построение отображаемого Message из matrix-события: медиа (аудио/фото/
// видео/файл — через media-content), PKOIN-транзакция, расшифровка текста
// (через use-message-decryption) и обогащение реакциями.

import { t } from '@/i18n'

import {
  getEventId,
  getEventContent,
  getEventType,
  getEventRoomId,
  getEventSender,
  getEventTs,
  isRenderableMessageEvent,
  getAddressFromMatrixId,
} from '../../helpers'
import { matrixService } from '../../services/matrix-service'
import { isGroupEncryptedContent } from '../../services/group-encryption'
import type { Message, MessageReaction } from '../../types'
import { ENCRYPTED_MESSAGE_PLACEHOLDER } from '../consts'
import type { ChatContext, MxEvent, MxReactionEvent, MxRoom } from './types'
import type { MessageDecryption } from './use-message-decryption'
import { mapMediaContent, mediaTypeOf, type MediaContent } from './media-content'

export function useMessageMapping(ctx: ChatContext, decryption: MessageDecryption) {
  const { currentUser, profileCache } = ctx
  const { tryDecrypt } = decryption

  /** mxc:// → http через клиент; http и неизвестное — как есть. */
  const resolveMxc = (mxcOrHttp: string): string => {
    if (mxcOrHttp.startsWith('http')) return mxcOrHttp
    const client = matrixService.getClient()
    return (client?.mxcUrlToHttp ? client.mxcUrlToHttp(mxcOrHttp) : null) || mxcOrHttp
  }

  const mapEventToMessage = async (
    event: MxEvent,
    skipDecryption = false
  ): Promise<Message | null> => {
    if (!isRenderableMessageEvent(event)) return null

    const eventId = getEventId(event)
    const content = getEventContent(event)
    let text = content.body || ''
    let type: Message['type'] = 'text'
    let url: string | undefined = undefined
    let info: Record<string, unknown> | undefined = undefined
    let finalContent = content

    // Медиа: url/info/имя из контента; секреты медиа-ключа остаются в info и
    // расшифровываются лениво в use-media-transfer (не как текст сообщения).
    const mediaType = mediaTypeOf(content.msgtype)
    if (mediaType) {
      const media = mapMediaContent(content as MediaContent, mediaType, resolveMxc)
      type = media.type
      url = media.url
      info = media.info
      text = media.text
    }

    // PKOIN-донат — обычное m.text с extra-полем `pocketnet_transaction`:
    // сторонние клиенты видят body, мы — карточку. Только текстовые msgtype.
    if (
      content.pocketnet_transaction &&
      typeof content.pocketnet_transaction === 'object' &&
      (content.msgtype === 'm.text' || content.msgtype === 'm.notice' || !content.msgtype)
    ) {
      type = 'transaction'
      info = { ...(info || {}), transaction: content.pocketnet_transaction }
      text = typeof content.body === 'string' ? content.body : ''
    }

    const isEncryptedType = getEventType(event) === 'm.room.encrypted'
    // У медиа `info.secrets` — обёрнутый ключ файла, а не зашифрованный текст.
    let hasSecrets =
      !mediaType && !!(content.info?.secrets || content.pbody?.secrets || content.secrets)
    const isGroupEncrypted = !mediaType && isGroupEncryptedContent(content)

    // body может быть base64 JSON с секретами
    if (
      !hasSecrets &&
      !isGroupEncrypted &&
      !mediaType &&
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
          let extractedBlock = 0
          try {
            extractedBlock = JSON.parse(decoded).block || 0
          } catch {
            /* ignore */
          }
          if (!content.info) content.info = {}
          content.info.secrets = { keys: content.body, block: content.block || extractedBlock }
          hasSecrets = true
        }
      } catch {
        /* ignore */
      }
    }

    const shouldDecrypt = (isEncryptedType || hasSecrets || isGroupEncrypted) && !skipDecryption

    if (shouldDecrypt) {
      const decrypted = await tryDecrypt(event)
      if (decrypted) {
        try {
          const parsed = JSON.parse(decrypted)
          if (parsed && typeof parsed === 'object') {
            finalContent = parsed
            const parsedMedia = mediaTypeOf(parsed.msgtype)
            if (parsedMedia) {
              const media = mapMediaContent(parsed as MediaContent, parsedMedia, resolveMxc)
              type = media.type
              url = media.url
              info = media.info
              text = media.text
            } else if (parsed.body) {
              text = parsed.body
            } else {
              text = decrypted
            }
          } else {
            text = decrypted
          }
        } catch {
          text = decrypted
        }
      } else {
        // Не расшифровалось (нет ключей / чужой ключ / повреждено). Тело такого
        // события — всегда шифротекст или base64-JSON с секретами, показывать
        // его нельзя: раньше ветка `content.body || placeholder` отдавала в UI
        // сырой hex legacy-формата (аудит P3-2).
        text = ENCRYPTED_MESSAGE_PLACEHOLDER
      }
    } else if ((isEncryptedType || hasSecrets || isGroupEncrypted) && skipDecryption) {
      // Без расшифровки у зашифрованного события нет читаемого текста —
      // короткий hex-шифротекст (<100 символов) в превью тоже не текст.
      text = ENCRYPTED_MESSAGE_PLACEHOLDER
    }

    let textToRender = typeof text === 'string' ? text : String(text || '')
    if (!textToRender.trim() && type === 'text') {
      if (isEncryptedType || content.msgtype === 'm.encrypted') {
        textToRender = ENCRYPTED_MESSAGE_PLACEHOLDER
      } else {
        return null
      }
    }

    const senderId = getEventSender(event)
    let senderName = senderId
    if (senderId === currentUser.value.id || senderId === 'me') {
      senderName = currentUser.value.name || t('appMsg.messenger.you')
    } else {
      const address = getAddressFromMatrixId(senderId)
      if (address) {
        if (profileCache.userProfiles[address]?.name) {
          senderName = profileCache.userProfiles[address].name
        } else {
          profileCache.fetchProfiles([address])
        }
      }
    }

    // Ответ (reply): event_id оригинала из m.relates_to.m.in_reply_to. Для
    // зашифрованных сообщений relation лежит на внешнем (открытом) content.
    const relatesTo = (finalContent as Record<string, unknown> | null)?.['m.relates_to'] as
      | Record<string, unknown>
      | undefined
    const inReplyTo = relatesTo?.['m.in_reply_to'] as Record<string, unknown> | undefined
    const replyToId = typeof inReplyTo?.event_id === 'string' ? inReplyTo.event_id : null

    return {
      id: eventId,
      chatId: getEventRoomId(event),
      senderId,
      senderName,
      text: textToRender,
      type,
      url,
      info,
      rawContent: finalContent,
      timestamp: getEventTs(event),
      read: false,
      status: 'sent',
      ...(replyToId ? { replyTo: { id: replyToId } } : {}),
    }
  }

  // --- Реакции ---

  const getReactionsForEventId = (
    room: MxRoom,
    eventId: string,
    myUserId: string
  ): MessageReaction[] => {
    if (!room?.relations?.getChildEventsForEvent) return []
    const relations = room.relations.getChildEventsForEvent(eventId, 'm.annotation', 'm.reaction')
    if (!relations?.getSortedAnnotationsByKey) return []
    const sorted = relations.getSortedAnnotationsByKey()
    if (!sorted || !Array.isArray(sorted)) return []
    return sorted.map(([key, eventsSet]: [string, Set<MxReactionEvent>]) => {
      const events = Array.from(eventsSet)
      const count = events.length
      const my = events.some((e) => (e.getSender ? e.getSender() : e.sender) === myUserId)
      return { key, count, my }
    })
  }

  const enrichMessagesWithReactions = (room: MxRoom, msgList: Message[], myUserId: string) => {
    if (!room || !myUserId) return
    msgList.forEach((msg) => {
      if (msg.id?.startsWith('$')) {
        msg.reactions = getReactionsForEventId(room, msg.id, myUserId)
        if (msg.reactions?.length === 0) msg.reactions = undefined
      }
    })
  }

  return { mapEventToMessage, getReactionsForEventId, enrichMessagesWithReactions }
}

export type MessageMapping = ReturnType<typeof useMessageMapping>
