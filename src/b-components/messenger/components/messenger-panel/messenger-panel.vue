<template>
  <SC_MessengerContainer>
    <SC_SidebarColumn :is-hidden="!!activeChatId || !!(lastTargetAddress && inviteViewActive)">
      <div
        style="
          padding: 16px;
          border-bottom: 1px solid #eee;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: space-between;
        "
      >
        <span>Сообщения</span>
        <slot name="header-actions" />
      </div>
      <div
        v-if="store.syncError"
        style="padding: 8px; background: #ffebee; color: #c62828; font-size: 12px"
      >
        {{ store.syncError }}
      </div>
      <div
        v-else-if="store.syncState !== 'PREPARED' && store.syncState !== 'SYNCING'"
        style="padding: 8px; background: #e3f2fd; color: #1565c0; font-size: 12px"
      >
        Status: {{ store.syncState }}
      </div>
      <SC_MessengerDialogsLoader v-if="!store.dialogsLoadedOnce || store.isLoading">
        <SC_MessengerDialogsSpinner />
        <SC_MessengerDialogsLoaderText>Загрузка диалогов...</SC_MessengerDialogsLoaderText>
      </SC_MessengerDialogsLoader>
      <ChatList v-else :dialogs="store.dialogs" @select="store.openChat" />
    </SC_SidebarColumn>

    <SC_ChatColumn :is-active="!!activeChatId || !!(lastTargetAddress && inviteViewActive)">
      <template v-if="activeChatId">
        <div
          style="
            height: 56px;
            border-bottom: 1px solid #eee;
            display: flex;
            align-items: center;
            padding: 0 16px;
          "
        >
          <SC_MobileBackButton
            @click="store.closeActiveChat ? store.closeActiveChat() : (store.activeChatId = null)"
          >
            <img :src="arrowBackIcon" alt="" width="24" height="24" />
          </SC_MobileBackButton>
          <span style="font-weight: 600">{{ activeChatName }}</span>
        </div>
        <ChatRoom
          :key="activeChatId"
          :messages="store.activeMessages"
          :invite-mode="false"
          :is-loading="store.isMessagesLoading"
          @send="(text) => store.sendMessage(activeChatId, text)"
          @load-more="handleLoadMore"
        />
      </template>
      <template v-else-if="lastTargetAddress && inviteViewActive">
        <div
          style="
            height: 56px;
            border-bottom: 1px solid #eee;
            display: flex;
            align-items: center;
            padding: 0 16px;
          "
        >
          <SC_MobileBackButton @click="store.clearInviteTarget">
            <img :src="arrowBackIcon" alt="" width="24" height="24" />
          </SC_MobileBackButton>
          <span style="font-weight: 600">{{ invitePartnerName }}</span>
        </div>
        <ChatRoom
          :messages="[]"
          :invite-mode="true"
          :is-loading="false"
          @send="() => {}"
          @load-more="() => {}"
          @open-chat="onChatStarted"
        />
      </template>
      <SC_EmptyState v-else>
        <img :src="chatEmptyIcon" alt="" width="24" height="24" />
        <div>Выберите чат, чтобы начать общение</div>
      </SC_EmptyState>
    </SC_ChatColumn>
  </SC_MessengerContainer>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
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
  SC_MobileBackButton,
  SC_MessengerDialogsLoader,
  SC_MessengerDialogsLoaderText,
  SC_MessengerDialogsSpinner,
} from './styled'
import arrowBackIcon from './img/arrow-back.svg'
import chatEmptyIcon from './img/chat-empty.svg'

const store = useMessengerStore()
const { activeChatId, lastTargetAddress, inviteViewActive } = storeToRefs(store)
const authStore = useAuthStore()

const activeChatName = computed<string>(() => {
  if (activeChatId.value) {
    const dialog = store.dialogs.find((d) => d.id === activeChatId.value)
    return dialog?.partner.name || 'Чат'
  }
  return ''
})

const invitePartnerName = computed<string>(() => {
  const addr = lastTargetAddress.value
  if (!addr) return 'Новый чат'
  const profile = store.userProfiles[addr]
  return profile?.name || addr || 'Новый чат'
})

onMounted(async () => {
  if (authStore.isUserAuthenticated) {
    await store.initMatrix()
  }
})

function handleLoadMore(): void {
  if (activeChatId.value) {
    store.loadMoreMessages(activeChatId.value)
  }
}

function onChatStarted(roomId: string): void {
  store.switchToChatAndLoad(roomId)
}
</script>
