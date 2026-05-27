// Логика комнат и сообщений мессенджера: загрузка, отправка, пагинация, реакции

import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import CryptoJS from 'crypto-js'

import { useAuthStore } from '@/blockchain'
import { deriveMessengerKeys } from '@/blockchain/core/keys'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRC } from '@/helpers/api/request'
import { PcryptoService, type User as PcryptoUser } from '../services/pcrypto'
import { matrixService } from '../services/matrix-service'
import {
  encryptAudioBlob,
  decryptAudioBlob,
  encryptTextWithSecret,
  decryptTextWithSecret,
} from '../services/encryption-service'
import { encryptBlobWithRandomKey, wrapKeyForRoom } from '../services/media-encrypt'
import { decryptBytesWithSecret, sniffMimeFromBytes } from '../services/media-decrypt'
import {
  loadAllDecryptedForUser,
  saveDecrypted,
  clearDecryptedForUser,
} from '@/db/apis/decrypted-messages-api'
import type { Message, MessageReaction, User } from '../types'

import {
  getEventId,
  getEventContent,
  getEventType,
  getEventRoomId,
  getEventSender,
  getEventTs,
  isRenderableMessageEvent,
  isTetatetchat,
  getAddressFromMatrixId,
  getMatrixId,
  getRoomTimelineEvents,
  extractUrl,
  parseProfileKeys,
  applyBlockToContent,
} from '../helpers'

import {
  MESSAGES_PER_PAGE,
  PCRYPTO_WAIT_TIMEOUT,
  BLOCK_HEIGHT_CACHE_TTL,
  DEFAULT_ENCRYPTION_BLOCK,
  ENCRYPTED_MESSAGE_PLACEHOLDER,
} from './consts'
import { useMessengerUiStore } from './messenger-ui-store'
import { useMessengerProfileCache } from './messenger-profile-cache'

// Лимиты согласованы с bastyon-chat (input/index.js:141, 163): фото — 100 МБ, файлы — 25 МБ.
// Тот же лимит применяется к видео (которые сейчас уходят как m.file).
const IMAGE_SIZE_LIMIT_BYTES = 100 * 1024 * 1024
const FILE_SIZE_LIMIT_BYTES = 25 * 1024 * 1024

/**
 * Декодирует blob как картинку, возвращает её размеры.
 * null — если файл не декодируется.
 */
const extractImageDimensions = (blob: Blob): Promise<{ w: number; h: number } | null> => {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth || img.width
      const h = img.naturalHeight || img.height
      URL.revokeObjectURL(url)
      resolve(w && h ? { w, h } : null)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

/**
 * Извлекает duration (сек) + размеры видео + первый кадр как poster blob (JPEG).
 * Poster НЕ шифруется — отправляется как обычный mxc-картинка через info.thumbnail_url,
 * чтобы клиенты видели превью до расшифровки видео.
 */
const extractVideoMetadata = (
  blob: Blob,
  maxThumbDim = 768
): Promise<{ duration: number; w: number; h: number; posterBlob: Blob | null }> => {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    let done = false
    const finalize = (result: {
      duration: number
      w: number
      h: number
      posterBlob: Blob | null
    }) => {
      if (done) return
      done = true
      URL.revokeObjectURL(url)
      resolve(result)
    }
    video.onerror = () => finalize({ duration: 0, w: 0, h: 0, posterBlob: null })
    video.onloadedmetadata = () => {
      const duration = isFinite(video.duration) ? video.duration : 0
      const w = video.videoWidth || 0
      const h = video.videoHeight || 0
      if (!w || !h) return finalize({ duration, w: 0, h: 0, posterBlob: null })
      // Seek в небольшую позицию, чтобы получить кадр (а не чёрный начальный кадр)
      const seekTo = Math.min(Math.max(0.1, duration * 0.05), 1.5)
      const onSeeked = () => {
        try {
          const scale = Math.min(1, maxThumbDim / Math.max(w, h))
          const tw = Math.max(1, Math.round(w * scale))
          const th = Math.max(1, Math.round(h * scale))
          const canvas = document.createElement('canvas')
          canvas.width = tw
          canvas.height = th
          const ctx = canvas.getContext('2d')
          if (!ctx) return finalize({ duration, w, h, posterBlob: null })
          ctx.drawImage(video, 0, 0, tw, th)
          canvas.toBlob((b) => finalize({ duration, w, h, posterBlob: b }), 'image/jpeg', 0.7)
        } catch (_e) {
          finalize({ duration, w, h, posterBlob: null })
        }
      }
      video.addEventListener('seeked', onSeeked, { once: true })
      try {
        video.currentTime = seekTo
      } catch (_e) {
        finalize({ duration, w, h, posterBlob: null })
      }
    }
    video.src = url
    try {
      video.load()
    } catch {
      /* ignore */
    }
  })
}

