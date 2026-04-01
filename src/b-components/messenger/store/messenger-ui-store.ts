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

  /** Сбросить состояние invite-экрана */
  const clearInviteTarget = (): void => {
    lastTargetAddress.value = null
    inviteViewActive.value = false
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
    clearInviteTarget,
    reset,
  }
})
