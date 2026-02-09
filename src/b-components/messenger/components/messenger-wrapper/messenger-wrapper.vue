<template>
  <!-- Full Screen Overlay Mode -->
  <SC_FullScreenOverlay v-if="store.isFullScreen">
    <SC_OverlayContent>
      <MessengerPanel />
    </SC_OverlayContent>
  </SC_FullScreenOverlay>

  <!-- Floating Widget Mode -->
  <SC_MessengerWrapper v-if="isVisible && !store.isFullScreen">
    <MessengerWindow :is-open="store.isOpen" :title="widgetTitle" @close="closeWidget">
      <template #actions>
        <SC_BackButton v-if="activeChatId || (lastTargetAddress && inviteViewActive)" @click="onWidgetBack">
          <img :src="icons.back" style="filter: brightness(0) invert(1);" />
        </SC_BackButton>
      </template>

      <SC_MessengerWrapperLoader v-if="(!store.dialogsLoadedOnce || store.isLoading) && !activeChatId && !(lastTargetAddress && inviteViewActive)">
        <SC_MessengerWrapperSpinner />
        <SC_MessengerWrapperLoaderText>Загрузка диалогов...</SC_MessengerWrapperLoaderText>
      </SC_MessengerWrapperLoader>

      <ChatRoom
        v-else-if="activeChatId"
        :key="activeChatId"
        :messages="store.activeMessages"
        :invite-mode="false"
        :is-loading="store.isMessagesLoading"
        @send="(text) => store.sendMessage(activeChatId, text)"
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

      <ChatList
        v-else
        :dialogs="store.dialogs"
        @select="store.openChat"
      />
    </MessengerWindow>

    <MessengerButton
      :unread-count="store.totalUnreadCount"
      :is-open="store.isOpen"
      @click="store.toggleMessenger"
    >
      <template #icon>
        <img v-if="!store.isOpen" :src="icons.chat" style="filter: brightness(0) invert(1);" />
        <img v-else :src="icons.close" style="filter: brightness(0) invert(1);" />
      </template>
    </MessengerButton>
  </SC_MessengerWrapper>
</template>

<script lang="ts">
import { messengerWrapperOptions } from './messenger-wrapper'

export default messengerWrapperOptions
</script>
