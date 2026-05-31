// Главный стор мессенджера — координация подсторов и инициализация Matrix
// Всю тяжёлую логику делегирует в messenger-chat-store, messenger-ui-store и messenger-profile-cache

import { defineStore, storeToRefs } from 'pinia'
import { computed, watch } from 'vue'

import { useAuthStore } from '@/blockchain'
import { t } from '@/i18n'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { logger } from '@/services/logger'

import { matrixService } from '../services/matrix-service'
import glassSound from '../sounds/glass.mp3'
import type { Dialog, Message } from '../types'

import {
  getEventType,
  getEventRoomId,
  getEventSender,
  getEventTs,
  isRenderableMessageEvent,
  getAddressFromMatrixId,
  getRoomTimelineEvents,
  isMessageEvent,
  resolveMatrixHost,
} from '../helpers'
import { findExistingRoomByAddress, getPartnerMatrixId } from '../room-helpers'

import { SOUND_MAX_AGE, PROFILE_UPDATE_DEBOUNCE, PCRYPTO_DIALOG_TIMEOUT } from './consts'

const log = logger.scope('[MessengerStore]')
import { useMessengerUiStore } from './messenger-ui-store'
import { useMessengerProfileCache } from './messenger-profile-cache'
import { useMessengerChatStore } from './messenger-chat-store'

