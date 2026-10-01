<template>
  <SC_MessageRow :class="isMine ? 'mine' : 'others'">
    <SC_AvatarSlot v-if="!isMine">
      <Avatar
        v-if="showAvatar"
        :src="displayAvatar"
        :alt="displayName"
        :fallback-text="displayName"
        :size="32"
        shape="circle"
      />
    </SC_AvatarSlot>

    <SC_MessageItem :class="isMine ? 'mine' : 'others'">
      <SC_MessageMeta v-if="showName && !isMine">
        <span>{{ displayName }}</span>
      </SC_MessageMeta>

      <SC_ReplyQuote v-if="repliedPreview">
        <SC_ReplyQuoteName>{{ repliedPreview.name }}</SC_ReplyQuoteName>
        <SC_ReplyQuoteText>{{ repliedPreview.text }}</SC_ReplyQuoteText>
      </SC_ReplyQuote>

      <div v-if="message.type === 'audio'" class="message-audio">
        <AudioMessage :message="message" :compact="isCompact" />
        <SC_AudioUrlMissing v-if="!message.url">Audio URL missing</SC_AudioUrlMissing>
      </div>

      <div v-else-if="message.type === 'image'" class="message-image">
        <ImageMessage :message="message" />
      </div>

      <div v-else-if="message.type === 'video'" class="message-video">
        <VideoMessage :message="message" />
      </div>

      <div v-else-if="message.type === 'file'" class="message-file">
        <FileMessage :message="message" />
      </div>

      <div v-else-if="message.type === 'transaction'" class="message-transaction">
        <TransactionMessage :message="message" />
      </div>

      <!-- Сообщение целиком — ссылка на файл в IPFS («Файл через IPFS»): карточка. -->
      <div v-else-if="ipfsFile" class="message-file">
        <IpfsFileMessage :link="ipfsFile" :mine="isMine" />
      </div>

      <div v-else class="message-text">
        <template v-for="(seg, idx) in messageSegments" :key="idx">
          <span v-if="seg.kind === 'html'" v-html="seg.html" />
          <PostEmbed v-else :target="seg.target" />
        </template>
        <LinkPreview v-if="previewUrl" :url="previewUrl" />
        <SC_MeshRouteButton v-if="lxmfAddress" type="button" @click.stop="writeViaReticulum">
          📡 {{ t('mesh.share.write') }}
        </SC_MeshRouteButton>
        <!-- Запись связки с Reticulum: маршрут в этот же чат. -->
        <SC_MeshBindingNote v-if="meshBinding">
          {{ isMine ? t('mesh.route.bindingMine') : t('mesh.route.bindingTheirs') }}
        </SC_MeshBindingNote>
        <SC_MeshRouteButton v-if="canShareBack" type="button" @click.stop="shareBack">
          📡 {{ t('mesh.route.shareBack') }}
        </SC_MeshRouteButton>
      </div>

      <!-- Не ушло в сеть: текст остаётся на экране с кнопкой повтора (S35). -->
      <SC_SendFailed v-if="message.status === 'failed'">
        <span>{{ t('messenger.notSent') }}</span>
        <SC_RetryButton type="button" @click.stop="onRetry">
          {{ t('messenger.retrySend') }}
        </SC_RetryButton>
      </SC_SendFailed>

      <SC_MessageTime>
        <span v-if="viaMesh" :title="viaMesh">📡</span>
        <!-- Коротко: сегодня — «14:30», раньше — с датой; полная дата — в подсказке. -->
        <time :datetime="timeIso" :title="formatTime(message.timestamp)">{{ timeShort }}</time>
        <SC_SeenTick v-if="mark" :class="{ done: mark.done }" :title="mark.title">
          {{ mark.mark }}
        </SC_SeenTick>
        <SC_ReactionButton
          v-if="canReact"
          ref="reactionTriggerRef"
          type="button"
          :title="t('messenger.reaction')"
          @click="toggleReactionPicker"
        >
          <SC_ReactionEmojiIcon>😀</SC_ReactionEmojiIcon>
        </SC_ReactionButton>

        <APopover
          v-if="canShowActions"
          v-model:open="actionsOpen"
          trigger="click"
          placement="topRight"
          :overlay-class-name="'message-actions-popover'"
        >
          <template #content>
            <SC_ActionsMenu @click.stop>
              <SC_ActionsItem v-if="canReply" type="button" @click.stop="onReply">
                <RollbackOutlined />
                <span>{{ t('messenger.reply') }}</span>
              </SC_ActionsItem>
              <SC_ActionsItem v-if="canDelete" type="button" class="danger" @click.stop="onDelete">
                <DeleteOutlined />
                <span>{{ t('messenger.deleteMessage') }}</span>
              </SC_ActionsItem>
            </SC_ActionsMenu>
          </template>
          <SC_ActionsButton type="button" :title="t('messenger.actions')" @click.stop>
            <MoreOutlined />
          </SC_ActionsButton>
        </APopover>
      </SC_MessageTime>

      <Teleport to="body">
        <SC_ReactionPicker
          v-if="showReactionPicker"
          ref="reactionPickerRef"
          class="reaction-picker"
          :style="pickerStyle || undefined"
        >
          <SC_ReactionPickerEmoji
            v-for="emoji in QUICK_REACTION_EMOJIS"
            :key="emoji"
            type="button"
            @click="onReactionClick(emoji)"
          >
            {{ emoji }}
          </SC_ReactionPickerEmoji>
        </SC_ReactionPicker>
      </Teleport>

      <SC_ReactionsRow v-if="message.reactions?.length">
        <SC_ReactionPill v-for="r in message.reactions" :key="r.key" :class="{ mine: r.my }">
          {{ r.key }}
          <SC_ReactionCount v-if="r.count > 1">{{ r.count }}</SC_ReactionCount>
        </SC_ReactionPill>
      </SC_ReactionsRow>
    </SC_MessageItem>
  </SC_MessageRow>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Popover, Modal } from 'ant-design-vue'
