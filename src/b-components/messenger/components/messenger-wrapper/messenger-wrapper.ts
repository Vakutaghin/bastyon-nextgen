import { defineComponent, computed, onMounted, watch, onUnmounted } from 'vue'

import closeIcon from '../../img/close.svg'
import backIcon from '../../img/back.svg'
import chatIcon from '../../img/chat.svg'
import MessengerButton from '../messenger-button/messenger-button.vue'
import MessengerWindow from '../messenger-window/messenger-window.vue'
import ChatList from '../chat-list/chat-list.vue'
import ChatRoom from '../chat-room/chat-room.vue'
import MessengerPanel from '../messenger-panel/messenger-panel.vue'
import { storeToRefs } from 'pinia'
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
} from './styled'

export const messengerWrapperOptions = defineComponent({
  name: 'MessengerWrapper',
  components: {
    SC_MessengerWrapper,
    SC_BackButton,
    SC_FullScreenOverlay,
    SC_OverlayContent,
    SC_MessengerWrapperLoader,
    SC_MessengerWrapperLoaderText,
    SC_MessengerWrapperSpinner,
    MessengerButton,
    MessengerWindow,
    ChatList,
    ChatRoom,
    MessengerPanel,
  },
  setup() {
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

    const isVisible = computed(() => {
      return authStore.isUserAuthenticated
    })

    // На мобилке/планшете НЕ показываем плавающий floating-widget — мессенджер
    // открывается только в full-screen режиме по клику на иконку в header.
    // Desktop сохраняет старое поведение: floating-widget + кнопка-кружок.
    const showFloatingWidget = computed(() => {
      return isVisible.value && !isMobileOrTablet.value
    })

    // На мобилке isFullScreen всегда автоматически синхронизируется
    // с тем что пользователь открывает мессенджер (любое isOpen ≡ full-screen).
    watch(
      () => store.isOpen,
      (open) => {
        if (open && isMobileOrTablet.value) {
          store.isFullScreen = true
        }
      }
    )

    // Если viewport ужался и мессенджер был открыт в widget-режиме — переключаем full-screen.
    watch(isMobileOrTablet, (mobile) => {
      if (mobile && store.isOpen) {
        store.isFullScreen = true
      }
    })

    const widgetTitle = computed(() => {
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

    const onWidgetBack = () => {
      if (activeChatId.value) {
        store.activeChatId = null
      } else if (lastTargetAddress.value) {
        store.clearInviteTarget()
      }
    }

    const onChatStarted = (roomId: string) => {
      store.switchToChatAndLoad(roomId)
    }

    const closeFullScreen = () => {
      store.isFullScreen = false
      store.clearInviteTarget()
      store.isOpen = false
    }

    const closeWidget = () => {
      store.clearInviteTarget()
      store.isOpen = false
    }

    const handleLoadMore = () => {
      if (activeChatId.value) {
        store.loadMoreMessages(activeChatId.value)
      }
    }

    const handleSendMessage = (text: string) => {
      if (activeChatId.value) {
        store.sendMessage(activeChatId.value, text)
      }
    }

    // Helper to get scrollbar width
    const getScrollbarWidth = () => {
      return window.innerWidth - document.documentElement.clientWidth
    }

    watch(
      () => store.isFullScreen,
      (isFull) => {
        const scrollbarWidth = getScrollbarWidth()
        const header = document.querySelector('header') as HTMLElement

        if (isFull) {
          // Close widget (collapse to circle) when opening full screen
          store.isOpen = false

          // Lock body and add padding to compensate scrollbar
          document.body.style.overflow = 'hidden'
          if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`
            // Compensate for fixed header as well
            if (header) {
              header.style.paddingRight = `${scrollbarWidth}px`
            }
          }
        } else {
          // Reset active chat when closing full screen (return to dialog list)
          store.activeChatId = null

          // Unlock and reset
          document.body.style.overflow = ''
          document.body.style.paddingRight = ''
          if (header) {
            header.style.paddingRight = ''
          }
        }
      }
    )

    // Handle Escape key
    const handleKeydown = (e: KeyboardEvent) => {
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
      const header = document.querySelector('header') as HTMLElement
      if (header) {
        header.style.paddingRight = ''
      }
    })

    return {
      isFullScreen,
      isOpen,
      dialogsLoadedOnce,
      isLoading,
      isMessagesLoading,
      dialogs,
      activeMessages,
      totalUnreadCount,
      activeChatId,
      lastTargetAddress,
      inviteViewActive,
      widgetTitle,
      isVisible,
      showFloatingWidget,
      closeWidget,
      closeFullScreen,
      onWidgetBack,
      onChatStarted,
      icons,
      handleLoadMore,
      handleSendMessage,
      openChat: store.openChat,
      toggleMessenger: store.toggleMessenger,
    }
  },
})
