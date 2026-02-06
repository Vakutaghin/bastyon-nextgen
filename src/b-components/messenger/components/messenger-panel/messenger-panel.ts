import { defineComponent, computed, onMounted } from 'vue'

import { useMessengerStore } from '../../store'
import { useAuthStore } from '@/blockchain'
import ChatList from '../chat-list/chat-list.vue'
import ChatRoom from '../chat-room/chat-room.vue'
import {
  SC_MessengerContainer,
  SC_SidebarColumn,
  SC_ChatColumn,
  SC_EmptyState,
  SC_MobileBackButton
} from './styled'


export const messengerPanelOptions = defineComponent({
  name: 'MessengerPanel',
  components: {
    ChatList,
    ChatRoom,
    SC_MessengerContainer,
    SC_SidebarColumn,
    SC_ChatColumn,
    SC_EmptyState,
    SC_MobileBackButton
  },
  setup() {
    const store = useMessengerStore()
    const authStore = useAuthStore()

    const activeChatName = computed(() => {
      if (store.activeChatId) {
        const dialog = store.dialogs.find(d => d.id === store.activeChatId)
        return dialog?.partner.name || 'Чат'
      }
      return ''
    })

    onMounted(async () => {
      // Initialize Matrix
      if (authStore.isUserAuthenticated) {
        await store.initMatrix()
      }
    })

    const handleLoadMore = () => {
      console.error('[MessengerPanel] handleLoadMore triggered. Active chat:', store.activeChatId)
      if (store.activeChatId) {
        store.loadMoreMessages(store.activeChatId)
      }
    }

    return {
      store,
      activeChatName,
      handleLoadMore
    }
  }
})
