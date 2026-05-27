import { defineComponent, ref, computed, type PropType, nextTick, watch, watchEffect } from 'vue'
import type { Message } from '../../types'
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
import MessageList from '../message-list/message-list.vue'
import EmojiPicker from '../emoji-picker/emoji-picker.vue'
import AttachmentPanel from '../attachment-panel/attachment-panel.vue'
import PkoinTransferModal from '../pkoin-transfer-modal/pkoin-transfer-modal.vue'
import { useMessengerStore } from '../../store'
import { formatDuration } from '../../helpers'
import { usePasteDrop } from './use-paste-drop'
import { resolveImageUrl } from '@/helpers/common/url-transformer'

export const chatRoomOptions = defineComponent({
  name: 'ChatRoom',
  components: {
    SC_MessageInputArea,
    SC_MessageInput,
    SC_SendButton,
    SC_VoiceButton,
    SC_EmojiToggleButton,
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
    SC_UserStats,
    SC_StatItem,
    SC_StatLabel,
    SC_StatValue,
    MessageList,
    EmojiPicker,
    AttachmentPanel,
    PkoinTransferModal,
  },
  props: {
    messages: {
      type: Array as PropType<Message[]>,
      required: true,
    },
    /** Режим приглашения: карточка + «Начать чат». Только при открытии из профиля/поста. */
    inviteMode: {
      type: Boolean,
      default: false,
    },
    /** Загрузка сообщений диалога (показываем прелоадер вместо списка). */
    isLoading: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['send', 'load-more', 'open-chat'],
  setup(props, { emit }) {
    const inputValue = ref('')
    const inputRef = ref<any>(null)
    const showEmojiPicker = ref(false)
    const store = useMessengerStore()
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
    const recordingTimer = ref<any>(null)
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

    const adjustHeight = () => {
      const el = inputRef.value?.$el
      if (el) {
        el.style.height = 'auto'
        el.style.height = el.scrollHeight + 2 + 'px'
      }
    }

    const handleSend = () => {
      if (inputValue.value.trim()) {
        emit('send', inputValue.value.trim())
        inputValue.value = ''
        showEmojiPicker.value = false
        nextTick(() => {
          adjustHeight()
        })
      }
    }

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    }

    const handleInput = () => {
      adjustHeight()
    }

    const toggleEmojiPicker = () => {
      showEmojiPicker.value = !showEmojiPicker.value
    }

    const onEmojiSelect = (emoji: string) => {
      // Insert emoji at cursor position or at end
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

    const startChatNow = async () => {
      const addrRef = (store as any).lastTargetAddress
      const address = addrRef?.value ?? addrRef ?? null
      if (!address) return
      try {
        const roomId = await (store as any).startChatWithAddress(address)
        if (roomId) {
          emit('open-chat', roomId)
        }
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

    const hexToAddress = (hex: string): string => {
      if (!hex || hex.length % 2 !== 0) return ''
      let result = ''
      for (let i = 0; i < hex.length; i += 2) {
        const chHex = hex.substring(i, i + 2)
        if (!/^[0-9a-fA-F]{2}$/.test(chHex)) return ''
        let charCode = parseInt(chHex, 16)
        if (charCode >= 0x80) {
          charCode += 0x350
        }
        result += String.fromCharCode(charCode)
      }
      return result
    }

    // Тонкая обёртка над resolveImageUrl: chat-room принимает уже извлечённый хэш/URL,
    // а не объект профиля целиком, поэтому используется именно url-нормализатор.
    const getAvatarUrlFromProfile = (imageHash?: string): string | undefined => {
      return imageHash ? resolveImageUrl(imageHash) : undefined
    }

    const updatePartnerInfo = async () => {
      let address: string | null = null
      const dialogRef = (store as any).activeDialog
      const d = dialogRef?.value ?? dialogRef
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
      if (!address) {
        const addrRef = (store as any).lastTargetAddress
        address = addrRef?.value ?? addrRef ?? null
      }
      if (address) {
        const profilesRef = (store as any).userProfiles
        const profilesObj = profilesRef?.value ?? profilesRef
        const p = profilesObj ? profilesObj[address] : undefined
        if (!p) {
          await (store as any).fetchProfiles([address])
        }
        const freshProfilesObj = (store as any).userProfiles?.value ?? (store as any).userProfiles
        const profile = freshProfilesObj ? freshProfilesObj[address] : undefined
        if (profile) {
          const r: unknown = profile.reputation ?? 0
          const num = typeof r === 'number' ? r : Number(r || 0)
          reputation.value = num.toFixed(1)
          subscribersCount.value = profile.subscribers_count || 0
          subscribesCount.value = profile.subscribes_count || 0
          // В режиме приглашения всегда обновлять имя и аватар из профиля по текущему lastTargetAddress,
          // иначе при смене собеседника без выхода через «Назад» остаются старые значения
          if (isInviteMode) {
            partnerName.value = profile.name || address || 'Новый чат'
            const img = (profile as any)?.i || (profile as any)?.avatar || (profile as any)?.image
            partnerAvatar.value = img ? getAvatarUrlFromProfile(img) || null : null
            avatarLoadFailed.value = false
          } else {
            if (!partnerAvatar.value) {
              const img = (profile as any)?.i || (profile as any)?.avatar || (profile as any)?.image
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
      }
    }

    const onAvatarError = () => {
      avatarLoadFailed.value = true
    }

    const partnerInitial = computed(() => {
      const name = partnerName.value
      return name ? name[0]!.toUpperCase() : 'U'
    })

    // Watch active dialog changes (use id to ensure reactivity across unwrap cases)
    watch(
      () => {
        const d = (store as any).activeDialog
        if (d == null) return null
        const val = typeof d === 'object' && 'id' in d ? d.id : d?.value?.id
        return val ?? null
      },
      () => {
        updatePartnerInfo()
      },
      { immediate: true }
    )

    // Watch profiles cache changes
    watch(
      () => (store as any).userProfiles,
      () => {
        updatePartnerInfo()
      },
      { deep: true }
    )

    watchEffect(() => {
      // react to active dialog, profiles and lastTargetAddress (смена собеседника в режиме приглашения)
      const _d = (store as any).activeDialog
      const _p = (store as any).userProfiles
      const _addr = (store as any).lastTargetAddress?.value ?? (store as any).lastTargetAddress
      void _d
      void _p
      void _addr
      updatePartnerInfo()
    })

    const getSupportedType = (): string | undefined => {
      const types = preferredTypes
      const tmpEl = document.createElement('audio')
      for (const t of types) {
        const mrSupported = (window as any).MediaRecorder?.isTypeSupported?.(t)
        const audioCanPlay = tmpEl.canPlayType(t.split(';')[0]!)
        if (mrSupported || audioCanPlay) return t
      }
      return undefined
    }

    const startRecording = async (e?: MouseEvent | TouchEvent) => {
      if (isRecording.value) return

      // Reset flags
      isLocked.value = false
      isCancelling.value = false
      recordingDuration.value = '00:00'
      recordedChunks.length = 0

      // Capture touch start
      if (e && 'touches' in e && e.touches.length > 0) {
        touchStartX.value = e.touches[0]!.clientX
        touchStartY.value = e.touches[0]!.clientY
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const type = getSupportedType()
        const options = type ? { mimeType: type } : undefined
        const mr = new MediaRecorder(stream, options as any)
        mediaRecorder.value = mr

        mr.ondataavailable = (e: BlobEvent) => {
          if (e.data && e.data.size > 0) {
            recordedChunks.push(e.data)
          }
        }
        mr.onstop = async () => {
          isRecording.value = false
          clearInterval(recordingTimer.value)

          if (isCancelling.value) {
            // Clean up stream but don't send
            try {
              stream.getTracks().forEach((t) => t.stop())
            } catch {
              /* ignore */
            }
            return
          }

          const blob = new Blob(recordedChunks, {
            type: (options as any)?.mimeType || 'audio/webm',
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

        // Start timer
        recordingTimer.value = setInterval(() => {
          const diff = (Date.now() - recordStartAt.value) / 1000
          recordingDuration.value = formatDuration(diff)
        }, 100)

        mr.start()
      } catch (e) {
        console.error('[ChatRoom] Failed to start recording:', e)
      }
    }

    const cancelRecording = () => {
      isCancelling.value = true
      mediaRecorder.value?.stop()
      isLocked.value = false
    }

    const stopRecording = () => {
      if (isRecording.value) {
        mediaRecorder.value?.stop()
      }
      isLocked.value = false
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isRecording.value || isLocked.value) return

      const touch = e.touches[0]
      if (!touch) return
      const diffX = touch.clientX - touchStartX.value
      const diffY = touch.clientY - touchStartY.value

      // Swipe Up to Lock (threshold -50px)
      if (diffY < -50) {
        isLocked.value = true
      }

      // Swipe Left to Cancel (threshold -50px)
      if (diffX < -50) {
        cancelRecording()
      }
    }

    const handleTouchEnd = () => {
      if (isLocked.value) return
      stopRecording()
    }

    // === Файлы: drag/drop, paste, кнопка-«скрепка» ===
    const inputAreaRef = ref<HTMLElement | null>(null)

    const handlePickFiles = async (files: File[]) => {
      if (!store.activeChatId) return
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          await store.sendImage(store.activeChatId, file, { name: file.name })
        } else if (file.type.startsWith('video/')) {
          // Видео отправляются как обычный файл (m.file) — отдельный m.video отключён.
          await store.sendFile(store.activeChatId, file, { name: file.name })
        } else {
          await store.sendFile(store.activeChatId, file, { name: file.name })
        }
      }
    }

    const { isDragging, bindToRef } = usePasteDrop({
      onMediaFiles: handlePickFiles,
      onOtherFiles: handlePickFiles,
    })
    bindToRef(inputAreaRef)

    // === PKOIN-донат (только для личных чатов) ===
    const activeChatIdForPkoin = computed<string>(() => store.activeChatId || '')
    const pkoinPartnerAddress = computed<string | null>(() => {
      if (!store.activeChatId) return null
      return store.getDirectPartnerAddress(store.activeChatId)
    })
    const canSendPkoin = computed<boolean>(() => !!pkoinPartnerAddress.value)
    const pkoinModalOpen = ref(false)
    const openPkoinModal = () => {
      pkoinModalOpen.value = true
    }
    const closePkoinModal = () => {
      pkoinModalOpen.value = false
    }
    const onPkoinSent = (txid: string) => {
      console.log('[ChatRoom] PKOIN transaction sent:', txid)
    }

    return {
      inputValue,
      inputRef,
      showEmojiPicker,
      isInitiated,
      startChatNow,
      partnerName,
      partnerAvatar,
      avatarLoadFailed,
      onAvatarError,
      partnerInitial,
      reputation,
      subscribersCount,
      subscribesCount,
      SC_PartnerInfoCard,
      handleSend,
      handleKeydown,
      handleInput,
      toggleEmojiPicker,
      onEmojiSelect,
      isRecording,
      isLocked,
      recordingDuration,
      startRecording,
      stopRecording,
      cancelRecording,
      handleTouchMove,
      handleTouchEnd,
      inputAreaRef,
      handlePickFiles,
      isDragging,
      canSendPkoin,
      pkoinPartnerAddress,
      activeChatIdForPkoin,
      pkoinModalOpen,
      openPkoinModal,
      closePkoinModal,
      onPkoinSent,
    }
  },
})
