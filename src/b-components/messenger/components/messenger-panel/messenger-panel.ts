import { defineComponent, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'

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
    const { activeChatId, lastTargetAddress, inviteViewActive } = storeToRefs(store)
    const authStore = useAuthStore()

    const activeChatName = computed(() => {
      if (activeChatId.value) {
        const dialog = store.dialogs.find(d => d.id === activeChatId.value)
        return dialog?.partner.name || 'Чат'
      }
      return ''
    })

    const invitePartnerName = computed(() => {
      const addr = lastTargetAddress.value
      if (!addr) return 'Новый чат'
      const profile = store.userProfiles[addr]
      return profile?.name || addr || 'Новый чат'
    })

    onMounted(async () => {
      // Initialize Matrix
      if (authStore.isUserAuthenticated) {
        await store.initMatrix()
      }
    })

    const handleLoadMore = () => {
      if (activeChatId.value) {
        store.loadMoreMessages(activeChatId.value)
      }
    }

    const onChatStarted = (roomId: string) => {
      store.switchToChatAndLoad(roomId)
    }

    return {
      store,
      activeChatId,
      lastTargetAddress,
      inviteViewActive,
      activeChatName,
      invitePartnerName,
      handleLoadMore,
      onChatStarted
    }
  }
})
