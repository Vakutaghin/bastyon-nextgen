<template>
  <!-- Full Screen Overlay Mode (перекрывает весь экран, включая хедер) -->
  <SC_FullScreenOverlay v-if="isFullScreen" :class="{ 'above-bottom-nav': aboveBottomNav }">
    <SC_CloseOverlayButton :aria-label="t('messenger.close')" @click="closeFullScreen">
      <CloseOutlined />
    </SC_CloseOverlayButton>
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
          <ArrowLeftIcon />
        </SC_BackButton>
      </template>
      <template v-if="shownPartner" #title>
        <ChatPartnerTitle :partner="shownPartner" />
      </template>

      <!-- Без него окошко при сбое синка показывало только вечную «Загрузку диалогов». -->
      <SyncErrorBanner v-if="!activeChatId && !(lastTargetAddress && inviteViewActive)" />

      <SC_MessengerWrapperLoader
        v-if="isDialogsLoading && !activeChatId && !(lastTargetAddress && inviteViewActive)"
      >
        <SC_MessengerWrapperSpinner />
        <SC_MessengerWrapperLoaderText>
          {{ t('messenger.loadingDialogs') }}
        </SC_MessengerWrapperLoaderText>
      </SC_MessengerWrapperLoader>

      <ChannelRoom
        v-else-if="channelAddressOf(activeChatId)"
        :key="activeChatId!"
        :address="channelAddressOf(activeChatId)!"
      />

      <MeshChatRoom
        v-else-if="activeChatId && isMeshDialogId(activeChatId)"
        :key="activeChatId"
        :dialog-id="activeChatId"
      />

      <ChatRoom
        v-else-if="activeChatId"
        :key="activeChatId"
        :messages="activeMessages"
        :invite-mode="false"
        :is-loading="isMessagesLoading"
        focus-on-open
        @send="handleSendMessage"
        @load-more="handleLoadMore"
      />

      <ChatRoom
        v-else-if="lastTargetAddress && inviteViewActive"
        :messages="[]"
        :invite-mode="true"
        :is-loading="false"
      />

      <ChatList v-else :dialogs="dialogs" @select="openChat" />
    </MessengerWindow>

    <MessengerButton
      v-if="prefs.chatButton"
      :unread-count="totalUnreadCount"
      :is-open="isOpen"
      @click="toggleMessenger"
    >
      <template #icon>
        <MessageOutlined v-if="!isOpen" />
        <CloseOutlined v-else />
      </template>
    </MessengerButton>
  </SC_MessengerWrapper>

  <!-- Участники и настройки группы — из шапки чата и меню «…» в списке. -->
  <GroupInfoModal v-if="isVisible" />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ArrowLeftIcon, CloseOutlined, MessageOutlined } from '@/components/icons'
import MessengerButton from '../messenger-button/messenger-button.vue'
import MessengerWindow from '../messenger-window/messenger-window.vue'
import ChatList from '../chat-list/chat-list.vue'
import ChatRoom from '../chat-room/chat-room.vue'
import MeshChatRoom from '../mesh-chat-room/mesh-chat-room.vue'
import ChannelRoom from '../channel-room/channel-room.vue'
import { channelAddressOf } from '../../lib/channels'
import { isMeshDialogId } from '@/mesh/ids'
import MessengerPanel from '../messenger-panel/messenger-panel.vue'
import SyncErrorBanner from '../sync-error-banner/sync-error-banner.vue'
import ChatPartnerTitle from '../chat-partner-title/chat-partner-title.vue'
import GroupInfoModal from '../group-info/group-info-modal.vue'
import { useShownPartner } from '../chat-partner-title/use-shown-partner'
import { useMessengerStore } from '../../store'
import { useAuthStore } from '@/blockchain'
import { useViewport } from '@/composables/use-viewport'
import { closePageOverlay, openPageOverlay } from '@/composables/use-page-overlay'
import { pushBackHandler } from '@/composables/use-back-button'
import { useAppPreferencesStore } from '@/stores/app-preferences-store'
import { useModalStore } from '@/stores/modal-store'
import {
  SC_MessengerWrapper,
  SC_BackButton,
  SC_FullScreenOverlay,
  SC_CloseOverlayButton,
  SC_OverlayContent,
  SC_MessengerWrapperLoader,
  SC_MessengerWrapperLoaderText,
  SC_MessengerWrapperSpinner,
} from './styled'

const store = useMessengerStore()
const modalStore = useModalStore()
const {
  isFullScreen,
  isOpen,
  isDialogsLoading,
  isMessagesLoading,
  dialogs,
  activeChatId,
  activeMessages,
  lastTargetAddress,
  inviteViewActive,
  totalUnreadCount,
} = storeToRefs(store)

