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

      <div v-else class="message-text">
        <template v-for="(seg, idx) in messageSegments" :key="idx">
          <span v-if="seg.kind === 'html'" v-html="seg.html" />
          <PostEmbed v-else :target="seg.target" />
        </template>
        <LinkPreview v-if="previewUrl" :url="previewUrl" />
      </div>

      <SC_MessageTime>
        {{ formatTime(message.timestamp) }}
        <SC_SeenTick v-if="isSeen" :title="t('messenger.seen')">✓✓</SC_SeenTick>
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
              <SC_ActionsItem
                v-if="canDelete"
                type="button"
                class="danger"
                @click.stop="onDelete"
              >
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
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Popover, Modal } from 'ant-design-vue'
import { MoreOutlined, DeleteOutlined, RollbackOutlined } from '@ant-design/icons-vue'
import type { Message } from '../../types'
import { useMessengerStore } from '../../store'
import { getAddressFromMatrixId, formatMessageTime as formatTime } from '../../helpers'
import { QUICK_REACTION_EMOJIS } from '../../store/consts'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import Avatar from '@/components/avatar/avatar.vue'
import AudioMessage from '../audio-message/audio-message.vue'
import ImageMessage from '../image-message/image-message.vue'
import VideoMessage from '../video-message/video-message.vue'
import FileMessage from '../file-message/file-message.vue'
import TransactionMessage from '../transaction-message/transaction-message.vue'
import PostEmbed from '../post-embed/post-embed.vue'
import LinkPreview from '../link-preview/link-preview.vue'
import { formatMessageSegments, extractFirstExternalUrl } from './helpers'
import {
  SC_MessageItem,
  SC_AudioUrlMissing,
  SC_ReactionEmojiIcon,
  SC_ReactionCount,
  SC_MessageMeta,
  SC_MessageRow,
  SC_MessageTime,
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
} from './styled'

const APopover = Popover

const props = withDefaults(
  defineProps<{
    message: Message
    showName?: boolean
    /** Показывать аватарку. Передаём false для подряд идущих сообщений того же
     *  отправителя — слот всё равно остаётся, чтобы выровнять колонку. */
    showAvatar?: boolean
    /** Время (ms), до которого собеседник прочитал переписку (read-receipts). */
    seenUpToTs?: number
  }>(),
  { showName: true, showAvatar: true, seenUpToTs: 0 }
)

const emit = defineEmits<{ reply: [message: Message] }>()

const store = useMessengerStore()
const { t } = useI18n()

const isMine = computed<boolean>(
  () => props.message.senderId === 'me' || props.message.senderId === store.currentUser.id
)

