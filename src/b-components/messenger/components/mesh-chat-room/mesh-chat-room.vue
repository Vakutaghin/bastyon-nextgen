<template>
  <SC_ChatRoomContainer>
    <SC_MeshInfoBar>
      <SC_MeshInfoIcon><RadioTowerIcon /></SC_MeshInfoIcon>
      <SC_MeshInfoText>
        {{ networkName }} ·
        <SC_MeshOpenWarning v-if="isOpenChannel">{{ securityText }}</SC_MeshOpenWarning>
        <template v-else>{{ securityText }}</template>
      </SC_MeshInfoText>
      <SC_MeshRadioState v-if="!canSend">
        {{ radioStateText }}
        <SC_MeshConnectButton type="button" @click="goToMesh">
          {{ t('mesh.chat.connect') }}
        </SC_MeshConnectButton>
      </SC_MeshRadioState>
    </SC_MeshInfoBar>

    <SC_ChatRoomEmptyHint v-if="messages.length === 0">
      {{ t('mesh.chat.emptyHint', { limit }) }}
    </SC_ChatRoomEmptyHint>

    <MessageList :messages="messages" @reply="onReplyTo" />

    <SC_ReplyBanner v-if="replyingTo">
      <SC_ReplyBannerBar />
      <SC_ReplyBannerBody>
        <SC_ReplyBannerTitle>
          {{ t('messenger.replyingTo') }} {{ replyPreviewName }}
        </SC_ReplyBannerTitle>
        <SC_ReplyBannerText>{{ replyPreviewText }}</SC_ReplyBannerText>
      </SC_ReplyBannerBody>
      <SC_ReplyBannerClose type="button" :aria-label="t('messenger.cancel')" @click="cancelReply">
        ×
      </SC_ReplyBannerClose>
    </SC_ReplyBanner>

    <SC_MessageInputArea>
      <EmojiPicker v-if="showEmojiPicker" @select="onEmojiSelect" />

      <!-- Вложения — только LXMF: у радио-сетей на них нет места в пакете. -->
      <AttachmentPanel
        v-if="network === 'lxmf'"
        :title="t('mesh.chat.attach')"
        @pick-files="sendFiles"
      />
      <SC_EmojiToggleButton
        v-if="network === 'lxmf'"
        type="button"
        :aria-label="t('mesh.chat.paper')"
        :title="t('mesh.chat.paper')"
        :disabled="!canSend || sending"
        @click="sendPaper"
      >
        🧾
      </SC_EmojiToggleButton>
      <SC_EmojiToggleButton
        v-if="network === 'lxmf' && voiceAvailable"
        type="button"
        :aria-label="voiceTitle"
        :title="voiceTitle"
        :disabled="!canSend || sending"
        @click="recording ? stopVoice() : startVoice()"
      >
        {{ recording ? '■' : '🎤' }}
      </SC_EmojiToggleButton>
      <template v-if="recording">
        <SC_ByteCounter :over="false" :blocked="false" aria-live="polite">
          {{ voiceTime }}
        </SC_ByteCounter>
        <SC_EmojiToggleButton
          type="button"
          :aria-label="t('mesh.chat.voiceCancel')"
          :title="t('mesh.chat.voiceCancel')"
          @click="cancelVoice"
        >
          ✕
        </SC_EmojiToggleButton>
      </template>

      <SC_MessageInput
        :ref="setInputRef"
        v-model="inputValue"
        :placeholder="t('mesh.chat.placeholder')"
        rows="1"
        @keydown="onKeydown"
        @input="handleInput"
      />

      <SC_EmojiToggleButton :aria-label="t('messenger.openEmojiPicker')" @click="toggleEmojiPicker">
        <SmileOutlined />
      </SC_EmojiToggleButton>

      <SC_ByteCounter
        v-if="inputValue.trim()"
        :over="parts > 1"
        :blocked="tooLong"
        aria-live="polite"
      >
        {{ counterText }}
      </SC_ByteCounter>

      <SC_SendButton
        :disabled="!canSubmit"
        :aria-label="t('messenger.sendMessage')"
        :title="sendTitle"
        @click="submit"
      >
        <SendOutlined />
      </SC_SendButton>
    </SC_MessageInputArea>

    <PaperMessageDialog v-if="paperUri" :uri="paperUri" @close="paperUri = null" />
  </SC_ChatRoomContainer>
</template>

