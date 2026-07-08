/**
 * Генерация device fingerprint для шифрования
 *
 * Улучшения:
 * - Используется SHA-256 (Web Crypto API) вместо простого 32-bit хеша
 * - Fallback на CryptoJS SHA-256 если Web Crypto недоступен
 * - Обратная совместимость: сохраненный fingerprint не пересоздается
 */

import CryptoJS from 'crypto-js'
import type { DeviceFingerprint } from '../types/storage'
import { DEVICE_FINGERPRINT_KEY } from '../constants/storage'

/**
 * SHA-256 хеш строки (синхронный fallback через CryptoJS).
 */
function sha256Hex(input: string): string {
  return CryptoJS.SHA256(input).toString(CryptoJS.enc.Hex)
}

/**
 * Генерирует уникальный fingerprint устройства.
 * Использует различные характеристики браузера/устройства
 * и хеширует результат через SHA-256.
 * @returns 64-char hex fingerprint
 */
export function generateDeviceFingerprint(): DeviceFingerprint {
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

  // Hardware concurrency
  if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
    components.push(String(navigator.hardwareConcurrency))
  }

  // Разрешение экрана
  if (typeof screen !== 'undefined') {
    components.push(`${screen.width}x${screen.height}`)
    components.push(`${screen.colorDepth}`)
    if (screen.availWidth) components.push(`${screen.availWidth}x${screen.availHeight}`)
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

  // Canvas fingerprint
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 50
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillStyle = '#f60'
      ctx.fillRect(125, 1, 62, 20)
      ctx.fillStyle = '#069'
      ctx.fillText('Device fingerprint \ud83d\ude00', 2, 15)
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
      ctx.fillText('Device fingerprint \ud83d\ude00', 4, 17)
      components.push(canvas.toDataURL())
    }
  } catch {
    // Canvas недоступен
  }

  // WebGL fingerprint
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (gl) {
      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info')
      if (debugInfo) {
        const vendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
        const renderer = (gl as WebGLRenderingContext).getParameter(
          debugInfo.UNMASKED_RENDERER_WEBGL
        )
        components.push(vendor || '')
        components.push(renderer || '')
      }
    }
  } catch {
    // WebGL недоступен
  }

  // Хешируем все компоненты через SHA-256
  const combined = components.join('|')
  return sha256Hex(combined)
}

/**
 * Читает СОХРАНЁННЫЙ fingerprint как есть, НЕ генерируя новый (в отличие от
 * getDeviceFingerprint). Нужен для legacy-миграции сейфа и heal-ветки чтения
 * (P0-1): вернуть тот самый ключ, которым старые данные были зашифрованы, и
 * `null`, когда fingerprint уже удалён после успешной миграции — чтобы не
 * «оживлять» legacy-путь [P1-I].
 */
export function readStoredFingerprint(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const saved = localStorage.getItem(DEVICE_FINGERPRINT_KEY)
    return saved && saved.length >= 8 ? saved : null
  } catch {
    return null
  }
}

/**
 * Получает или генерирует device fingerprint.
 * Сохраняет в localStorage для постоянства.
 * @param forceRegenerate - Принудительно перегенерировать
 * @returns Device fingerprint
 */
export function getDeviceFingerprint(forceRegenerate: boolean = false): DeviceFingerprint {
  const STORAGE_KEY = DEVICE_FINGERPRINT_KEY

  try {
    // Проверяем сохраненный fingerprint (обратная совместимость: принимаем даже старый формат)
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
  } catch {
    // В случае ошибки возвращаем базовый fingerprint
    return 'default_fp_' + Date.now().toString(16)
  }
}
