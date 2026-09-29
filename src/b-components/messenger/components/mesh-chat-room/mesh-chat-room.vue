<template>
  <SC_ChatRoomContainer>
    <SC_MeshInfoBar>
      <SC_MeshInfoIcon><RadioTowerIcon /></SC_MeshInfoIcon>
      <SC_MeshInfoText>
        {{ t('mesh.chat.via') }} ·
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
      {{ t('mesh.chat.emptyHint') }}
    </SC_ChatRoomEmptyHint>

    <MessageList :messages="messages" />

    <SC_MessageInputArea>
      <EmojiPicker v-if="showEmojiPicker" @select="onEmojiSelect" />

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
  </SC_ChatRoomContainer>
</template>

<script setup lang="ts">
/**
 * Чат через mesh-радио (MeshCore). Отдельно от ChatRoom: у эфира нет
 * вложений, реакций, «печатает» и прочтений, зато есть предел в байтах и
 * радио, которое может быть не подключено.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { RadioTowerIcon, SendOutlined, SmileOutlined } from '@/components/icons'
import { appToast } from '@/b-components/app-toast'
import { useMeshChatStore } from '@/mesh/store/mesh-chat-store'
import { useMeshConnectionStore } from '@/mesh/store/mesh-connection-store'
import { utf8Length } from '@/mesh/bytes'
import { splitForMesh } from '@/mesh/text'
import MessageList from '../message-list/message-list.vue'
import EmojiPicker from '../emoji-picker/emoji-picker.vue'
import { useChatInput } from '../chat-room/use-chat-input'
import { useMessengerUiStore } from '../../store/messenger-ui-store'
import {
  SC_ChatRoomContainer,
  SC_ChatRoomEmptyHint,
  SC_EmojiToggleButton,
  SC_MessageInput,
  SC_MessageInputArea,
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

const { t } = useI18n()
const router = useRouter()
const meshChat = useMeshChatStore()
const connection = useMeshConnectionStore()
const ui = useMessengerUiStore()

const dialog = computed(() => meshChat.dialogs.find((d) => d.id === props.dialogId) ?? null)
const messages = computed(() => meshChat.messengerMessages(props.dialogId))

const isOpenChannel = computed(
  () => dialog.value?.kind === 'channel' && dialog.value.channelKind !== 'private'
)

/** Честно о защите: в MeshCore шифрование кончается на радио. */
const securityText = computed<string>(() => {
  const d = dialog.value
  if (!d || d.kind === 'direct') return t('mesh.chat.deviceEncryption')
  return d.channelKind === 'private' ? t('mesh.chat.privateChannel') : t('mesh.chat.openChannel')
})

const canSend = computed(() => meshChat.canSend(props.dialogId))

const radioStateText = computed<string>(() => {
  if (connection.status === 'connecting' || connection.status === 'reconnecting') {
    return t(`mesh.status.${connection.status}`)
  }
  return connection.status === 'connected' ? t('mesh.chat.otherRadio') : t('mesh.chat.noRadio')
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

const canSubmit = computed(
  () => canSend.value && !!inputValue.value.trim() && !tooLong.value && !sending.value
)

const sendTitle = computed<string>(() => (canSend.value ? '' : t('mesh.chat.noRadio')))

async function submit(): Promise<void> {
  if (!canSubmit.value) return
  sending.value = true
  try {
    const result = await meshChat.send(props.dialogId, inputValue.value)
    if (result.ok) {
      inputValue.value = ''
      showEmojiPicker.value = false
      adjustHeight()
    } else {
      appToast.error({ message: t(`mesh.chat.errors.${result.error}`) })
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
  void router.push('/mesh')
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
  () => void open()
)
</script>