<script setup lang="ts">
/**
 * Чат через mesh-сети (Meshtastic, MeshCore, Reticulum). Отдельно от
 * ChatRoom: «печатает» и прочтений нет, зато есть предел в байтах и радио
 * (узел), которое может быть не подключено. Вложения, бумажные сообщения и
 * голосовые — только в LXMF.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { RadioTowerIcon, SendOutlined, SmileOutlined } from '@/components/icons'
import { appToast } from '@/b-components/app-toast'
import { parseMeshDialogId } from '@/mesh/ids'
import { useMeshChatStore } from '@/mesh/store/mesh-chat-store'
import { useMeshConnectionStore } from '@/mesh/store/mesh-connection-store'
import { useMeshtasticConnectionStore } from '@/mesh/store/meshtastic-connection-store'
import { useReticulumStore } from '@/mesh/store/reticulum-store'
import { utf8Length } from '@/mesh/bytes'
import { meshAttachments } from '@/mesh/media'
import { splitForMesh } from '@/mesh/text'
import MessageList from '../message-list/message-list.vue'
import AttachmentPanel from '../attachment-panel/attachment-panel.vue'
import PaperMessageDialog from './paper-message-dialog.vue'
import EmojiPicker from '../emoji-picker/emoji-picker.vue'
import { useChatInput } from '../chat-room/use-chat-input'
import { micErrorMessage } from '../chat-room/use-voice-recording'
import { MAX_SECONDS, useMeshVoice, type MeshVoiceError } from './use-mesh-voice'
import type { MeshAttachment } from '@/db/types'
import { useMessengerUiStore } from '../../store/messenger-ui-store'
import type { Message } from '../../types'
import {
  SC_ChatRoomContainer,
  SC_ChatRoomEmptyHint,
  SC_EmojiToggleButton,
  SC_MessageInput,
  SC_MessageInputArea,
  SC_ReplyBanner,
  SC_ReplyBannerBar,
  SC_ReplyBannerBody,
  SC_ReplyBannerClose,
  SC_ReplyBannerText,
  SC_ReplyBannerTitle,
  SC_SendButton,
} from '../chat-room/styled'
import {
  SC_ByteCounter,
  SC_MeshConnectButton,
  SC_MeshInfoBar,
  SC_MeshInfoIcon,
  SC_MeshInfoText,
  SC_MeshOpenWarning,
  SC_MeshRadioState,
} from './styled'

const props = defineProps<{ dialogId: string }>()

const { t, te } = useI18n()
const router = useRouter()
const meshChat = useMeshChatStore()
const meshcore = useMeshConnectionStore()
const meshtastic = useMeshtasticConnectionStore()
const reticulum = useReticulumStore()
const ui = useMessengerUiStore()

const network = computed(() => parseMeshDialogId(props.dialogId)?.network ?? 'meshcore')
const networkName = computed(() => t(`mesh.networks.${network.value}`))
const connection = computed(() => (network.value === 'meshtastic' ? meshtastic : meshcore))

const dialog = computed(() => meshChat.dialogs.find((d) => d.id === props.dialogId) ?? null)
const messages = computed(() => meshChat.messengerMessages(props.dialogId))

const isOpenChannel = computed(
  () => dialog.value?.kind === 'channel' && dialog.value.channelKind !== 'private'
)

/**
 * Честно о защите: и в Meshtastic, и в MeshCore шифрование кончается на радио.
 * ЛС Meshtastic шифруются ключами узлов (X25519), MeshCore — слабее.
 */
const securityText = computed<string>(() => {
  const d = dialog.value
  if (network.value === 'lxmf') return t('mesh.chat.lxmfEncryption')
  if (d?.kind === 'room') return t('mesh.chat.room')
  if (!d || d.kind === 'direct') {
    return network.value === 'meshtastic'
      ? t('mesh.chat.pkiEncryption')
      : t('mesh.chat.deviceEncryption')
  }
  return d.channelKind === 'private' ? t('mesh.chat.privateChannel') : t('mesh.chat.openChannel')
})

const canSend = computed(() => meshChat.canSend(props.dialogId))

const radioStateText = computed<string>(() => {
  if (network.value === 'lxmf') {
    return reticulum.status === 'running'
      ? t('mesh.chat.otherRadio')
      : t('mesh.errors.rns_not_running')
  }
  const status = connection.value.status
  if (status === 'connecting' || status === 'reconnecting') return t(`mesh.status.${status}`)
  if (status !== 'connected') return t('mesh.chat.noRadio')
  if (network.value === 'meshtastic' && meshtastic.regionUnset) return t('mesh.chat.regionUnset')
  return t('mesh.chat.otherRadio')
})

const limit = computed(() => meshChat.textLimit(props.dialogId))

const {
  inputValue,
  inputRef,
  showEmojiPicker,
  handleInput,
  toggleEmojiPicker,
  onEmojiSelect,
  adjustHeight,
  focusInput,
} = useChatInput({ onSend: () => {} })

/** Поле ввода для автовысоты, фокуса и вставки эмодзи. */
function setInputRef(el: unknown): void {
  inputRef.value = el as { $el?: HTMLTextAreaElement } | null
}

const usedBytes = computed(() => utf8Length(inputValue.value.trim()))
const split = computed(() => splitForMesh(inputValue.value, limit.value))
const tooLong = computed(() => split.value === null)
const parts = computed(() => split.value?.length ?? 0)

const counterText = computed<string>(() => {
  if (tooLong.value) return t('mesh.chat.tooLong')
  if (parts.value > 1) return t('mesh.chat.parts', { n: parts.value }, parts.value)
  return t('mesh.chat.bytes', { used: usedBytes.value, limit: limit.value })
})

