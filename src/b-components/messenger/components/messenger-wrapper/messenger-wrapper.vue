<template>
  <!-- Full Screen Overlay Mode -->
  <SC_FullScreenOverlay v-if="store.isFullScreen">
    <SC_OverlayContent>
      <MessengerPanel />
    </SC_OverlayContent>
  </SC_FullScreenOverlay>

  <!-- Floating Widget Mode -->
  <SC_MessengerWrapper v-if="isVisible && !store.isFullScreen">
    <MessengerWindow :is-open="store.isOpen" :title="title" @close="closeWidget">
      <template #actions>
        <SC_BackButton v-if="store.activeChatId" @click="store.activeChatId = null">
          <img :src="icons.back" style="filter: brightness(0) invert(1);" />
        </SC_BackButton>
      </template>

      <div v-if="store.isLoading && !store.activeChatId" style="padding: 20px; text-align: center; color: #888;">
        Загрузка...
      </div>

      <ChatList
        v-else-if="!store.activeChatId"
        :dialogs="store.dialogs"
        @select="store.openChat"
      />

      <ChatRoom
        v-else
        :messages="store.activeMessages"
        @send="(text) => store.sendMessage(store.activeChatId, text)"
        @load-more="handleLoadMore"
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
