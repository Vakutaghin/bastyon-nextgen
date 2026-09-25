// Хелперы видеоплеера: стиль обёртки, обработчик одиночного и двойного клика

import type { AspectRatio } from './types'

/**
 * Стиль обёртки видео (фон для contain-режима).
 */
export function getVideoWrapperStyle(aspectInfo: AspectRatio | null): Record<string, string> {
  if (aspectInfo?.useContain) {
    return { backgroundColor: '#f5f5f5' }
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
