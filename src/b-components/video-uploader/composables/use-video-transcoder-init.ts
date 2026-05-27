import { ref } from 'vue'
import { transcoder } from '../transcoder'

function getFfmpegMissingInstruction(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  if (/mac|darwin/i.test(ua)) {
    return 'Для транскодирования видео требуется FFmpeg. Установите его: brew install ffmpeg'
  }
  if (/win/i.test(ua)) {
    return 'Для транскодирования видео требуется FFmpeg. Установите его: winget install ffmpeg (или скачайте с ffmpeg.org)'
  }
  if (/linux/i.test(ua)) {
    return 'Для транскодирования видео требуется FFmpeg. Установите его: sudo apt install ffmpeg (или через ваш пакетный менеджер)'
  }
  return 'Для транскодирования видео требуется FFmpeg. Установите его системно (ffmpeg + ffprobe должны быть в PATH).'
}

export function useVideoTranscoderInit() {
  const isInitialized = ref(false)
  const initError = ref<string | null>(null)

  const initialize = async () => {
    if (isInitialized.value) return

    try {
      if (transcoder.isSupported()) {
        const ffmpegStatus = await transcoder.checkFfmpegAvailable()
        if (!ffmpegStatus.ffmpeg || !ffmpegStatus.ffprobe) {
          initError.value = getFfmpegMissingInstruction()
        }
      }
      isInitialized.value = true
    } catch (error) {
      console.error('Failed to initialize video uploader:', error)
    }
  }

  return {
    isInitialized,
    initError,
    initialize,
  }
}
