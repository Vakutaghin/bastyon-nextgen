/**
 * Страница приложения в системных настройках. Если в доступе (микрофон,
 * камера) отказали насовсем, Android больше не показывает свой диалог — включить
 * доступ можно только там. Есть в приложении для Android: её открывает плагин
 * VoiceInput.
 */

import { isAndroidVoice, voiceInvoke } from '@/helpers/voice-input/voice-backend'

export function canOpenAppSettings(): boolean {
  return isAndroidVoice()
}

export function openAppSettings(): void {
  voiceInvoke('asr_open_mic_settings').catch(() => {})
}

/** Браузер или система отказали странице в доступе к устройству. */
export function isAccessDenied(err: unknown): boolean {
  const name = err instanceof Error || err instanceof DOMException ? err.name : ''
  return name === 'NotAllowedError' || name === 'SecurityError'
}