const { t } = useI18n()
const authStore = useAuthStore()
const { isMobileOrTablet } = useViewport()

// Без входа чата нет. Круглую кнопку можно скрыть в настройках («Общие»):
// окно чата тогда открывает значок в шапке.
const prefs = useAppPreferencesStore()
const isVisible = computed<boolean>(() => authStore.isUserAuthenticated)

// На мобилке/планшете НЕ показываем плавающий floating-widget — мессенджер
// открывается только в full-screen режиме, «Чатами» в нижней панели.
// Desktop сохраняет старое поведение: floating-widget + кнопка-кружок.
const showFloatingWidget = computed<boolean>(() => isVisible.value && !isMobileOrTablet.value)

// На телефоне нижняя панель остаётся видна под списком чатов: из чатов можно
// уйти в любой раздел, как из обычной вкладки. Открытый чат занимает весь
// экран — внизу у него поле ввода.
const aboveBottomNav = computed<boolean>(
  () =>
    isMobileOrTablet.value &&
    !activeChatId.value &&
    !(lastTargetAddress.value && inviteViewActive.value)
)

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

const shownPartner = useShownPartner()
const widgetTitle = computed<string>(() => shownPartner.value?.name ?? t('messenger.messages'))

function onWidgetBack(): void {
  if (activeChatId.value) {
    store.activeChatId = null
  } else if (lastTargetAddress.value) {
    store.clearInviteTarget()
  }
}

function closeFullScreen(): void {
  // Вместе с активным чатом — иначе скрытое окно продолжает слать read-markers
  // за пользователя (V30).
  store.closeFullScreen()
}

function closeWidget(): void {
  store.clearInviteTarget()
  store.closeWidget()
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

// Полноэкранный мессенджер закрывает всю страницу. Переход из него — ссылка
// `bastyon://` в сообщении, «В эксплорере» у перевода — раньше менял страницу
// под ним, и её не было видно, пока чат не закроешь.
const route = useRoute()
watch(
  () => route.path,
  () => {
    if (store.isFullScreen) closeFullScreen()
  }
)

watch(
  () => store.isFullScreen,
  (isFull) => {
    if (isFull) {
      // Закрываем widget при открытии full-screen, чтобы не было одновременно
      // двух открытых режимов мессенджера.
      store.isOpen = false
      openPageOverlay()
    } else {
      // Сброс активного чата при выходе из full-screen — возвращаемся к списку.
      store.activeChatId = null
      closePageOverlay()
    }
  }
)

/**
 * Закрыть верхнее, что открыто в мессенджере: Esc на компьютере и «Назад» на
 * Android. Сначала окно поверх чата, потом диалог, потом сам чат. false —
 * мессенджер закрыт, закрывать нечего.
 */
function closeTopmost(): boolean {
  // Открытый поверх пост (из канала или ссылки в чате) закрывается первым:
  // фокус остаётся в ленте, и раньше Escape закрывал чат под постом.
  if (modalStore.postModal.isOpen) {
    modalStore.closePostModal()
    return true
  }
  // Окно группы закрывается первым (обычно его Escape сюда и не доходит).
  if (store.groupInfoChatId) {
    store.closeGroupInfo()
    return true
  }
  if (!store.isFullScreen && !store.isOpen) return false
  if (store.activeChatId) {
    store.activeChatId = null
    return true
  }
  // Переписка с тем, с кем чата ещё нет, — как стрелка «назад» над ней.
  if (store.lastTargetAddress && store.inviteViewActive) {
    store.clearInviteTarget()
    return true
  }
  if (store.isFullScreen) closeFullScreen()
  else store.closeWidget()
  return true
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  // Просмотрщик картинок (пост в канале) закрывается сам — чат под ним остаётся.
  if (modalStore.imageGallery.isOpen) return
  if (!closeTopmost()) return
  e.preventDefault()
  e.stopPropagation()
}

// Обработчик с монтирования — ниже всего, что открывается поверх чата и
// добавляет свой (картинка, пост, меню вложений): те закрываются раньше.
let releaseBack: (() => void) | null = null

onMounted(async () => {
  // До входа в Matrix: пока он идёт, чат уже открывают, и Esc с «Назад» нужны.
  window.addEventListener('keydown', handleKeydown)
  releaseBack = pushBackHandler(closeTopmost)
  if (authStore.isUserAuthenticated) {
    await store.initMatrix()
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  releaseBack?.()
  if (store.isFullScreen) closePageOverlay()
})

const openChat = store.openChat
const toggleMessenger = store.toggleMessenger
</script>
