// Главный стор мессенджера — координация подсторов и инициализация Matrix
// Всю тяжёлую логику делегирует в messenger-chat-store, messenger-ui-store и messenger-profile-cache

import type { MatrixEvent } from 'matrix-js-sdk'
import { defineStore, storeToRefs } from 'pinia'
import { computed, onScopeDispose, watch } from 'vue'

import { useAuthStore } from '@/blockchain'
import type { UserProfile } from '@/types/rpc-responses/user-get'
import type { Dialog } from '../types'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { logger } from '@/services/logger'
import { t } from '@/i18n'

import { matrixService } from '../services/matrix-service'
import { isMeshDialogId } from '@/mesh/ids'
import { useMeshChatStore } from '@/mesh/store/mesh-chat-store'
import { useMeshConnectionStore } from '@/mesh/store/mesh-connection-store'
import { useMeshtasticConnectionStore } from '@/mesh/store/meshtastic-connection-store'
import { useReticulumStore } from '@/mesh/store/reticulum-store'
import { useMeshRoutesStore } from '@/mesh/store/mesh-routes-store'

import { getAddressFromMatrixId, resolveMatrixHost } from '../helpers'
import { findExistingRoomByAddress, getPartnerMatrixId } from '../room-helpers'

import {
  DECRYPTED_CACHE_WAIT_TIMEOUT,
  LOGIN_RETRY_MAX_DELAY,
  LOGIN_RETRY_MIN_DELAY,
  PROFILE_UPDATE_DEBOUNCE,
} from './consts'

const log = logger.scope('[MessengerStore]')
import { useMessengerUiStore } from './messenger-ui-store'
import { useMessengerProfileCache } from './messenger-profile-cache'
import { useMessengerChatStore } from './messenger-chat-store'
import type { MessengerStoreContext } from './messenger-store/types'
import { loadDialogsSnapshot, saveDialogsSnapshot } from './messenger-store/dialogs-snapshot'
import { useDialogMapping } from './messenger-store/use-dialog-mapping'
import { registerMatrixListeners } from './messenger-store/use-matrix-listeners'
import { useMeshRoutes } from './messenger-store/use-mesh-routes'
import { appToast } from '@/b-components/app-toast'

