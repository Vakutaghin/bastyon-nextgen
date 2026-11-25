// Построение отображаемого Message из matrix-события: медиа (аудио/фото/
// видео/файл — через media-content), PKOIN-транзакция, расшифровка текста
// (через use-message-decryption) и обогащение реакциями.

import { t } from '@/i18n'

import {
  editTargetOf,
  getEventId,
  getEventContent,
  getEventType,
  getEventRoomId,
  getEventSender,
  getEventTs,
  isMessageEvent,
  isRenderableMessageEvent,
  getAddressFromMatrixId,
} from '../../helpers'
import { asEditEvent, editOf } from '../../lib/chat-edits'
import { redactionOf } from '../../lib/chat-history'
import { matrixService } from '../../services/matrix-service'
import { useMeshRoutesStore } from '@/mesh/store/mesh-routes-store'
import { resolveMediaUrl } from '../../services/matrix-service/mxc-resolver'
import { isGroupEncryptedContent } from '../../services/group-encryption'
import type { Message, MessageReaction } from '../../types'
import { ENCRYPTED_MESSAGE_PLACEHOLDER } from '../consts'
import type { ChatContext, MxEvent, MxReactionEvent, MxRoom } from './types'
import type { MessageDecryption } from './use-message-decryption'
import { mapMediaContent, mediaTypeOf, type MediaContent } from './media-content'
import {
  parseFortaTransfer,
  pkoinTransferNote,
  pkoinTransferText,
  type PkoinTransferInfo,
} from '../../lib/pkoin-transfer'

