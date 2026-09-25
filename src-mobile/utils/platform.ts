/**
 * Утилиты для определения платформы и окружения
 */

import { Capacitor } from '@capacitor/core'

export type Platform = 'web' | 'tauri' | 'capacitor-ios' | 'capacitor-android'

/**
 * Определить текущую платформу
 */
export function getPlatform(): Platform {
  if (typeof window === 'undefined') {
    return 'web'
  }

  const win = window as unknown as Record<string, unknown>

  // Проверка Tauri (приоритет выше, так как Tauri может работать поверх Capacitor)
  if (
    win.__TAURI__ ||
    win.__TAURI_INTERNALS__ ||
    win.__TAURI_METADATA__ ||
    (typeof navigator !== 'undefined' && navigator.userAgent.includes('Tauri'))
  ) {
    return 'tauri'
  }

  // Проверка Capacitor
  if (Capacitor.isNativePlatform()) {
    const platform = Capacitor.getPlatform()
    return platform === 'ios' ? 'capacitor-ios' : 'capacitor-android'
  }

  return 'web'
}

/**
 * Проверить, является ли платформа мобильной (iOS или Android через Capacitor)
 */
export function isMobile(): boolean {
  const platform = getPlatform()
  return platform === 'capacitor-ios' || platform === 'capacitor-android'
}

/**
 * Проверить, является ли платформа Tauri
 */
export function isTauri(): boolean {
  return getPlatform() === 'tauri'
}
