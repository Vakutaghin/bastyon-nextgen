// Хелперы видеоплеера: стиль обёртки, обработчик одиночного и двойного клика

import type { AspectRatio } from './types'

/**
 * Стиль обёртки видео (фон для contain-режима): полосы по краям вертикального
 * ролика чёрные, как у YouTube, а не светло-серые.
 */
export function getVideoWrapperStyle(aspectInfo: AspectRatio | null): Record<string, string> {
  if (aspectInfo?.useContain) {
    return { backgroundColor: 'var(--color-black)' }
  }
  return {}
}

/**
 * Возвращает click-handler с разделением одиночного/двойного клика.
 * Одиночный → togglePlay, двойной → toggleFullscreen.
 * delay — окно ожидания второго клика (мс).
 */
export function createClickHandler(
  togglePlay: () => void,
  toggleFullscreen: () => void,
  delay: number
): () => void {
  let clickTimer: ReturnType<typeof setTimeout> | null = null
  return () => {
    if (clickTimer) {
      clearTimeout(clickTimer)
      clickTimer = null
      toggleFullscreen()
    } else {
      clickTimer = setTimeout(() => {
        clickTimer = null
        togglePlay()
      }, delay)
    }
  }
}
