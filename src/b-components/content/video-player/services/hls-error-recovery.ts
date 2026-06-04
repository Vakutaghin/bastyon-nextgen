/**
 * Recovery-стратегии для HLS.js:
 * - bufferStalledError → форс startLoad не чаще раза в 5 сек
 * - NETWORK_ERROR → экспоненциальный retry до 3 раз
 * - MEDIA_ERROR → recoverMediaError, со сменой аудиокодека на 2-й попытке
 *
 * Счётчики сбрасываются на каждом успешном фрагменте (FRAG_LOADED).
 *
 * Когда hls.js исчерпал все попытки восстановления, управление передаётся в
 * `onExhausted` (если передан) — caller может, например, деградировать на прямой mp4.
 * Без `onExhausted` поведение прежнее: выставляем локализованную ошибку.
 */

import type { Ref } from 'vue'
import Hls from 'hls.js'
import { t } from '@/i18n'

export function attachHlsErrorRecovery(
  hls: Hls,
  error: Ref<string | null>,
  isLoading: Ref<boolean>,
  onExhausted?: () => void
): void {
  let networkRetryCount = 0
  let mediaRecoveryCount = 0
  let stallRecoveryAt = 0
  const MAX_NETWORK_RETRY = 3
  const MAX_MEDIA_RECOVERY = 2

  // Все попытки восстановления исчерпаны. Если есть fallback (`onExhausted`) — отдаём
  // ему; иначе показываем ошибку `fallbackMsgKey`.
  const giveUp = (fallbackMsgKey: string): void => {
    if (onExhausted) {
      onExhausted()
      return
    }
    error.value = t(fallbackMsgKey)
    isLoading.value = false
  }

  hls.on(Hls.Events.FRAG_LOADED, () => {
    networkRetryCount = 0
    mediaRecoveryCount = 0
  })

  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (!data.fatal) {
      // bufferStalledError — буфер опустошён, hls.js обычно сам восстанавливается, но
      // на медленной сети может зависнуть. Форсируем startLoad не чаще раза в 5с.
      if (data.details === 'bufferStalledError') {
        const now = Date.now()
        if (now - stallRecoveryAt > 5000) {
          stallRecoveryAt = now
          hls.startLoad(-1)
        }
        return
      }
      console.warn('HLS non-fatal error:', data.details)
      return
    }

    console.error('HLS fatal error:', data)
    switch (data.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        if (networkRetryCount < MAX_NETWORK_RETRY) {
          const delay = 1000 * Math.pow(2, networkRetryCount)
          networkRetryCount += 1
          console.warn(`HLS network retry ${networkRetryCount}/${MAX_NETWORK_RETRY} in ${delay}ms`)
          setTimeout(() => hls.startLoad(), delay)
          return
        }
        giveUp('videoMsg.networkError')
        break
      case Hls.ErrorTypes.MEDIA_ERROR:
        if (mediaRecoveryCount < MAX_MEDIA_RECOVERY) {
          mediaRecoveryCount += 1
          // На второй попытке меняем аудиокодек — рекомендованный hls.js паттерн
          if (mediaRecoveryCount === 2) {
            hls.swapAudioCodec()
          }
          hls.recoverMediaError()
          return
        }
        giveUp('videoMsg.playbackError')
        break
      default:
        giveUp('videoMsg.loadError')
        break
    }
  })
}
