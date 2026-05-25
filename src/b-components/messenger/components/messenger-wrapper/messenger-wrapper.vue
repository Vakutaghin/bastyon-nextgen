<template>
  <!-- Full Screen Overlay Mode -->
  <SC_FullScreenOverlay v-if="isFullScreen">
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
          <img :src="icons.back" style="filter: brightness(0) invert(1)" />
        </SC_BackButton>
      </template>

      <SC_MessengerWrapperLoader
        v-if="
          (!dialogsLoadedOnce || isLoading) &&
          !activeChatId &&
          !(lastTargetAddress && inviteViewActive)
        "
      >
        <SC_MessengerWrapperSpinner />
        <SC_MessengerWrapperLoaderText>Загрузка диалогов...</SC_MessengerWrapperLoaderText>
      </SC_MessengerWrapperLoader>

      <ChatRoom
        v-else-if="activeChatId"
        :key="activeChatId"
        :messages="activeMessages"
        :invite-mode="false"
        :is-loading="isMessagesLoading"
        @send="handleSendMessage"
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

      <ChatList v-else :dialogs="dialogs" @select="openChat" />
    </MessengerWindow>

    <MessengerButton :unread-count="totalUnreadCount" :is-open="isOpen" @click="toggleMessenger">
      <template #icon>
        <img v-if="!isOpen" :src="icons.chat" style="filter: brightness(0) invert(1)" />
        <img v-else :src="icons.close" style="filter: brightness(0) invert(1)" />
      </template>
    </MessengerButton>
  </SC_MessengerWrapper>
</template>

<script lang="ts">
import { messengerWrapperOptions } from './messenger-wrapper'

export default messengerWrapperOptions
</script>
