<template>
  <!-- Full Screen Overlay Mode -->
  <SC_FullScreenOverlay v-if="isFullScreen">
    <SC_OverlayContent>
      <MessengerPanel />
    </SC_OverlayContent>
  </SC_FullScreenOverlay>

  <!-- Floating Widget Mode (desktop only) -->
  <SC_MessengerWrapper v-if="showFloatingWidget && !isFullScreen">
    <MessengerWindow :is-open="isOpen" :title="widgetTitle" @close="closeWidget">
      <template #actions>
        <SC_BackButton
          v-if="activeChatId || (lastTargetAddress && inviteViewActive)"
          @click="onWidgetBack"
        >
          <SC_WhiteIcon :src="icons.back" />
        </SC_BackButton>
      </template>

      <SC_MessengerWrapperLoader
        v-if="
          (!dialogsLoadedOnce || isLoading) &&
          !activeChatId &&
          !(lastTargetAddress && inviteViewActive)
        "
      >
        <SC_MessengerWrapperSpinner />
        <SC_MessengerWrapperLoaderText> Загрузка диалогов... </SC_MessengerWrapperLoaderText>
      </SC_MessengerWrapperLoader>

      <ChatRoom
        v-else-if="activeChatId"
        :key="activeChatId"
        :messages="activeMessages"
        :invite-mode="false"
        :is-loading="isMessagesLoading"
        @send="handleSendMessage"
        @load-more="handleLoadMore"
      />

      <ChatRoom
        v-else-if="lastTargetAddress && inviteViewActive"
        :messages="[]"
        :invite-mode="true"
        :is-loading="false"
        @send="() => {}"
        @load-more="() => {}"
        @open-chat="onChatStarted"
      />

      <ChatList v-else :dialogs="dialogs" @select="openChat" />
    </MessengerWindow>

    <MessengerButton :unread-count="totalUnreadCount" :is-open="isOpen" @click="toggleMessenger">
      <template #icon>
        <SC_WhiteIcon v-if="!isOpen" :src="icons.chat" />
        <SC_WhiteIcon v-else :src="icons.close" />
      </template>
    </MessengerButton>
  </SC_MessengerWrapper>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import closeIcon from '../../img/close.svg'
import backIcon from '../../img/back.svg'
import chatIcon from '../../img/chat.svg'
import MessengerButton from '../messenger-button/messenger-button.vue'
import MessengerWindow from '../messenger-window/messenger-window.vue'
import ChatList from '../chat-list/chat-list.vue'
import ChatRoom from '../chat-room/chat-room.vue'
import MessengerPanel from '../messenger-panel/messenger-panel.vue'
import { useMessengerStore } from '../../store'
import { useAuthStore } from '@/blockchain'
import { useViewport } from '@/composables/use-viewport'
import {
  SC_MessengerWrapper,
  SC_BackButton,
  SC_FullScreenOverlay,
  SC_OverlayContent,
  SC_MessengerWrapperLoader,
  SC_MessengerWrapperLoaderText,
  SC_MessengerWrapperSpinner,
  SC_WhiteIcon,
} from './styled'

const store = useMessengerStore()
const {
  isFullScreen,
  isOpen,
  dialogsLoadedOnce,
  isLoading,
  isMessagesLoading,
  dialogs,
  activeChatId,
  activeMessages,
  lastTargetAddress,
  inviteViewActive,
} = storeToRefs(store)

const totalUnreadCount = store.totalUnreadCount
const authStore = useAuthStore()
const { isMobileOrTablet } = useViewport()

const icons = {
  close: closeIcon,
  back: backIcon,
  chat: chatIcon,
}

const isVisible = computed<boolean>(() => authStore.isUserAuthenticated)

// На мобилке/планшете НЕ показываем плавающий floating-widget — мессенджер
// открывается только в full-screen режиме по клику на иконку в header.
// Desktop сохраняет старое поведение: floating-widget + кнопка-кружок.
const showFloatingWidget = computed<boolean>(() => isVisible.value && !isMobileOrTablet.value)

// На мобилке isFullScreen автоматически синхронизируется с тем, что
// пользователь открывает мессенджер (любое isOpen ≡ full-screen).
watch(
  () => store.isOpen,
  (open) => {
    if (open && isMobileOrTablet.value) {
      store.isFullScreen = true
    }
  }
)

// Если viewport ужался и мессенджер был открыт в widget-режиме —
// переключаем в full-screen.
watch(isMobileOrTablet, (mobile) => {
  if (mobile && store.isOpen) {
    store.isFullScreen = true
  }
})

const widgetTitle = computed<string>(() => {
  if (activeChatId.value) {
    const dialog = dialogs.value.find((d) => d.id === activeChatId.value)
    return dialog?.partner.name || 'Чат'
  }
  if (lastTargetAddress.value) {
    const profile = store.userProfiles[lastTargetAddress.value]
    return profile?.name || lastTargetAddress.value || 'Новый чат'
  }
  return 'Сообщения'
})

function onWidgetBack(): void {
  if (activeChatId.value) {
    store.activeChatId = null
  } else if (lastTargetAddress.value) {
    store.clearInviteTarget()
  }
}

function onChatStarted(roomId: string): void {
  store.switchToChatAndLoad(roomId)
}

function closeFullScreen(): void {
  store.isFullScreen = false
  store.clearInviteTarget()
  store.isOpen = false
}

function closeWidget(): void {
  store.clearInviteTarget()
  store.isOpen = false
}

function handleLoadMore(): void {
  if (activeChatId.value) {
    store.loadMoreMessages(activeChatId.value)
  }
}

function handleSendMessage(text: string): void {
  if (activeChatId.value) {
    store.sendMessage(activeChatId.value, text)
  }
}

function getScrollbarWidth(): number {
  return window.innerWidth - document.documentElement.clientWidth
}

watch(
  () => store.isFullScreen,
  (isFull) => {
    const scrollbarWidth = getScrollbarWidth()
    const header = document.querySelector('header') as HTMLElement | null

    if (isFull) {
      // Закрываем widget при открытии full-screen, чтобы не было одновременно
      // двух открытых режимов мессенджера.
      store.isOpen = false

      // Блокируем скролл body и компенсируем ширину скроллбара, чтобы layout
      // не «прыгал» вправо от исчезновения скроллбара.
      document.body.style.overflow = 'hidden'
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`
        if (header) header.style.paddingRight = `${scrollbarWidth}px`
      }
    } else {
      // Сброс активного чата при выходе из full-screen — возвращаемся к списку.
      store.activeChatId = null

      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
      if (header) header.style.paddingRight = ''
    }
  }
)

function handleKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (store.isFullScreen) {
    e.preventDefault()
    e.stopPropagation()
    if (store.activeChatId) {
      store.activeChatId = null
      return
    }
    closeFullScreen()
    return
  }
  if (!store.isOpen) return
  e.preventDefault()
  e.stopPropagation()
  if (store.activeChatId) {
    store.activeChatId = null
    return
  }
  store.isOpen = false
}

onMounted(async () => {
  if (authStore.isUserAuthenticated) {
    await store.initMatrix()
  }
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
  document.body.style.paddingRight = ''
  const header = document.querySelector('header') as HTMLElement | null
  if (header) header.style.paddingRight = ''
})

const openChat = store.openChat
const toggleMessenger = store.toggleMessenger
</script>
