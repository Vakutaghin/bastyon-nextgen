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

  const win = window as any

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
 * Проверить, является ли платформа нативной (Tauri или Capacitor)
 */
export function isNative(): boolean {
  const platform = getPlatform()
  return platform !== 'web'
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

/**
 * Проверить, является ли платформа веб-браузером
 */
export function isWeb(): boolean {
  return getPlatform() === 'web'
}

/**
 * Проверить, является ли платформа iOS
 */
export function isIOS(): boolean {
  return getPlatform() === 'capacitor-ios'
}

/**
 * Проверить, является ли платформа Android
 */
export function isAndroid(): boolean {
  return getPlatform() === 'capacitor-android'
}

/**
 * Получить информацию о платформе
 */
export function getPlatformInfo() {
  const platform = getPlatform()
  return {
    platform,
    isNative: isNative(),
    isMobile: isMobile(),
    isTauri: isTauri(),
    isWeb: isWeb(),
    isIOS: isIOS(),
    isAndroid: isAndroid(),
    capacitorPlatform: Capacitor.isNativePlatform() ? Capacitor.getPlatform() : null,
  }
}