import { MoreOutlined, DeleteOutlined, RollbackOutlined } from '@/components/icons'
import { parseMeshDialogId } from '@/mesh/ids'
import { useMeshChatStore } from '@/mesh/store/mesh-chat-store'
import { useMeshRoutesStore } from '@/mesh/store/mesh-routes-store'
import { useReticulumStore } from '@/mesh/store/reticulum-store'
import { appToast } from '@/b-components/app-toast'
import { isMeshTransport, type Message } from '../../types'
import { deliveryMark } from './delivery-mark'
import { useMessengerStore } from '../../store'
import { chatUserName, getAddressFromMatrixId } from '../../helpers'
import {
  formatDateTimeFromString as formatTime,
  formatMessageTime,
} from '@/helpers/common/date-formatter'
import { QUICK_REACTION_EMOJIS } from '../../store/consts'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import Avatar from '@/components/avatar/avatar.vue'
import AudioMessage from '../audio-message/audio-message.vue'
import ImageMessage from '../image-message/image-message.vue'
import VideoMessage from '../video-message/video-message.vue'
import FileMessage from '../file-message/file-message.vue'
import TransactionMessage from '../transaction-message/transaction-message.vue'
import IpfsFileMessage from '../ipfs-file-message/ipfs-file-message.vue'
import { parseIpfsFileLink } from '@/helpers/ipfs/ipfs-link'
import PostEmbed from '../post-embed/post-embed.vue'
import LinkPreview from '../link-preview/link-preview.vue'
import { formatMessageSegments, extractFirstExternalUrl } from './helpers'
import { useReactionPicker } from './use-reaction-picker'
import {
  SC_MessageItem,
  SC_AudioUrlMissing,
  SC_ReactionEmojiIcon,
  SC_ReactionCount,
  SC_MessageMeta,
  SC_MessageRow,
  SC_MessageTime,
  SC_SendFailed,
  SC_RetryButton,
  SC_SeenTick,
  SC_ReactionsRow,
  SC_ReactionPill,
  SC_ReactionButton,
  SC_ReactionPicker,
  SC_ReactionPickerEmoji,
  SC_AvatarSlot,
  SC_ActionsButton,
  SC_ActionsMenu,
  SC_ActionsItem,
  SC_ReplyQuote,
  SC_ReplyQuoteName,
  SC_ReplyQuoteText,
  SC_MeshRouteButton,
  SC_MeshBindingNote,
} from './styled'