const sending = ref(false)

// --- Ответ на сообщение (Meshtastic передаёт его по радио) ---
const replyingTo = ref<Message | null>(null)
const replyPreviewName = computed<string>(() => {
  const m = replyingTo.value
  if (!m) return ''
  return m.senderId === 'me' ? t('messenger.you') : m.senderName || t('mesh.chat.unknownSender')
})
const replyPreviewText = computed<string>(() => (replyingTo.value?.text || '').slice(0, 80))

function onReplyTo(message: Message): void {
  replyingTo.value = message
  focusInput()
}

function cancelReply(): void {
  replyingTo.value = null
}

const canSubmit = computed(
  () => canSend.value && !!inputValue.value.trim() && !tooLong.value && !sending.value
)

const sendTitle = computed<string>(() => (canSend.value ? '' : t('mesh.chat.noRadio')))

async function submit(): Promise<void> {
  if (!canSubmit.value) return
  sending.value = true
  try {
    const result = await meshChat.send(props.dialogId, inputValue.value, {
      replyTo: replyingTo.value?.id,
    })
    if (result.ok) {
      inputValue.value = ''
      replyingTo.value = null
      showEmojiPicker.value = false
      adjustHeight()
    } else {
      appToast.error({ message: t(`mesh.chat.errors.${result.error}`) })
    }
  } finally {
    sending.value = false
  }
}

/** Картинки и файлы (LXMF); текст из поля уходит подписью к ним. */
async function sendFiles(files: File[]): Promise<void> {
  if (!canSend.value || sending.value || tooLong.value) return
  sending.value = true
  try {
    const result = await meshChat.sendAttachments(
      props.dialogId,
      await meshAttachments(files),
      inputValue.value.trim()
    )
    if (result.ok) {
      inputValue.value = ''
      adjustHeight()
    } else {
      appToast.error({ message: t(`mesh.chat.errors.${result.error}`) })
    }
  } finally {
    sending.value = false
  }
}

/** Голосовое (LXMF, Ogg Opus как у Sideband); текст из поля уходит подписью. */
async function sendVoice(recorded: MeshAttachment): Promise<void> {
  if (!canSend.value) return
  sending.value = true
  try {
    const result = await meshChat.sendAttachments(
      props.dialogId,
      [recorded],
      tooLong.value ? '' : inputValue.value.trim()
    )
    if (result.ok) {
      if (!tooLong.value) inputValue.value = ''
      adjustHeight()
    } else {
      appToast.error({ message: t(`mesh.chat.errors.${result.error}`) })
    }
  } finally {
    sending.value = false
  }
}

function voiceError(e: MeshVoiceError): void {
  appToast.error({
    message:
      typeof e === 'object'
        ? micErrorMessage(e.mic, !!navigator.mediaDevices?.getUserMedia)
        : t('mesh.chat.voiceUnsupported'),
  })
}

const {
  recording,
  seconds: voiceSeconds,
  available: voiceAvailable,
  start: startVoice,
  stop: stopVoice,
  cancel: cancelVoice,
} = useMeshVoice({ onRecorded: (v) => void sendVoice(v), onError: voiceError })

const voiceTitle = computed<string>(() =>
  recording.value ? t('mesh.chat.voiceSend') : t('mesh.chat.voice')
)

const voiceTime = computed<string>(() => {
  const clock = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  return `● ${clock(voiceSeconds.value)} / ${clock(MAX_SECONDS)}`
})

/** Бумажное сообщение (LXMF): текст из поля — в QR-код и ссылку `lxm://`. */
const paperUri = ref<string | null>(null)

async function sendPaper(): Promise<void> {
  if (!canSend.value || sending.value) return
  if (!inputValue.value.trim()) {
    appToast.error({ message: t('mesh.chat.paperEmpty') })
    return
  }
  sending.value = true
  try {
    const result = await meshChat.sendPaper(props.dialogId, inputValue.value)
    if (result.ok) {
      paperUri.value = result.uri
      inputValue.value = ''
      adjustHeight()
    } else {
      // Ошибки чата и отказы узла («rns_too_large») — из своих разделов.
      const key = [`mesh.chat.errors.${result.error}`, `mesh.errors.${result.error}`].find((k) =>
        te(k)
      )
      appToast.error({
        message: key ? t(key) : t('mesh.errors.generic', { code: result.error }),
      })
    }
  } finally {
    sending.value = false
  }
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    void submit()
  }
}

function goToMesh(): void {
  const net = network.value === 'lxmf' ? 'reticulum' : network.value
  void router.push({ path: '/mesh', query: { net } })
}

async function open(): Promise<void> {
  await meshChat.openDialog(props.dialogId)
  if (ui.isChatOnScreen(props.dialogId)) meshChat.markRead(props.dialogId)
}

onMounted(() => {
  void open()
  focusInput()
})

watch(
  () => props.dialogId,
  () => {
    replyingTo.value = null
    // Недописанное голосовое не уходит в чат, который открыли следом.
    cancelVoice()
    void open()
  }
)
</script>
