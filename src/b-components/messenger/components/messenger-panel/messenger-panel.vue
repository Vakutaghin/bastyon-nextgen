<template>
  <SC_MessengerContainer>
    <SC_SidebarColumn :is-hidden="!!activeChatId || !!(lastTargetAddress && inviteViewActive)">
      <SC_SidebarHeader>
        <SC_SidebarTitle>
          <span>{{ t('messenger.messages') }}</span>
          <MessengerActivity scope="list" />
        </SC_SidebarTitle>
        <ChatScreenToggle />
        <ChatSearchToggle />
        <slot name="header-actions" />
      </SC_SidebarHeader>
      <SyncErrorBanner />
      <SC_MessengerDialogsLoader v-if="store.isDialogsLoading">
        <SC_MessengerDialogsSpinner />
        <SC_MessengerDialogsLoaderText>{{
          t('messenger.loadingDialogs')
        }}</SC_MessengerDialogsLoaderText>
      </SC_MessengerDialogsLoader>
      <ChatList v-else :dialogs="store.dialogs" @select="store.openChat" />
    </SC_SidebarColumn>

    <SC_ChatColumn :is-active="!!activeChatId || !!(lastTargetAddress && inviteViewActive)">
      <template v-if="activeChatId">
        <SC_ChatTopBar>
          <SC_MobileBackButton
            :aria-label="t('chat.back')"
            @click="store.closeActiveChat ? store.closeActiveChat() : (store.activeChatId = null)"
          >
            <ArrowLeftIcon />
          </SC_MobileBackButton>
          <ChatPartnerTitle v-if="shownPartner" :partner="shownPartner">
            <MessengerActivity v-if="isMatrixChat" scope="chat" />
          </ChatPartnerTitle>
        </SC_ChatTopBar>
        <ChannelRoom
          v-if="channelAddressOf(activeChatId)"
          :key="activeChatId"
          :address="channelAddressOf(activeChatId)!"
        />
        <MeshChatRoom
          v-else-if="isMeshDialogId(activeChatId)"
          :key="activeChatId"
          :dialog-id="activeChatId"
        />
        <ChatRoom
          v-else
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
          <SC_MobileBackButton :aria-label="t('chat.back')" @click="store.clearInviteTarget">
            <ArrowLeftIcon />
          </SC_MobileBackButton>
          <ChatPartnerTitle v-if="shownPartner" :partner="shownPartner" />
        </SC_ChatTopBar>
        <ChatRoom :messages="[]" :invite-mode="true" :is-loading="false" />
      </template>
      <SC_EmptyState v-else>
        <MessagesIcon />
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
import ChatSearchToggle from '../chat-list/chat-search-toggle.vue'
import ChatScreenToggle from '../chat-list/chat-screen-toggle.vue'
import ChatRoom from '../chat-room/chat-room.vue'
import MeshChatRoom from '../mesh-chat-room/mesh-chat-room.vue'
import ChannelRoom from '../channel-room/channel-room.vue'
import SyncErrorBanner from '../sync-error-banner/sync-error-banner.vue'
import { channelAddressOf } from '../../lib/channels'
import ChatPartnerTitle from '../chat-partner-title/chat-partner-title.vue'
import MessengerActivity from '../messenger-activity/messenger-activity.vue'
import { useShownPartner } from '../chat-partner-title/use-shown-partner'
import { isMeshDialogId } from '@/mesh/ids'
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
  SC_SidebarHeader,
  SC_SidebarTitle,
} from './styled'
import { ArrowLeftIcon, MessagesIcon } from '@/components/icons'

const store = useMessengerStore()
const { activeChatId, lastTargetAddress, inviteViewActive } = storeToRefs(store)
const authStore = useAuthStore()
const { t } = useI18n()

/** Значок «догружается» в шапке чата — у чатов Matrix: каналу и радио сервер чатов не нужен. */
const isMatrixChat = computed<boolean>(() => {
  const id = activeChatId.value
  return !!id && !channelAddressOf(id) && !isMeshDialogId(id)
})

/** Собеседник в шапке чата: аватар и имя ведут в его профиль. */
const shownPartner = useShownPartner()

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
</script>
