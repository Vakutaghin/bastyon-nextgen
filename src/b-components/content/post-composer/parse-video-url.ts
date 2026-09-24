/**
 * Исторический путь импорта композера. Канонический разбор — в
 * `@/helpers/common/video-embed-url` (S31): один экстрактор для композера и ленты.
 */
export type { ParsedVideo, ParsedVideoKind } from '@/helpers/common/video-embed-url'
export {
  extractVimeoId,
  extractYoutubeId,
  firstVideoUrl,
  parseVideoUrl,
} from '@/helpers/common/video-embed-url'
