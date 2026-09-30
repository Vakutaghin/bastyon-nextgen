/**
 * Запуск PixiJS для декоративной графики (звёзды и монеты, волна аудио).
 *
 * Без WebGL — урезанные или старые WebView, эмуляторы — PixiJS 8 падает на
 * `init()`: запасной Canvas-рендерер у него не готов («CanvasRenderer is not
 * yet implemented»). Раньше это уходило в общий обработчик ошибок, и при
 * каждом запуске всплывало «Что-то пошло не так». Теперь эффект просто не
 * показывается, а отказ запоминается до перезапуска: пробовать снова
 * бессмысленно.
 */

import type { ApplicationOptions } from 'pixi.js'
import { logger } from '@/services/logger'

/** То, что нужно от Application: сам запуск. */
export interface PixiInitTarget {
  init(options?: Partial<ApplicationOptions>): Promise<void>
}

let unavailable = false

/**
 * Запускает `app` и отвечает, получилось ли. При `false` приложение не
 * запущено: трогать его (canvas, destroy) нельзя.
 */
export async function initPixiApp(
  app: PixiInitTarget,
  options: Partial<ApplicationOptions>,
  scope: string
): Promise<boolean> {
  if (unavailable) return false
  try {
    await app.init(options)
    return true
  } catch (e) {
    unavailable = true
    logger.warn(scope, 'PixiJS unavailable, the effect is off:', e)
    return false
  }
}

/** Сброс запомненного отказа — только для тестов. */
export function resetPixiAvailabilityForTests(): void {
  unavailable = false
}
