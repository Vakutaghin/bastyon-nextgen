import {
  defineComponent,
  type PropType,
  computed,
  ref,
  nextTick,
  watch,
  onMounted,
  onUnmounted,
} from 'vue'

import type { Message } from '../../types'
import { matrixFetch } from '@/helpers/api/request'
import { useMessengerStore } from '../../store'
import { getAddressFromMatrixId, formatMessageTime } from '../../helpers'
import { QUICK_REACTION_EMOJIS } from '../../store/consts'
import { decryptMatrixAttachment } from '../../services/media-decrypt'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import Avatar from '@/components/avatar/avatar.vue'
import {
  SC_MessageItem,
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
import AudioMessage from '../audio-message/audio-message.vue'
import ImageMessage from '../image-message/image-message.vue'
import VideoMessage from '../video-message/video-message.vue'
import FileMessage from '../file-message/file-message.vue'
import TransactionMessage from '../transaction-message/transaction-message.vue'
import PostEmbed from '../post-embed/post-embed.vue'
import LinkPreview from '../link-preview/link-preview.vue'
import { formatMessageSegments, extractFirstExternalUrl } from './helpers'

export const messageItemOptions = defineComponent({
  name: 'MessageItem',
  components: {
    SC_MessageItem,
    SC_MessageMeta,
    SC_MessageRow,
    SC_MessageTime,
    SC_ReactionsRow,
    SC_ReactionPill,
    SC_ReactionButton,
    SC_ReactionPicker,
    SC_ReactionPickerEmoji,
    SC_AvatarSlot,
    AudioMessage,
    ImageMessage,
    VideoMessage,
    FileMessage,
    TransactionMessage,
    PostEmbed,
    LinkPreview,
    Avatar,
  },
  props: {
    message: {
      type: Object as PropType<Message>,
      required: true,
    },
    showName: {
      type: Boolean,
      default: true,
    },
    /** Показывать аватарку. Передаём false для подряд идущих сообщений того же отправителя — слот сохраняем для выравнивания. */
    showAvatar: {
      type: Boolean,
      default: true,
    },
  },
  setup(props) {
    const store = useMessengerStore()

    const isMine = computed(() => {
      return props.message.senderId === 'me' || props.message.senderId === store.currentUser.id
    })

    const isCompact = computed(() => {
      return !store.isFullScreen
    })

    /** Адрес pocketnet, выделенный из matrix id отправителя */
    const senderAddress = computed(() => {
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

    const displayName = computed(() => {
      if (isMine.value) return store.currentUser.name || 'Вы'
      const profile = senderProfile.value
      if (profile?.name) return profile.name
      return props.message.senderName || props.message.senderId
    })

    /** URL аватарки отправителя (или undefined, если ещё нет в кэше). */
    const displayAvatar = computed<string | undefined>(() => {
      if (isMine.value) return store.currentUser.avatar
      const profile = senderProfile.value as any
      const img = profile?.i || profile?.avatar || profile?.image
      if (!img) return undefined
      const resolved = resolveImageUrl(img)
      return resolved || undefined
    })

    /** Подтянуть профиль, если его ещё нет в кэше. */
    const ensureSenderProfile = () => {
      const addr = senderAddress.value
      if (!addr) return
      if (store.userProfiles[addr]) return
      store.fetchProfiles([addr])
    }

    watch(senderAddress, ensureSenderProfile, { immediate: true })

    /** Сегменты текста: чередование 'html' (с inline <a>) и 'bastyon' (PostEmbed). */
    const messageSegments = computed(() => formatMessageSegments(props.message.text || ''))

    /** Первый внешний http(s) URL для OG-превью (не bastyon-ссылка). */
    const previewUrl = computed<string | null>(() =>
      extractFirstExternalUrl(props.message.text || '')
    )

    const onAudioError = async (e: Event) => {
      const target = e.target as HTMLAudioElement
      const src = target.src || props.message.url

      if (!src) return

      // Prevent infinite loop if we already switched to blob
      if (src.startsWith('blob:')) {
        console.error('[MessageItem] Blob playback failed for:', src)
        return
      }

      console.error('[MessageItem] Audio error:', target.error?.code, src)

      // If error is MEDIA_ERR_SRC_NOT_SUPPORTED (4), it might be because of content-type
      if (target.error?.code === 4) {
        try {
          // Check for Bastyon encryption (secrets)
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
            } catch (e) {
              console.error('[MessageItem] Pcrypto decryption failed:', e)
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

          // Force correct MIME type if it's 'encrypted/audio/mpeg', 'application/octet-stream' or unknown
          const newBlob = new Blob([blob], { type: 'audio/mpeg' })
          const objectUrl = URL.createObjectURL(newBlob)

          target.src = objectUrl
          target.load()
        } catch (err) {
          console.error('[MessageItem] Failed to fetch audio blob:', err)
        }
      }
    }

    const showReactionPicker = ref(false)
    const reactionTriggerRef = ref<HTMLElement | null>(null)
    const reactionPickerRef = ref<HTMLElement | null>(null)
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

    const canReact = computed(() => {
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

    function positionPicker() {
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

    const toggleReactionPicker = () => {
      if (!canReact.value) return
      showReactionPicker.value = !showReactionPicker.value
      if (showReactionPicker.value) {
        nextTick(() => {
          nextTick(() => positionPicker())
        })
      } else {
        pickerStyle.value = null
      }
    }

    const onReactionClick = (key: string) => {
      if (!canReact.value || !props.message.chatId) return
      store.sendReaction(props.message.chatId, props.message.id, key)
      showReactionPicker.value = false
      pickerStyle.value = null
    }

    watch(showReactionPicker, (open) => {
      if (open) {
        nextTick(() => {
          nextTick(() => positionPicker())
        })
        clickOutsideHandler = (e: MouseEvent) => {
          const pickerEl = asElement(reactionPickerRef.value)
          const triggerEl = asElement(reactionTriggerRef.value)
          const target = e.target as Node
          if (pickerEl?.contains(target) || triggerEl?.contains(target)) return
          showReactionPicker.value = false
          pickerStyle.value = null
        }
        scrollParent = reactionTriggerRef.value ? getScrollParent(reactionTriggerRef.value) : null
        scrollHandler = () => {
          showReactionPicker.value = false
          pickerStyle.value = null
        }
        setTimeout(() => document.addEventListener('click', clickOutsideHandler!, true), 0)
        scrollParent?.addEventListener('scroll', scrollHandler, true)
      } else {
        document.removeEventListener('click', clickOutsideHandler!, true)
        scrollParent?.removeEventListener('scroll', scrollHandler!, true)
        clickOutsideHandler = null
        scrollHandler = null
      }
    })

    onMounted(() => {
      if (showReactionPicker.value) nextTick(() => positionPicker())
    })
    onUnmounted(() => {
      document.removeEventListener('click', clickOutsideHandler!, true)
      scrollParent?.removeEventListener('scroll', scrollHandler!, true)
    })

    return {
      formatTime: formatMessageTime,
      displayName,
      displayAvatar,
      isMine,
      messageSegments,
      previewUrl,
      onAudioError,
      isCompact,
      showReactionPicker,
      canReact,
      toggleReactionPicker,
      onReactionClick,
      quickReactionEmojis: QUICK_REACTION_EMOJIS,
      reactionTriggerRef,
      reactionPickerRef,
      pickerStyle,
    }
  },
})