const APopover = Popover

const props = withDefaults(
  defineProps<{
    message: Message
    showName?: boolean
    /** Показывать аватарку. Передаём false для подряд идущих сообщений того же
     *  отправителя — слот всё равно остаётся, чтобы выровнять колонку. */
    showAvatar?: boolean
    /** Своё сообщение прочитано собеседником (квитанции Matrix, use-read-receipts). */
    seen?: boolean
  }>(),
  { showName: true, showAvatar: true, seen: false }
)

const emit = defineEmits<{ reply: [message: Message] }>()

const store = useMessengerStore()
const router = useRouter()
const { t } = useI18n()

const timeShort = computed(() => formatMessageTime(props.message.timestamp))
const timeIso = computed(() => {
  const date = new Date(props.message.timestamp)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
})

const isMine = computed<boolean>(
  () => props.message.senderId === 'me' || props.message.senderId === store.currentUser.id
)

/** Повторная отправка текста, который не ушёл (S35). */
function onRetry(): void {
  void store.retryMessage(props.message.chatId, props.message.id)
}

/** Сообщение через mesh-радио (src/mesh), а не через Matrix. */
const isMesh = computed<boolean>(() => isMeshTransport(props.message.transport))
const meshKind = computed(() =>
  isMesh.value ? (parseMeshDialogId(props.message.chatId)?.kind ?? null) : null
)
/** Meshtastic передаёт ответы и реакции по радио — если у сообщения есть id пакета. */
const isMeshReplyable = computed<boolean>(
  () => props.message.transport === 'meshtastic' && !!props.message.meshReplyable
)

/** «…», «✓», «✓✓» у времени своего сообщения (delivery-mark.ts). */
const mark = computed(() =>
  deliveryMark(
    {
      status: props.message.status,
      transport: props.message.transport,
      mine: isMine.value,
      seen: props.seen,
      mesh: isMesh.value,
      meshKind: meshKind.value,
    },
    t
  )
)

const isCompact = computed<boolean>(() => !store.isFullScreen)

/** Адрес pocketnet, выделенный из matrix id отправителя. */
const senderAddress = computed<string | null>(() => {
  if (isMine.value) return null
  const id = props.message.senderId
  if (!id || id === 'me') return null
  return getAddressFromMatrixId(id)
})

/** Профиль отправителя из реактивного кэша (подтянется автоматически после fetch). */
const senderProfile = computed(() => {
  const addr = senderAddress.value
  if (!addr) return null
  return store.userProfiles[addr] || null
})

const displayName = computed<string>(() => {
  if (isMine.value) return store.currentUser.name || t('messenger.you')
  // В mesh-канале отправитель — имя, которое написало его радио; его может не быть.
  if (isMesh.value) return props.message.senderName || t('mesh.chat.unknownSender')
  return chatUserName(props.message.senderId, store.userProfiles, props.message.senderName)
})

/** URL аватарки отправителя (или undefined, если ещё нет в кэше). */
const displayAvatar = computed<string | undefined>(() => {
  if (isMine.value) return store.currentUser.avatar
  const profile = senderProfile.value as { i?: string; avatar?: string; image?: string } | null
  const img = profile?.i || profile?.avatar || profile?.image
  if (!img) return undefined
  return resolveImageUrl(img) || undefined
})