export const useMessengerStore = defineStore('messenger', () => {
  const authStore = useAuthStore()
  const uiStore = useMessengerUiStore()
  const profileCache = useMessengerProfileCache()
  const chatStore = useMessengerChatStore()

  // Writable refs из uiStore — нужны для внешних присваиваний
  // (store.isOpen = false, store.isFullScreen = true, store.activeChatId = null).
  const uiRefs = storeToRefs(uiStore)

  // --- Маппинг комнаты в диалог ---

  const mapRoomToDialog = async (room: any): Promise<Dialog> => {
    if (room?.loadMembersIfNeeded) {
      try {
        await room.loadMembersIfNeeded()
      } catch {
        /* ignore */
      }
    }

    const timelineEvents = getRoomTimelineEvents(room)
    const myUserId = matrixService.getClient()?.getUserId()
    const joinedMembers = room.getJoinedMembers()
    const isDirect = joinedMembers.length === 2

    let otherMember = joinedMembers.find((m: any) => m.userId !== myUserId)
    if (!otherMember) {
      otherMember = room.currentState
        .getMembers()
        .find(
          (m: any) =>
            m.userId !== myUserId && (m.membership === 'join' || m.membership === 'invite')
        )
    }

    const roomName = room.name || (otherMember ? otherMember.name : t('appMsg.messenger.chat'))
    const partnerId = isDirect ? (otherMember ? otherMember.userId : room.roomId) : null
    const member = partnerId && room.getMember ? room.getMember(partnerId) : null

    // Резолв аватара: комната → участник → Matrix профиль
    let avatarUrl: string | undefined = undefined
    if (!isDirect && room.getAvatarUrl) {
      avatarUrl = room.getAvatarUrl(matrixService.getBaseUrl(), 40, 40, 'crop')
    }
    if (!avatarUrl && member?.getAvatarUrl)
      avatarUrl = member.getAvatarUrl(matrixService.getBaseUrl(), 40, 40, 'crop')
    if (!avatarUrl && member?.avatarUrl)
      avatarUrl = chatStore.getMatrixAvatarUrl(member.avatarUrl, 40)
    if (!avatarUrl && isDirect && room.getAvatarUrl)
      avatarUrl = room.getAvatarUrl(matrixService.getBaseUrl(), 40, 40, 'crop')
    if (!avatarUrl && otherMember?.getAvatarUrl)
      avatarUrl = otherMember.getAvatarUrl(matrixService.getBaseUrl(), 40, 40, 'crop')
    if (!avatarUrl && otherMember?.avatarUrl)
      avatarUrl = chatStore.getMatrixAvatarUrl(otherMember.avatarUrl, 40)

    let name = roomName
    if (isDirect && member?.name) name = member.name
    let avatar = avatarUrl
    let verified = false

    // Резолв из кэша профилей
    if (partnerId) {
      const address = getAddressFromMatrixId(partnerId)
      if (address) {
        if (!profileCache.userProfiles[address]) profileCache.fetchProfiles([address])
        const p = profileCache.userProfiles[address]
        if (p?.name) name = p.name
        const img = p?.i || (p as any)?.avatar || (p as any)?.image
        if (img) {
          const url = resolveImageUrl(img)
          if (url) avatar = url
        }
        const badges = (p as any)?.badges
        if (Array.isArray(badges))
          verified = badges.includes('verificated') || badges.includes('verified')
        if (!verified) {
          const flags = (p as any)?.flags
          const real = (flags && (flags as any).real) ?? (p as any)?.real
          verified = real === 1 || real === '1' || real === true || real === 'true'
        }
      }
    }

    if (!avatar && partnerId) {
      const client = matrixService.getClient()
      if (client?.getProfileInfo) {
        try {
          const profile = await client.getProfileInfo(partnerId)
          const matrixAvatar = chatStore.getMatrixAvatarUrl(profile?.avatar_url, 40)
          if (matrixAvatar) avatar = matrixAvatar
          if (profile?.displayname && !name) name = profile.displayname
        } catch {
          /* ignore */
        }
      }
    }

    chatStore.ensurePcryptoInitialized()
    if (!chatStore.pcryptoService && uiStore.isInitInProgress)
      await chatStore.waitForPcrypto(PCRYPTO_DIALOG_TIMEOUT)

    let lastMessage: Message | undefined = undefined
    for (let i = timelineEvents.length - 1; i >= 0; i--) {
      if (!isMessageEvent(timelineEvents[i])) continue
      const mapped = await chatStore.mapEventToMessage(timelineEvents[i], false)
      if (mapped) {
        lastMessage = mapped
        break
      }
    }

    const createdAt = timelineEvents.length
      ? Math.min(...timelineEvents.map(getEventTs))
      : undefined

    const unreadCount =
      uiStore.activeChatId === room.roomId
        ? 0
        : room.getUnreadNotificationCount('total') ||
          room.getUnreadNotificationCount('ns.total') ||
          0

    return {
      id: room.roomId,
      partner: { id: partnerId || room.roomId, name, avatar, verified },
      unreadCount,
      lastMessage,
      createdAt,
    }
  }

  // --- Загрузка диалогов ---

  /**
   * Дебаунсированный вызов silent-перезагрузки диалогов.
   * Используется на инкрементальных событиях (Room.timeline) — во время initial sync
   * matrix может реплеить много событий подряд, без дебаунса это даёт квадратичное
   * поведение (loadDialogs зовётся N раз, каждый перекодирует N последних сообщений).
   */
  let scheduleLoadDialogsTimer: ReturnType<typeof setTimeout> | null = null
  const scheduleLoadDialogs = (delayMs = 300) => {
    if (scheduleLoadDialogsTimer) clearTimeout(scheduleLoadDialogsTimer)
    scheduleLoadDialogsTimer = setTimeout(() => {
      scheduleLoadDialogsTimer = null
      loadDialogs(true)
    }, delayMs)
  }

  const loadDialogs = async (silent = false) => {
    if (!silent) uiStore.isLoading = true
    try {
      const rooms = matrixService.getRooms()
      const partnerAddresses = rooms
        .map((room: any) => getPartnerMatrixId(room))
        .map((id: string | null) => (id ? getAddressFromMatrixId(id) : null))
        .filter((a: string | null): a is string => Boolean(a))
      if (partnerAddresses.length > 0)
        await profileCache.fetchProfiles([...new Set(partnerAddresses)] as string[])

      let dialogsList = await Promise.all(rooms.map(mapRoomToDialog))

      // Сохраняем имя/аватар если из Matrix пришло «Empty Room»
      const prevDialogs = uiStore.dialogs
      dialogsList = dialogsList.map((d) => {
        const prev = prevDialogs.find((p) => p.id === d.id)
        if (!prev?.partner) return d
        const n = d.partner?.name?.trim()
        if (
          (!n || n === 'Empty Room' || n === 'Unknown') &&
          (prev.partner.name || prev.partner.avatar)
        ) {
          return {
            ...d,
            partner: {
              ...d.partner,
              name: prev.partner.name || d.partner?.name,
              avatar: prev.partner.avatar ?? d.partner?.avatar,
            },
          }
        }
        return d
      })

      // Сохраняем активный диалог если его ещё нет в списке
      const activeId = uiStore.activeChatId
      if (activeId && !dialogsList.some((d) => d.id === activeId)) {
        const existing = uiStore.dialogs.find((d) => d.id === activeId)
        if (existing) dialogsList = [existing, ...dialogsList]
      }

      uiStore.setDialogs(
        dialogsList.sort((a, b) => {
          const tsA = a.lastMessage?.timestamp ?? a.createdAt ?? 0
          const tsB = b.lastMessage?.timestamp ?? b.createdAt ?? 0
          return tsB - tsA
        })
      )
    } catch (e) {
      log.error('Ошибка загрузки диалогов:', e)
    } finally {
      if (!silent) uiStore.isLoading = false
      if (uiStore.syncState === 'PREPARED' || uiStore.syncState === 'SYNCING')
        uiStore.dialogsLoadedOnce = true
    }
  }

  // --- Синхронизация текущего пользователя ---

  const syncCurrentUser = async () => {
    const client = matrixService.getClient()
    const myMatrixId = client?.getUserId()
    if (myMatrixId) chatStore.currentUser.id = myMatrixId
    const address = authStore.address
    if (!address) return
    await profileCache.fetchProfiles([address])
    const profile = profileCache.userProfiles[address]
    if (profile?.name) chatStore.currentUser.name = profile.name
    if (profile?.i) {
      const avatar = resolveImageUrl(profile.i)
      if (avatar) chatStore.currentUser.avatar = avatar
    }
  }

  // --- Инициализация Matrix ---

  const initMatrix = async () => {
    if (!authStore.isUserAuthenticated || !authStore.address || !authStore.keyPair) return
    if (uiStore.isInitInProgress) return
    uiStore.isInitInProgress = true

    // Был ли клиент уже инициализирован к моменту входа в эту функцию.
    // Если нет — после login синк ещё бежит в фоне, и грузить диалоги сразу нет смысла:
    // во-первых, getRooms() может вернуть пустоту/частично, во-вторых, обработчик 'PREPARED'
    // сам вызовет loadDialogs (см. ниже). Иначе UI «ступенями» обновляется по мере подгрузки.
    const wasClientAlreadyInitialized = !!matrixService.getClient()

    try {
      if (!matrixService.getClient()) {
        uiStore.isLoading = true
        try {
          // Подписка на события
          matrixService.on(
            'Room.timeline',
            async (event: any, room: any, toStartOfTimeline: boolean) => {
              if (toStartOfTimeline) return
              const evType = getEventType(event)
              if (evType === 'm.reaction') {
                const roomId = getEventRoomId(event)
                if (uiStore.activeChatId === roomId) {
                  const client = matrixService.getClient()
                  const list = chatStore.messages[roomId]
                  if (client && list)
                    chatStore.enrichMessagesWithReactions(room, list, client.getUserId() || '')
                }
                return
              }

              try {
                if (isRenderableMessageEvent(event)) {
                  const roomId = getEventRoomId(event)
                  if (chatStore.currentUser.id === 'me') {
                    const client = matrixService.getClient()
                    if (client) chatStore.currentUser.id = client.getUserId() || 'me'
                  }

                  const senderId = getEventSender(event)
                  const isRecent = Date.now() - getEventTs(event) < SOUND_MAX_AGE
                  if (
                    senderId !== chatStore.currentUser.id &&
                    uiStore.activeChatId !== roomId &&
                    isRecent
                  ) {
                    try {
                      new Audio(glassSound).play().catch(() => {})
                    } catch {
                      /* ignore */
                    }
                  }

                  if (uiStore.activeChatId === roomId) {
                    const msg = await chatStore.mapEventToMessage(event)
                    if (!msg) return
                    if (!chatStore.messages[roomId]) chatStore.messages[roomId] = []
                    if (!chatStore.messages[roomId].find((m) => m.id === msg.id))
                      chatStore.messages[roomId].push(msg)
                    const c = matrixService.getClient()
                    if (c)
                      chatStore.enrichMessagesWithReactions(
                        room,
                        chatStore.messages[roomId],
                        c.getUserId() || ''
                      )

                    try {
                      const client = matrixService.getClient()
                      const evId =
                        typeof event.getId === 'function' ? event.getId() : event.event_id
                      if (client && typeof evId === 'string' && evId.startsWith('$')) {
                        if (typeof client.setRoomReadMarkers === 'function')
                          await client.setRoomReadMarkers(room.roomId, evId, event)
                        else if (typeof client.sendReadReceipt === 'function')
                          await client.sendReadReceipt(event)
                      }
                    } catch {
                      /* ignore */
                    }
                  }

                  scheduleLoadDialogs()
                }
              } catch (e) {
                log.error('Ошибка в Room.timeline:', e)
              }
            }
          )

          matrixService.on('sync', (state: string) => {
            uiStore.syncState = state
            if (state === 'ERROR') uiStore.syncError = t('appMsg.messenger.syncError')
            else if (state === 'PREPARED') {
              uiStore.syncError = null
              loadDialogs(true).then(() => {
                uiStore.dialogsLoadedOnce = true
              })
            }
          })

          const success = await matrixService.login(authStore.address, authStore.keyPair)
          if (!success) throw new Error('Matrix login failed')
          await syncCurrentUser()
        } catch (e) {
          log.error('Ошибка инициализации Matrix:', e)
        } finally {
          uiStore.isLoading = false
        }
      }

      await syncCurrentUser()
      chatStore.ensurePcryptoInitialized()
      // Для свежей сессии (client только что создан) — ждём 'PREPARED', он сам поднимет диалоги.
      // Для уже инициализированного клиента (повторное открытие мессенджера) — грузим сразу:
      // sync прошёл ранее, повторного 'PREPARED' не будет.
      if (
        wasClientAlreadyInitialized &&
        uiStore.dialogs.length === 0 &&
        matrixService.getClient()
      ) {
        await loadDialogs()
      }
    } finally {
      uiStore.isInitInProgress = false
    }
  }

  // --- Открытие/переключение ---

  const openChat = async (chatId: string) => {
    uiStore.switchToChat(chatId)
    uiStore.markDialogRead(chatId)

    await chatStore.loadMessages(chatId)

    try {
      const room = matrixService.getRoom(chatId)
      if (room) {
        const events = room.getLiveTimeline().getEvents()
        const lastEvent = [...events].reverse().find((e: any) => e.getId()?.startsWith('$'))
        if (lastEvent) {
          const client = matrixService.getClient()
          if (client?.setRoomReadMarkers)
            await client.setRoomReadMarkers(room.roomId, lastEvent.getId(), lastEvent)
          else await client?.sendReadReceipt(lastEvent)
        }
      }
    } catch {
      /* ignore */
    }
  }

  const toggleMessenger = async () => {
    uiStore.isOpen = !uiStore.isOpen
    if (uiStore.isOpen) {
      const needDialogs = uiStore.dialogs.length === 0
      if (needDialogs) uiStore.isLoading = true
      try {
        const wasClientInitialized = !!matrixService.getClient()
        if (!wasClientInitialized) await initMatrix()
        // Свежий клиент → дальнейшую подгрузку сделает обработчик 'PREPARED' внутри initMatrix.
        if (needDialogs && wasClientInitialized) await loadDialogs()
      } finally {
        if (needDialogs) uiStore.isLoading = false
      }
    }
  }

  const openMessenger = async () => {
    if (!uiStore.isOpen) {
      await toggleMessenger()
      return
    }
    const needDialogs = uiStore.dialogs.length === 0
    if (needDialogs) uiStore.isLoading = true
    try {
      const wasClientInitialized = !!matrixService.getClient()
      if (!wasClientInitialized) await initMatrix()
      if (needDialogs && wasClientInitialized) await loadDialogs()
    } finally {
      if (needDialogs) uiStore.isLoading = false
    }
  }

  const startChatWithAddress = async (address: string): Promise<string | null> => {
    if (!address || !authStore.isUserAuthenticated) return null
    uiStore.lastTargetAddress = address
    try {
      await profileCache.fetchProfiles([address])
    } catch {
      /* ignore */
    }
    await openMessenger()
    await initMatrix()

    const hex = matrixService.addressToHex(address).toLowerCase()
    const host = resolveMatrixHost()
    const partnerId = `@${hex}:${host}`

    let roomId = findExistingRoomByAddress(address)
    if (!roomId) {
      roomId = await matrixService.createDirectRoom(partnerId)
      if (roomId) {
        const profile = profileCache.userProfiles[address]
        const partnerName = profile?.name || address || ''
        const img = (profile as any)?.i || (profile as any)?.avatar
        const partnerAvatar = img ? resolveImageUrl(img) : undefined

        uiStore.prependDialog({
          id: roomId,
          partner: { id: partnerId, name: partnerName, avatar: partnerAvatar, verified: false },
          unreadCount: 0,
          lastMessage: undefined,
          createdAt: Date.now(),
        })
      }
    }
    return roomId || null
  }

  const switchToChatAndLoad = (roomId: string): void => {
    uiStore.switchToChat(roomId)
    uiStore.markDialogRead(roomId)
    Promise.resolve().then(async () => {
      await chatStore.loadMessages(roomId)
      await loadDialogs(true)
      try {
        const room = matrixService.getRoom(roomId)
        if (room) {
          const events = room.getLiveTimeline().getEvents()
          const lastEvent = [...events].reverse().find((e: any) => e.getId()?.startsWith('$'))
          if (lastEvent) {
            const client = matrixService.getClient()
            if (client?.setRoomReadMarkers)
              await client.setRoomReadMarkers(room.roomId, lastEvent.getId(), lastEvent)
            else await client?.sendReadReceipt(lastEvent)
          }
        }
      } catch {
        /* ignore */
      }
    })
  }

  const openInviteWithAddress = async (
    address: string,
    preloadedProfile?: UserProfile | null
  ): Promise<void> => {
    if (!address || !authStore.isUserAuthenticated) return
    if (preloadedProfile?.address === address) profileCache.userProfiles[address] = preloadedProfile
    try {
      await profileCache.fetchProfiles([address])
    } catch {
      /* ignore */
    }
    await openMessenger()
    await initMatrix()
    const existingRoomId = findExistingRoomByAddress(address)
    if (existingRoomId) {
      switchToChatAndLoad(existingRoomId)
      return
    }
    uiStore.showInvite(address)
  }

  const deleteDialog = (chatId: string) => {
    const removedMessages = chatStore.messages[chatId] ? [...chatStore.messages[chatId]] : null
    const wasActive = uiStore.activeChatId === chatId

    if (wasActive) uiStore.setActiveChatId(null)
    const { dialog: removedDialog, index: removedIndex } = uiStore.removeDialog(chatId)
    delete chatStore.messages[chatId]

    matrixService.leaveAndForgetRoom(chatId).catch((e) => {
      log.error('Ошибка удаления, восстанавливаем:', e)
      if (removedDialog) uiStore.restoreDialog(removedDialog, removedIndex)
      if (removedMessages) chatStore.messages[chatId] = removedMessages
      if (wasActive) uiStore.setActiveChatId(chatId)
    })
  }

  const logout = () => {
    matrixService.stop()
    uiStore.reset()
    chatStore.reset()
    profileCache.reset()
  }

  // Обновление диалогов при обновлении профилей
  // Вместо deep watch на весь объект — следим за количеством ключей (новые профили)
  let profileUpdateTimeout: ReturnType<typeof setTimeout> | null = null
  watch(
    () => Object.keys(profileCache.userProfiles).length,
    () => {
      if (profileUpdateTimeout) clearTimeout(profileUpdateTimeout)
      profileUpdateTimeout = setTimeout(() => loadDialogs(true), PROFILE_UPDATE_DEBOUNCE)
    }
  )

  // Computed для обратной совместимости
  const activeMessages = computed(() => {
    if (!uiStore.activeChatId) return []
    return chatStore.messages[uiStore.activeChatId] || []
  })

  return {
    // UI (делегируем в uiStore)
    isOpen: uiRefs.isOpen,
    isFullScreen: uiRefs.isFullScreen,
    activeChatId: uiRefs.activeChatId,
    dialogs: computed(() => uiStore.dialogs),
    messages: chatStore.messages,
    activeMessages,
    // ВАЖНО: та же проблема, что и с pcryptoService — `activeDialog` initial value
    // (нет активного чата) = null. Голый null ломает storeToRefs.
    activeDialog: computed(() => uiStore.activeDialog),
    currentUser: chatStore.currentUser,
    lastTargetAddress: computed(() => uiStore.lastTargetAddress),
    inviteViewActive: computed(() => uiStore.inviteViewActive),
    isSyncStarted: computed(() => uiStore.isSyncStarted),
    isLoading: computed(() => uiStore.isLoading),
    isMessagesLoading: computed(() => uiStore.isMessagesLoading),
    dialogsLoadedOnce: computed(() => uiStore.dialogsLoadedOnce),
    syncState: computed(() => uiStore.syncState),
    syncError: computed(() => uiStore.syncError),
    userProfiles: computed(() => profileCache.userProfiles),
    // ВАЖНО: `pcryptoService` инициализируется как `ref(null)`, поэтому при auto-unwrap
    // через Pinia это даёт `null`. Если выставить значение напрямую (`pcryptoService:
    // chatStore.pcryptoService`), оно попадёт в store как голый `null` — и `storeToRefs`
    // упадёт на `null.effect`. Обёртка `computed` делает поле reactive-ссылкой, безопасной
    // для storeToRefs.
    pcryptoService: computed(() => chatStore.pcryptoService),
    totalUnreadCount: uiStore.totalUnreadCount,

    // Методы
    loadDialogs,
    loadMessages: chatStore.loadMessages,
    loadMoreMessages: chatStore.loadMoreMessages,
    openChat,
    toggleMessenger,
    openMessenger,
    sendMessage: chatStore.sendMessage,
    sendReaction: chatStore.sendReaction,
    sendAudio: chatStore.sendAudio,
    sendImage: chatStore.sendImage,
    sendVideo: chatStore.sendVideo,
    sendFile: chatStore.sendFile,
    sendPkoin: chatStore.sendPkoin,
    getDirectPartnerAddress: chatStore.getDirectPartnerAddress,
    fetchAndDecryptMedia: chatStore.fetchAndDecryptMedia,
    initMatrix,
    deleteDialog,
    logout,
    fetchProfiles: profileCache.fetchProfiles,
    decryptAudioData: chatStore.decryptAudioData,
    startChatWithAddress,
    switchToChatAndLoad,
    openInviteWithAddress,
    clearInviteTarget: uiStore.clearInviteTarget,
  }
})
