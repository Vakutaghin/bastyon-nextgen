// Главный стор мессенджера — координация подсторов и инициализация Matrix
// Всю тяжёлую логику делегирует в messenger-chat-store, messenger-ui-store и messenger-profile-cache

import type { MatrixEvent } from 'matrix-js-sdk'
import { defineStore, storeToRefs } from 'pinia'
import { computed, watch } from 'vue'

import { useAuthStore } from '@/blockchain'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { logger } from '@/services/logger'

import { matrixService } from '../services/matrix-service'

import { getAddressFromMatrixId, resolveMatrixHost } from '../helpers'
import { findExistingRoomByAddress, getPartnerMatrixId } from '../room-helpers'

import { PROFILE_UPDATE_DEBOUNCE } from './consts'

const log = logger.scope('[MessengerStore]')
import { useMessengerUiStore } from './messenger-ui-store'
import { useMessengerProfileCache } from './messenger-profile-cache'
import { useMessengerChatStore } from './messenger-chat-store'
import type { MessengerStoreContext } from './messenger-store/types'
import { useDialogMapping } from './messenger-store/use-dialog-mapping'
import { registerMatrixListeners } from './messenger-store/use-matrix-listeners'

export const useMessengerStore = defineStore('messenger', () => {
  const authStore = useAuthStore()
  const uiStore = useMessengerUiStore()
  const profileCache = useMessengerProfileCache()
  const chatStore = useMessengerChatStore()

  // Writable refs из uiStore — нужны для внешних присваиваний
  // (store.isOpen = false, store.isFullScreen = true, store.activeChatId = null).
  const uiRefs = storeToRefs(uiStore)

  // Маппинг комнаты в диалог и подписки на Matrix — в messenger-store/*.
  const ctx: MessengerStoreContext = { uiStore, chatStore, profileCache }
  const { mapRoomToDialog } = useDialogMapping(ctx)

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
        .map((room) => getPartnerMatrixId(room))
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
          // Подписка на события (Room.timeline / sync) — до login, matrixService
          // копит подписки до создания клиента.
          registerMatrixListeners(ctx, { loadDialogs, scheduleLoadDialogs })

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
        const lastEvent = [...events].reverse().find((e: MatrixEvent) => e.getId()?.startsWith('$'))
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
        const imgCandidate = profile?.i || profile?.avatar
        const img = typeof imgCandidate === 'string' ? imgCandidate : undefined
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
          const lastEvent = [...events]
            .reverse()
            .find((e: MatrixEvent) => e.getId()?.startsWith('$'))
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

  /**
   * @param opts.purge — стереть с диска sync-state и кэш расшифровок текущего
   *   юзера (signOut / удаление аккаунта, V15/Р6). При смене аккаунта — false:
   *   кэши per-user и пригодятся при возврате.
   */
  const logout = (opts: { purge?: boolean } = {}) => {
    // auth-store к этому моменту уже обнулил address — берём id из matrix-клиента.
    const userId = matrixService.getClient()?.getUserId() || undefined
    matrixService.stop()
    uiStore.reset()
    chatStore.reset()
    profileCache.reset()
    if (opts.purge && userId) {
      matrixService.purgeLocalData({ userId }).catch((e: unknown) => {
        console.warn('[MessengerStore] purgeLocalData failed:', e)
      })
    }
  }

  /** Стереть локальные данные мессенджера удалённого (не текущего) аккаунта. */
  const purgeAccountData = (address: string): Promise<void> =>
    matrixService.purgeLocalData({ address })

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
    // Та же ловушка, что с pcryptoService/activeDialog: `uiStore.totalUnreadCount`
    // авто-разворачивается Pinia в голое число, и storeToRefs(messengerStore) не
    // может сделать из него ref → в хедере totalUnreadCount === undefined и computed
    // unreadBadge падает при появлении иконки мессенджера после входа.
    totalUnreadCount: computed(() => uiStore.totalUnreadCount),

    // Методы
    loadDialogs,
    loadMessages: chatStore.loadMessages,
    loadMoreMessages: chatStore.loadMoreMessages,
    openChat,
    toggleMessenger,
    openMessenger,
    sendMessage: chatStore.sendMessage,
    replyToMessage: chatStore.replyToMessage,
    deleteMessage: chatStore.deleteMessage,
    sendReaction: chatStore.sendReaction,
    sendAudio: chatStore.sendAudio,
    sendImage: chatStore.sendImage,
    sendVideo: chatStore.sendVideo,
    sendFile: chatStore.sendFile,
    sendPkoin: chatStore.sendPkoin,
    sendPkoinMessage: chatStore.sendPkoinMessage,
    getDirectPartnerAddress: chatStore.getDirectPartnerAddress,
    fetchAndDecryptMedia: chatStore.fetchAndDecryptMedia,
    initMatrix,
    deleteDialog,
    logout,
    purgeAccountData,
    fetchProfiles: profileCache.fetchProfiles,
    decryptAudioData: chatStore.decryptAudioData,
    startChatWithAddress,
    switchToChatAndLoad,
    openInviteWithAddress,
    clearInviteTarget: uiStore.clearInviteTarget,
  }
})
