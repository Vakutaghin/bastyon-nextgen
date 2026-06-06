// Скачивание медиа (картинка/файл) в браузере. Для кросс-доменных URL (peertube)
// тянем blob через fetch и отдаём через временный object URL; если fetch упал
// (нет CORS) — фолбэк: открываем в новой вкладке, пользователь сохранит вручную.

/** Имя файла из URL: последний сегмент pathname (без query/hash), иначе дефолт. */
export function deriveFilename(url: string, fallback = 'download'): string {
  if (!url) return fallback
  try {
    const base = typeof window !== 'undefined' ? window.location.href : 'http://localhost/'
    const seg = new URL(url, base).pathname.split('/').filter(Boolean).pop()
    const name = seg ? decodeURIComponent(seg) : ''
    return name || fallback
  } catch {
    return fallback
  }
}

function triggerAnchorDownload(href: string, filename: string): void {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * Скачивает медиа по URL. Возвращает true, если запущено blob-скачивание,
 * false — если сработал фолбэк (открытие в новой вкладке).
 */
export async function downloadMedia(url: string, filename?: string): Promise<boolean> {
  if (!url) return false
  const name = filename || deriveFilename(url)
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`http ${res.status}`)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    triggerAnchorDownload(objectUrl, name)
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
    return true
  } catch {
    // CORS/сетевой сбой — открываем в новой вкладке как запасной вариант.
    window.open(url, '_blank', 'noopener,noreferrer')
    return false
  }
}
