<template>
  <SC_MessengerContainer>
    <SC_SidebarColumn :is-hidden="!!activeChatId || !!(lastTargetAddress && inviteViewActive)">
      <SC_SidebarHeader>
        <span>{{ t('messenger.messages') }}</span>
        <slot name="header-actions" />
      </SC_SidebarHeader>
      <SC_SyncErrorBanner v-if="store.syncError">
        {{ store.syncError }}
      </SC_SyncErrorBanner>
      <SC_SyncStatusBanner
        v-else-if="store.syncState !== 'PREPARED' && store.syncState !== 'SYNCING'"
      >
        Status: {{ store.syncState }}
      </SC_SyncStatusBanner>
      <SC_MessengerDialogsLoader v-if="!store.dialogsLoadedOnce || store.isLoading">
        <SC_MessengerDialogsSpinner />
        <SC_MessengerDialogsLoaderText>{{ t('messenger.loadingDialogs') }}</SC_MessengerDialogsLoaderText>
      </SC_MessengerDialogsLoader>
      <ChatList v-else :dialogs="store.dialogs" @select="store.openChat" />
    </SC_SidebarColumn>

    <SC_ChatColumn :is-active="!!activeChatId || !!(lastTargetAddress && inviteViewActive)">
      <template v-if="activeChatId">
        <SC_ChatTopBar>
          <SC_MobileBackButton
            @click="store.closeActiveChat ? store.closeActiveChat() : (store.activeChatId = null)"
          >
            <img :src="arrowBackIcon" alt="" width="24" height="24" />
          </SC_MobileBackButton>
          <SC_PartnerName>{{ activeChatName }}</SC_PartnerName>
        </SC_ChatTopBar>
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
        <SC_ChatTopBar>
          <SC_MobileBackButton @click="store.clearInviteTarget">
            <img :src="arrowBackIcon" alt="" width="24" height="24" />
          </SC_MobileBackButton>
          <SC_PartnerName>{{ invitePartnerName }}</SC_PartnerName>
        </SC_ChatTopBar>
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
        <div>{{ t('messenger.selectChatHint') }}</div>
      </SC_EmptyState>
    </SC_ChatColumn>
  </SC_MessengerContainer>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useMessengerStore } from '../../store'
import { useAuthStore } from '@/blockchain'
import ChatList from '../chat-list/chat-list.vue'
import ChatRoom from '../chat-room/chat-room.vue'
import {
  SC_MessengerContainer,
  SC_SidebarColumn,
  SC_ChatColumn,
  SC_ChatTopBar,
  SC_EmptyState,
  SC_MobileBackButton,
  SC_MessengerDialogsLoader,
  SC_MessengerDialogsLoaderText,
  SC_MessengerDialogsSpinner,
  SC_PartnerName,
  SC_SidebarHeader,
  SC_SyncErrorBanner,
  SC_SyncStatusBanner,
} from './styled'
import arrowBackIcon from './img/arrow-back.svg'
import chatEmptyIcon from './img/chat-empty.svg'

const store = useMessengerStore()
const { activeChatId, lastTargetAddress, inviteViewActive } = storeToRefs(store)
const authStore = useAuthStore()
const { t } = useI18n()

const activeChatName = computed<string>(() => {
  if (activeChatId.value) {
    const dialog = store.dialogs.find((d) => d.id === activeChatId.value)
    return dialog?.partner.name || t('messenger.chat')
  }
  return ''
})

const invitePartnerName = computed<string>(() => {
  const addr = lastTargetAddress.value
  if (!addr) return t('messenger.newChat')
  const profile = store.userProfiles[addr]
  return profile?.name || addr || t('messenger.newChat')
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
