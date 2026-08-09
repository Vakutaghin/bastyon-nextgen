// Медиа-производные карточки поста: главы из тайм-кодов, YouTube-эмбеды (кроме
// постов с внутриплатформенным видео) и перемотка плеера по тайм-коду. Владеет
// ref'ом плеера. Вынесено из post-card.vue (см. LARGE_FILE_SPLIT_AUDIT.md).
import { computed, ref } from 'vue'
import { getYoutubeEmbedUrls } from '@/helpers/common/youtube-url'
import { parseTimecodes, type Chapter } from '@/helpers/content/timecode-parser'
import type { Post } from './post-card.types'

export function usePostMedia(getPost: () => Post) {
  const videoPlayerRef = ref<{ seekTo?: (s: number) => void } | null>(null)

  /** Главы из тайм-кодов в описании (для video/audio постов). */
  const chapters = computed<Chapter[]>(() => {
    const post = getPost()
    const isMedia = (post.type === 'video' || post.type === 'audio') && !!post.videoUrl
    if (!isMedia) return []
    return parseTimecodes(post.content)
  })

  const youtubeEmbedUrls = computed<string[]>(() => {
    const post = getPost()
    if (!post) return []
    // Не показываем YouTube-эмбеды, если пост содержит внутриплатформенное видео —
    // это привело бы к двум плеерам.
    const hasInPlatformVideo = (post.type === 'video' || post.type === 'audio') && !!post.videoUrl
    if (hasInPlatformVideo) return []
    const fromContent = getYoutubeEmbedUrls(post.content)
    const fromPreview = getYoutubeEmbedUrls(post.preview)
    const seen = new Set(fromContent)
    for (const url of fromPreview) seen.add(url)
    return Array.from(seen)
  })

  /** Клик по тайм-коду в описании → плеер перематывает и запускает. */
  function handleSeekTimecode(seconds: number): void {
    const player = videoPlayerRef.value
    if (player && typeof player.seekTo === 'function') {
      player.seekTo(seconds)
    }
  }

  return { videoPlayerRef, chapters, youtubeEmbedUrls, handleSeekTimecode }
}
