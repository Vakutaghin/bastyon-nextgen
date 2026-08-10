// Tauri-runtime часть универсального вьювера (Фаза 1, Tier 0): лёгкая проба типа
// контента и сохранение файла на диск. Чистая логика решения — в ipfs-content.ts.
//
// ВНИМАНИЕ: сохранение сейчас буферизует ответ целиком (arrayBuffer), как и
// выгрузка видео в use-video-manager. Для больших файлов это память — стриминг на
// диск (reqwest bytes_stream в Rust) запланирован как хардненинг Фазы 2.
import { appFetch } from '@/helpers/api/fetch-strategies'

export type ProbedHeaders = {
  contentType: string | null
  contentDisposition: string | null
}

function inTauri(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as Record<string, unknown>
  return typeof w.__TAURI_INTERNALS__ !== 'undefined' || typeof w.__TAURI__ !== 'undefined'
}

/**
 * Проба заголовков ответа gateway для выбора render-vs-download. Ranged GET
 * (первый байт) надёжнее HEAD на публичных gateway и почти бесплатен; тело не
 * читаем. При любой ошибке — null (вызывающий деградирует к render).
 */
export async function probeContent(url: string): Promise<ProbedHeaders | null> {
  try {
    const res = await appFetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } })
    return {
      contentType: res.headers.get('content-type'),
      contentDisposition: res.headers.get('content-disposition'),
    }
  } catch {
    return null
  }
}

/**
 * Скачивание ресурса gateway на диск. В Tauri — диалог сохранения + запись через
 * plugin-fs (паттерн use-video-manager). В вебе — обычная ссылка-скачивание
 * (фича Tauri-only, ветка на будущее/консистентность).
 */
export async function saveIpfsResource(url: string, filename: string): Promise<void> {
  const res = await appFetch(url)
  const blob = await res.blob()

  if (inTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeFile } = await import('@tauri-apps/plugin-fs')

    const filePath = await save({ defaultPath: filename })
    if (!filePath) return // пользователь отменил

    const bytes = new Uint8Array(await blob.arrayBuffer())
    await writeFile(filePath, bytes)
    return
  }

  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}
