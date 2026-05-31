import { ref } from 'vue'
import { transcoder } from '../transcoder'
import { t } from '@/i18n'

function getFfmpegMissingInstruction(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  if (/mac|darwin/i.test(ua)) {
    return t('videoMsg.ffmpegMissingMac')
  }
  if (/win/i.test(ua)) {
    return t('videoMsg.ffmpegMissingWin')
  }
  if (/linux/i.test(ua)) {
    return t('videoMsg.ffmpegMissingLinux')
  }
  return t('videoMsg.ffmpegMissingGeneric')
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
