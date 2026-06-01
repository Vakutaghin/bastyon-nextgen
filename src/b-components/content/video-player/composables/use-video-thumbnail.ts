// Composable: превью (poster) видео и расчёт соотношения сторон.
//
// Грузит thumbnail через PeerTube-хелпер, отслеживает загрузку превью и
// метаданные видео, и отдаёт inline-стили обёртки/превью/видео (contain vs
// cover в зависимости от соотношения сторон). Раньше эта логика была инлайн
// в video-player.vue.

import { ref, type Ref } from 'vue'

import { getVideoThumbnailFromUrl } from '@/helpers/api/peertube-url'
import { ASPECT_RATIO_CONTAIN_THRESHOLD } from '../consts'
import { resolveVideoElement } from './utils'

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

  function loadThumbnail(): void {
    getVideoThumbnailFromUrl(videoUrl.value)
      .then((url) => {
        thumbnailUrl.value = url
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
  }

  function getVideoWrapperStyle(): Record<string, string> {
    const aspectInfo = videoAspectRatio.value || thumbnailAspectRatio.value
    if (aspectInfo && aspectInfo.useContain) {
      return { backgroundColor: 'var(--color-bg-tertiary)' }
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
    loadThumbnail,
    handleThumbnailLoad,
    handleThumbnailError,
    handleVideoMetadata,
    getVideoWrapperStyle,
    getThumbnailStyle,
    getVideoStyle,
  }
}
