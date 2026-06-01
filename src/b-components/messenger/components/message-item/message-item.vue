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
        <SC_ReactionButton
          v-if="canReact"
          ref="reactionTriggerRef"
          type="button"
          :title="t('messenger.reaction')"
          @click="toggleReactionPicker"
        >
          <SC_ReactionEmojiIcon>😀</SC_ReactionEmojiIcon>
        </SC_ReactionButton>
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
import type { Message } from '../../types'
import { matrixFetch } from '@/helpers/api/request'
import { useMessengerStore } from '../../store'
import { getAddressFromMatrixId, formatMessageTime as formatTime } from '../../helpers'
import { QUICK_REACTION_EMOJIS } from '../../store/consts'
import { decryptMatrixAttachment } from '../../services/media-decrypt'
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
  SC_ReactionsRow,
  SC_ReactionPill,
  SC_ReactionButton,
  SC_ReactionPicker,
  SC_ReactionPickerEmoji,
  SC_AvatarSlot,
} from './styled'

const props = withDefaults(
  defineProps<{
    message: Message
    showName?: boolean
    /** Показывать аватарку. Передаём false для подряд идущих сообщений того же
     *  отправителя — слот всё равно остаётся, чтобы выровнять колонку. */
    showAvatar?: boolean
  }>(),
  { showName: true, showAvatar: true }
)

const store = useMessengerStore()
const { t } = useI18n()

const isMine = computed<boolean>(
  () => props.message.senderId === 'me' || props.message.senderId === store.currentUser.id
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

async function onAudioError(e: Event): Promise<void> {
  const target = e.target as HTMLAudioElement
  const src = target.src || props.message.url
  if (!src) return

  // Защита от бесконечной петли: blob уже наш фолбэк, повторять нет смысла.
  if (src.startsWith('blob:')) {
    console.error('[MessageItem] Blob playback failed for:', src)
    return
  }

  console.error('[MessageItem] Audio error:', target.error?.code, src)

  // MEDIA_ERR_SRC_NOT_SUPPORTED (4) часто значит «wrong content-type» —
  // подменяем src на blob с правильным MIME.
  if (target.error?.code === 4) {
    try {
      // Bastyon-шифрованные аудио (secrets) — расшифровываем через store.
      if (props.message.info?.secrets) {
        try {
          const response = await matrixFetch(src, { mode: 'cors' })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)

          const blob = await response.blob()
          const decryptedBlob = await store.decryptAudioData(blob, props.message)

          if (decryptedBlob) {
            const objectUrl = URL.createObjectURL(decryptedBlob)
            target.src = objectUrl
            target.load()
            return
          } else {
            console.error('[MessageItem] Decryption returned null')
          }
        } catch (err) {
          console.error('[MessageItem] Pcrypto decryption failed:', err)
        }
      }

      const fileInfo = props.message.info?.file || props.message.info?.secrets?.file

      if (fileInfo && fileInfo.key) {
        const response = await matrixFetch(src, { mode: 'cors' })
        const arrayBuffer = await response.arrayBuffer()

        try {
          const decryptedData = await decryptMatrixAttachment(arrayBuffer, fileInfo)
          const blob = new Blob([decryptedData], { type: 'audio/mpeg' })
          const objectUrl = URL.createObjectURL(blob)
          target.src = objectUrl
          target.load()
          return
        } catch (decryptErr) {
          console.error('[MessageItem] Decryption failed:', decryptErr)
        }
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      const response = await matrixFetch(src, {
        mode: 'cors',
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const blob = await response.blob()
      // Принудительно ставим audio/mpeg — даже если сервер вернул octet-stream
      // или encrypted/audio/mpeg, плеер сможет проиграть.
      const newBlob = new Blob([blob], { type: 'audio/mpeg' })
      const objectUrl = URL.createObjectURL(newBlob)
      target.src = objectUrl
      target.load()
    } catch (err) {
      console.error('[MessageItem] Failed to fetch audio blob:', err)
    }
  }
}

// Отмечаем как используемое, чтобы TS не жаловался — функция передана в audio[onError]
// со стороны audio-message.vue через store; явный listener тут не нужен, но функция
// доступна как часть API компонента для тестов.
void onAudioError

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
