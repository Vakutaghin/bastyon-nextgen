/**
 * Генерация device fingerprint для шифрования
 */

import type { DeviceFingerprint } from '../types/storage'
import { DEVICE_FINGERPRINT_KEY } from '../constants/storage'

/**
 * Генерирует уникальный fingerprint устройства
 * Использует различные характеристики браузера/устройства
 * @returns Device fingerprint строка
 */
export function generateDeviceFingerprint(): DeviceFingerprint {
  // Собираем информацию об устройстве
  const components: string[] = []

  // User Agent
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    components.push(navigator.userAgent)
  }

  // Язык
  if (typeof navigator !== 'undefined' && navigator.language) {
    components.push(navigator.language)
  }

  // Платформа
  if (typeof navigator !== 'undefined' && navigator.platform) {
    components.push(navigator.platform)
  }

  // Разрешение экрана
  if (typeof screen !== 'undefined') {
    components.push(`${screen.width}x${screen.height}`)
    components.push(`${screen.colorDepth}`)
  }

  // Часовой пояс
  if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      components.push(timeZone)
    } catch {
      // Игнорируем ошибки
    }
  }

  // Canvas fingerprint (если доступен)
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillText('Device fingerprint', 2, 2)
      const canvasData = canvas.toDataURL()
      components.push(canvasData.substring(0, 100)) // Первые 100 символов
    }
  } catch {
    // Canvas недоступен
  }

  // WebGL fingerprint (если доступен)
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
      if (debugInfo) {
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        components.push(vendor || '')
        components.push(renderer || '')
      }
    }
  } catch {
    // WebGL недоступен
  }

  // Объединяем все компоненты
  const combined = components.join('|')

  // Простое хеширование (можно улучшить, но для простоты используем простой подход)
  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }

  // Конвертируем в hex строку
  const fingerprint = Math.abs(hash).toString(16).padStart(8, '0')

  // Если fingerprint слишком короткий, добавляем дополнительную информацию
  if (fingerprint.length < 16) {
    const additional = combined
      .split('')
      .map((c) => c.charCodeAt(0).toString(16))
      .join('')
      .substring(0, 16 - fingerprint.length)
    return (fingerprint + additional).substring(0, 16)
  }

  return fingerprint.substring(0, 16)
}

/**
 * Получает или генерирует device fingerprint
 * Сохраняет в localStorage для постоянства
 * @param forceRegenerate - Принудительно перегенерировать
 * @returns Device fingerprint
 */
export function getDeviceFingerprint(forceRegenerate: boolean = false): DeviceFingerprint {
  const STORAGE_KEY = DEVICE_FINGERPRINT_KEY

  try {
    // Проверяем сохраненный fingerprint
    if (!forceRegenerate && typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && saved.length >= 8) {
        return saved
      }
    }

    // Генерируем новый
    const fingerprint = generateDeviceFingerprint()

    // Сохраняем в localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, fingerprint)
      } catch {
        // Игнорируем ошибки сохранения
      }
    }

    return fingerprint
  } catch (error) {
    // В случае ошибки возвращаем базовый fingerprint
    return 'default_fp_' + Date.now().toString(16)
  }
}
