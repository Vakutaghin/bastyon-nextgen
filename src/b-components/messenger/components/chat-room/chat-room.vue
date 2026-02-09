<template>
  <div style="display: flex; flex-direction: column; height: 100%;">
    <template v-if="inviteMode">
      <SC_PartnerInfoCard>
        <SC_PartnerHeader>
          <SC_PartnerAvatar>
            <img
              v-if="partnerAvatar && !avatarLoadFailed"
              :src="partnerAvatar"
              alt=""
              @error="onAvatarError"
            />
            <span v-else class="avatar-fallback">{{ partnerInitial }}</span>
          </SC_PartnerAvatar>
          <SC_PartnerName>{{ partnerName }}</SC_PartnerName>
        </SC_PartnerHeader>

        <SC_UserStats style="justify-content: center; gap: 16px;">
          <SC_StatItem>
            <SC_StatLabel>Репутация</SC_StatLabel>
            <SC_StatValue>{{ reputation }}</SC_StatValue>
          </SC_StatItem>
          <SC_StatItem>
            <SC_StatLabel>Подписчики</SC_StatLabel>
            <SC_StatValue>{{ subscribersCount }}</SC_StatValue>
          </SC_StatItem>
          <SC_StatItem>
            <SC_StatLabel>Подписки</SC_StatLabel>
            <SC_StatValue>{{ subscribesCount }}</SC_StatValue>
          </SC_StatItem>
        </SC_UserStats>
      </SC_PartnerInfoCard>

      <SC_StartChatContainer>
        <SC_StartChatButton @click="startChatNow">Начать чат</SC_StartChatButton>
      </SC_StartChatContainer>
    </template>
    <template v-else-if="isLoading">
      <SC_ChatRoomLoader>
        <SC_ChatRoomSpinner />
        <SC_ChatRoomLoaderText>Загрузка сообщений...</SC_ChatRoomLoaderText>
      </SC_ChatRoomLoader>
    </template>
    <template v-else>
      <SC_ChatRoomEmptyHint v-if="!messages || messages.length === 0">
        Пока сообщений нет. Вы можете написать первое.
      </SC_ChatRoomEmptyHint>
      <MessageList :messages="messages" @load-more="() => { console.error('[ChatRoom] load-more triggered (emitting)'); $emit('load-more') }" />
    </template>

    <SC_MessageInputArea>
      <!-- RECORDING STATE -->
      <template v-if="isRecording || isLocked">
        <SC_RecordingTimer>{{ recordingDuration }}</SC_RecordingTimer>

        <template v-if="isLocked">
           <SC_CancelButton @click="cancelRecording">Отмена</SC_CancelButton>
           <SC_SendButton @click="stopRecording">
             <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
           </SC_SendButton>
        </template>

        <template v-else>
           <SC_SwipeHint>
             <span>&lt; Влево - отмена, Вверх - замок</span>
           </SC_SwipeHint>
        </template>
      </template>

      <!-- NORMAL STATE -->
      <template v-else-if="!inviteMode || isInitiated || (messages && messages.length > 0)">
        <EmojiPicker
          v-if="showEmojiPicker"
          @select="onEmojiSelect"
        />

        <SC_MessageInput
          ref="inputRef"
          v-model="inputValue"
          placeholder="Введите сообщение..."
          rows="1"
          @keydown="handleKeydown"
          @input="handleInput"
        />
        <SC_EmojiToggleButton @click="toggleEmojiPicker">
          <svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>
        </SC_EmojiToggleButton>
      </template>
      <template v-else>
        <!-- hide input until user clicks "Начать чат" -->
      </template>

      <!-- VOICE BUTTON (Visible when recording but not locked, or when input empty) -->
      <SC_VoiceButton
        v-if="(!inviteMode || isInitiated || (messages && messages.length > 0)) && (!inputValue.trim() && !isLocked)"
        :class="{ recording: isRecording }"
        @mousedown.prevent="startRecording"
        @mouseup.prevent="stopRecording"
        @touchstart.prevent="startRecording"
        @touchend.prevent="handleTouchEnd"
        @touchmove.prevent="handleTouchMove"
      >
        <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 3-2.69 5.1-5 5.1S7 14 7 11H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
      </SC_VoiceButton>

      <!-- TEXT SEND BUTTON (Visible when text exists and not recording) -->
      <SC_SendButton
        v-if="inputValue.trim() && !isRecording && !isLocked"
        @click="handleSend"
        :disabled="!inputValue.trim()"
      >
        <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </SC_SendButton>
    </SC_MessageInputArea>
  </div>
</template>

<script lang="ts">
import { chatRoomOptions } from './chat-room'

export default chatRoomOptions
</script>
