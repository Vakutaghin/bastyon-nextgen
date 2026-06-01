// Построение отображаемого Message из matrix-события: разрешение url аудио,
// расшифровка (через use-message-decryption) и обогащение реакциями.

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
  extractUrl,
} from '../../helpers'
import { matrixService } from '../../services/matrix-service'
import { isGroupEncryptedContent } from '../../services/group-encryption'
import type { Message, MessageReaction } from '../../types'
import { ENCRYPTED_MESSAGE_PLACEHOLDER } from '../consts'
import type { ChatContext, MxAudioContent, MxEvent, MxReactionEvent, MxRoom } from './types'
import type { MessageDecryption } from './use-message-decryption'

export function useMessageMapping(ctx: ChatContext, decryption: MessageDecryption) {
  const { currentUser, profileCache } = ctx
  const { tryDecrypt } = decryption

  const resolveAudioUrl = (content: MxAudioContent): string | undefined => {
    const audioUrl =
      extractUrl(content.url) ||
      extractUrl(content.file?.url) ||
      extractUrl(content.info?.url) ||
      extractUrl(content.info?.file?.url) ||
      (typeof content.body === 'string' && content.body.startsWith('http') ? content.body : null)

    if (typeof audioUrl !== 'string' || !audioUrl.length) return undefined

    if (audioUrl.startsWith('http')) return audioUrl

    const client = matrixService.getClient()
    if (client?.mxcUrlToHttp) return client.mxcUrlToHttp(audioUrl)

    return audioUrl
  }

  const mapEventToMessage = async (
    event: MxEvent,
    skipDecryption = false
  ): Promise<Message | null> => {
    if (!isRenderableMessageEvent(event)) return null

    const eventId = getEventId(event)
    const content = getEventContent(event)
    let text = content.body || ''
    let type: 'text' | 'audio' | 'image' | 'file' = 'text'
    let url: string | undefined = undefined
    let info: Record<string, unknown> | undefined = undefined
    let finalContent = content

    if (content.msgtype === 'm.audio') {
      type = 'audio'
      url = resolveAudioUrl(content)
      info = content.info
      if (content.file) {
        if (!info) info = {}
        info.file = content.file
      }
    }

    const isEncryptedType = getEventType(event) === 'm.room.encrypted'
    let hasSecrets = !!(content.info?.secrets || content.pbody?.secrets || content.secrets)
    const isGroupEncrypted = content.msgtype !== 'm.audio' && isGroupEncryptedContent(content)

    // body может быть base64 JSON с секретами
    if (
      !hasSecrets &&
      !isGroupEncrypted &&
      content.msgtype !== 'm.audio' &&
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
            if (parsed.msgtype === 'm.audio') {
              type = 'audio'
              url = resolveAudioUrl(parsed)
              if (parsed.info) info = parsed.info
              if (parsed.file) {
                if (!info) info = {}
                info.file = parsed.file
              }
              text = parsed.body || ''
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
      } else if (isGroupEncrypted) {
        text = ENCRYPTED_MESSAGE_PLACEHOLDER
      } else {
        text = content.body || ENCRYPTED_MESSAGE_PLACEHOLDER
      }
    } else if ((isEncryptedType || hasSecrets || isGroupEncrypted) && skipDecryption) {
      if (
        !isGroupEncrypted &&
        content.body &&
        !content.body.includes('***') &&
        content.body.length < 100
      ) {
        text = content.body
      } else {
        text = ENCRYPTED_MESSAGE_PLACEHOLDER
      }
    }

    let textToRender = typeof text === 'string' ? text : String(text || '')
    if (!textToRender.trim() && type !== 'audio') {
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

  return { resolveAudioUrl, mapEventToMessage, getReactionsForEventId, enrichMessagesWithReactions }
}

export type MessageMapping = ReturnType<typeof useMessageMapping>
