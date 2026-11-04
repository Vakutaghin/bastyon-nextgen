// Composable: превью (poster) видео и расчёт соотношения сторон.
//
// Грузит thumbnail через PeerTube-хелпер, отслеживает загрузку превью и
// метаданные видео, и отдаёт inline-стили обёртки/превью/видео (contain vs
// cover в зависимости от соотношения сторон). Раньше эта логика была инлайн
// в video-player.vue.
//
// Пропорции ролика (`aspect`) — для рамки плеера: вертикальный ролик в рамке
// 16:9 выходил узкой полосой посередине. Точнее всего — по самому ролику,
// до запуска — из описания на сервере, у старых роликов — по обложке.

import { computed, ref, type Ref } from 'vue'

import { getVideoPosterFromUrl } from '@/helpers/api/peertube-url'
import { ASPECT_RATIO_CONTAIN_THRESHOLD } from '../consts'
import { resolveVideoElement } from './utils'

/**
 * Известные пропорции роликов: плеер, смонтированный заново (лента вернулась
 * к посту), сразу строит нужную рамку, а не 16:9 до ответа сервера.
 */
const knownAspect = new Map<string, number>()

interface AspectRatio {
  width: number
  height: number
  useContain: boolean
}

export function useVideoThumbnail(
  videoElement: Ref<HTMLVideoElement | null>,
  videoUrl: Ref<string>,
  refreshMetadata: () => void
) {
  const thumbnailUrl = ref<string | null>(null)
  const isThumbnailLoaded = ref(false)
  const thumbnailAspectRatio = ref<AspectRatio | null>(null)
  const videoAspectRatio = ref<AspectRatio | null>(null)
  /** Пропорции из описания ролика на сервере. */
  const serverAspect = ref<number | null>(null)

  /** Ширина к высоте: по ролику, по описанию, по обложке; `null` — неизвестно. */
  const aspect = computed<number | null>(() => {
    const fromVideo = videoAspectRatio.value
    if (fromVideo) return fromVideo.width / fromVideo.height
    if (serverAspect.value) return serverAspect.value
    const fromThumb = thumbnailAspectRatio.value
    if (fromThumb) return fromThumb.width / fromThumb.height
    return knownAspect.get(videoUrl.value) ?? null
  })

  function remember(ratio: number): void {
    if (Number.isFinite(ratio) && ratio > 0) knownAspect.set(videoUrl.value, ratio)
  }

  function loadThumbnail(): void {
    serverAspect.value = null
    thumbnailAspectRatio.value = null
    videoAspectRatio.value = null
    const url = videoUrl.value
    getVideoPosterFromUrl(url)
      .then((poster) => {
        if (url !== videoUrl.value) return
        thumbnailUrl.value = poster.url
        serverAspect.value = poster.aspectRatio
        if (poster.aspectRatio) remember(poster.aspectRatio)
      })
      .catch(() => {
        // Превью не критично: невалидный URL / PeerTube 5xx — просто
        // показываем плеер без превью, не засоряя консоль.
        thumbnailUrl.value = null
      })
  }

  function handleThumbnailLoad(e: Event): void {
    isThumbnailLoaded.value = true

    const img = e.target as HTMLImageElement
    if (img.naturalWidth && img.naturalHeight) {
      const aspectRatio = img.naturalWidth / img.naturalHeight
      const useContain = aspectRatio > ASPECT_RATIO_CONTAIN_THRESHOLD

      thumbnailAspectRatio.value = {
        width: img.naturalWidth,
        height: img.naturalHeight,
        useContain,
      }
      if (!serverAspect.value) remember(aspectRatio)
    }
  }

  function handleThumbnailError(): void {
    isThumbnailLoaded.value = true
  }

  function handleVideoMetadata(): void {
    const video = resolveVideoElement(videoElement)
    if (!video) return

    // Длительность стала известна — обновим media session, чтобы scrubber
    // на lock screen / в notification получил корректный диапазон.
    refreshMetadata()

    const videoWidth = video.videoWidth
    const videoHeight = video.videoHeight
    if (videoWidth === 0 || videoHeight === 0) return

    const aspectRatio = videoWidth / videoHeight
    const useContain = aspectRatio > ASPECT_RATIO_CONTAIN_THRESHOLD

    videoAspectRatio.value = {
      width: videoWidth,
      height: videoHeight,
      useContain,
    }
    remember(aspectRatio)
  }

  function getVideoWrapperStyle(): Record<string, string> {
    const aspectInfo = videoAspectRatio.value || thumbnailAspectRatio.value
    if (aspectInfo && aspectInfo.useContain) {
      // Полосы по краям вертикального ролика — чёрные, как у YouTube.
      return { backgroundColor: 'var(--color-black)' }
    }
    return {}
  }

  function getThumbnailStyle(): Record<string, string> {
    return { objectFit: 'contain' }
  }
  function getVideoStyle(): Record<string, string> {
    return { objectFit: 'contain' }
  }

  return {
    thumbnailUrl,
    isThumbnailLoaded,
    thumbnailAspectRatio,
    videoAspectRatio,
    aspect,
    loadThumbnail,
    handleThumbnailLoad,
    handleThumbnailError,
    handleVideoMetadata,
    getVideoWrapperStyle,
    getThumbnailStyle,
    getVideoStyle,
  }
}
