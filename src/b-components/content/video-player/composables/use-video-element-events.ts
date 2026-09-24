// Composable: привязка DOM-событий <video> к реактивному состоянию плеера и
// IntersectionObserver для авто-паузы при уходе из вьюпорта.
//
// Раньше это были inline-функции setupVideoEventListeners /
// setupIntersectionObserver в video-player.vue. Регистрация слушателей
// императивна, поэтому собрана в один composable; observer чистится здесь же.

import { onBeforeUnmount, type Ref } from 'vue'

import { videoPlayerManager } from '../video-player-manager'
import { VISIBILITY_THRESHOLD } from '../consts'
import { resolveDomElement, resolveVideoElement } from './utils'

interface VideoElementEventsOptions {
  videoElement: Ref<HTMLVideoElement | null>
  videoContainer: Ref<HTMLElement | null>
  playerId: Ref<string>
  isPlaying: Ref<boolean>
  isEnded: Ref<boolean>
  isBuffering: Ref<boolean>
  isInBackground: Ref<boolean>
  stopProgressAnimation: () => void
  updateDuration: () => void
  updateBuffered: () => void
  handleVideoMetadata: () => void
}

export function useVideoElementEvents(opts: VideoElementEventsOptions) {
  const {
    videoElement,
    videoContainer,
    playerId,
    isPlaying,
    isEnded,
    isBuffering,
    isInBackground,
    stopProgressAnimation,
    updateDuration,
    updateBuffered,
    handleVideoMetadata,
  } = opts

  let intersectionObserver: IntersectionObserver | null = null
  /**
   * Снятие слушателей прошлой инициализации (S26). `initPlayer` вызывается
   * заново на retry и на fallback в mp4, и без этого на одном `<video>`
   * копились по комплекту обработчиков на каждую попытку: `pauseAllExcept`
   * дёргался N раз, буферизация мигала.
   */
  let detachVideoListeners: (() => void) | null = null

  function setupVideoEventListeners(): void {
    const video = resolveVideoElement(videoElement)
    if (!video) return

    detachVideoListeners?.()

    const handlers: Array<[keyof HTMLMediaElementEventMap, () => void]> = [
      [
        'play',
        () => {
          isPlaying.value = true
          isEnded.value = false
          videoPlayerManager.pauseAllExcept(playerId.value)
        },
      ],
      [
        'pause',
        () => {
          isPlaying.value = false
        },
      ],
      [
        'ended',
        () => {
          isPlaying.value = false
          isEnded.value = true
          stopProgressAnimation()
          if (document.fullscreenElement) document.exitFullscreen()
        },
      ],
      [
        'waiting',
        () => {
          isBuffering.value = true
        },
      ],
      [
        'playing',
        () => {
          isBuffering.value = false
          isEnded.value = false
        },
      ],
      [
        'canplay',
        () => {
          updateDuration()
          updateBuffered()
        },
      ],
      [
        'loadedmetadata',
        () => {
          updateDuration()
          updateBuffered()
          handleVideoMetadata()
        },
      ],
      [
        'durationchange',
        () => {
          updateDuration()
        },
      ],
      [
        'progress',
        () => {
          updateBuffered()
        },
      ],
    ]

    for (const [event, handler] of handlers) {
      video.addEventListener(event, handler)
    }

    detachVideoListeners = () => {
      for (const [event, handler] of handlers) {
        video.removeEventListener(event, handler)
      }
      detachVideoListeners = null
    }
  }

  function setupIntersectionObserver(): void {
    if (intersectionObserver) intersectionObserver.disconnect()

    const element = resolveDomElement(videoContainer)
    if (!element) return

    intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            // Видео ушло с экрана — обычно ставим на паузу. Но если приложение
            // ушло в фон (document.hidden / isInBackground), это «ложный» уход
            // из вьюпорта и плеер должен продолжать играть звук.
            if (isInBackground.value || document.hidden) return

            const video = resolveVideoElement(videoElement)
            if (video && !video.paused) video.pause()
          }
        }
      },
      {
        threshold: VISIBILITY_THRESHOLD,
      }
    )

    intersectionObserver.observe(element)
  }

  onBeforeUnmount(() => {
    if (intersectionObserver) intersectionObserver.disconnect()
    detachVideoListeners?.()
  })

  return { setupVideoEventListeners, setupIntersectionObserver }
}
