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
import { computed, nextTick, ref, watch, watchEffect } from 'vue'
import { debugLog } from '@/helpers/common/debug-log'
import type { Message } from '../../types'
import MessageList from '../message-list/message-list.vue'
import EmojiPicker from '../emoji-picker/emoji-picker.vue'
import AttachmentPanel from '../attachment-panel/attachment-panel.vue'
import PkoinTransferModal from '../pkoin-transfer-modal/pkoin-transfer-modal.vue'
import { useMessengerStore } from '../../store'
import { formatDuration } from '../../helpers'
import { usePasteDrop } from './use-paste-drop'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
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

const inputValue = ref('')
const inputRef = ref<{ $el?: HTMLTextAreaElement } | null>(null)
const showEmojiPicker = ref(false)

const isInitiated = ref<boolean>(props.messages && props.messages.length > 0 ? true : false)
const partnerName = ref<string>('')
const partnerAvatar = ref<string | null>(null)
const avatarLoadFailed = ref(false)
const reputation = ref<string>('0.0')
const subscribersCount = ref<number>(0)
const subscribesCount = ref<number>(0)

const isRecording = ref(false)
const isLocked = ref(false)
const isCancelling = ref(false)
const recordingDuration = ref('00:00')
const recordingTimer = ref<ReturnType<typeof setInterval> | null>(null)
const mediaRecorder = ref<MediaRecorder | null>(null)
const recordedChunks: BlobPart[] = []
const recordStartAt = ref<number>(0)
const touchStartX = ref(0)
const touchStartY = ref(0)

const preferredTypes = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/aac',
]

function adjustHeight(): void {
  const el = inputRef.value?.$el
  if (el) {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 2 + 'px'
  }
}

function handleSend(): void {
  if (inputValue.value.trim()) {
    emit('send', inputValue.value.trim())
    inputValue.value = ''
    showEmojiPicker.value = false
    nextTick(adjustHeight)
  }
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function handleInput(): void {
  adjustHeight()
}

function toggleEmojiPicker(): void {
  showEmojiPicker.value = !showEmojiPicker.value
}

function onEmojiSelect(emoji: string): void {
  // Вставляем эмодзи в позицию курсора (или в конец, если нет input ref).
  const el = inputRef.value?.$el
  if (el) {
    const start = el.selectionStart
    const end = el.selectionEnd
    const text = inputValue.value
    inputValue.value = text.substring(0, start) + emoji + text.substring(end)

    nextTick(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = start + emoji.length
      adjustHeight()
    })
  } else {
    inputValue.value += emoji
    adjustHeight()
  }
}

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
  nextTick(() => {
    const el = inputRef.value?.$el
    if (el) {
      el.focus()
      adjustHeight()
    }
  })
}

function hexToAddress(hex: string): string {
  if (!hex || hex.length % 2 !== 0) return ''
  let result = ''
  for (let i = 0; i < hex.length; i += 2) {
    const chHex = hex.substring(i, i + 2)
    if (!/^[0-9a-fA-F]{2}$/.test(chHex)) return ''
    let charCode = parseInt(chHex, 16)
    if (charCode >= 0x80) charCode += 0x350
    result += String.fromCharCode(charCode)
  }
  return result
}

// Тонкая обёртка над `resolveImageUrl`: chat-room принимает уже извлечённый
// хэш/URL, а не объект профиля целиком — поэтому используем именно нормализатор.
function getAvatarUrlFromProfile(imageHash?: string): string | undefined {
  return imageHash ? resolveImageUrl(imageHash) : undefined
}

async function updatePartnerInfo(): Promise<void> {
  let address: string | null = null
  const d = store.activeDialog
  const isInviteMode = !d

  if (d) {
    partnerName.value = d.partner?.name || 'Чат'
    partnerAvatar.value = d.partner?.avatar || null
    avatarLoadFailed.value = false
    const id = d.partner?.id
    if (typeof id === 'string' && id.startsWith('@') && id.includes(':')) {
      const parts = id.split(':')
      const userId = parts[0]!.substring(1)
      const looksHex = /^[0-9a-fA-F]+$/.test(userId) && userId.length % 2 === 0
      address = looksHex ? hexToAddress(userId) : userId
    }
  }
  if (!address) address = store.lastTargetAddress ?? null
  if (!address) return

  const cached = store.userProfiles[address]
  if (!cached) await store.fetchProfiles([address])
  const profile = store.userProfiles[address]
  if (!profile) return

  const r: unknown = profile.reputation ?? 0
  const num = typeof r === 'number' ? r : Number(r || 0)
  reputation.value = num.toFixed(1)
  subscribersCount.value = profile.subscribers_count || 0
  subscribesCount.value = profile.subscribes_count || 0

  // В режиме приглашения всегда обновляем имя и аватар из профиля по
  // текущему lastTargetAddress — иначе при смене собеседника без выхода
  // через «Назад» остаются старые значения.
  const profileAny = profile as { i?: string; avatar?: string; image?: string; name?: string }
  if (isInviteMode) {
    partnerName.value = profile.name || address || 'Новый чат'
    const img = profileAny.i || profileAny.avatar || profileAny.image
    partnerAvatar.value = img ? getAvatarUrlFromProfile(img) || null : null
    avatarLoadFailed.value = false
  } else {
    if (!partnerAvatar.value) {
      const img = profileAny.i || profileAny.avatar || profileAny.image
      const url = getAvatarUrlFromProfile(img)
      if (url) {
        partnerAvatar.value = url
        avatarLoadFailed.value = false
      }
    }
    if (!partnerName.value && profile.name) {
      partnerName.value = profile.name
    }
  }
}

