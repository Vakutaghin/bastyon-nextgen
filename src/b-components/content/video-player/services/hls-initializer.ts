/**
 * Ветки инициализации видео в зависимости от source/окружения:
 * - {@link initBlobVideo} — blob:/data: URL, без HLS
 * - {@link initHlsJsVideo} — HLS.js (для большинства браузеров)
 * - {@link initNativeHlsVideo} — нативный HLS (Safari)
 * - {@link initProgressiveVideo} — прямой mp4 (fallback, когда HLS не воспроизводится)
 *
 * Каждая ветка делает одинаковый «финализ»: проставляет volume/playbackRate,
 * включает контролы на 3с, ставит IntersectionObserver, и опционально
 * автоплеит. Чтобы не дублировать — {@link finalizeVideoInit}.
 */

import { nextTick, type Ref } from 'vue'
import Hls from 'hls.js'
import { t } from '@/i18n'
import { videoPlayerManager } from '../video-player-manager'
import { tryAutoplay } from '../composables/utils'
import { attachHlsErrorRecovery, HLS_LOAD_POLICY } from './hls-error-recovery'

export interface VideoInitContext {
  volume: Ref<number>
  playbackRate: Ref<number>
  showControlsInitially: Ref<boolean>
  isLoading: Ref<boolean>
  isInitialized: Ref<boolean>
  error: Ref<string | null>
  playerId: Ref<string>
  autoplay: boolean
  forcePlay: boolean
  setupVideoEventListeners: () => void
  updateBuffered: () => void
  setupIntersectionObserver: () => void
}

/** Общий «после-инициализационный» хвост: setup events, volume, autoplay, observer. */
function finalizeVideoInit(video: HTMLVideoElement, ctx: VideoInitContext): void {
  ctx.isLoading.value = false
  ctx.isInitialized.value = true
  ctx.showControlsInitially.value = true
  setTimeout(() => {
    ctx.showControlsInitially.value = false
  }, 3000)

  ctx.setupVideoEventListeners()

  video.volume = ctx.volume.value
  video.playbackRate = ctx.playbackRate.value

  setTimeout(ctx.updateBuffered, 300)

  nextTick(() => {
    ctx.setupIntersectionObserver()
  })

  if (ctx.autoplay || ctx.forcePlay) {
    // Останавливаем все другие видеоплееры перед автозапуском
    videoPlayerManager.pauseAllExcept(ctx.playerId.value)
    tryAutoplay(video)
  }
}

/** blob:/data: URL — назначаем src напрямую, без HLS. */
export function initBlobVideo(
  video: HTMLVideoElement,
  videoUrl: string,
  ctx: VideoInitContext
): void {
  video.src = videoUrl
  video.load()

  video.addEventListener(
    'loadedmetadata',
    () => {
      finalizeVideoInit(video, ctx)
    },
    { once: true }
  )

  video.addEventListener(
    'error',
    () => {
      ctx.isLoading.value = false
      ctx.error.value = t('videoMsg.loadError')
    },
    { once: true }
  )
}

/**
 * Прямой mp4 на том же `<video>` — деградация, когда HLS фатально не воспроизвёлся.
 * Источник (`videoUrl`) — прогрессивный файл с той же ноды; см. getProgressiveVideoUrl.
 *
 * `resumeAt` — с какой секунды продолжить: HLS мог оборваться посреди ролика,
 * и начинать заново с нуля нельзя.
 */
export function initProgressiveVideo(
  video: HTMLVideoElement,
  videoUrl: string,
  ctx: VideoInitContext,
  resumeAt = 0
): void {
  video.src = videoUrl
  video.load()

  video.addEventListener(
    'loadedmetadata',
    () => {
      if (resumeAt > 0 && resumeAt < video.duration) video.currentTime = resumeAt
      finalizeVideoInit(video, ctx)
    },
    { once: true }
  )

  video.addEventListener(
    'error',
    () => {
      ctx.isLoading.value = false
      ctx.error.value = t('videoMsg.playbackError')
    },
    { once: true }
  )
}

/**
 * HLS.js — для браузеров без нативной поддержки HLS.
 *
 * Возвращает инстанс Hls — caller должен сохранить ссылку и destroy() в onBeforeUnmount.
 * `onLevelsLoaded` вызывается после MANIFEST_PARSED, чтобы caller мог обновить
 * UI списка качества (composable держит реактивный список).
 */
export function initHlsJsVideo(
  video: HTMLVideoElement,
  playlistUrl: string,
  ctx: VideoInitContext,
  onLevelsLoaded: (hls: Hls) => void,
  onExhausted?: () => void
): Hls {
  const hls = new Hls({
    enableWorker: true,
    lowLatencyMode: false,
    maxBufferLength: 60,
    maxMaxBufferLength: 300,
    // Жёсткий потолок в байтах: на 4K стриме без него буфер съедает >1GB RAM и убивает мобильный браузер
    maxBufferSize: 60 * 1000 * 1000,
    ...HLS_LOAD_POLICY,
  })

  hls.loadSource(playlistUrl)
  hls.attachMedia(video)

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    onLevelsLoaded(hls)
    finalizeVideoInit(video, ctx)
  })

  attachHlsErrorRecovery(hls, ctx.error, ctx.isLoading, onExhausted)

  return hls
}

/** Столько плейлист, который играет сам `<video>`, может стоять на месте, пока должен играть. */
export const NATIVE_HLS_STALL_MS = 15_000

/**
 * Нативный HLS (Safari без MediaSource — старые iPhone) — назначаем playlistUrl
 * как src. `onError` (если передан) вызывается при ошибке загрузки — caller может
 * деградировать на прямой mp4.
 *
 * Safari на битых кусках не шлёт `error`: плейлист разобран, а ролик молча стоит
 * (`stalled`). Поэтому сдаёмся и тогда, когда ролик должен играть, а время не
 * двигается {@link NATIVE_HLS_STALL_MS}.
 *
 * Возвращает функцию, которая снимает слежку: её зовут при переходе на mp4,
 * повторной инициализации и размонтировании.
 */
export function initNativeHlsVideo(
  video: HTMLVideoElement,
  playlistUrl: string,
  ctx: VideoInitContext,
  onError?: () => void
): () => void {
  const session = new AbortController()
  video.src = playlistUrl

  if (onError) {
    let lastTime = -1
    let stuckSince = Date.now()
    const fail = (): void => {
      if (session.signal.aborted) return
      session.abort()
      onError()
    }
    const poll = setInterval(() => {
      if (video.paused || video.ended || video.currentTime !== lastTime) {
        lastTime = video.currentTime
        stuckSince = Date.now()
        return
      }
      if (Date.now() - stuckSince >= NATIVE_HLS_STALL_MS) fail()
    }, 1000)
    session.signal.addEventListener('abort', () => clearInterval(poll))
    video.addEventListener('error', fail, { signal: session.signal })
  }

  finalizeVideoInit(video, ctx)
  return () => session.abort()
}
