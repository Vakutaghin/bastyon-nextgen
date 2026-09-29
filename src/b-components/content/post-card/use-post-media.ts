// Медиа-производные карточки поста: главы из тайм-кодов, эмбеды YouTube и Vimeo (кроме
// постов с внутриплатформенным видео), ссылка под карточку превью и перемотка
// плеера по тайм-коду. Владеет ref'ом плеера. Вынесено из post-card.vue (аудит
// крупных файлов 2026-08).
import { computed, ref } from 'vue'
import {
  getVideoEmbeds,
  isImageUrl,
  parseVideoUrl,
  type VideoEmbed,
} from '@/helpers/common/video-embed-url'
import { safeDecode } from '@/helpers/content/safe-decode'
import { parseTimecodes, type Chapter } from '@/helpers/content/timecode-parser'
import type { Post } from './post-card.types'

/** Ссылка поста (`u`): старые посты хранят её целиком закодированной (`https%3A%2F%2F…`). */
function decodedUrl(value: string | undefined): string {
  const raw = (value || '').trim()
  return /^https?%3A/i.test(raw) ? safeDecode(raw) : raw
}

export function usePostMedia(getPost: () => Post) {
  const videoPlayerRef = ref<{ seekTo?: (s: number) => void } | null>(null)

  /** Главы из тайм-кодов в описании (для video/audio постов). */
  const chapters = computed<Chapter[]>(() => {
    const post = getPost()
    const isMedia = (post.type === 'video' || post.type === 'audio') && !!post.videoUrl
    if (!isMedia) return []
    return parseTimecodes(post.content)
  })

  const videoEmbeds = computed<VideoEmbed[]>(() => {
    const post = getPost()
    if (!post) return []
    // Не показываем эмбеды, если пост содержит внутриплатформенное видео —
    // это привело бы к двум плеерам.
    const hasInPlatformVideo = (post.type === 'video' || post.type === 'audio') && !!post.videoUrl
    if (hasInPlatformVideo) return []
    return getVideoEmbeds(decodedUrl(post.videoUrl), post.content, post.preview)
  })

  /**
   * Обычная веб-ссылка поста (`u`) — под карточку превью. У видео свой плеер,
   * у YouTube встраивание, картинку и так видно. Старые посты хранят `u`
   * целиком закодированным (`https%3A%2F%2F…`).
   */
  const linkPreviewUrl = computed<string>(() => {
    const post = getPost()
    if (post.type === 'video' || post.type === 'audio' || post.type === 'article') return ''
    const url = decodedUrl(post.videoUrl)
    if (!/^https?:\/\//i.test(url)) return ''
    if (parseVideoUrl(url).kind || isImageUrl(url)) return ''
    return url
  })

  /** Клик по тайм-коду в описании → плеер перематывает и запускает. */
  function handleSeekTimecode(seconds: number): void {
    const player = videoPlayerRef.value
    if (player && typeof player.seekTo === 'function') {
      player.seekTo(seconds)
    }
  }

  return { videoPlayerRef, chapters, videoEmbeds, linkPreviewUrl, handleSeekTimecode }
}
