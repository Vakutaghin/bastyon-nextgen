<template>
  <div style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
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

      <MessageList
        :messages="messages"
        @load-more="() => $emit('load-more')" />
    </template>

    <SC_MessageInputArea>
      <!-- RECORDING STATE -->
      <template v-if="isRecording || isLocked">
        <SC_RecordingTimer>{{ recordingDuration }}</SC_RecordingTimer>

        <template v-if="isLocked">
           <SC_CancelButton @click="cancelRecording">Отмена</SC_CancelButton>

           <SC_SendButton @click="stopRecording">
             <img :src="sendIcon" alt="" width="24" height="24" />
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
          <img :src="emojiIcon" alt="" width="24" height="24" />
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
        <img :src="micIcon" alt="" width="24" height="24" />
      </SC_VoiceButton>

      <!-- TEXT SEND BUTTON (Visible when text exists and not recording) -->
      <SC_SendButton
        v-if="inputValue.trim() && !isRecording && !isLocked"
        @click="handleSend"
        :disabled="!inputValue.trim()"
      >
        <img :src="sendIcon" alt="" width="24" height="24" />
      </SC_SendButton>
    </SC_MessageInputArea>
  </div>
</template>

<script lang="ts">
import { chatRoomOptions } from './chat-room'
import sendIcon from './img/send.svg'
import emojiIcon from './img/emoji.svg'
import micIcon from './img/mic.svg'

export default {
  ...chatRoomOptions,
  data () {
    return { sendIcon, emojiIcon, micIcon }
  },
}
</script>