function onAvatarError(): void {
  avatarLoadFailed.value = true
}

const partnerInitial = computed<string>(() => {
  const name = partnerName.value
  return name ? name[0]!.toUpperCase() : 'U'
})

watch(
  () => store.activeDialog?.id ?? null,
  () => {
    updatePartnerInfo()
  },
  { immediate: true }
)

watch(
  () => store.userProfiles,
  () => {
    updatePartnerInfo()
  },
  { deep: true }
)

watchEffect(() => {
  // Реагируем на смену активного диалога, профилей и lastTargetAddress
  // (смена собеседника в режиме приглашения).
  void store.activeDialog
  void store.userProfiles
  void store.lastTargetAddress
  updatePartnerInfo()
})

function getSupportedType(): string | undefined {
  const tmpEl = document.createElement('audio')
  for (const t of preferredTypes) {
    const mrSupported = (
      window as Window & { MediaRecorder?: typeof MediaRecorder }
    ).MediaRecorder?.isTypeSupported?.(t)
    const audioCanPlay = tmpEl.canPlayType(t.split(';')[0]!)
    if (mrSupported || audioCanPlay) return t
  }
  return undefined
}

async function startRecording(e?: MouseEvent | TouchEvent): Promise<void> {
  if (isRecording.value) return

  isLocked.value = false
  isCancelling.value = false
  recordingDuration.value = '00:00'
  recordedChunks.length = 0

  if (e && 'touches' in e && e.touches.length > 0) {
    touchStartX.value = e.touches[0]!.clientX
    touchStartY.value = e.touches[0]!.clientY
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const type = getSupportedType()
    const options: MediaRecorderOptions | undefined = type ? { mimeType: type } : undefined
    const mr = new MediaRecorder(stream, options)
    mediaRecorder.value = mr

    mr.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) recordedChunks.push(e.data)
    }
    mr.onstop = async () => {
      isRecording.value = false
      if (recordingTimer.value) clearInterval(recordingTimer.value)

      if (isCancelling.value) {
        // Освобождаем устройство, но запись не отправляем.
        try {
          stream.getTracks().forEach((t) => t.stop())
        } catch {
          /* ignore */
        }
        return
      }

      const blob = new Blob(recordedChunks, {
        type: options?.mimeType || 'audio/webm',
      })
      const duration = (Date.now() - recordStartAt.value) / 1000
      if (store.activeChatId) {
        await store.sendAudio(store.activeChatId, blob, { duration, name: 'voice-message' })
      }
      try {
        stream.getTracks().forEach((t) => t.stop())
      } catch {
        /* ignore */
      }
    }
    recordStartAt.value = Date.now()
    isRecording.value = true

    recordingTimer.value = setInterval(() => {
      const diff = (Date.now() - recordStartAt.value) / 1000
      recordingDuration.value = formatDuration(diff)
    }, 100)

    mr.start()
  } catch (e) {
    console.error('[ChatRoom] Failed to start recording:', e)
  }
}

function cancelRecording(): void {
  isCancelling.value = true
  mediaRecorder.value?.stop()
  isLocked.value = false
}

function stopRecording(): void {
  if (isRecording.value) mediaRecorder.value?.stop()
  isLocked.value = false
}

function handleTouchMove(e: TouchEvent): void {
  if (!isRecording.value || isLocked.value) return

  const touch = e.touches[0]
  if (!touch) return
  const diffX = touch.clientX - touchStartX.value
  const diffY = touch.clientY - touchStartY.value

  // Свайп вверх → залочить запись (порог -50px).
  if (diffY < -50) isLocked.value = true

  // Свайп влево → отменить (порог -50px).
  if (diffX < -50) cancelRecording()
}

function handleTouchEnd(): void {
  if (isLocked.value) return
  stopRecording()
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
