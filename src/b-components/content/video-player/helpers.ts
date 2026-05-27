// Хелперы видеоплеера: вычисление стилей, генерация ID

import type { AspectRatio } from './types'
import { ASPECT_RATIO_CONTAIN_THRESHOLD } from './consts'

/**
 * Генерирует уникальный ID плеера.
 */
export function generatePlayerId(): string {
  return `video-player-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Определяет, нужно ли использовать object-fit: contain
 * на основе соотношения сторон.
 */
export function shouldUseContain(width: number, height: number): boolean {
  if (width === 0 || height === 0) return false
  return width / height > ASPECT_RATIO_CONTAIN_THRESHOLD
}

/**
 * Создаёт объект AspectRatio из размеров.
 */
export function createAspectRatio(width: number, height: number): AspectRatio {
  return {
    width,
    height,
    useContain: shouldUseContain(width, height),
  }
}

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
