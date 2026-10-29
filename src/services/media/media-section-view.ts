/**
 * Вид ленты разделов «Видео» и «Аудио»: сеткой роликов (у аудио — списком
 * треков) или постами, как главная лента. У каждого раздела свой, запоминается
 * на устройстве.
 */

import type { MediaType } from './media-post'

export type MediaSectionView = 'media' | 'posts'

export const SECTION_VIEW_KEYS: Record<MediaType, string> = {
  video: 'bastyon_video_section_view',
  audio: 'bastyon_audio_section_view',
}

export function loadSectionView(type: MediaType): MediaSectionView {
  try {
    return localStorage.getItem(SECTION_VIEW_KEYS[type]) === 'posts' ? 'posts' : 'media'
  } catch {
    return 'media'
  }
}

export function saveSectionView(type: MediaType, view: MediaSectionView): void {
  try {
    localStorage.setItem(SECTION_VIEW_KEYS[type], view)
  } catch {
    // Хранилище закрыто (приватный режим) — вид просто не запомнится.
  }
}
