import { defineComponent, ref, type PropType, nextTick } from 'vue'
import type { Message } from '../../types'
import { SC_MessageInputArea, SC_MessageInput, SC_SendButton, SC_EmojiToggleButton, SC_VoiceButton, SC_RecordingTimer, SC_SwipeHint, SC_CancelButton } from './styled'
import MessageList from '../message-list/message-list.vue'
import EmojiPicker from '../emoji-picker/emoji-picker.vue'
import { useMessengerStore } from '../../store'

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
    MessageList,
    EmojiPicker
  },
  props: {
    messages: {
      type: Array as PropType<Message[]>,
      required: true
    }
  },
  emits: ['send', 'load-more'],
  setup(props, { emit }) {
    const inputValue = ref('')
    const inputRef = ref<any>(null)
    const showEmojiPicker = ref(false)
    const store = useMessengerStore()

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
      'audio/aac'
    ]

    const formatDuration = (seconds: number) => {
      const m = Math.floor(seconds / 60)
      const s = Math.floor(seconds % 60)
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    const adjustHeight = () => {
      const el = inputRef.value?.$el
      if (el) {
        el.style.height = 'auto'
        el.style.height = (el.scrollHeight + 2) + 'px'
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

    const getSupportedType = (): string | undefined => {
      const types = preferredTypes
      const tmpEl = document.createElement('audio')
      for (const t of types) {
        const mrSupported = (window as any).MediaRecorder?.isTypeSupported?.(t)
        const audioCanPlay = tmpEl.canPlayType(t.split(';')[0])
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
        touchStartX.value = e.touches[0].clientX
        touchStartY.value = e.touches[0].clientY
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
              stream.getTracks().forEach(t => t.stop())
            } catch (_e) {}
            return
          }

          const blob = new Blob(recordedChunks, { type: (options as any)?.mimeType || 'audio/webm' })
          const duration = (Date.now() - recordStartAt.value) / 1000
          if (store.activeChatId) {
            await store.sendAudio(store.activeChatId, blob, { duration, name: 'voice-message' })
          }
          try {
            stream.getTracks().forEach(t => t.stop())
          } catch (_e) {}
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

    return {
      inputValue,
      inputRef,
      showEmojiPicker,
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
      handleTouchEnd
    }
  }
})