/** Своё сообщение прочитано собеседником (read-receipt). */
const isSeen = computed<boolean>(
  () => isMine.value && props.seenUpToTs > 0 && props.message.timestamp <= props.seenUpToTs
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
  const profile = senderProfile.value
  if (profile?.name) return profile.name
  return props.message.senderName || props.message.senderId
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

/** Первый внешний http(s)-URL для OG-превью (не bastyon-ссылка). */
const previewUrl = computed<string | null>(() => extractFirstExternalUrl(props.message.text || ''))

const showReactionPicker = ref(false)
const reactionTriggerRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
const reactionPickerRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
const pickerStyle = ref<{
  position: string
  top: string
  left: string
  right?: string
  bottom?: string
  zIndex: number
} | null>(null)
let scrollParent: HTMLElement | null = null
let clickOutsideHandler: ((e: MouseEvent) => void) | null = null
let scrollHandler: (() => void) | null = null

const canReact = computed<boolean>(() => {
  if (typeof props.message.id !== 'string' || !props.message.id.startsWith('$')) return false
  if (isMine.value) return false
  return true
})

// --- Действия над сообщением (ответ / удаление) ---
const actionsOpen = ref(false)
/** Реальное (отправленное) сообщение с matrix event-id ($...), не temp/pending. */
const isRealMessage = computed<boolean>(
  () => typeof props.message.id === 'string' && props.message.id.startsWith('$')
)
/** Ответить можно на любое реальное сообщение. */
const canReply = computed<boolean>(() => isRealMessage.value)
/** Удалить можно только своё реальное сообщение. */
const canDelete = computed<boolean>(() => isRealMessage.value && isMine.value)
const canShowActions = computed<boolean>(() => canReply.value || canDelete.value)

/** Превью цитируемого сообщения (на которое отвечает текущее). Резолвится по
 *  загруженным сообщениям диалога; если оригинал не в списке — общий плейсхолдер. */
const repliedPreview = computed<{ name: string; text: string } | null>(() => {
  const rid = props.message.replyTo?.id
  if (!rid) return null
  const chatId = props.message.chatId
  const list = chatId ? store.messages[chatId] : null
  const ref = list?.find((m) => m.id === rid)
  if (!ref) return { name: '', text: t('messenger.reply') }
  const isRefMine = ref.senderId === 'me' || ref.senderId === store.currentUser.id
  const name = isRefMine ? store.currentUser.name || t('messenger.you') : ref.senderName || ''
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

function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null
  let parent = el.parentElement
  while (parent) {
    const style = getComputedStyle(parent)
    const overflow = style.overflow + style.overflowY + style.overflowX
    if (/(auto|scroll|overlay)/.test(overflow)) return parent
    parent = parent.parentElement
  }
  return null
}

function asElement(refVal: unknown): HTMLElement | null {
  if (!refVal) return null
  const el = (refVal as { $el?: HTMLElement })?.$el ?? refVal
  return el instanceof HTMLElement ? el : null
}

function positionPicker(): void {
  const trigger = asElement(reactionTriggerRef.value)
  const picker = asElement(reactionPickerRef.value)
  if (!trigger || !picker) return
  const container = getScrollParent(trigger) || document.documentElement
  const containerRect = container.getBoundingClientRect()
  const triggerRect = trigger.getBoundingClientRect()
  const pickerRect = picker.getBoundingClientRect()
  const gap = 4
  const padding = 8
  const pickerHeight = pickerRect.height || 44
  const pickerWidth = pickerRect.width || 220
  let top: number
  if (triggerRect.top - containerRect.top >= pickerHeight + gap) {
    top = triggerRect.top - pickerHeight - gap
  } else if (containerRect.bottom - triggerRect.bottom >= pickerHeight + gap) {
    top = triggerRect.bottom + gap
  } else {
    top = Math.max(containerRect.top + padding, containerRect.bottom - pickerHeight - padding)
  }
  let left = triggerRect.left
  if (left + pickerWidth > containerRect.right - padding) {
    left = containerRect.right - pickerWidth - padding
  }
  if (left < containerRect.left + padding) {
    left = containerRect.left + padding
  }
  pickerStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    right: 'auto',
    bottom: 'auto',
    zIndex: 10000,
  }
}

function toggleReactionPicker(): void {
  if (!canReact.value) return
  showReactionPicker.value = !showReactionPicker.value
  if (showReactionPicker.value) {
    nextTick(() => {
      nextTick(positionPicker)
    })
  } else {
    pickerStyle.value = null
  }
}

function onReactionClick(key: string): void {
  if (!canReact.value || !props.message.chatId) return
  store.sendReaction(props.message.chatId, props.message.id, key)
  showReactionPicker.value = false
  pickerStyle.value = null
}

watch(showReactionPicker, (open) => {
  if (open) {
    nextTick(() => {
      nextTick(positionPicker)
    })
    clickOutsideHandler = (e: MouseEvent) => {
      const pickerEl = asElement(reactionPickerRef.value)
      const triggerEl = asElement(reactionTriggerRef.value)
      const target = e.target as Node
      if (pickerEl?.contains(target) || triggerEl?.contains(target)) return
      showReactionPicker.value = false
      pickerStyle.value = null
    }
    scrollParent = reactionTriggerRef.value
      ? getScrollParent(asElement(reactionTriggerRef.value))
      : null
    scrollHandler = () => {
      showReactionPicker.value = false
      pickerStyle.value = null
    }
    setTimeout(() => document.addEventListener('click', clickOutsideHandler!, true), 0)
    scrollParent?.addEventListener('scroll', scrollHandler, true)
  } else {
    if (clickOutsideHandler) document.removeEventListener('click', clickOutsideHandler, true)
    if (scrollHandler) scrollParent?.removeEventListener('scroll', scrollHandler, true)
    clickOutsideHandler = null
    scrollHandler = null
  }
})

onMounted(() => {
  if (showReactionPicker.value) nextTick(positionPicker)
})

onUnmounted(() => {
  if (clickOutsideHandler) document.removeEventListener('click', clickOutsideHandler, true)
  if (scrollHandler) scrollParent?.removeEventListener('scroll', scrollHandler, true)
})
</script>
