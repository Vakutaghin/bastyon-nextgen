// Крипто-ядро чат-стора: жизненный цикл PcryptoService, ключи мессенджера,
// высота блока, разрешение участников комнаты и кэш расшифровок.
//
// Это нижний слой графа зависимостей модулей чат-стора — он не зависит от
// других use-* модулей, а они зависят от него (см. messenger-chat-store.ts).

import { ref } from 'vue'

import { deriveMessengerKeys } from '@/blockchain/core/keys'
import { rpcEndpoints } from '@/helpers/api/rpc-endpoints'
import { getByPRC } from '@/helpers/api/request'

import { PcryptoService, type User as PcryptoUser } from '../../services/pcrypto'
import { matrixService } from '../../services/matrix-service'
import { createDecryptionCache } from '../../services/decryption-cache'
import { collectPcryptoUsers as collectPcryptoUsersHelper } from '../../services/group-encryption'
import {
  getEventId,
  getEventContent,
  getEventSender,
  getEventTs,
  isTetatetchat,
} from '../../helpers'
import { BLOCK_HEIGHT_CACHE_TTL, DEFAULT_ENCRYPTION_BLOCK, PCRYPTO_WAIT_TIMEOUT } from '../consts'
import type { ChatContext, MxEvent, MxRoom, MxRoomMember } from './types'

export function useChatCrypto(ctx: ChatContext) {
  const { authStore, profileCache } = ctx

  const pcryptoService = ref<PcryptoService | null>(null)
  const localMessengerKeys = ref<{ private: string; public: string }[] | null>(null)
  const currentBlockHeight = ref<number | null>(null)
  let currentBlockFetchedAt = 0

  /**
   * Кэш расшифрованного текста по event_id. События в матрице иммутабельны,
   * так что один раз расшифровали — повторно не дёргаем тяжёлую криптографию
   * (PBKDF2×2 + EAA + secp256k1). Кэшируем только успешные расшифровки —
   * при сбое (например, ещё не приехал state event с общим ключом) на следующем
   * проходе попробуем снова.
   *
   * Параллельно зеркалится в IndexedDB через decrypted-messages-api, чтобы
   * расшифровки переживали перезагрузку приложения. hydrate() поднимает их
   * пачкой в память сразу после инициализации pcrypto. Реализация — в
   * services/decryption-cache.ts.
   */
  const decryptionCache = createDecryptionCache()

  // --- Высота блока ---

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
      })) as { data?: { lastblock?: { height?: number } }; lastblock?: { height?: number } }
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

  /** Высота блока для шифрования: для DM — фиксированная, для группы — текущая. */
  const pickRoomBlock = async (room: MxRoom): Promise<number> => {
    if (isTetatetchat(room)) return DEFAULT_ENCRYPTION_BLOCK
    const height = await getCurrentBlockHeight()
    return height || DEFAULT_ENCRYPTION_BLOCK
  }

  // --- Аватары ---

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
    } catch {
      return undefined
    }
  }

  // --- Участники комнаты ---

  const getMemberHistoryEvents = (room: MxRoom): MxEvent[] => {
    if (!room) return []
    const seen = new Map<string, MxEvent>()
    const addEvents = (events: MxEvent[]) => {
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

  const getOrderedMemberIds = (room: MxRoom, time: number | null): string[] => {
    if (!room) return []
    const isDirect = isTetatetchat(room)
    const historyEvents = getMemberHistoryEvents(room)

    if (historyEvents.length === 0) {
      const members = room.currentState?.getMembers ? room.currentState.getMembers() : []
      return members
        .filter(
          (m: MxRoomMember) =>
            m.membership === 'join' || m.membership === 'invite' || m.membership === 'leave'
        )
        .map((m: MxRoomMember) => m.userId)
    }

    const history = (
      historyEvents
        .map((ev: MxEvent) => {
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
   * Делегирует в group-encryption.ts, передавая текущие profileCache + localMessengerKeys.
   */
  const collectPcryptoUsers = (memberIds: string[]): Promise<PcryptoUser[]> =>
    collectPcryptoUsersHelper(memberIds, {
      profileCache,
      localMessengerKeys: localMessengerKeys.value,
    })

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
      void hydrateDecryptedCache()
    } catch (e) {
      console.error('[ChatStore] Ошибка инициализации Pcrypto:', e)
    }
  }

  /** Однократная загрузка персистентного кэша расшифровок текущего юзера в память. */
  const hydrateDecryptedCache = (): Promise<void> =>
    decryptionCache.hydrate(matrixService.getClient()?.getUserId())

  const waitForPcrypto = async (timeoutMs = PCRYPTO_WAIT_TIMEOUT) => {
    if (pcryptoService.value) return true
    const startedAt = Date.now()
    while (!pcryptoService.value && Date.now() - startedAt < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    return !!pcryptoService.value
  }

  /** Полная очистка персистентного кэша расшифровок для текущего юзера. */
  const purgeDecryptedCache = (): Promise<void> =>
    decryptionCache.purge(matrixService.getClient()?.getUserId())

  /** Сброс крипто-состояния при логауте (messages/currentUser сбрасывает корень стора). */
  const resetCrypto = () => {
    pcryptoService.value = null
    localMessengerKeys.value = null
    decryptionCache.resetInMemory()
  }

  return {
    pcryptoService,
    localMessengerKeys,
    decryptionCache,
    getCurrentBlockHeight,
    pickRoomBlock,
    getMatrixAvatarUrl,
    getOrderedMemberIds,
    collectPcryptoUsers,
    ensurePcryptoInitialized,
    hydrateDecryptedCache,
    waitForPcrypto,
    purgeDecryptedCache,
    resetCrypto,
  }
}

export type ChatCrypto = ReturnType<typeof useChatCrypto>
