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
 * Проверка, запущено ли приложение в Tauri (синхронная версия)
 * В Tauri 2.x проверяем наличие различных глобальных объектов
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
  
  // Tauri 2.x - проверяем наличие внутренних объектов
  if (typeof win.__TAURI_INTERNALS__ !== 'undefined') {
    return true
  }
  
  // Tauri 2.x - проверяем наличие метаданных
  if (typeof win.__TAURI_METADATA__ !== 'undefined') {
    return true
  }
  
  // Проверяем наличие глобального объекта, который создается Tauri 2.x
  try {
    const keys = Object.keys(win).filter(key => key.startsWith('__TAURI'))
    if (keys.length > 0) {
      return true
    }
  } catch {
    // Игнорируем ошибки
  }
  
  // Проверяем наличие invoke в глобальной области
  if (typeof win.invoke !== 'undefined') {
    return true
  }
  
  // Проверяем userAgent
  if (typeof navigator !== 'undefined' && navigator.userAgent.includes('Tauri')) {
    return true
  }
  
  return false
}

/**
 * Асинхронная проверка Tauri через попытку использования invoke
 * Более надежный способ для Tauri 2.x
 */
export async function isTauriAsync(): Promise<boolean> {
  // Сначала проверяем синхронно
  if (isTauri()) {
    return true
  }
  
  // Пытаемся использовать invoke для проверки
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    // Если мы можем импортировать invoke без ошибки, значит мы в Tauri
    // В браузере этот импорт должен выбросить ошибку или вернуть undefined
    if (typeof invoke === 'function') {
      // Пытаемся вызвать простую команду для проверки
      // Если команда не существует, но мы в Tauri - получим ошибку о команде
      // Если мы не в Tauri - получим другую ошибку
      try {
        await invoke('__tauri_internal_check')
      } catch (e: any) {
        const errorMessage = e?.message || String(e)
        // Если ошибка связана с отсутствием команды или Tauri - мы в Tauri
        if (errorMessage.includes('command') || errorMessage.includes('not found') || errorMessage.includes('Tauri')) {
          return true
        }
        // Другие ошибки могут означать, что мы не в Tauri
      }
      return true
    }
    return false
  } catch (e: any) {
    // Если импорт не удался, значит мы не в Tauri
    const errorMessage = e?.message || String(e)
    // В некоторых случаях импорт может не выбросить ошибку, но вернуть undefined
    // В этом случае мы уже проверили выше
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
    'video/mp4' // MP4 без указания кодека
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
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
  }
}