export function useMessageMapping(ctx: ChatContext, decryption: MessageDecryption) {
  const { currentUser, profileCache } = ctx
  const { tryDecrypt } = decryption

  /**
   * mxc:// → http через homeserver; абсолютный http(s) — только с origin
   * homeserver'а или как медиа Matrix через него, остальное → '' (медиа
   * «недоступно»). Иначе любой URL из контента отправителя фетчился при
   * открытии чата и отдавал IP читателя (S34).
   */
  const resolveMxc = (mxcOrHttp: string): string =>
    resolveMediaUrl(matrixService.getClient(), mxcOrHttp)

  const mapEventToMessage = async (
    event: MxEvent,
    skipDecryption = false
  ): Promise<Message | null> => {
    // Удалённое сообщение приходит с пустым содержимым. Раньше оно молча
    // пропадало, и переписка выглядела пустой без объяснений: теперь это
    // отметка «удалено» — кем и когда.
    const deleted = isMessageEvent(event) ? redactionOf(event) : null
    if (deleted) {
      return {
        id: getEventId(event),
        chatId: getEventRoomId(event),
        senderId: getEventSender(event),
        text: '',
        type: 'text',
        rawContent: null,
        timestamp: getEventTs(event),
        read: false,
        status: 'sent',
        deleted,
      }
    }
    // Правка — не отдельное сообщение: её текст показывает исходное.
    if (editTargetOf(event)) return null
    return (await mapEdited(event, skipDecryption)) ?? mapContent(event, skipDecryption)
  }

  /** Ответ: id оригинала. У зашифрованных ссылка лежит на внешнем (открытом) content. */
  const replyIdOf = (content: unknown): string | null => {
    const relatesTo = (content as Record<string, unknown> | null)?.['m.relates_to'] as
      | Record<string, unknown>
      | undefined
    const inReplyTo = relatesTo?.['m.in_reply_to'] as Record<string, unknown> | undefined
    return typeof inReplyTo?.event_id === 'string' ? inReplyTo.event_id : null
  }

  /** Вложение или перевод: у них правка текста ничего не меняет. */
  const isPlainText = (content: Record<string, unknown>): boolean =>
    !mediaTypeOf(content.msgtype) && !content.pocketnet_transaction

  /**
   * Исправленное сообщение: место и время — исходного, текст — последней
   * правки. null — не правили, или правка не расшифровалась: тогда как было.
   */
  const mapEdited = async (event: MxEvent, skipDecryption: boolean): Promise<Message | null> => {
    const edit = editOf(event, getEventRoomId(event))
    const content = getEventContent(event)
    if (!edit || !isPlainText(content)) return null
    const next = await mapContent(edit as unknown as MxEvent, skipDecryption)
    if (!next || next.type !== 'text') return null
    if (next.text === ENCRYPTED_MESSAGE_PLACEHOLDER && !skipDecryption) return null
    const replyToId = replyIdOf(content)
    return {
      ...next,
      id: getEventId(event),
      chatId: getEventRoomId(event),
      timestamp: getEventTs(event),
      editedAt: edit.origin_server_ts,
      replyTo: replyToId ? { id: replyToId } : undefined,
    }
  }

  /**
   * Правка сообщения, которого в ленте комнаты ещё нет, — для строки списка
   * чатов: там нужен последний текст, а не пустота.
   */
  const mapEditPreview = async (event: MxEvent): Promise<Message | null> => {
    const target = editTargetOf(event)
    if (!target) return null
    const edit = asEditEvent(event, getEventRoomId(event))
    const message = await mapContent(edit as unknown as MxEvent, false)
    return message ? { ...message, id: target, editedAt: edit.origin_server_ts } : null
  }

  const mapContent = async (event: MxEvent, skipDecryption: boolean): Promise<Message | null> => {
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

    // Перевод PKOIN — открытое поле `pocketnet_transaction` рядом с телом:
    // зашифрованным (sendPkoinMessage) или, у ранних версий, открытым m.text.
    // Сторонние клиенты видят тело, мы — карточку. Только текстовые msgtype.
    if (
      content.pocketnet_transaction &&
      typeof content.pocketnet_transaction === 'object' &&
      (content.msgtype === 'm.text' ||
        content.msgtype === 'm.notice' ||
        content.msgtype === 'm.encrypted' ||
        !content.msgtype)
    ) {
      type = 'transaction'
      info = { ...(info || {}), transaction: { ...content.pocketnet_transaction } }
      text = typeof content.body === 'string' ? content.body : ''
    }

    const isEncryptedType = getEventType(event) === 'm.room.encrypted'
    // Сообщение из E2E-переписки: превью ссылок для таких не запрашиваем (S33/Р4).
    const encrypted =
      isEncryptedType ||
      content.msgtype === 'm.encrypted' ||
      !!(content.info?.secrets || content.pbody?.secrets || content.secrets) ||
      isGroupEncryptedContent(content)
    // У медиа `info.secrets` — обёрнутый ключ файла, а не зашифрованный текст.
    let hasSecrets =
      !mediaType && !!(content.info?.secrets || content.pbody?.secrets || content.secrets)
    const isGroupEncrypted = !mediaType && isGroupEncryptedContent(content)

    // body может быть base64 JSON с секретами. Только признак: content — объект
    // самого события, и у только что отправленного он ещё не ушёл на сервер.
    // Раньше сюда дописывался `info.secrets`, и каждое личное сообщение уходило
    // с лишней копией шифротекста (расшифровка разбирает body сама).
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
            // Перевод из forta.chat — зашифрованный JSON `{"_transfer":true,…}`:
            // без этой ветки собеседник видел сырой JSON.
            const fortaTransfer = parseFortaTransfer(parsed)
            if (fortaTransfer) {
              type = 'transaction'
              info = { ...(info || {}), transaction: fortaTransfer }
              text = pkoinTransferText(fortaTransfer.amount, fortaTransfer.message)
            } else if (parsedMedia) {
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

    if (type === 'transaction') {
      const tx = info?.transaction as PkoinTransferInfo | undefined
      // Заметка к переводу есть только в зашифрованном теле. Не расшифровалось —
      // в превью хотя бы сумма, а не «зашифровано».
      if (tx && text === ENCRYPTED_MESSAGE_PLACEHOLDER) text = pkoinTransferText(tx.amount)
      else if (tx && !tx.message) tx.message = pkoinTransferNote(String(text || ''))
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
    // Собеседник поделился адресом Reticulum: проверенная запись связки даёт
    // mesh-маршрут к нему (use-mesh-routes).
    const binding = (finalContent as Record<string, unknown> | null)?.bastyonMesh
    if (binding && senderId !== currentUser.value.id && senderId !== 'me') {
      const contact = getAddressFromMatrixId(senderId)
      const name = contact ? profileCache.userProfiles[contact]?.name : undefined
      if (contact) useMeshRoutesStore().learn(binding, 'matrix', { contact, name })
    }
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

    const replyToId = replyIdOf(finalContent)

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
      encrypted,
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

  return {
    mapEventToMessage,
    mapEditPreview,
    getReactionsForEventId,
    enrichMessagesWithReactions,
  }
}

export type MessageMapping = ReturnType<typeof useMessageMapping>
