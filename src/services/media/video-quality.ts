// Качество видео — одно на всё приложение: выбрали 144p в одном плеере — так
// начинают и остальные ролики, пока качество не сменят. «Авто» — плеер
// подбирает сам. Хранится на устройстве.

import { ref } from 'vue'
import { VIDEO_QUALITY_KEY } from '@/blockchain/constants/storage'

/** Ступени качества, как их называют: «144p», «240p»… */
const STEPS: readonly number[] = [144, 240, 360, 480, 720, 1080]

/** Уровень качества hls.js — только то, по чему видно, «сколько это p». */
export interface QualityLevel {
  height?: number
  width?: number
}

/**
 * Ступень уровня. Считается по короткой стороне: у вертикального ролика 144p
 * кадр 144×256, и по высоте он выходил «360p». Нестандартные (352) — до
 * ближайшей ступени сверху.
 */
export function levelQuality(level: QualityLevel): number {
  const height = level.height || 0
  const width = level.width || 0
  const side = width > 0 && height > 0 ? Math.min(width, height) : height
  return STEPS.find((step) => side <= step) ?? side
}

export function qualityLabel(level: QualityLevel): string {
  return `${levelQuality(level)}p`
}

/**
 * Уровень под выбранное качество: такой же или ближайший ниже; все выше —
 * самый низкий. `-1` — уровней нет.
 */
export function levelForQuality(levels: readonly QualityLevel[], quality: number): number {
  let best = -1
  let lowest = -1
  levels.forEach((level, index) => {
    const q = levelQuality(level)
    if (lowest === -1 || q < levelQuality(levels[lowest]!)) lowest = index
    if (q <= quality && (best === -1 || q > levelQuality(levels[best]!))) best = index
  })
  return best === -1 ? lowest : best
}

function readQuality(): number | null {
  try {
    const n = Number(localStorage.getItem(VIDEO_QUALITY_KEY))
    return Number.isInteger(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

/** Выбранное качество (ступень) или `null` — «Авто». */
export const preferredQuality = ref<number | null>(readQuality())

export function setPreferredQuality(quality: number | null): void {
  preferredQuality.value = quality
  try {
    if (quality === null) localStorage.removeItem(VIDEO_QUALITY_KEY)
    else localStorage.setItem(VIDEO_QUALITY_KEY, String(quality))
  } catch {
    // Без хранилища качество живёт до перезапуска.
  }
}

/** Для тестов: перечитать сохранённое. */
export function reloadPreferredQualityForTests(): void {
  preferredQuality.value = readQuality()
}
