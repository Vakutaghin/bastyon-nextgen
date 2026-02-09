import { defineComponent, computed, onMounted, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

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
import {
  SC_MessengerWrapper,
  SC_BackButton,
  SC_FullScreenOverlay,
  SC_OverlayContent,
  SC_MessengerWrapperLoader,
  SC_MessengerWrapperLoaderText,
  SC_MessengerWrapperSpinner
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
    MessengerPanel
  },
  setup() {
    const store = useMessengerStore()
    const { activeChatId, lastTargetAddress, inviteViewActive } = storeToRefs(store)
    const route = useRoute()
    const authStore = useAuthStore()

    const icons = {
      close: closeIcon,
      back: backIcon,
      chat: chatIcon
    }

    const isVisible = computed(() => {
      return authStore.isUserAuthenticated
    })

    const widgetTitle = computed(() => {
      if (store.activeChatId) {
        const dialog = store.dialogs.find(d => d.id === store.activeChatId)
        return dialog?.partner.name || 'Чат'
      }
      if (store.lastTargetAddress) {
        const profile = store.userProfiles[store.lastTargetAddress]
        return profile?.name || store.lastTargetAddress || 'Новый чат'
      }
      return 'Сообщения'
    })

    const onWidgetBack = () => {
      if (store.activeChatId) {
        store.closeActiveChat?.()
        store.activeChatId = null
      } else if (store.lastTargetAddress) {
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
      // Сбрасываем приглашение к новому чату — при следующем открытии покажем список диалогов
      store.clearInviteTarget()
      // Активный диалог не сбрасываем — при открытии снова покажем тот же чат
      store.isOpen = false
    }

    const handleLoadMore = () => {
      if (store.activeChatId) {
        store.loadMoreMessages(store.activeChatId)
      }
    }

    // Helper to get scrollbar width
    const getScrollbarWidth = () => {
      return window.innerWidth - document.documentElement.clientWidth
    }

    watch(() => store.isFullScreen, (isFull) => {
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
    })

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
      store,
      activeChatId,
      lastTargetAddress,
      inviteViewActive,
      widgetTitle,
      isVisible,
      closeWidget,
      closeFullScreen,
      onWidgetBack,
      onChatStarted,
      icons,
      handleLoadMore
    }
  }
})
