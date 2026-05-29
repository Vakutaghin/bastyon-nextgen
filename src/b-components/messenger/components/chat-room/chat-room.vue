<template>
  <div style="display: flex; flex-direction: column; flex: 1; min-height: 0">
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

        <SC_UserStats style="justify-content: center; gap: 16px">
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

      <MessageList :messages="messages" @load-more="emit('load-more')" />
    </template>

    <SC_MessageInputArea ref="inputAreaRef" :style="isDragging ? DRAG_STYLE : undefined">
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
        <EmojiPicker v-if="showEmojiPicker" @select="onEmojiSelect" />

        <AttachmentPanel
          :can-send-pkoin="canSendPkoin"
          @pick-files="handlePickFiles"
          @pick-pkoin="openPkoinModal"
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

      <!-- VOICE BUTTON (видна при записи или когда input пуст). -->
      <SC_VoiceButton
        v-if="
          (!inviteMode || isInitiated || (messages && messages.length > 0)) &&
          !inputValue.trim() &&
          !isLocked
        "
        :class="{ recording: isRecording }"
        @mousedown.prevent="startRecording"
        @mouseup.prevent="stopRecording"
        @touchstart.prevent="startRecording"
        @touchend.prevent="handleTouchEnd"
        @touchmove.prevent="handleTouchMove"
      >
        <img :src="micIcon" alt="" width="24" height="24" />
      </SC_VoiceButton>

      <!-- TEXT SEND BUTTON (виден когда есть текст и не идёт запись). -->
      <SC_SendButton
        v-if="inputValue.trim() && !isRecording && !isLocked"
        :disabled="!inputValue.trim()"
        @click="handleSend"
      >
        <img :src="sendIcon" alt="" width="24" height="24" />
      </SC_SendButton>
    </SC_MessageInputArea>

    <PkoinTransferModal
      v-if="pkoinPartnerAddress"
      :open="pkoinModalOpen"
      :chat-id="activeChatIdForPkoin"
      :to-address="pkoinPartnerAddress"
      @close="closePkoinModal"
      @sent="onPkoinSent"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { debugLog } from '@/helpers/common/debug-log'
import type { Message } from '../../types'
import MessageList from '../message-list/message-list.vue'
import EmojiPicker from '../emoji-picker/emoji-picker.vue'
import AttachmentPanel from '../attachment-panel/attachment-panel.vue'
import PkoinTransferModal from '../pkoin-transfer-modal/pkoin-transfer-modal.vue'
import { useMessengerStore } from '../../store'
import { usePasteDrop } from './use-paste-drop'
import { useVoiceRecording } from './use-voice-recording'
import { usePartnerInfo } from './use-partner-info'
import { useChatInput } from './use-chat-input'
import sendIcon from './img/send.svg'
import emojiIcon from './img/emoji.svg'
import micIcon from './img/mic.svg'
import {
  SC_MessageInputArea,
  SC_MessageInput,
  SC_SendButton,
  SC_EmojiToggleButton,
  SC_VoiceButton,
  SC_RecordingTimer,
  SC_SwipeHint,
  SC_CancelButton,
  SC_StartChatContainer,
  SC_StartChatButton,
  SC_PartnerHeader,
  SC_PartnerAvatar,
  SC_PartnerName,
  SC_PartnerInfoCard,
  SC_ChatRoomLoader,
  SC_ChatRoomSpinner,
  SC_ChatRoomLoaderText,
  SC_ChatRoomEmptyHint,
} from './styled'
import {
  SC_UserStats,
  SC_StatItem,
  SC_StatLabel,
  SC_StatValue,
} from '@/b-components/profile/profile-sidebar/styled'

// Inline style на dragover — выделение dashed-обводкой. Используется через
// :style биндинг, не плодит регрессию (значение из объекта, не литерал).
const DRAG_STYLE = {
  outline: '2px dashed #00A4DB',
  outlineOffset: '-4px',
  background: 'rgba(0, 164, 219, 0.06)',
}

const props = withDefaults(
  defineProps<{
    messages: Message[]
    /** Режим приглашения: карточка + «Начать чат». Только при открытии из профиля/поста. */
    inviteMode?: boolean
    /** Загрузка сообщений диалога (показываем прелоадер вместо списка). */
    isLoading?: boolean
  }>(),
  { inviteMode: false, isLoading: false }
)

const emit = defineEmits<{
  send: [text: string]
  'load-more': []
  'open-chat': [roomId: string]
}>()

const store = useMessengerStore()

// Карточка собеседника в invite-режиме.
const {
  partnerName,
  partnerAvatar,
  partnerInitial,
  avatarLoadFailed,
  reputation,
  subscribersCount,
  subscribesCount,
  onAvatarError,
} = usePartnerInfo(store)

// Поле ввода + emoji-пикер.
const {
  inputValue,
  inputRef,
  showEmojiPicker,
  handleSend,
  handleKeydown,
  handleInput,
  toggleEmojiPicker,
  onEmojiSelect,
  focusInput,
} = useChatInput({
  onSend: (text) => emit('send', text),
})

// Голосовая запись с touch-жестами.
const {
  isRecording,
  isLocked,
  recordingDuration,
  startRecording,
  cancelRecording,
  stopRecording,
  handleTouchMove,
  handleTouchEnd,
} = useVoiceRecording({
  onAudioRecorded: async (blob, duration) => {
    if (store.activeChatId) {
      await store.sendAudio(store.activeChatId, blob, { duration, name: 'voice-message' })
    }
  },
})

const isInitiated = ref<boolean>(props.messages && props.messages.length > 0)

async function startChatNow(): Promise<void> {
  const address = store.lastTargetAddress
  if (!address) return
  try {
    const roomId = await store.startChatWithAddress(address)
    if (roomId) emit('open-chat', roomId)
  } catch (e) {
    console.error('[ChatRoom] Failed to start chat room:', e)
  }
  isInitiated.value = true
  focusInput()
}

// === Файлы: drag/drop, paste, кнопка-«скрепка». ===
const inputAreaRef = ref<HTMLElement | null>(null)

async function handlePickFiles(files: File[]): Promise<void> {
  if (!store.activeChatId) return
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      await store.sendImage(store.activeChatId, file, { name: file.name })
    } else {
      // Видео и прочие файлы отправляются как m.file — отдельный m.video отключён.
      await store.sendFile(store.activeChatId, file, { name: file.name })
    }
  }
}

const { isDragging, bindToRef } = usePasteDrop({
  onMediaFiles: handlePickFiles,
  onOtherFiles: handlePickFiles,
})
bindToRef(inputAreaRef)

// === PKOIN-донат (только для личных чатов). ===
const activeChatIdForPkoin = computed<string>(() => store.activeChatId || '')
const pkoinPartnerAddress = computed<string | null>(() => {
  if (!store.activeChatId) return null
  return store.getDirectPartnerAddress(store.activeChatId)
})
const canSendPkoin = computed<boolean>(() => !!pkoinPartnerAddress.value)
const pkoinModalOpen = ref(false)

function openPkoinModal(): void {
  pkoinModalOpen.value = true
}
function closePkoinModal(): void {
  pkoinModalOpen.value = false
}
function onPkoinSent(txid: string): void {
  debugLog('[ChatRoom] PKOIN transaction sent:', txid)
}
</script>