function ensureSenderProfile(): void {
  const addr = senderAddress.value
  if (!addr) return
  if (store.userProfiles[addr]) return
  store.fetchProfiles([addr])
}

watch(senderAddress, ensureSenderProfile, { immediate: true })

/** Сегменты текста: чередование `html` (с inline `<a>`) и `bastyon` (PostEmbed). */
const messageSegments = computed(() => formatMessageSegments(props.message.text || ''))

/** Текст — одна ссылка на файл в IPFS: рисуем карточкой, а не ссылкой. */
const ipfsFile = computed(() =>
  (props.message.type ?? 'text') === 'text' ? parseIpfsFileLink(props.message.text || '') : null
)

/**
 * Адрес LXMF (`lxmf@<32 hex>`, как в ссылках NomadNet) в чужом сообщении:
 * написать по нему через Reticulum — когда узел есть в этой сборке.
 */
const reticulum = useReticulumStore()

/**
 * Запись связки с Reticulum в сообщении (зашифрованный JSON, use-mesh-share):
 * по ней приложение запоминает mesh-маршрут к собеседнику.
 */
const meshBinding = computed<boolean>(() => {
  const raw = props.message.rawContent as Record<string, unknown> | undefined
  return !!raw && typeof raw.bastyonMesh === 'object' && raw.bastyonMesh !== null
})

/** Сообщение ушло или пришло через mesh-сеть, а показано в чате Bastyon: «Через …». */
const viaMesh = computed<string | null>(() => {
  const transport = props.message.transport
  if (!isMeshTransport(transport) || props.message.chatId === store.activeChatId) return null
  return t('mesh.route.via', { net: t(`mesh.networks.${transport}`) })
})

/** Собеседник поделился адресом, а мы своим — ещё нет. */
const canShareBack = computed<boolean>(() => {
  if (!meshBinding.value || isMine.value || !reticulum.available) return false
  const contact = getAddressFromMatrixId(props.message.senderId)
  return !!contact && !useMeshRoutesStore().hasShared(contact)
})

async function shareBack(): Promise<void> {
  if (reticulum.status !== 'running' || !reticulum.address) {
    appToast.info({ message: t('mesh.share.startNode') })
    void router.push({ path: '/mesh', query: { net: 'reticulum' } })
    return
  }
  const result = await store.shareMeshBinding(props.message.chatId)
  if (result === 'failed') appToast.error({ message: t('mesh.share.failed') })
}

const lxmfAddress = computed<string | null>(() => {
  if (isMine.value || !reticulum.available || (props.message.type ?? 'text') !== 'text') {
    return null
  }
  // Со связкой маршрут уже в этом чате — отдельный чат LXMF не нужен.
  if (meshBinding.value) return null
  const match = /\blxmf@([0-9a-f]{32})\b/i.exec(props.message.text || '')
  return match ? match[1]!.toLowerCase() : null
})

async function writeViaReticulum(): Promise<void> {
  const address = lxmfAddress.value
  if (!address) return
  if (reticulum.status !== 'running' || !reticulum.address) {
    appToast.info({ message: t('mesh.share.startNode') })
    void router.push({ path: '/mesh', query: { net: 'reticulum' } })
    return
  }
  const name = isMesh.value ? reticulum.peerName(address) : displayName.value
  const id = await useMeshChatStore().ensureLxmfDialog(reticulum.address, address, name)
  await store.openChat(id)
}

/** Первый внешний http(s)-URL для OG-превью (не bastyon-ссылка). */
// OG-превью запрашивается у homeserver'а с userId — для E2E-переписки не
// делаем этого по умолчанию, как Element (S33/Р4).
// Mesh-переписка — эфир без интернета: её ссылки на сервер не отправляем.
const previewUrl = computed<string | null>(() =>
  props.message.encrypted || isMesh.value ? null : extractFirstExternalUrl(props.message.text || '')
)

