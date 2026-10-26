// Скачивание медиа (картинка/файл) на устройство. Для кросс-доменных URL
// (peertube) тянем blob через appFetch (под Tor — torFetch, в Tauri —
// plugin-http без CORS), blob:/data: уже в памяти страницы. Сохраняет
// saveBlobToDevice; если по сети не скачалось — фолбэк: открываем снаружи,
// пользователь сохранит вручную.

import { appFetch } from '@/helpers/api/fetch-strategies'
import { openExternal } from '@/helpers/common/open-external'
import { saveBlobToDevice, type SaveResult } from '@/helpers/common/save-to-device'

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

/**
 * Скачивает медиа по URL на устройство. 'opened' — скачать не вышло, ссылка
 * открыта снаружи (в Tauri это системный браузер: window.open там no-op, V40).
 */
export async function downloadMedia(
  url: string,
  filename?: string
): Promise<SaveResult | 'opened'> {
  if (!url) return 'failed'
  let blob: Blob
  try {
    const inPage = /^(blob|data):/i.test(url)
    const res = inPage ? await fetch(url) : await appFetch(url, { credentials: 'omit' })
    if (!res.ok) throw new Error(`http ${res.status}`)
    blob = await res.blob()
  } catch {
    if (!/^https?:/i.test(url)) return 'failed'
    void openExternal(url)
    return 'opened'
  }
  return saveBlobToDevice(blob, filename || deriveFilename(url))
}
