/**
 * Запись голосового сообщения с touch-жестами (swipe-up = lock, swipe-left = cancel).
 *
 * Композабла отвечает только за state-machine и MediaRecorder, отправку аудио
 * делегирует через `onAudioRecorded` колбэк — это позволяет чату решать,
 * куда писать (sendAudio для активного диалога), не таща сюда messenger-store.
 *
 * См. CODE_AUDIT.md §1. Раньше всё это жило в chat-room.vue inline.
 */
import { ref, type Ref } from 'vue'
import { formatDuration } from '../../helpers'

const PREFERRED_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/aac',
]

const SWIPE_THRESHOLD_PX = 50

export interface VoiceRecording {
  isRecording: Ref<boolean>
  isLocked: Ref<boolean>
  recordingDuration: Ref<string>
  startRecording: (e?: MouseEvent | TouchEvent) => Promise<void>
  cancelRecording: () => void
  stopRecording: () => void
  handleTouchMove: (e: TouchEvent) => void
  handleTouchEnd: () => void
}

export interface VoiceRecordingOptions {
  /** Куда отдать записанный blob после mr.stop(). Длительность — в секундах. */
  onAudioRecorded: (blob: Blob, durationSec: number) => Promise<void> | void
}

function pickSupportedType(): string | undefined {
  const tmpEl = document.createElement('audio')
  for (const t of PREFERRED_TYPES) {
    const mrSupported = (
      window as Window & { MediaRecorder?: typeof MediaRecorder }
    ).MediaRecorder?.isTypeSupported?.(t)
    const audioCanPlay = tmpEl.canPlayType(t.split(';')[0]!)
    if (mrSupported || audioCanPlay) return t
  }
  return undefined
}

export function useVoiceRecording(opts: VoiceRecordingOptions): VoiceRecording {
  const isRecording = ref(false)
  const isLocked = ref(false)
  const isCancelling = ref(false)
  const recordingDuration = ref('00:00')
  const recordingTimer = ref<ReturnType<typeof setInterval> | null>(null)
  const mediaRecorder = ref<MediaRecorder | null>(null)
  const recordedChunks: BlobPart[] = []
  const recordStartAt = ref(0)
  const touchStartX = ref(0)
  const touchStartY = ref(0)

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
      const type = pickSupportedType()
      const options: MediaRecorderOptions | undefined = type ? { mimeType: type } : undefined
      const mr = new MediaRecorder(stream, options)
      mediaRecorder.value = mr

      mr.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) recordedChunks.push(ev.data)
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
        const durationSec = (Date.now() - recordStartAt.value) / 1000
        await opts.onAudioRecorded(blob, durationSec)
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
    } catch (err) {
      console.error('[ChatRoom] Failed to start recording:', err)
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

    // Свайп вверх → залочить запись.
    if (diffY < -SWIPE_THRESHOLD_PX) isLocked.value = true

    // Свайп влево → отменить.
    if (diffX < -SWIPE_THRESHOLD_PX) cancelRecording()
  }

  function handleTouchEnd(): void {
    if (isLocked.value) return
    stopRecording()
  }

  return {
    isRecording,
    isLocked,
    recordingDuration,
    startRecording,
    cancelRecording,
    stopRecording,
    handleTouchMove,
    handleTouchEnd,
  }
}