const canReact = computed<boolean>(() => {
  if (isMeshReplyable.value) return !isMine.value
  if (typeof props.message.id !== 'string' || !props.message.id.startsWith('$')) return false
  if (isMine.value) return false
  return true
})

// Плавающий пикер реакций вынесен в use-reaction-picker (состояние, позиционирование,
// закрытие по клику-вне/скроллу, lifecycle). Отправку делает вызывающий компонент.
const {
  showReactionPicker,
  reactionTriggerRef,
  reactionPickerRef,
  pickerStyle,
  toggleReactionPicker,
  onReactionClick,
} = useReactionPicker({
  canReact,
  onReact: (key) => {
    const chatId = props.message.chatId
    if (!chatId) return
    if (isMesh.value) void useMeshChatStore().react(chatId, props.message.id, key)
    else store.sendReaction(chatId, props.message.id, key)
  },
})

// --- Действия над сообщением (ответ / удаление) ---
const actionsOpen = ref(false)
/** Реальное (отправленное) сообщение с matrix event-id ($...), не temp/pending. */
const isRealMessage = computed<boolean>(
  () => typeof props.message.id === 'string' && props.message.id.startsWith('$')
)
/** Ответить можно на любое реальное сообщение (и на сообщение Meshtastic с id пакета). */
const canReply = computed<boolean>(() => isRealMessage.value || isMeshReplyable.value)
/** Удалить можно только своё реальное сообщение. */
const canDelete = computed<boolean>(() => isRealMessage.value && isMine.value)
const canShowActions = computed<boolean>(() => canReply.value || canDelete.value)

/** Превью цитируемого сообщения (на которое отвечает текущее). Резолвится по
 *  загруженным сообщениям диалога; если оригинал не в списке — общий плейсхолдер. */
const repliedPreview = computed<{ name: string; text: string } | null>(() => {
  const rid = props.message.replyTo?.id
  if (!rid) return null
  const chatId = props.message.chatId
  if (isMesh.value && chatId) {
    // Mesh-переписка лежит в своём сторе, не среди сообщений Matrix.
    const rec = useMeshChatStore().messages[chatId]?.find((m) => m.id === rid)
    if (!rec) return { name: '', text: t('messenger.reply') }
    const name = rec.mine
      ? store.currentUser.name || t('messenger.you')
      : rec.senderName || t('mesh.chat.unknownSender')
    return { name, text: rec.text.slice(0, 80) }
  }
  const list = chatId ? store.messages[chatId] : null
  const ref = list?.find((m) => m.id === rid)
  if (!ref) return { name: '', text: t('messenger.reply') }
  const isRefMine = ref.senderId === 'me' || ref.senderId === store.currentUser.id
  // Имя в цитате — по кэшу профилей, а не то, что запомнилось при разборе
  // сообщения: тогда профиль мог быть ещё не загружен, и там лежал Matrix-id.
  const name = isRefMine
    ? store.currentUser.name || t('messenger.you')
    : chatUserName(ref.senderId, store.userProfiles, ref.senderName)
  const text = ref.type && ref.type !== 'text' ? `[${ref.type}]` : (ref.text || '').slice(0, 80)
  return { name, text }
})

function onReply(): void {
  actionsOpen.value = false
  emit('reply', props.message)
}

function onDelete(): void {
  actionsOpen.value = false
  const chatId = props.message.chatId
  if (!chatId) return
  Modal.confirm({
    title: t('messenger.deleteConfirmTitle'),
    content: t('messenger.deleteConfirmText'),
    okText: t('messenger.deleteMessage'),
    okType: 'danger',
    cancelText: t('messenger.cancel'),
    centered: true,
    onOk: async () => {
      try {
        await store.deleteMessage(chatId, props.message.id)
      } catch {
        /* ошибка залогирована в сторе */
      }
    },
  })
}
</script>
