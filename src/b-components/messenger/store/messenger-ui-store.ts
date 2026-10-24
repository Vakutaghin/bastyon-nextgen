// UI-состояние мессенджера: открытие/закрытие, полноэкранность, активный диалог, invite

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

import type { Dialog } from '../types'

/** Что показывает список: всё, только переписки (личные и группы) или только каналы. */
export type ChatFilter = 'all' | 'chats' | 'channels'

/**
 * Выбранный фильтр помнится на устройстве: один и тот же у виджета и
 * полноэкранного мессенджера и после перезапуска.
 */
const CHAT_FILTER_KEY = 'BST_MSG_CHAT_FILTER'

function readChatFilter(): ChatFilter {
  try {
    const v = localStorage.getItem(CHAT_FILTER_KEY)
    return v === 'chats' || v === 'channels' ? v : 'all'
  } catch {
    return 'all'
  }
}

export const useMessengerUiStore = defineStore('messenger-ui', () => {
  const isOpen = ref(false)
  const isFullScreen = ref(false)
  const activeChatId = ref<string | null>(null)
  const dialogs = ref<Dialog[]>([])

  /** true только при явном открытии приглашения (профиль/пост) */
  const inviteViewActive = ref(false)
  const lastTargetAddress = ref<string | null>(null)

  const isLoading = ref(false)
  const isMessagesLoading = ref(false)
  /** true после первой успешной загрузки списка диалогов */
  const dialogsLoadedOnce = ref(false)

  const chatFilter = ref<ChatFilter>(readChatFilter())
  /** Группа, чьё окно с участниками сейчас открыто. */
  const groupInfoChatId = ref<string | null>(null)

  const syncState = ref<string>('STOPPED')
  const syncError = ref<string | null>(null)
  /** Техническая причина ошибки синка (HTTP-код, «fetch failed…») — для поддержки. */
  const syncErrorDetail = ref<string | null>(null)
  const isSyncStarted = ref(false)
  const isInitInProgress = ref(false)

  const activeDialog = computed<Dialog | null>(() => {
    if (!activeChatId.value) return null
    return dialogs.value.find((d) => d.id === activeChatId.value) || null
  })

  const totalUnreadCount = computed(() => {
    return dialogs.value.reduce((sum, dialog) => sum + (dialog.unreadCount || 0), 0)
  })

  /** Обновить список диалогов (единственная точка мутации) */
  const setDialogs = (newDialogs: Dialog[]): void => {
    dialogs.value = newDialogs
  }

  /** Установить активный чат */
  const setActiveChatId = (id: string | null): void => {
    activeChatId.value = id
  }

  /**
   * Закрыть виджет. Активный чат сбрасываем: свёрнутое окно продолжало
   * считаться «открытым чатом» — сообщения приходили без звука и бейджа, зато
   * серверу уходил read-marker, и собеседник видел «прочитано» (V30).
   */
  const closeWidget = (): void => {
    isOpen.value = false
    activeChatId.value = null
    inviteViewActive.value = false
  }

  /**
   * Виден ли чат на экране прямо сейчас: виджет открыт и вкладка не в фоне.
   * От этого зависят read-markers, звук и уведомления (V30).
   */
  /**
   * Чаты, которые показываются внутри другого: mesh-диалог собеседника с
   * mesh-маршрутом — в его диалоге Bastyon (id mesh-диалога → id комнаты).
   */
  const chatAliases = new Map<string, string>()
  const setChatAlias = (chatId: string, shownIn: string): void => {
    chatAliases.set(chatId, shownIn)
  }

  const isChatOnScreen = (chatId: string | null): boolean => {
    // Полноэкранный режим специально гасит `isOpen` (два окна мессенджера
    // одновременно не показываем), но чат при этом виден.
    if (!isOpen.value && !isFullScreen.value) return false
    if (!chatId) return false
    if (activeChatId.value !== chatId && chatAliases.get(chatId) !== activeChatId.value) {
      return false
    }
    if (typeof document !== 'undefined' && document.hidden) return false
    return true
  }

  /** Переключиться на чат: сбросить invite и установить активный чат */
  const switchToChat = (chatId: string): void => {
    inviteViewActive.value = false
    lastTargetAddress.value = null
    activeChatId.value = chatId
  }

  /** Показать invite-экран для адреса */
  const showInvite = (address: string): void => {
    lastTargetAddress.value = address
    inviteViewActive.value = true
    activeChatId.value = null
  }

  /** Сбросить состояние invite-экрана */
  const clearInviteTarget = (): void => {
    lastTargetAddress.value = null
    inviteViewActive.value = false
  }

  /** Закрыть полноэкранный мессенджер целиком — вместе с чатом и приглашением. */
  const closeFullScreen = (): void => {
    isFullScreen.value = false
    clearInviteTarget()
    closeWidget()
  }

  /** Пометить прочтённым конкретный диалог */
  const markDialogRead = (chatId: string): void => {
    const dialog = dialogs.value.find((d) => d.id === chatId)
    if (dialog) dialog.unreadCount = 0
  }

  /** «Без звука» в списке — сразу, не дожидаясь сервера. */
  const setDialogMuted = (chatId: string, muted: boolean): void => {
    const dialog = dialogs.value.find((d) => d.id === chatId)
    if (!dialog) return
    if (muted) dialog.muted = true
    else delete dialog.muted
    delete dialog.hasUnread
  }

  const setChatFilter = (filter: ChatFilter): void => {
    chatFilter.value = filter
    try {
      localStorage.setItem(CHAT_FILTER_KEY, filter)
    } catch {
      /* без хранилища — до перезапуска */
    }
  }

  const openGroupInfo = (chatId: string): void => {
    groupInfoChatId.value = chatId
  }

  const closeGroupInfo = (): void => {
    groupInfoChatId.value = null
  }

  /** Добавить диалог в начало списка */
  const prependDialog = (dialog: Dialog): void => {
    dialogs.value = [dialog, ...dialogs.value]
  }

  /** Удалить диалог из списка (возвращает удалённый и его индекс для undo) */
  const removeDialog = (chatId: string): { dialog: Dialog | undefined; index: number } => {
    const index = dialogs.value.findIndex((d) => d.id === chatId)
    const dialog = dialogs.value[index]
    if (index !== -1) dialogs.value = dialogs.value.filter((d) => d.id !== chatId)
    return { dialog, index }
  }

  /** Восстановить удалённый диалог (для undo) */
  const restoreDialog = (dialog: Dialog, index: number): void => {
    dialogs.value.splice(index, 0, dialog)
  }

  /** Полный сброс UI при логауте */
  const reset = () => {
    isOpen.value = false
    isFullScreen.value = false
    activeChatId.value = null
    dialogs.value = []
    inviteViewActive.value = false
    lastTargetAddress.value = null
    isLoading.value = false
    isMessagesLoading.value = false
    dialogsLoadedOnce.value = false
    syncState.value = 'STOPPED'
    syncError.value = null
    syncErrorDetail.value = null
    isSyncStarted.value = false
    isInitInProgress.value = false
    groupInfoChatId.value = null
  }

  return {
    isOpen,
    isFullScreen,
    activeChatId,
    dialogs,
    inviteViewActive,
    lastTargetAddress,
    isLoading,
    isMessagesLoading,
    dialogsLoadedOnce,
    syncState,
    syncError,
    syncErrorDetail,
    isSyncStarted,
    isInitInProgress,
    chatFilter,
    groupInfoChatId,
    activeDialog,
    totalUnreadCount,
    setDialogs,
    setActiveChatId,
    closeWidget,
    isChatOnScreen,
    setChatAlias,
    switchToChat,
    showInvite,
    clearInviteTarget,
    closeFullScreen,
    markDialogRead,
    setDialogMuted,
    setChatFilter,
    openGroupInfo,
    closeGroupInfo,
    prependDialog,
    removeDialog,
    restoreDialog,
    reset,
  }
})