export const useMessengerStore = defineStore('messenger', () => {
  const authStore = useAuthStore()
  const uiStore = useMessengerUiStore()
  const profileCache = useMessengerProfileCache()
  const chatStore = useMessengerChatStore()
  // Mesh-диалоги (переписка через радио, src/mesh) идут в общем списке с
  // комнатами Matrix; их id начинаются с `mesh:`.
  const meshChat = useMeshChatStore()
  const meshRoutes = useMeshRoutes({ uiStore, meshChat })

  // Writable refs из uiStore — нужны для внешних присваиваний
  // (store.isOpen = false, store.isFullScreen = true, store.activeChatId = null).
  const uiRefs = storeToRefs(uiStore)

  // Маппинг комнаты в диалог и подписки на Matrix — в messenger-store/*.
  const ctx: MessengerStoreContext = { uiStore, chatStore, profileCache }
  const { mapRoomToDialog } = useDialogMapping(ctx)

  // --- Загрузка диалогов ---

  /** Первый синк прошёл: getRooms() знает все комнаты. */
  const isSyncReady = (): boolean =>
    uiStore.syncState === 'PREPARED' || uiStore.syncState === 'SYNCING'

  /**
   * На экране список с прошлого запуска (dialogs-snapshot): Matrix ещё входит
   * или синхронизируется. Сменится свежим после первого синка.
   */
  let showingSnapshot = false

  /**
   * Список с прошлого запуска — пока нет клиента: вход, первый синк и
   * расшифровка последних сообщений занимают секунды, а мессенджер часто
   * открывают сразу после запуска. Заодно свой matrix-id: по нему строка
   * списка ставит «Вы:» перед своим сообщением.
   */
  const showDialogsSnapshot = (address: string) => {
    if (uiStore.dialogs.length > 0) return
    const cached = loadDialogsSnapshot(address)
    if (cached.length === 0) return
    uiStore.setDialogs(cached)
    showingSnapshot = true
    if (chatStore.currentUser.id === 'me') {
      const hex = matrixService.addressToHex(address).toLowerCase()
      chatStore.currentUser.id = `@${hex}:${resolveMatrixHost()}`
    }
  }

  /** Запомнить список до следующего запуска — только полный, после синка. */
  const persistDialogs = (
    address: string | null = authStore.address,
    dialogs: Dialog[] = uiStore.dialogs
  ) => {
    if (!address || address !== authStore.address) return
    if (showingSnapshot || !isSyncReady()) return
    saveDialogsSnapshot(address, dialogs)
  }

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
    // До первого синка getRooms() отдаёт пустоту или часть комнат: такой список
    // не затирает список с прошлого запуска и не сохраняется вместо него.
    const complete = isSyncReady()
    if (showingSnapshot && !complete) return
    // Адрес — на момент начала: аккаунт могли сменить, пока шла загрузка.
    const address = authStore.address
    if (!silent) uiStore.isLoading = true
    try {
      const rooms = matrixService.getRooms()
      const partnerAddresses = rooms
        .map((room) => getPartnerMatrixId(room))
        .map((id: string | null) => (id ? getAddressFromMatrixId(id) : null))
        .filter((a: string | null): a is string => Boolean(a))
      if (partnerAddresses.length > 0)
        await profileCache.fetchProfiles([...new Set(partnerAddresses)] as string[])

      // Последние сообщения берём из кэша расшифровок, а не расшифровываем
      // заново: без этого первый список после запуска расшифровывал по
      // сообщению на каждую комнату. Таймаут — на случай зависшего IndexedDB.
      if (rooms.length > 0) {
        chatStore.ensurePcryptoInitialized()
        await Promise.race([
          chatStore.hydrateDecryptedCache(),
          new Promise((resolve) => setTimeout(resolve, DECRYPTED_CACHE_WAIT_TIMEOUT)),
        ])
      }

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
      let keptActiveId: string | null = null
      if (activeId && !dialogsList.some((d) => d.id === activeId)) {
        const existing = uiStore.dialogs.find((d) => d.id === activeId)
        if (existing) {
          dialogsList = [existing, ...dialogsList]
          keptActiveId = activeId
        }
      }

      uiStore.setDialogs(
        dialogsList.sort((a, b) => {
          const tsA = a.lastMessage?.timestamp ?? a.createdAt ?? 0
          const tsB = b.lastMessage?.timestamp ?? b.createdAt ?? 0
          return tsB - tsA
        })
      )
      if (complete) {
        showingSnapshot = false
        // Открытый чат, которого нет среди комнат, остаётся только на экране: в
        // список следующего запуска попадают комнаты, известные серверу.
        persistDialogs(
          address,
          uiStore.dialogs.filter((d) => d.id !== keptActiveId)
        )
      }
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

  // --- Отметка «прочитано» ---

  /** До какого события чат уже отмечен прочитанным на сервере, по комнатам. */
  const readMarkerSent = new Map<string, string>()

  /**
   * Сказать серверу, что чат прочитан до последнего события: у собеседника
   * появится «✓✓». Только если чат на экране (V30) и раз на событие.
   */
  const markRoomRead = async (roomId: string): Promise<void> => {
    if (isMeshDialogId(roomId) || !uiStore.isChatOnScreen(roomId)) return
    const room = matrixService.getRoom(roomId)
    if (!room) return
    const lastEvent = [...room.getLiveTimeline().getEvents()]
      .reverse()
      .find((e: MatrixEvent) => e.getId()?.startsWith('$'))
    const eventId = lastEvent?.getId()
    if (!lastEvent || !eventId || readMarkerSent.get(roomId) === eventId) return
    readMarkerSent.set(roomId, eventId)
    try {
      const client = matrixService.getClient()
      if (client?.setRoomReadMarkers) await client.setRoomReadMarkers(roomId, eventId, lastEvent)
      else await client?.sendReadReceipt(lastEvent)
    } catch (e) {
      log.debug('read marker not sent', e)
      // Не ушло — следующая попытка отправит снова.
      if (readMarkerSent.get(roomId) === eventId) readMarkerSent.delete(roomId)
    }
  }

  // Чат снова на экране: открыли или развернули мессенджер, вернули вкладку
  // или окно приложения. Собеседник увидит «✓✓» на том, что пришло, пока
  // чат был скрыт.
  const markActiveChatRead = () => {
    const id = uiStore.activeChatId
    if (id) void markRoomRead(id)
  }
  watch(() => [uiStore.isOpen, uiStore.isFullScreen, uiStore.activeChatId], markActiveChatRead)
  if (typeof document !== 'undefined') {
    const onVisibility = () => {
      if (!document.hidden) markActiveChatRead()
    }
    document.addEventListener('visibilitychange', onVisibility)
    onScopeDispose(() => document.removeEventListener('visibilitychange', onVisibility))
  }

  // --- Инициализация Matrix ---

  /**
   * Подписки на события Matrix регистрируются ОДИН раз на клиента. Раньше при
   * каждой неудачной попытке логина `registerMatrixListeners` добавлял новый
   * комплект в очередь matrixService, и после успешного входа каждое событие
   * обрабатывалось по разу на попытку: двойной звук, двойной read-marker (S37).
   */
  let listenersRegistered = false

  /**
   * Вход при запуске мог не пройти: сеть ещё не поднялась, Tor не успел,
   * сервер моргнул. Раньше следующая попытка была только при открытии
   * мессенджера, и пользователь ждал вход, синк и загрузку диалогов. Теперь
   * повторяем в фоне с растущей паузой и сразу, как вернулась сеть.
   */
  let loginRetryTimer: ReturnType<typeof setTimeout> | null = null
  let loginRetryDelay = LOGIN_RETRY_MIN_DELAY

  const retryLoginNow = () => {
    cancelLoginRetry()
    void initMatrix()
  }

  const cancelLoginRetry = () => {
    if (loginRetryTimer) clearTimeout(loginRetryTimer)
    loginRetryTimer = null
    loginRetryDelay = LOGIN_RETRY_MIN_DELAY
    window.removeEventListener('online', retryLoginNow)
  }

  const scheduleLoginRetry = () => {
    if (loginRetryTimer) return
    window.addEventListener('online', retryLoginNow)
    loginRetryTimer = setTimeout(() => {
      loginRetryTimer = null
      void initMatrix()
    }, loginRetryDelay)
    loginRetryDelay = Math.min(loginRetryDelay * 2, LOGIN_RETRY_MAX_DELAY)
  }

  const initMatrix = async () => {
    if (!authStore.isUserAuthenticated || !authStore.address || !authStore.keyPair) return
    // Переписка через радио не зависит от Matrix: без интернета она нужнее всего.
    void meshChat.ensureLoaded()
    void useReticulumStore().autostart()
    if (uiStore.isInitInProgress) return
    uiStore.isInitInProgress = true
    if (!matrixService.getClient()) showDialogsSnapshot(authStore.address)

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
          // копит подписки до создания клиента. Ровно один раз (S37).
          if (!listenersRegistered) {
            registerMatrixListeners(ctx, { loadDialogs, scheduleLoadDialogs, markRoomRead })
            listenersRegistered = true
          }

          const success = await matrixService.login(authStore.address, authStore.keyPair)
          if (!success) throw new Error('Matrix login failed')
          cancelLoginRetry()
          uiStore.syncError = null
          await syncCurrentUser()
        } catch (e) {
          log.error('Ошибка инициализации Matrix:', e)
          // Провал логина был виден только в консоли — пользователь смотрел на
          // вечную «Загрузку диалогов» (S37).
          uiStore.syncState = 'ERROR'
          uiStore.syncError = t('appMsg.messenger.loginFailed')
          uiStore.dialogsLoadedOnce = true
          if (!matrixService.getClient()) scheduleLoginRetry()
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
    if (isMeshDialogId(chatId)) {
      uiStore.switchToChat(chatId)
      await meshChat.openDialog(chatId)
      return
    }
    uiStore.switchToChat(chatId)
    uiStore.markDialogRead(chatId)
    // mesh-маршрут собеседника: его LXMF — в этой же ленте.
    void meshRoutes.openRouted(chatId)

    await chatStore.loadMessages(chatId)
    // Read-marker уходит, только если чат действительно на экране (V30).
    await markRoomRead(chatId)
  }

  const toggleMessenger = async () => {
    if (uiStore.isOpen) {
      // Сворачивание — через closeWidget: иначе свёрнутое окно продолжает
      // держать активный чат и слать read-markers (V30).
      uiStore.closeWidget()
      return
    }
    uiStore.isOpen = true
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

  /**
   * Адреса, для которых прямо сейчас создаётся комната. Без этого два быстрых
   * клика по «Начать чат» создавали ДВЕ комнаты с одним собеседником (S40).
   */
  const startingChats = new Map<string, Promise<string | null>>()

  const startChatWithAddress = async (address: string): Promise<string | null> => {
    if (!address || !authStore.isUserAuthenticated) return null
    const inFlight = startingChats.get(address)
    if (inFlight) return inFlight
    const run = startChatWithAddressInner(address).finally(() => {
      startingChats.delete(address)
    })
    startingChats.set(address, run)
    return run
  }

  const startChatWithAddressInner = async (address: string): Promise<string | null> => {
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
      await markRoomRead(roomId)
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
    if (isMeshDialogId(chatId)) {
      if (uiStore.activeChatId === chatId) uiStore.setActiveChatId(null)
      void meshChat.deleteDialog(chatId)
      return
    }
    const removedMessages = chatStore.messages[chatId] ? [...chatStore.messages[chatId]] : null
    const wasActive = uiStore.activeChatId === chatId

    if (wasActive) uiStore.setActiveChatId(null)
    const { dialog: removedDialog, index: removedIndex } = uiStore.removeDialog(chatId)
    delete chatStore.messages[chatId]

    matrixService
      .leaveAndForgetRoom(chatId)
      // Иначе удалённый чат мелькнёт в списке при следующем запуске.
      .then(() => persistDialogs())
      .catch((e) => {
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
    // Серверную сессию отзываем всегда (N21): следующий вход всё равно делает
    // новый login, а без отзыва на homeserver'е копятся device'ы с токенами.
    // Остановка синхронная (initMatrix сразу после должен увидеть «клиента нет»),
    // отзыв — в фоне.
    matrixService.stop({ revoke: true })
    // stop() чистит очередь подписок — при следующем входе регистрируем заново.
    listenersRegistered = false
    readMarkerSent.clear()
    cancelLoginRetry()
    showingSnapshot = false
    uiStore.reset()
    chatStore.reset()
    profileCache.reset()
    // Радио отключается, переписка аккаунта уходит из памяти; при выходе —
    // и с диска, как расшифровки Matrix.
    void useMeshConnectionStore().reset()
    void useMeshtasticConnectionStore().reset()
    void useReticulumStore().reset()
    meshChat.reset({ purge: opts.purge })
    useMeshRoutesStore().reset()
    if (opts.purge && userId) {
      matrixService.purgeLocalData({ userId }).catch((e: unknown) => {
        console.warn('[MessengerStore] purgeLocalData failed:', e)
      })
    }
  }

  /** Стереть локальные данные мессенджера удалённого (не текущего) аккаунта. */
  const purgeAccountData = async (address: string): Promise<void> => {
    await Promise.all([matrixService.purgeLocalData({ address }), meshChat.purgeAccount(address)])
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
    const id = uiStore.activeChatId
    if (!id) return []
    if (isMeshDialogId(id)) return meshChat.messengerMessages(id)
    // С mesh-маршрутом — вместе с перепиской через Reticulum.
    return meshRoutes.messagesOf(id, chatStore.messages[id] || [])
  })

  /**
   * Весь список: комнаты Matrix и mesh-диалоги, свежие сверху. mesh-диалог
   * собеседника с маршрутом не отдельно — он в его диалоге Bastyon.
   */
  const allDialogs = computed(() =>
    meshRoutes.dialogsOf(uiStore.dialogs, meshChat.messengerDialogs)
  )

  /** Отказ mesh-отправки — тостом: в чате Bastyon ошибки рисуются иначе. */
  function meshSendFailed(result: Awaited<ReturnType<typeof meshChat.send>>): void {
    if (!result.ok) appToast.error({ message: t(`mesh.chat.errors.${result.error}`) })
  }

  const sendMessage = async (chatId: string, text: string): Promise<void> => {
    if (isMeshDialogId(chatId)) {
      await meshChat.send(chatId, text)
      return
    }
    // Сервер чатов недоступен (или выбран Reticulum), а маршрут есть.
    const viaMesh = await meshRoutes.sendRoute(chatId)
    if (viaMesh) {
      meshSendFailed(await meshChat.send(viaMesh, text))
      return
    }
    await chatStore.sendMessage(chatId, text)
  }

  const retryMessage = async (chatId: string, messageId: string): Promise<void> => {
    if (isMeshDialogId(chatId)) {
      await meshChat.retry(chatId, messageId)
      return
    }
    // Не ушедшее в Matrix — через Reticulum, если сейчас туда.
    const failed = chatStore.messages[chatId]?.find((m) => m.id === messageId)
    const viaMesh = failed?.text ? await meshRoutes.sendRoute(chatId) : null
    if (failed?.text && viaMesh) {
      const result = await meshChat.send(viaMesh, failed.text)
      meshSendFailed(result)
      if (result.ok) {
        chatStore.messages[chatId] = chatStore.messages[chatId]!.filter((m) => m.id !== messageId)
      }
      return
    }
    await chatStore.retryMessage(chatId, messageId)
  }

  /**
   * Свои записи связки — собеседнику в чат Bastyon: Reticulum, если узел
   * запущен, и радио MeshCore и Meshtastic, если подключены.
   */
  async function shareMeshBinding(chatId: string): Promise<'sent' | 'no_node' | 'failed'> {
    const routes = useMeshRoutesStore()
    const bindings = await routes.ownBindings()
    if (bindings.length === 0) return 'no_node'
    const address = bindings
      .map((b) =>
        b.net === 'lxmf'
          ? `Reticulum lxmf@${b.dest}`
          : b.net === 'meshcore'
            ? `MeshCore ${b.dest.slice(0, 12)}`
            : `Meshtastic !${b.dest}`
      )
      .join(', ')
    const body = t('mesh.share.text', { address })
    try {
      // Записи — в зашифрованном теле (JSON), сервер их не видит.
      await chatStore.sendTextContent(chatId, JSON.stringify({ body, bastyonMesh: bindings }))
    } catch (e) {
      log.warn('mesh binding not sent', e)
      return 'failed'
    }
    const partner = allDialogs.value.find((d) => d.id === chatId)?.partner.id
    const contact = partner ? getAddressFromMatrixId(partner) : null
    if (contact) routes.markShared(contact)
    return 'sent'
  }

  return {
    // UI (делегируем в uiStore)
    isOpen: uiRefs.isOpen,
    isFullScreen: uiRefs.isFullScreen,
    activeChatId: uiRefs.activeChatId,
    dialogs: allDialogs,
    messages: chatStore.messages,
    activeMessages,
    // ВАЖНО: та же проблема, что и с pcryptoService — `activeDialog` initial value
    // (нет активного чата) = null. Голый null ломает storeToRefs.
    activeDialog: computed(
      () =>
        uiStore.activeDialog ?? allDialogs.value.find((d) => d.id === uiStore.activeChatId) ?? null
    ),
    // Живая ссылка: chatStore.reset() при каждом входе в аккаунт подменяет
    // объект, и снятая при создании стора копия навсегда оставалась с id 'me' —
    // свои сообщения рисовались чужими, без «Вы:» и без удаления.
    currentUser: computed(() => chatStore.currentUser),
    lastTargetAddress: computed(() => uiStore.lastTargetAddress),
    inviteViewActive: computed(() => uiStore.inviteViewActive),
    isSyncStarted: computed(() => uiStore.isSyncStarted),
    isLoading: computed(() => uiStore.isLoading),
    // Без связи с сервером история Matrix не придёт — у чата с mesh-маршрутом
    // сразу лента LXMF, без ожидания.
    isMessagesLoading: computed(
      () => uiStore.isMessagesLoading && !meshRoutes.offlineRouted(uiStore.activeChatId)
    ),
    activeMeshRoute: meshRoutes.active,
    toggleMeshRoute: meshRoutes.toggleForced,
    shareMeshBinding,
    dialogsLoadedOnce: computed(() => uiStore.dialogsLoadedOnce),
    /** Загрузка вместо списка — только пока показать нечего, даже списка с прошлого запуска. */
    isDialogsLoading: computed(
      () =>
        uiStore.dialogs.length === 0 &&
        meshChat.dialogs.length === 0 &&
        (!uiStore.dialogsLoadedOnce || uiStore.isLoading)
    ),
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
    totalUnreadCount: computed(() => uiStore.totalUnreadCount + meshChat.totalUnread),

    // Методы
    loadDialogs,
    loadMessages: chatStore.loadMessages,
    loadMoreMessages: chatStore.loadMoreMessages,
    openChat,
    toggleMessenger,
    openMessenger,
    /** Свернуть виджет: сбрасывает активный чат вместе с видимостью (V30). */
    closeWidget: uiStore.closeWidget,
    /** Виден ли чат на экране (для read-markers/звука/уведомлений). */
    isChatOnScreen: uiStore.isChatOnScreen,
    sendMessage,
    retryMessage,
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
