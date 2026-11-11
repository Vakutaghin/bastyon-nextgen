// Скачивание медиа (картинка/файл) на устройство. Для кросс-доменных URL
// (peertube) тянем blob через appFetch (под Tor — torFetch, в Tauri —
// plugin-http без CORS), blob:/data: уже в памяти страницы. Сохраняет
// saveBlobToDevice; если по сети не скачалось — фолбэк: открываем снаружи,
// пользователь сохранит вручную.

import { appFetch } from '@/helpers/api/fetch-strategies'
import { openExternal } from '@/helpers/common/open-external'
import { saveBlobToDevice, type SaveResult } from '@/helpers/common/save-to-device'
import { typeFromBytes } from '@/helpers/ipfs/ipfs-sniff'

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
 * Имя скачанной картинки: `image_from_bastyon_2026-11-12_14-05-33`, время —
 * момент скачивания по часам устройства. Расширение добавит сохранение — по
 * типу картинки.
 */
export function bastyonImageName(at: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  const date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
  const time = `${pad(at.getHours())}-${pad(at.getMinutes())}-${pad(at.getSeconds())}`
  return `image_from_bastyon_${date}_${time}`
}

/**
 * Тип картинки — по первым байтам: сервер чата отдаёт её как
 * application/octet-stream, а расшифрованная помечена image/jpeg и тогда,
 * когда это PNG. Без типа файл сохранился бы без расширения.
 */
async function withImageType(blob: Blob): Promise<Blob> {
  const declared = blob.type.split(';')[0]?.trim().toLowerCase() ?? ''
  if (declared && declared !== 'application/octet-stream' && !declared.startsWith('image/')) {
    return blob
  }
  const head = new Uint8Array(await blob.slice(0, 32).arrayBuffer())
  const sniffed = typeFromBytes(head)
  if (!sniffed.startsWith('image/') || sniffed === declared) return blob
  return new Blob([blob], { type: sniffed })
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
  return saveBlobToDevice(await withImageType(blob), filename || deriveFilename(url))
}
