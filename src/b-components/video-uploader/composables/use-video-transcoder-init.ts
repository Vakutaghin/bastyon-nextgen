import { ref } from 'vue'
import { transcoder } from '../transcoder'
import { t } from '@/i18n'
import type { TranscoderKind } from '../transcoder/types'

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
  /** Активный способ транскодинга — для подсказок в UI. */
  const transcoderMethod = ref<TranscoderKind | 'none'>('none')
  /** Не-блокирующее предупреждение (например, «wasm медленный, ожидайте ~N минут»). */
  const transcoderNotice = ref<string | null>(null)

  const initialize = async () => {
    if (isInitialized.value) return

    try {
      const info = await transcoder.getTranscoderInfoAsync()
      transcoderMethod.value = info.method

      if (info.method === 'tauri') {
        // Нативный путь требует системного ffmpeg — показываем инструкцию, если его нет.
        const ffmpegStatus = await transcoder.checkFfmpegAvailable()
        if (!ffmpegStatus.ffmpeg || !ffmpegStatus.ffprobe) {
          initError.value = getFfmpegMissingInstruction()
        }
      } else if (info.method === 'wasm') {
        // Браузерный путь работает standalone, но в разы медленнее — предупреждаем.
        transcoderNotice.value = t('videoMsg.wasmSlowNotice')
      } else {
        initError.value = t('videoMsg.transcodeNotSupported')
      }
      isInitialized.value = true
    } catch (error) {
      console.error('Failed to initialize video uploader:', error)
    }
  }

  return {
    isInitialized,
    initError,
    transcoderMethod,
    transcoderNotice,
    initialize,
  }
}
