/**
 * Утилиты для определения окружения и доступных API
 */

/**
 * Проверка, запущено ли приложение в Capacitor
 */
export function isCapacitor(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    // Проверяем наличие Capacitor в глобальном объекте
    const win = window as any
    if (win.Capacitor || win.CapacitorWeb) {
      return true
    }

    // Проверяем через импорт (может быть не всегда доступен)
    // Это будет работать только если @capacitor/core установлен
    if (typeof (window as any).Capacitor !== 'undefined') {
      return true
    }
  } catch {
    // Игнорируем ошибки
  }

  return false
}

/**
 * Проверка, запущено ли приложение в Tauri (синхронная версия).
 * Используем только runtime-признаки (window/navigator): в браузере при открытии
 * того же dev-сервера (запущенного через tauri dev) VITE_TAURI может быть в бандле,
 * но __TAURI__ и др. в браузере отсутствуют.
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const win = window as any

  // Tauri 1.x
  if (typeof win.__TAURI__ !== 'undefined') {
    return true
  }

  // Tauri 2.x
  if (typeof win.__TAURI_INTERNALS__ !== 'undefined') {
    return true
  }
  if (typeof win.__TAURI_METADATA__ !== 'undefined') {
    return true
  }
  try {
    const keys = Object.keys(win).filter((key) => key.startsWith('__TAURI'))
    if (keys.length > 0) {
      return true
    }
  } catch {
    // ignore
  }
  if (typeof win.invoke !== 'undefined') {
    return true
  }
  if (typeof navigator !== 'undefined' && navigator.userAgent.includes('Tauri')) {
    return true
  }
  if (typeof win.__TAURI_APP_READY__ !== 'undefined' && win.__TAURI_APP_READY__) {
    return true
  }

  return false
}

/**
 * Асинхронная проверка Tauri через попытку использования invoke.
 * Вызывать только когда возможен Tauri (например, сборка с VITE_TAURI), иначе в браузере
 * импорт @tauri-apps/api может успешно загрузиться и дать ложное срабатывание.
 */
export async function isTauriAsync(): Promise<boolean> {
  if (isTauri()) {
    return true
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    if (typeof invoke !== 'function') return false
    try {
      await invoke('__tauri_internal_check')
      return true
    } catch (e: unknown) {
      const msg = ((e instanceof Error ? e.message : null) ?? String(e)).toLowerCase()
      // Только явная ошибка «команда не найдена» = мы в Tauri, команды нет
      if (
        (msg.includes('command') && msg.includes('not found')) ||
        msg.includes('unknown command')
      ) {
        return true
      }
      // В браузере: "undefined", "not available" — не Tauri
      if (
        msg.includes('undefined') ||
        msg.includes('not available') ||
        msg.includes('is not defined')
      ) {
        return false
      }
    }
    return false
  } catch {
    return false
  }
}

/**
 * Проверка поддержки WebCodecs API
 */
export function supportsWebCodecs(): boolean {
  return (
    typeof window !== 'undefined' &&
    'VideoDecoder' in window &&
    'VideoEncoder' in window &&
    'AudioDecoder' in window &&
    'AudioEncoder' in window
  )
}

/**
 * Проверка поддержки MediaRecorder API
 */
export function supportsMediaRecorder(): boolean {
  return typeof MediaRecorder !== 'undefined'
}

/**
 * Проверка поддержки конкретного MIME-типа в MediaRecorder
 */
export function supportsMimeType(mimeType: string): boolean {
  if (!supportsMediaRecorder()) {
    return false
  }
  return MediaRecorder.isTypeSupported(mimeType)
}

/**
 * Получить лучший доступный метод транскодирования
 * @returns 'tauri' | 'capacitor' | 'webcodecs' | 'mediarecorder' | null
 */
export function getBestConverter(): 'tauri' | 'capacitor' | 'webcodecs' | 'mediarecorder' | null {
  if (isTauri()) {
    return 'tauri'
  }
  if (isCapacitor()) {
    // В Capacitor можно использовать нативные плагины для транскодирования
    return 'capacitor'
  }
  if (supportsWebCodecs()) {
    return 'webcodecs'
  }
  if (supportsMediaRecorder()) {
    return 'mediarecorder'
  }
  return null
}

/**
 * Получить лучший доступный MIME-тип для кодирования
 * Проверяет поддержку различных кодеков в порядке приоритета
 */
export function getBestMimeType(): string | null {
  if (!supportsMediaRecorder()) {
    return null
  }

  // Приоритетный порядок проверки кодеков
  const mimeTypes = [
    'video/webm;codecs=vp9,opus', // VP9 + Opus (лучшее качество)
    'video/webm;codecs=vp9', // VP9 без аудио
    'video/webm;codecs=vp8,opus', // VP8 + Opus
    'video/webm;codecs=vp8', // VP8 без аудио
    'video/webm', // WebM без указания кодека
    'video/mp4;codecs=h264,aac', // H.264 + AAC
    'video/mp4;codecs=h264', // H.264 без аудио
    'video/mp4', // MP4 без указания кодека
  ]

  for (const mimeType of mimeTypes) {
    if (supportsMimeType(mimeType)) {
      return mimeType
    }
  }

  return null
}

/**
 * Проверка поддержки OffscreenCanvas (для Web Workers)
 */
export function supportsOffscreenCanvas(): boolean {
  return typeof OffscreenCanvas !== 'undefined'
}

/**
 * Получить информацию о доступных возможностях окружения
 */
export function getEnvironmentInfo() {
  return {
    isTauri: isTauri(),
    isCapacitor: isCapacitor(),
    supportsWebCodecs: supportsWebCodecs(),
    supportsMediaRecorder: supportsMediaRecorder(),
    supportsOffscreenCanvas: supportsOffscreenCanvas(),
    bestConverter: getBestConverter(),
    bestMimeType: getBestMimeType(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
  }
}
