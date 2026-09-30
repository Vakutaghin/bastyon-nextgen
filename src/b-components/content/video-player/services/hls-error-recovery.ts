/**
 * Recovery-стратегии для HLS.js:
 * - bufferStalledError → форс startLoad не чаще раза в 5 сек
 * - NETWORK_ERROR → один повтор загрузки через секунду; плейлист, который не
 *   пришёл, не повторяем: `startLoad` его заново не запрашивает
 * - MEDIA_ERROR → recoverMediaError, со сменой аудиокодека на 2-й попытке
 *
 * Счётчики сбрасываются на каждом успешном фрагменте (FRAG_LOADED).
 *
 * Сам hls.js перед фатальной ошибкой уже повторяет запрос
 * ({@link HLS_LOAD_POLICY}), поэтому своих повторов немного: раньше битый
 * кусок держал спиннер около двух минут (шесть повторов hls.js до 31 с,
 * и так трижды), прежде чем плеер переходил на прямой mp4.
 *
 * Когда hls.js исчерпал все попытки восстановления, управление передаётся в
 * `onExhausted` (если передан) — caller может, например, деградировать на прямой mp4.
 * Без `onExhausted` поведение прежнее: выставляем локализованную ошибку.
 */

import type { Ref } from 'vue'
import Hls, { type HlsConfig } from 'hls.js'
import { t } from '@/i18n'

/**
 * Повторы запросов кусков внутри hls.js: две попытки с паузой 1 и 2 с и
 * одна — после 10 с молчания сервера. Фатальная ошибка приходит через
 * несколько секунд, а не через полминуты.
 */
export const HLS_LOAD_POLICY: Pick<HlsConfig, 'fragLoadPolicy'> = {
  fragLoadPolicy: {
    default: {
      maxTimeToFirstByteMs: 10_000,
      maxLoadTimeMs: 120_000,
      timeoutRetry: { maxNumRetry: 1, retryDelayMs: 0, maxRetryDelayMs: 0 },
      errorRetry: { maxNumRetry: 2, retryDelayMs: 1000, maxRetryDelayMs: 2000 },
    },
  },
}

/** Плейлист не пришёл или не разобрался: повтор загрузки его не вернёт. */
const MANIFEST_ERRORS: ReadonlySet<string> = new Set([
  Hls.ErrorDetails.MANIFEST_LOAD_ERROR,
  Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT,
  Hls.ErrorDetails.MANIFEST_PARSING_ERROR,
  Hls.ErrorDetails.LEVEL_LOAD_ERROR,
  Hls.ErrorDetails.LEVEL_LOAD_TIMEOUT,
  Hls.ErrorDetails.LEVEL_PARSING_ERROR,
])

export function attachHlsErrorRecovery(
  hls: Hls,
  error: Ref<string | null>,
  isLoading: Ref<boolean>,
  onExhausted?: () => void
): void {
  let networkRetryCount = 0
  let mediaRecoveryCount = 0
  let stallRecoveryAt = 0
  const MAX_NETWORK_RETRY = 1
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
        if (!MANIFEST_ERRORS.has(data.details) && networkRetryCount < MAX_NETWORK_RETRY) {
          networkRetryCount += 1
          console.warn(`HLS network retry ${networkRetryCount}/${MAX_NETWORK_RETRY}`)
          setTimeout(() => hls.startLoad(), 1000)
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
