<template>
  <SC_MessengerContainer>
    <SC_SidebarColumn :isHidden="!!activeChatId || !!(lastTargetAddress && inviteViewActive)">
      <div style="padding: 16px; border-bottom: 1px solid #eee; font-weight: bold; display: flex; align-items: center; justify-content: space-between;">
        <span>Сообщения</span>
        <slot name="header-actions" />
      </div>
      <div v-if="store.syncError" style="padding: 8px; background: #ffebee; color: #c62828; font-size: 12px;">
        {{ store.syncError }}
      </div>
      <div v-else-if="store.syncState !== 'PREPARED' && store.syncState !== 'SYNCING'" style="padding: 8px; background: #e3f2fd; color: #1565c0; font-size: 12px;">
        Status: {{ store.syncState }}
      </div>
      <SC_MessengerDialogsLoader v-if="!store.dialogsLoadedOnce || store.isLoading">
        <SC_MessengerDialogsSpinner />
        <SC_MessengerDialogsLoaderText>Загрузка диалогов...</SC_MessengerDialogsLoaderText>
      </SC_MessengerDialogsLoader>
      <ChatList
        v-else
        :dialogs="store.dialogs"
        @select="store.openChat"
      />
    </SC_SidebarColumn>

    <SC_ChatColumn :isActive="!!activeChatId || !!(lastTargetAddress && inviteViewActive)">
      <template v-if="activeChatId">
        <div style="height: 56px; border-bottom: 1px solid #eee; display: flex; align-items: center; padding: 0 16px;">
          <SC_MobileBackButton @click="store.closeActiveChat ? store.closeActiveChat() : (store.activeChatId = null)">
            <img :src="arrowBackIcon" alt="" width="24" height="24" />
          </SC_MobileBackButton>
          <span style="font-weight: 600;">{{ activeChatName }}</span>
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
        <div style="height: 56px; border-bottom: 1px solid #eee; display: flex; align-items: center; padding: 0 16px;">
          <SC_MobileBackButton @click="store.clearInviteTarget">
            <img :src="arrowBackIcon" alt="" width="24" height="24" />
          </SC_MobileBackButton>
          <span style="font-weight: 600;">{{ invitePartnerName }}</span>
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

<script lang="ts">
import { messengerPanelOptions } from './messenger-panel'
import {
  SC_MessengerDialogsLoader,
  SC_MessengerDialogsLoaderText,
  SC_MessengerDialogsSpinner,
} from './styled'
import arrowBackIcon from './img/arrow-back.svg'
import chatEmptyIcon from './img/chat-empty.svg'

export default {
  ...messengerPanelOptions,
  components: {
    ...messengerPanelOptions.components,
    SC_MessengerDialogsLoader,
    SC_MessengerDialogsLoaderText,
    SC_MessengerDialogsSpinner,
  },
  data () {
    return { arrowBackIcon, chatEmptyIcon }
  },
}
</script>