/** Matrix ID собеседника по комнате (включая invite) или roomId как fallback. */
const getPartnerMatrixId = (room: any): string | null => {
  if (!room) return null
  const myUserId = matrixService.getClient()?.getUserId()
  let otherMember = room.getJoinedMembers?.().find((m: any) => m.userId !== myUserId)
  if (!otherMember && room.currentState?.getMembers) {
    const allMembers = room.currentState.getMembers()
    otherMember = allMembers.find(
      (m: any) => m.userId !== myUserId && (m.membership === 'join' || m.membership === 'invite')
    )
  }
  return otherMember ? otherMember.userId : room.roomId || null
}

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
  const isLoadingMore = ref(false)

  /**
   * Кэш расшифрованного текста по event_id. События в матрице иммутабельны,
   * так что один раз расшифровали — повторно не дёргаем тяжёлую криптографию
   * (PBKDF2×2 + EAA + secp256k1). Кэшируем только успешные расшифровки —
   * при сбое (например, ещё не приехал state event с общим ключом) на следующем
   * проходе попробуем снова.
   *
   * Параллельно зеркалится в IndexedDB через decrypted-messages-api, чтобы
   * расшифровки переживали перезагрузку приложения. hydrate() поднимает их
   * пачкой в память сразу после инициализации pcrypto.
   */
  const decryptedTextCache = new Map<string, string>()
  let decryptedCacheHydrated = false
  let decryptedCacheHydrating: Promise<void> | null = null

  // --- Вспомогательные методы ---

  const getCurrentBlockHeight = async (): Promise<number | null> => {
    const now = Date.now()
    if (currentBlockHeight.value && now - currentBlockFetchedAt < BLOCK_HEIGHT_CACHE_TTL) {
      return currentBlockHeight.value
    }
    try {
      const response = (await getByPRC({
        method: rpcEndpoints.getNodeInfo,
        parameters: [],
        options: { auth: false },
      })) as any
      const data = response?.data || response
      const height = data?.lastblock?.height
      if (typeof height === 'number' && height > 0) {
        currentBlockHeight.value = height
        currentBlockFetchedAt = now
        return height
      }
    } catch {
      /* ignore */
    }
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
        .filter(
          (m: any) =>
            m.membership === 'join' || m.membership === 'invite' || m.membership === 'leave'
        )
        .map((m: any) => m.userId)
    }

    const history = (
      historyEvents
        .map((ev: any) => {
          const content = getEventContent(ev)
          const membership = content?.membership
          if (membership !== 'join' && membership !== 'invite' && membership !== 'leave')
            return null
          const stateKey =
            typeof ev.getStateKey === 'function'
              ? ev.getStateKey()
              : ev.state_key || ev?.event?.state_key
          const sender = getEventSender(ev)
          const id = membership === 'invite' ? stateKey : sender
          if (!id) return null
          return { time: getEventTs(ev) || 1, membership, id }
        })
        .filter(Boolean) as Array<{ time: number; membership: string; id: string }>
    ).sort((a, b) => a.time - b.time)

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
            dbId:
              address && profileCache.userProfiles[address]
                ? (profileCache.userProfiles[address] as any).id
                : undefined,
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

  // --- Групповая криптография (общий ключ комнаты) ---

  /**
   * Вычисляет usershash для группового чата: md5(<id всех участников кроме меня, отсортировано по dbId>) + suffix.
   * Совместимо с bastyon-chat: usershashVersion=13, version=2.
   */
  const computeGroupUsershash = (users: PcryptoUser[], myMatrixIdLocal: string): string => {
    const sorted = [...users].sort((a, b) => {
      const da = a.dbId || 0
      const db = b.dbId || 0
      if (da !== db) return da - db
      return a.id.localeCompare(b.id)
    })
    const otherIds = sorted
      .map((u) => getMatrixId(u.id))
      .filter((id) => id && id !== myMatrixIdLocal)
    return CryptoJS.MD5(otherIds.join('') + '_v13_2').toString()
  }

  /**
   * Находит state-событие `m.room.encryption` с state_key `pcrypto.<sender>.<hash>`,
   * в котором лежит общий ключ группы (зашифрованный по схеме pcrypto для каждого участника).
   */
  const findCommonKeyStateEvent = (
    room: any,
    senderMatrixIdLocal: string,
    hash: string
  ): any | null => {
    if (!room?.currentState?.getStateEvents) return null
    const stateKey = `pcrypto.${senderMatrixIdLocal}.${hash}`
    const single = room.currentState.getStateEvents('m.room.encryption', stateKey)
    if (single) return single
    const events = room.currentState.getStateEvents('m.room.encryption')
    if (!Array.isArray(events)) return null
    return (
      events.find((e: any) => {
        const sk =
          typeof e.getStateKey === 'function' ? e.getStateKey() : e.event?.state_key || e.state_key
        return sk === stateKey
      }) || null
    )
  }

  /**
   * Расшифровывает state-событие общего ключа группы и возвращает строку-секрет
   * (которой далее AES-CBC-дешифруется тело сообщения).
   */
  const decryptGroupCommonKey = async (
    stateEvent: any,
    users: PcryptoUser[]
  ): Promise<string | null> => {
    if (!pcryptoService.value || !stateEvent) return null
    const raw = stateEvent.event || stateEvent
    const senderId =
      typeof stateEvent.getSender === 'function'
        ? stateEvent.getSender()
        : raw?.sender || raw?.user_id
    const content =
      typeof stateEvent.getContent === 'function' ? stateEvent.getContent() : raw?.content
    if (!content?.keys) return null
    const fakeStateEvent = {
      type: 'm.room.encryption',
      sender: senderId,
      content,
      origin_server_ts: raw?.origin_server_ts || Date.now(),
    }
    try {
      return await pcryptoService.value.decryptEvent(fakeStateEvent, users)
    } catch (e) {
      return null
    }
  }

  /**
   * Признак группового зашифрованного m.room.message (bastyon-chat group protocol).
   *
   * Раньше требовали msgtype === 'm.encrypted', но это ломалось на исторических
   * сообщениях, где старые клиенты могли отправлять без явного msgtype или с другим.
   * Достаточный сигнал: есть content.hash и body выглядит как hex-кодированный
   * AES-CBC ciphertext (только hex-символы, длина кратна 32 — 1 блок = 16 байт = 32 hex).
   */
  const isGroupEncryptedContent = (content: any): boolean => {
    if (!content) return false
    if (typeof content.hash !== 'string' || content.hash.length === 0) return false
    if (typeof content.body !== 'string' || content.body.length === 0) return false
    if (content.body.length % 32 !== 0) return false
    return /^[0-9a-fA-F]+$/.test(content.body)
  }

  // --- Дешифрование ---

  const tryDecrypt = async (event: any): Promise<string | null> => {
    const eventId = getEventId(event)
    if (!pcryptoService.value) return null

    // Кэш: один раз расшифровали — больше не считаем.
    if (eventId && decryptedTextCache.has(eventId)) {
      return decryptedTextCache.get(eventId)!
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
            if (p?.k) users.push({ id: senderId, keys: parseProfileKeys(p.k), dbId: (p as any).id })
          }
          if (!users.find((u) => u.id === senderId)) return null
        }

        const commonSecret = await decryptGroupCommonKey(stateEvent, users)
        if (!commonSecret) return null

        const decrypted = await decryptTextWithSecret(content.body, commonSecret)
        if (decrypted && eventId) {
          decryptedTextCache.set(eventId, decrypted)
          const uid = matrixService.getClient()?.getUserId()
          if (uid) saveDecrypted(uid, eventId, decrypted)
        }
        return decrypted
      } catch (e: any) {
        console.error(`[ChatStore] Ошибка дешифрования группового ${eventId}:`, e.message || e)
        return null
      }
    }

    let secrets: any = content.info?.secrets || content.pbody?.secrets || content.secrets || null

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
            users.push({ id: sender, keys: parseProfileKeys(p.k), dbId: (p as any).id })
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

      const rawEvent = (event as any).event
        ? { ...(event as any).event, content }
        : { ...event, content }

      const decrypted = await pcryptoService.value.decryptEvent(rawEvent, users)
      if (decrypted && eventId) {
        decryptedTextCache.set(eventId, decrypted)
        const uid = matrixService.getClient()?.getUserId()
        if (uid) saveDecrypted(uid, eventId, decrypted)
      }
      return decrypted
    } catch (e: any) {
      console.error(`[ChatStore] Ошибка дешифрования ${eventId}:`, e.message || e)
      return null
    }
  }

  // --- Маппинг событий ---

  const resolveAudioUrl = (content: any): string | undefined => {
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
        } catch (_e) {
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

  const getReactionsForEventId = (
    room: any,
    eventId: string,
    myUserId: string
  ): MessageReaction[] => {
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
      await client.paginateEventTimeline(liveTimeline, {
        backwards: true,
        limit: MESSAGES_PER_PAGE,
      })
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
    if (!chatId || isLoadingMore.value) return
    const room = matrixService.getRoom(chatId)
    if (!room) return

    isLoadingMore.value = true
    try {
      const client = matrixService.getClient()
      const liveTimeline = room.getLiveTimeline()
      const initialCount = liveTimeline.getEvents().length

      await client.paginateEventTimeline(liveTimeline, {
        backwards: true,
        limit: MESSAGES_PER_PAGE,
      })
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
      isLoadingMore.value = false
    }
  }

  // --- Отправка ---

  /**
   * Отправка группового зашифрованного сообщения по протоколу bastyon-chat:
   *   1) usershash = md5(<id участников кроме меня, сортировка по dbId>) + "_v13_2"
   *   2) ищем state-событие m.room.encryption со state_key `pcrypto.<my>.<hash>`;
   *      если есть — расшифровываем общий ключ; нет — генерируем и публикуем своё.
   *   3) AES-CBC шифруем тело общим ключом, отправляем m.room.message
   *      { msgtype: 'm.encrypted', body: hex, hash, block: 10 }.
   */
  const sendGroupMessage = async (chatId: string, room: any, text: string) => {
    await room.loadMembersIfNeeded?.()

    ensurePcryptoInitialized()
    if (!pcryptoService.value && uiStore.isInitInProgress) await waitForPcrypto()
    if (!pcryptoService.value) throw new Error('PcryptoService not initialized')

    const client = matrixService.getClient()
    if (!client) throw new Error('Matrix client not initialized')
    const myMatrixId = client.getUserId()
    if (!myMatrixId) throw new Error('Missing my matrix id')
    const myLocal = getMatrixId(myMatrixId)

    const memberIds = getOrderedMemberIds(room, Date.now())
    const users = await collectPcryptoUsers(memberIds)
    if (!users.find((u) => u.id === myMatrixId)) {
      throw new Error('My pcrypto keys are not available')
    }

    const hash = computeGroupUsershash(users, myLocal)
    const block = 10
    const version = 2

    let commonSecret: string | null = null
    const existing = findCommonKeyStateEvent(room, myLocal, hash)
    if (existing) {
      commonSecret = await decryptGroupCommonKey(existing, users)
    }

    if (!commonSecret) {
      const rand = crypto.getRandomValues(new Uint8Array(32))
      commonSecret = Array.from(rand)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      const encrypted = await pcryptoService.value.encryptKey(commonSecret, users, block, version)
      await matrixService.sendStateEvent(
        chatId,
        'm.room.encryption',
        { version, hash, block: encrypted.block, keys: encrypted.keys },
        `pcrypto.${myLocal}.${hash}`
      )
    }

    const bodyHex = await encryptTextWithSecret(text, commonSecret)
    await matrixService.sendEncryptedTextMessage(chatId, { body: bodyHex, hash, block })
  }

  const sendMessage = async (chatId: string, text: string) => {
    try {
      const room = matrixService.getRoom(chatId)
      // Для тет-а-тет оставляем текущее поведение (отправка m.text).
      // Для групп — протокол общего ключа.
      if (room && !isTetatetchat(room)) {
        await sendGroupMessage(chatId, room, text)
        return
      }
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
          if (!existing.my) {
            existing.count += 1
            existing.my = true
          }
        } else {
          msg.reactions.push({ key, count: 1, my: true })
        }
      }
      await matrixService.sendReaction(chatId, eventId, key)
    } catch (e) {
      console.error('[ChatStore] Ошибка отправки реакции:', e)
    }
  }

  const sendAudio = async (
    chatId: string,
    blob: Blob,
    meta?: { duration?: number; name?: string }
  ) => {
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
        id: tempId,
        chatId,
        senderId: currentUser.value.id,
        senderName: currentUser.value.name,
        text: '',
        type: 'audio',
        url: objectUrl,
        info: {
          mimetype: (blob as any).type || 'audio/webm',
          size: blob.size,
          duration: meta?.duration || 0,
          uploadProgress: 0,
        },
        rawContent: null,
        timestamp: now,
        read: true,
        status: 'sending',
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
      const block = isDirect
        ? DEFAULT_ENCRYPTION_BLOCK
        : (await getCurrentBlockHeight()) || DEFAULT_ENCRYPTION_BLOCK

      const { encryptedBlob, secretStr } = await encryptAudioBlob(blob)
      const version = 2
      const secrets = await pcryptoService.value!.encryptKey(secretStr, users, block, version)

      await matrixService.sendAudio(
        chatId,
        {
          blob: encryptedBlob,
          name: meta?.name || 'voice-message',
          mimetype: (blob as any).type || 'audio/webm',
          duration: meta?.duration || 0,
          size: encryptedBlob.size,
          secrets,
          block,
        },
        onProgress
      )

      // Удаляем оптимистичное сообщение
      const idx = messages[chatId]?.findIndex((m) => m.id === tempId)
      if (typeof idx === 'number' && idx >= 0) messages[chatId].splice(idx, 1)
      try {
        URL.revokeObjectURL(objectUrl)
      } catch {
        /* ignore */
      }
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

      const fakeEvent = {
        sender: message.senderId,
        content: { info: { secrets: message.info.secrets } },
      }
      const decryptedSecretsStr = await pcryptoService.value.decryptEvent(fakeEvent, users)
      if (!decryptedSecretsStr) return null

      return await decryptAudioBlob(blob, decryptedSecretsStr.trim())
    } catch (e) {
      console.error('[ChatStore] Ошибка дешифрования аудио:', e)
      return null
    }
  }

  // --- Медиа: отправка ---

  /** Возвращает Pocketnet-адрес собеседника в личном чате. null — если это не 1-на-1. */
  const getDirectPartnerAddress = (chatId: string): string | null => {
    const room = matrixService.getRoom(chatId)
    if (!room) return null
    if (!isTetatetchat(room)) return null
    const partnerMatrixId = getPartnerMatrixId(room)
    if (!partnerMatrixId) return null
    return getAddressFromMatrixId(partnerMatrixId)
  }

  /** Высота блока для шифрования: для DM — фиксированная, для группы — текущая. */
  const pickRoomBlock = async (room: any): Promise<number> => {
    if (isTetatetchat(room)) return DEFAULT_ENCRYPTION_BLOCK
    const height = await getCurrentBlockHeight()
    return height || DEFAULT_ENCRYPTION_BLOCK
  }

  const sendImage = async (chatId: string, file: File | Blob, meta?: { name?: string }) => {
    try {
      if (file.size > IMAGE_SIZE_LIMIT_BYTES) {
        console.error('[ChatStore] Image too large:', file.size, 'limit:', IMAGE_SIZE_LIMIT_BYTES)
        return
      }
      const client = matrixService.getClient()
      if (!client) throw new Error('Matrix client not initialized')

      ensurePcryptoInitialized()
      if (!pcryptoService.value && uiStore.isInitInProgress) await waitForPcrypto()

      const room = matrixService.getRoom(chatId)
      if (!room) throw new Error('Room not found')
      await room.loadMembersIfNeeded?.()

      const mimetype = (file as any).type || 'image/jpeg'
      const fileName = (file as any).name || meta?.name || 'image'
      const dims = await extractImageDimensions(file)
      const objectUrl = URL.createObjectURL(file)
      const tempId = 'local-' + Math.random().toString(36).slice(2)
      const now = Date.now()

      const tempMessage: Message = {
        id: tempId,
        chatId,
        senderId: currentUser.value.id,
        senderName: currentUser.value.name,
        text: '',
        type: 'image',
        url: objectUrl,
        info: { mimetype, size: file.size, w: dims?.w, h: dims?.h, uploadProgress: 0 },
        rawContent: null,
        timestamp: now,
        read: true,
        status: 'sending',
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

      const memberIds = getOrderedMemberIds(room, now)
      const users = await collectPcryptoUsers(memberIds)
      const block = await pickRoomBlock(room)

      const { encryptedBlob, secretStr } = await encryptBlobWithRandomKey(file)
      const secrets = await wrapKeyForRoom(pcryptoService.value!, secretStr, users, block)

      await matrixService.sendImage(
        chatId,
        {
          blob: encryptedBlob,
          name: fileName,
          mimetype,
          width: dims?.w,
          height: dims?.h,
          size: encryptedBlob.size,
          secrets,
          block,
        },
        onProgress
      )

      const idx = messages[chatId]?.findIndex((m) => m.id === tempId)
      if (typeof idx === 'number' && idx >= 0) messages[chatId].splice(idx, 1)
      try {
        URL.revokeObjectURL(objectUrl)
      } catch {
        /* ignore */
      }
    } catch (e) {
      console.error('[ChatStore] Failed to send image:', e)
      const arr = messages[chatId]
      if (arr) {
        const last = arr[arr.length - 1]
        if (last?.status === 'sending' && last.type === 'image') last.status = 'failed'
      }
    }
  }

  const sendVideo = async (chatId: string, file: File | Blob, meta?: { name?: string }) => {
    try {
      const client = matrixService.getClient()
      if (!client) throw new Error('Matrix client not initialized')

      ensurePcryptoInitialized()
      if (!pcryptoService.value && uiStore.isInitInProgress) await waitForPcrypto()

      const room = matrixService.getRoom(chatId)
      if (!room) throw new Error('Room not found')
      await room.loadMembersIfNeeded?.()

      const mimetype = (file as any).type || 'video/mp4'
      const fileName = (file as any).name || meta?.name || 'video'
      const { duration, w, h, posterBlob } = await extractVideoMetadata(file)
      const objectUrl = URL.createObjectURL(file)
      const posterLocalUrl = posterBlob ? URL.createObjectURL(posterBlob) : null
      const tempId = 'local-' + Math.random().toString(36).slice(2)
      const now = Date.now()

      const tempMessage: Message = {
        id: tempId,
        chatId,
        senderId: currentUser.value.id,
        senderName: currentUser.value.name,
        text: '',
        type: 'video',
        url: objectUrl,
        info: {
          mimetype,
          size: file.size,
          duration: duration ? Math.round(duration * 1000) : undefined,
          w: w || undefined,
          h: h || undefined,
          posterUrl: posterLocalUrl,
          uploadProgress: 0,
        },
        rawContent: null,
        timestamp: now,
        read: true,
        status: 'sending',
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

      const memberIds = getOrderedMemberIds(room, now)
      const users = await collectPcryptoUsers(memberIds)
      const block = await pickRoomBlock(room)

      const [posterMxcUrl, encryptedVideo] = await Promise.all([
        posterBlob
          ? matrixService
              .uploadContent(posterBlob, { name: 'poster.jpg', type: 'image/jpeg' })
              .catch(() => null)
          : Promise.resolve(null),
        encryptBlobWithRandomKey(file),
      ])

      const { encryptedBlob, secretStr } = encryptedVideo
      const secrets = await wrapKeyForRoom(pcryptoService.value!, secretStr, users, block)

      await matrixService.sendVideo(
        chatId,
        {
          blob: encryptedBlob,
          name: fileName,
          mimetype,
          duration,
          width: w || undefined,
          height: h || undefined,
          size: encryptedBlob.size,
          thumbnailUrl: posterMxcUrl || undefined,
          thumbnailMimetype: posterBlob?.type || 'image/jpeg',
          thumbnailSize: posterBlob?.size,
          secrets,
          block,
        },
        onProgress
      )

      const idx = messages[chatId]?.findIndex((m) => m.id === tempId)
      if (typeof idx === 'number' && idx >= 0) messages[chatId].splice(idx, 1)
      try {
        URL.revokeObjectURL(objectUrl)
      } catch {
        /* ignore */
      }
      try {
        if (posterLocalUrl) URL.revokeObjectURL(posterLocalUrl)
      } catch {
        /* ignore */
      }
    } catch (e) {
      console.error('[ChatStore] Failed to send video:', e)
      const arr = messages[chatId]
      if (arr) {
        const last = arr[arr.length - 1]
        if (last?.status === 'sending' && last.type === 'video') last.status = 'failed'
      }
    }
  }

  const sendFile = async (chatId: string, file: File | Blob, meta?: { name?: string }) => {
    try {
      if (file.size > FILE_SIZE_LIMIT_BYTES) {
        console.error('[ChatStore] File too large:', file.size, 'limit:', FILE_SIZE_LIMIT_BYTES)
        return
      }
      const client = matrixService.getClient()
      if (!client) throw new Error('Matrix client not initialized')

      ensurePcryptoInitialized()
      if (!pcryptoService.value && uiStore.isInitInProgress) await waitForPcrypto()

      const room = matrixService.getRoom(chatId)
      if (!room) throw new Error('Room not found')
      await room.loadMembersIfNeeded?.()

      const mimetype = (file as any).type || 'application/octet-stream'
      const fileName = (file as any).name || meta?.name || 'file'
      const tempId = 'local-' + Math.random().toString(36).slice(2)
      const now = Date.now()

      const tempMessage: Message = {
        id: tempId,
        chatId,
        senderId: currentUser.value.id,
        senderName: currentUser.value.name,
        text: '',
        type: 'file',
        url: undefined,
        info: { mimetype, size: file.size, name: fileName, uploadProgress: 0 },
        rawContent: null,
        timestamp: now,
        read: true,
        status: 'sending',
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

      const memberIds = getOrderedMemberIds(room, now)
      const users = await collectPcryptoUsers(memberIds)
      const block = await pickRoomBlock(room)

      const { encryptedBlob, secretStr } = await encryptBlobWithRandomKey(file)
      const secrets = await wrapKeyForRoom(pcryptoService.value!, secretStr, users, block)

      await matrixService.sendFile(
        chatId,
        {
          blob: encryptedBlob,
          name: fileName,
          mimetype,
          size: encryptedBlob.size,
          secrets,
          block,
        },
        onProgress
      )

      const idx = messages[chatId]?.findIndex((m) => m.id === tempId)
      if (typeof idx === 'number' && idx >= 0) messages[chatId].splice(idx, 1)
    } catch (e) {
      console.error('[ChatStore] Failed to send file:', e)
      const arr = messages[chatId]
      if (arr) {
        const last = arr[arr.length - 1]
        if (last?.status === 'sending' && last.type === 'file') last.status = 'failed'
      }
    }
  }

  /**
   * Отправка PKOIN-доната в личный чат:
   *  1) собираем UTXO отправителя, выбираем подходящие;
   *  2) строим/подписываем транзакцию (buildTransferTransaction);
   *  3) шлём через sendrawtransactionwithmessage;
   *  4) пишем в Matrix-комнату событие m.text с extra-полем `pocketnet_transaction`.
   * Работает только в личных чатах. Возвращает txid либо null.
   */
  const sendPkoin = async (
    chatId: string,
    amount: number,
    messageText?: string
  ): Promise<string | null> => {
    if (!authStore.isUserAuthenticated) {
      console.error('[ChatStore] sendPkoin: not authenticated')
      return null
    }
    const fromAddress = authStore.address
    const keyPair = authStore.keyPair
    if (!fromAddress || !keyPair) {
      console.error('[ChatStore] sendPkoin: missing address or keypair')
      return null
    }
    const toAddress = getDirectPartnerAddress(chatId)
    if (!toAddress) {
      console.error('[ChatStore] sendPkoin: partner address unavailable (not a direct chat?)')
      return null
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      console.error('[ChatStore] sendPkoin: invalid amount', amount)
      return null
    }

    try {
      const [
        { getUnspents, filterAvailableUnspents, selectBestUnspents },
        { buildTransferTransaction },
        { sendTransactionWithMessage },
        { DEFAULT_TX_FEE },
      ] = await Promise.all([
        import('@/blockchain/core/transactions/unspents-manager'),
        import('@/blockchain/core/transactions/transaction-builder'),
        import('@/blockchain/core/transactions/transaction-sender'),
        import('@/blockchain/constants/transactions'),
      ])

      const rawUnspents = await getUnspents(fromAddress, 1, 9999999)
      const unspents = filterAvailableUnspents(rawUnspents, false)
      const requiredAmount = amount + DEFAULT_TX_FEE
      const selected = selectBestUnspents(unspents, requiredAmount)
      if (!selected.length) throw new Error('Недостаточно средств для перевода с учётом комиссии')

      const built = await buildTransferTransaction({
        unspents: selected,
        fromAddress,
        sourceAddresses: [fromAddress],
        keyPair,
        outputs: [{ address: toAddress, amount }],
        fee: DEFAULT_TX_FEE,
        message: (messageText || '').trim(),
        feemode: 'exclude',
      })

      const txid = await sendTransactionWithMessage({
        hex: built.hex,
        messageData: built.messageData,
        operationType: 'transaction',
      })

      await matrixService.sendPkoinTransaction(chatId, {
        txid,
        amount,
        fromAddress,
        toAddress,
        message: messageText,
      })

      return txid
    } catch (e) {
      console.error('[ChatStore] sendPkoin failed:', e)
      throw e
    }
  }

  // --- Медиа: получение/расшифровка ---

  /** Кэш расшифрованных blob-URL по eventId — чтобы не дешифровать одно и то же повторно. */
  const decryptedMediaUrls = new Map<string, string>()

  const decryptMediaBlob = async (
    blob: Blob,
    message: Message,
    fallbackMime: string
  ): Promise<Blob | null> => {
    if (!message.info?.secrets) {
      return new Blob([await blob.arrayBuffer()], { type: blob.type || fallbackMime })
    }
    if (!pcryptoService.value) return null

    try {
      const room = matrixService.getRoom(message.chatId)
      if (!room) return null

      const memberIds = getOrderedMemberIds(room, message.timestamp)
      const users = await collectPcryptoUsers(memberIds)

      const fakeEvent = {
        sender: message.senderId,
        content: { info: { secrets: message.info.secrets } },
      }
      const decryptedSecretsStr = await pcryptoService.value.decryptEvent(fakeEvent, users)
      if (!decryptedSecretsStr) {
        console.error('[ChatStore] decryptMediaBlob: decryptEvent returned null')
        return null
      }

      const arrayBuffer = await blob.arrayBuffer()
      const decryptedBytes = await decryptBytesWithSecret(arrayBuffer, decryptedSecretsStr.trim())
      const mime = sniffMimeFromBytes(decryptedBytes) || fallbackMime
      return new Blob([decryptedBytes as unknown as BlobPart], { type: mime })
    } catch (e) {
      console.error('[ChatStore] decryptMediaBlob failed:', e)
      return null
    }
  }

  /**
   * Скачивает и расшифровывает (если нужно) медиа по mxc/http url из message.url.
   * Возвращает blob URL (object URL), пригодный для <img src>/<video src>/download.
   * Кэширует результат в локальной Map по message.id.
   */
  const fetchAndDecryptMedia = async (
    message: Message,
    fallbackMime = 'application/octet-stream'
  ): Promise<string | null> => {
    if (!message.url) return null
    const cached = decryptedMediaUrls.get(message.id)
    if (cached) return cached

    try {
      const httpUrl = message.info?.httpUrl || message.url
      const response = await (
        await import('@/helpers/api/request')
      ).matrixFetch(httpUrl, { mode: 'cors' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const raw = await response.blob()

      const decrypted = await decryptMediaBlob(raw, message, fallbackMime)
      if (!decrypted) return null
      const url = URL.createObjectURL(decrypted)
      decryptedMediaUrls.set(message.id, url)
      return url
    } catch (e) {
      console.error('[ChatStore] fetchAndDecryptMedia failed:', e)
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
      const keys = deriveMessengerKeys(authStore.keyPair.privateKey)
      pcryptoService.value = new PcryptoService(keys, client.getUserId() || '')
      localMessengerKeys.value = keys
      // Fire-and-forget: поднимаем персистентный кэш расшифровок текущего юзера.
      // Пока он подгружается, отдельные tryDecrypt просто посчитают на лету;
      // после hydrate последующие чтения списка диалогов будут мгновенными.
      hydrateDecryptedCache()
    } catch (e) {
      console.error('[ChatStore] Ошибка инициализации Pcrypto:', e)
    }
  }

  /**
   * Однократная загрузка персистентного кэша расшифровок текущего юзера в память.
   * Делается лениво (fire-and-forget) — UI не блокируется.
   */
  const hydrateDecryptedCache = (): Promise<void> => {
    if (decryptedCacheHydrated) return Promise.resolve()
    if (decryptedCacheHydrating) return decryptedCacheHydrating
    const userId = matrixService.getClient()?.getUserId()
    if (!userId) return Promise.resolve()
    decryptedCacheHydrating = (async () => {
      try {
        const rows = await loadAllDecryptedForUser(userId)
        for (const r of rows) {
          if (!decryptedTextCache.has(r.eventId)) decryptedTextCache.set(r.eventId, r.text)
        }
        decryptedCacheHydrated = true
      } catch (e) {
        console.warn('[ChatStore] hydrateDecryptedCache failed:', e)
      } finally {
        decryptedCacheHydrating = null
      }
    })()
    return decryptedCacheHydrating
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
    decryptedTextCache.clear()
    decryptedCacheHydrated = false
    decryptedCacheHydrating = null
    // IDb-кэш расшифровок не трогаем: при повторном логине того же аккаунта он сразу
    // даст ускорение. Очистка для конкретного юзера доступна через clearDecryptedForUser
    // (вызывается, например, при удалении аккаунта).
  }

  /** Полная очистка персистентного кэша расшифровок для текущего юзера. */
  const purgeDecryptedCache = async (): Promise<void> => {
    const userId = matrixService.getClient()?.getUserId()
    decryptedTextCache.clear()
    decryptedCacheHydrated = false
    decryptedCacheHydrating = null
    if (userId) await clearDecryptedForUser(userId)
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
    sendImage,
    sendVideo,
    sendFile,
    sendPkoin,
    getDirectPartnerAddress,
    fetchAndDecryptMedia,
    decryptAudioData,
    mapEventToMessage,
    mapRoomToDialog: undefined as any, // будет заполнен из главного стора
    enrichMessagesWithReactions,
    ensurePcryptoInitialized,
    waitForPcrypto,
    hydrateDecryptedCache,
    purgeDecryptedCache,
    getMatrixAvatarUrl,
    getOrderedMemberIds,
    collectPcryptoUsers,
    getCurrentBlockHeight,
    reset,
  }
})
