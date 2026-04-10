// UI-состояние мессенджера: открытие/закрытие, полноэкранность, активный диалог, invite

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

import type { Dialog } from '../types'

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

  const syncState = ref<string>('STOPPED')
  const syncError = ref<string | null>(null)
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

  /** Пометить прочтённым конкретный диалог */
  const markDialogRead = (chatId: string): void => {
    const dialog = dialogs.value.find((d) => d.id === chatId)
    if (dialog) dialog.unreadCount = 0
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
    isSyncStarted.value = false
    isInitInProgress.value = false
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
    isSyncStarted,
    isInitInProgress,
    activeDialog,
    totalUnreadCount,
    setDialogs,
    setActiveChatId,
    switchToChat,
    showInvite,
    clearInviteTarget,
    markDialogRead,
    prependDialog,
    removeDialog,
    restoreDialog,
    reset,
  }
})
