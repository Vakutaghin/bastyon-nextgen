// Логика комнат и сообщений мессенджера: загрузка, отправка, пагинация, реакции

import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'

import { useAuthStore } from '@/blockchain'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRC } from '@/helpers/api/request'
import { PcryptoService, type User as PcryptoUser } from '../services/pcrypto'
import { matrixService } from '../services/matrix-service'
import { encryptAudioBlob, decryptAudioBlob } from '../services/encryption-service'
import type { Message, MessageReaction, User } from '../types'

import {
  getEventId, getEventContent, getEventType, getEventRoomId,
  getEventSender, getEventTs, isRenderableMessageEvent,
  isTetatetchat, getAddressFromMatrixId,
  getRoomTimelineEvents, extractUrl, parseProfileKeys, applyBlockToContent,
} from '../helpers'

import {
  MESSAGES_PER_PAGE, PCRYPTO_WAIT_TIMEOUT,
  BLOCK_HEIGHT_CACHE_TTL, DEFAULT_ENCRYPTION_BLOCK, ENCRYPTED_MESSAGE_PLACEHOLDER,
} from './consts'
import { useMessengerUiStore } from './messenger-ui-store'
import { useMessengerProfileCache } from './messenger-profile-cache'

export const useMessengerChatStore = defineStore('messenger-chat', () => {
  const authStore = useAuthStore()
  const uiStore = useMessengerUiStore()
  const profileCache = useMessengerProfileCache()

  const messages = reactive<Record<string, Message[]>>({})
  const currentUser = ref<User>({
    id: 'me',
    name: 'Я',
    avatar: 'https://via.placeholder.com/150',
  })

  const pcryptoService = ref<PcryptoService | null>(null)
  const localMessengerKeys = ref<{ private: string; public: string }[] | null>(null)
  const currentBlockHeight = ref<number | null>(null)
  let currentBlockFetchedAt = 0
  let isLoadingMore = false

  // --- Вспомогательные методы ---

  const getCurrentBlockHeight = async (): Promise<number | null> => {
    const now = Date.now()
    if (currentBlockHeight.value && now - currentBlockFetchedAt < BLOCK_HEIGHT_CACHE_TTL) {
      return currentBlockHeight.value
    }
    try {
      const response = await getByPRC({
        method: rpcEndpoints.getNodeInfo,
        parameters: [],
        options: { auth: false },
      }) as any
      const data = response?.data || response
      const height = data?.lastblock?.height
      if (typeof height === 'number' && height > 0) {
        currentBlockHeight.value = height
        currentBlockFetchedAt = now
        return height
      }
    } catch (_e) {}
    return currentBlockHeight.value
  }

  const getMatrixAvatarUrl = (mxcUrl?: string | null, size = 40): string | undefined => {
    if (!mxcUrl) return undefined
    const client = matrixService.getClient()
    if (client?.mxcUrlToHttp) {
      return client.mxcUrlToHttp(mxcUrl, size, size, 'crop')
    }
    try {
      const match = /^mxc:\/\/([^/]+)\/(.+)$/.exec(mxcUrl)
      if (!match) return undefined
      const server = match[1]
      const mediaId = match[2]
      const base = matrixService.getBaseUrl()
      const baseIsLocal = !/^https?:\/\//.test(base) || /localhost|127\.0\.0\.1/.test(base)
      const host = baseIsLocal ? 'https://matrix.pocketnet.app' : base
      return `${host}/_matrix/media/r0/thumbnail/${server}/${mediaId}?width=${size}&height=${size}&method=crop`
    } catch (_e) {
      return undefined
    }
  }

  const getMemberHistoryEvents = (room: any): any[] => {
    if (!room) return []
    const seen = new Map<string, any>()
    const addEvents = (events: any[]) => {
      events.forEach((ev) => {
        const id = getEventId(ev)
        if (!seen.has(id)) seen.set(id, ev)
      })
    }
    if (room.currentState?.getStateEvents) {
      addEvents(room.currentState.getStateEvents('m.room.member') || [])
    }
    if (room.oldState?.getStateEvents) {
      addEvents(room.oldState.getStateEvents('m.room.member') || [])
    }
    return Array.from(seen.values())
  }

  const getOrderedMemberIds = (room: any, time: number | null): string[] => {
    if (!room) return []
    const isDirect = isTetatetchat(room)
    const historyEvents = getMemberHistoryEvents(room)

    if (historyEvents.length === 0) {
      const members = room.currentState?.getMembers ? room.currentState.getMembers() : []
      return members
        .filter((m: any) => m.membership === 'join' || m.membership === 'invite' || m.membership === 'leave')
        .map((m: any) => m.userId)
    }

    const history = (historyEvents
      .map((ev: any) => {
        const content = getEventContent(ev)
        const membership = content?.membership
        if (membership !== 'join' && membership !== 'invite' && membership !== 'leave') return null
        const stateKey = typeof ev.getStateKey === 'function'
          ? ev.getStateKey()
          : (ev.state_key || ev?.event?.state_key)
        const sender = getEventSender(ev)
        const id = membership === 'invite' ? stateKey : sender
        if (!id) return null
        return { time: getEventTs(ev) || 1, membership, id }
      })
      .filter(Boolean) as Array<{ time: number; membership: string; id: string }>)
      .sort((a, b) => a.time - b.time)

    const users = new Map<string, { life: Array<{ start: number; end?: number }> }>()
    history.forEach((h) => {
      if (!users.has(h.id)) users.set(h.id, { life: [] })
      const life = users.get(h.id)!.life
      if (h.membership === 'join' || h.membership === 'invite') {
        life.push({ start: isDirect ? 1 : h.time })
      } else if (h.membership === 'leave' && !isDirect) {
        const last = life[life.length - 1]
        if (last && !last.end) last.end = h.time
      }
    })

    const targetTime = time || 1
    const memberIds: string[] = []
    users.forEach((u, id) => {
      const active = u.life.some((l) => {
        if (!targetTime) return l.start && !l.end
        return l.start < targetTime && (!l.end || l.end > targetTime)
      })
      if (active) memberIds.push(id)
    })
    if (memberIds.length === 0) {
      users.forEach((_u, id) => memberIds.push(id))
    }
    return memberIds
  }

  /**
   * Собирает PcryptoUser[] для шифрования/дешифрования по участникам комнаты.
   * Загружает профили при необходимости.
   */
  const collectPcryptoUsers = async (memberIds: string[]): Promise<PcryptoUser[]> => {
    const myMatrixId = matrixService.getClient()?.getUserId()
    const addressesToFetch: string[] = []

    for (const memberId of memberIds) {
      const address = getAddressFromMatrixId(memberId)
      if (address && !profileCache.userProfiles[address]) addressesToFetch.push(address)
    }
    const myAddress = myMatrixId ? getAddressFromMatrixId(myMatrixId) : null
    if (myAddress && !profileCache.userProfiles[myAddress]) addressesToFetch.push(myAddress)

    if (addressesToFetch.length > 0) await profileCache.fetchProfiles(addressesToFetch)

    const users: PcryptoUser[] = []
    for (const memberId of memberIds) {
      const address = getAddressFromMatrixId(memberId)
      const isMe = !!myMatrixId && memberId === myMatrixId

      if (isMe) {
        if (address && profileCache.userProfiles[address]?.k) {
          users.push({
            id: memberId,
            keys: parseProfileKeys(profileCache.userProfiles[address].k),
            dbId: (profileCache.userProfiles[address] as any).id,
          })
          continue
        }
        if (localMessengerKeys.value) {
          users.push({
            id: memberId,
            keys: localMessengerKeys.value.map((k) => k.public),
            dbId: address && profileCache.userProfiles[address] ? (profileCache.userProfiles[address] as any).id : undefined,
          })
          continue
        }
      }

      if (address && profileCache.userProfiles[address]?.k) {
        users.push({
          id: memberId,
          keys: parseProfileKeys(profileCache.userProfiles[address].k),
          dbId: (profileCache.userProfiles[address] as any).id,
        })
      }
    }
    return users
  }

  // --- Дешифрование ---

  const tryDecrypt = async (event: any): Promise<string | null> => {
    const eventId = getEventId(event)
    if (!pcryptoService.value) return null

    const content = getEventContent(event)
    const isEncryptedType = getEventType(event) === 'm.room.encrypted'

    let secrets: any = content.info?.secrets || content.pbody?.secrets || content.secrets || null

    // body может быть base64 JSON с секретами
    if (!secrets && content.body && typeof content.body === 'string' && content.body.startsWith('ey')) {
      try {
        const decoded = atob(content.body)
        if (decoded.startsWith('{') && (decoded.includes('"encrypted"') || (decoded.includes('"keys"') && decoded.includes('"cipher"')))) {
          if (!content.info) content.info = {}
          content.info.secrets = {
            keys: content.body,
            block: content.block || content.info?.block || (JSON.parse(decoded).block) || 0,
          }
          secrets = content.info.secrets
        }
      } catch (_e) {}
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
            users.push({ id: sender, keys: parseProfileKeys(p.k), dbId: (p as any).id })
          }
        }
        if (!users.find((u) => u.id === sender)) return null
      }

      let version = content?.version || content?.info?.secrets?.version || content?.info?.secrets?.v ||
        content?.pbody?.secrets?.version || content?.pbody?.secrets?.v || content?.secrets?.version || content?.secrets?.v
      if (version && version > 1) {
        users.sort((a, b) => {
          const dbIdA = a.dbId || 0
          const dbIdB = b.dbId || 0
          return dbIdA !== dbIdB ? dbIdA - dbIdB : a.id.localeCompare(b.id)
        })
      }

      const rawEvent = (event as any).event
        ? { ...(event as any).event, content }
        : { ...event, content }

      return await pcryptoService.value.decryptEvent(rawEvent, users)
    } catch (e: any) {
      console.error(`[ChatStore] Ошибка дешифрования ${eventId}:`, e.message || e)
      return null
    }
  }

  // --- Маппинг событий ---

  const resolveAudioUrl = (content: any): string | undefined => {
    const audioUrl = extractUrl(content.url) || extractUrl(content.file?.url) ||
      extractUrl(content.info?.url) || extractUrl(content.info?.file?.url) ||
      (typeof content.body === 'string' && content.body.startsWith('http') ? content.body : null)

    if (typeof audioUrl !== 'string' || !audioUrl.length) return undefined

    if (audioUrl.startsWith('http')) return audioUrl

    const client = matrixService.getClient()
    if (client?.mxcUrlToHttp) return client.mxcUrlToHttp(audioUrl)

    return audioUrl
  }

  const mapEventToMessage = async (event: any, skipDecryption = false): Promise<Message | null> => {
    if (!isRenderableMessageEvent(event)) return null

    const eventId = getEventId(event)
    const content = getEventContent(event)
    let text = content.body || ''
    let type: 'text' | 'audio' | 'image' | 'file' = 'text'
    let url: string | undefined = undefined
    let info: any = undefined
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

    // body может быть base64 JSON с секретами
    if (!hasSecrets && content.msgtype !== 'm.audio' && content.body && typeof content.body === 'string' && content.body.startsWith('ey')) {
      try {
        const decoded = atob(content.body)
        if (decoded.startsWith('{') && (decoded.includes('"encrypted"') || (decoded.includes('"keys"') && decoded.includes('"cipher"')))) {
          let extractedBlock = 0
          try { extractedBlock = JSON.parse(decoded).block || 0 } catch (_e) {}
          if (!content.info) content.info = {}
          content.info.secrets = { keys: content.body, block: content.block || extractedBlock }
          hasSecrets = true
        }
      } catch (_e) {}
    }

    const shouldDecrypt = (isEncryptedType || hasSecrets) && !skipDecryption

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
              if (parsed.file) { if (!info) info = {}; info.file = parsed.file }
              text = parsed.body || ''
            } else if (parsed.body) {
              text = parsed.body
            } else {
              text = decrypted
            }
          } else {
            text = decrypted
          }
        } catch (_e) {
          text = decrypted
        }
      } else {
        text = content.body || ENCRYPTED_MESSAGE_PLACEHOLDER
      }
    } else if ((isEncryptedType || hasSecrets) && skipDecryption) {
      if (content.body && !content.body.includes('***') && content.body.length < 100) {
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
      senderName = currentUser.value.name || 'Вы'
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

  const getReactionsForEventId = (room: any, eventId: string, myUserId: string): MessageReaction[] => {
    if (!room?.relations?.getChildEventsForEvent) return []
    const relations = room.relations.getChildEventsForEvent(eventId, 'm.annotation', 'm.reaction')
    if (!relations?.getSortedAnnotationsByKey) return []
    const sorted = relations.getSortedAnnotationsByKey()
    if (!sorted || !Array.isArray(sorted)) return []
    return sorted.map(([key, eventsSet]: [string, Set<unknown>]) => {
      const events = Array.from(eventsSet as Set<{ getSender?: () => string }>)
      const count = events.length
      const my = events.some((e) => (e.getSender ? e.getSender() : (e as any).sender) === myUserId)
      return { key, count, my }
    })
  }

  const enrichMessagesWithReactions = (room: any, msgList: Message[], myUserId: string) => {
    if (!room || !myUserId) return
    msgList.forEach((msg) => {
      if (msg.id?.startsWith('$')) {
        msg.reactions = getReactionsForEventId(room, msg.id, myUserId)
        if (msg.reactions?.length === 0) msg.reactions = undefined
      }
    })
  }

  // --- Загрузка и пагинация ---

  const paginateRoomHistory = async (room: any) => {
    const client = matrixService.getClient()
    if (!client || !room || typeof room.getLiveTimeline !== 'function') return
    const liveTimeline = room.getLiveTimeline()
    if (liveTimeline.getEvents().length < MESSAGES_PER_PAGE) {
      await client.paginateEventTimeline(liveTimeline, { backwards: true, limit: MESSAGES_PER_PAGE })
    }
  }

  const loadMessages = async (chatId: string) => {
    uiStore.activeChatId = chatId
    uiStore.isMessagesLoading = true
    try {
      ensurePcryptoInitialized()
      if (!pcryptoService.value && uiStore.isInitInProgress) await waitForPcrypto()

      const room = matrixService.getRoom(chatId)
      if (room) {
        await room.loadMembersIfNeeded()
        await paginateRoomHistory(room)
        const timelineEvents = getRoomTimelineEvents(room)
        const mapped = await Promise.all(timelineEvents.map((e: any) => mapEventToMessage(e)))
        const list = mapped.filter((m): m is Message => Boolean(m))
        messages[chatId] = list
        const client = matrixService.getClient()
        if (client) enrichMessagesWithReactions(room, list, client.getUserId() || '')
      }
    } catch (e) {
      console.error('[ChatStore] Ошибка загрузки сообщений:', e)
    } finally {
      uiStore.isMessagesLoading = false
    }
  }

  const loadMoreMessages = async (chatId: string) => {
    if (!chatId || isLoadingMore) return
    const room = matrixService.getRoom(chatId)
    if (!room) return

    isLoadingMore = true
    try {
      const client = matrixService.getClient()
      const liveTimeline = room.getLiveTimeline()
      const initialCount = liveTimeline.getEvents().length

      await client.paginateEventTimeline(liveTimeline, { backwards: true, limit: MESSAGES_PER_PAGE })
      const finalCount = liveTimeline.getEvents().length

      if (finalCount > initialCount) {
        const timelineEvents = getRoomTimelineEvents(room)
        const mapped = await Promise.all(timelineEvents.map((e: any) => mapEventToMessage(e)))
        const list = mapped.filter((m): m is Message => Boolean(m))
        messages[chatId] = list
        if (client) enrichMessagesWithReactions(room, list, client.getUserId() || '')
      }
    } catch (e) {
      console.error('[ChatStore] Ошибка подгрузки истории:', e)
    } finally {
      isLoadingMore = false
    }
  }

  // --- Отправка ---

  const sendMessage = async (chatId: string, text: string) => {
    try {
      await matrixService.sendMessage(chatId, text)
    } catch (e) {
      console.error('[ChatStore] Ошибка отправки сообщения:', e)
    }
  }

  const sendReaction = async (chatId: string, eventId: string, key: string) => {
    try {
      const list = messages[chatId]
      const msg = list?.find((m) => m.id === eventId)
      if (msg) {
        if (!msg.reactions) msg.reactions = []
        const existing = msg.reactions.find((r) => r.key === key)
        if (existing) {
          if (!existing.my) { existing.count += 1; existing.my = true }
        } else {
          msg.reactions.push({ key, count: 1, my: true })
        }
      }
      await matrixService.sendReaction(chatId, eventId, key)
    } catch (e) {
      console.error('[ChatStore] Ошибка отправки реакции:', e)
    }
  }

  const sendAudio = async (chatId: string, blob: Blob, meta?: { duration?: number; name?: string }) => {
    try {
      const client = matrixService.getClient()
      if (!client) throw new Error('Matrix client not initialized')

      ensurePcryptoInitialized()
      if (!pcryptoService.value && uiStore.isInitInProgress) await waitForPcrypto()

      const room = matrixService.getRoom(chatId)
      if (!room) throw new Error('Room not found')
      await room.loadMembersIfNeeded?.()

      // Оптимистичное сообщение
      const objectUrl = URL.createObjectURL(blob)
      const tempId = 'local-' + Math.random().toString(36).slice(2)
      const now = Date.now()
      const tempMessage: Message = {
        id: tempId, chatId,
        senderId: currentUser.value.id,
        senderName: currentUser.value.name,
        text: '', type: 'audio', url: objectUrl,
        info: { mimetype: (blob as any).type || 'audio/webm', size: blob.size, duration: meta?.duration || 0, uploadProgress: 0 },
        rawContent: null, timestamp: now, read: true, status: 'sending',
      }
      if (!messages[chatId]) messages[chatId] = []
      messages[chatId].push(tempMessage)

      const onProgress = (loaded: number, total?: number) => {
        const msg = messages[chatId]?.find((m) => m.id === tempId)
        if (msg?.info) {
          msg.info.uploadProgress = total
            ? Math.min(100, Math.round((loaded / total) * 100))
            : Math.min(100, Math.round((loaded / (msg.info.size || loaded)) * 100))
        }
      }

      // Шифрование
      const memberIds = getOrderedMemberIds(room, now)
      const users = await collectPcryptoUsers(memberIds)

      const isDirect = isTetatetchat(room)
      let block = isDirect ? DEFAULT_ENCRYPTION_BLOCK : ((await getCurrentBlockHeight()) || DEFAULT_ENCRYPTION_BLOCK)

      const { encryptedBlob, secretStr } = await encryptAudioBlob(blob)
      const version = 2
      const secrets = await pcryptoService.value!.encryptKey(secretStr, users, block, version)

      await matrixService.sendAudio(chatId, {
        blob: encryptedBlob, name: meta?.name || 'voice-message',
        mimetype: (blob as any).type || 'audio/webm', duration: meta?.duration || 0,
        size: encryptedBlob.size, secrets, block,
      }, onProgress)

      // Удаляем оптимистичное сообщение
      const idx = messages[chatId]?.findIndex((m) => m.id === tempId)
      if (typeof idx === 'number' && idx >= 0) messages[chatId].splice(idx, 1)
      try { URL.revokeObjectURL(objectUrl) } catch (_e) {}
    } catch (e) {
      console.error('[ChatStore] Ошибка отправки аудио:', e)
      const arr = messages[chatId]
      if (arr) {
        const last = arr[arr.length - 1]
        if (last?.status === 'sending' && last.type === 'audio') last.status = 'failed'
      }
    }
  }

  // --- Дешифрование аудио ---

  const decryptAudioData = async (blob: Blob, message: Message): Promise<Blob | null> => {
    if (!pcryptoService.value || !message.info?.secrets) return null

    try {
      const room = matrixService.getRoom(message.chatId)
      if (!room) return null

      const memberIds = getOrderedMemberIds(room, message.timestamp)
      const users = await collectPcryptoUsers(memberIds)

      const fakeEvent = { sender: message.senderId, content: { info: { secrets: message.info.secrets } } }
      const decryptedSecretsStr = await pcryptoService.value.decryptEvent(fakeEvent, users)
      if (!decryptedSecretsStr) return null

      return await decryptAudioBlob(blob, decryptedSecretsStr.trim())
    } catch (e) {
      console.error('[ChatStore] Ошибка дешифрования аудио:', e)
      return null
    }
  }

  // --- Инициализация шифрования ---

  const ensurePcryptoInitialized = () => {
    if (pcryptoService.value) return
    if (!authStore.isUserAuthenticated || !authStore.keyPair) return
    const client = matrixService.getClient()
    if (!client) return
    try {
      const { deriveMessengerKeys } = require('@/blockchain/core/keys')
      const keys = deriveMessengerKeys(authStore.keyPair.privateKey)
      pcryptoService.value = new PcryptoService(keys, client.getUserId() || '')
      localMessengerKeys.value = keys
    } catch (e) {
      console.error('[ChatStore] Ошибка инициализации Pcrypto:', e)
    }
  }

  const waitForPcrypto = async (timeoutMs = PCRYPTO_WAIT_TIMEOUT) => {
    if (pcryptoService.value) return true
    const startedAt = Date.now()
    while (!pcryptoService.value && Date.now() - startedAt < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    return !!pcryptoService.value
  }

  /** Полный сброс при логауте */
  const reset = () => {
    Object.keys(messages).forEach((key) => delete messages[key])
    currentUser.value = { id: 'me', name: 'Я', avatar: 'https://via.placeholder.com/150' }
    pcryptoService.value = null
    localMessengerKeys.value = null
  }

  return {
    messages,
    currentUser,
    pcryptoService,
    localMessengerKeys,
    loadMessages,
    loadMoreMessages,
    sendMessage,
    sendReaction,
    sendAudio,
    decryptAudioData,
    mapEventToMessage,
    mapRoomToDialog: undefined as any, // будет заполнен из главного стора
    enrichMessagesWithReactions,
    ensurePcryptoInitialized,
    waitForPcrypto,
    getMatrixAvatarUrl,
    getOrderedMemberIds,
    collectPcryptoUsers,
    getCurrentBlockHeight,
    reset,
  }
})
