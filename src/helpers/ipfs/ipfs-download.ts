// Tauri-runtime часть универсального вьювера (Фаза 1, Tier 0): лёгкая проба типа
// контента и сохранение файла на диск. Чистая логика решения — в ipfs-content.ts.
//
// ВНИМАНИЕ: сохранение сейчас буферизует ответ целиком (arrayBuffer), как и
// выгрузка видео в use-video-manager. Для больших файлов это память — стриминг на
// диск (reqwest bytes_stream в Rust) запланирован как хардненинг Фазы 2.
import { appFetch, getTauriFetch } from '@/helpers/api/fetch-strategies'

export type ProbedHeaders = {
  contentType: string | null
  contentDisposition: string | null
}

function inTauri(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as Record<string, unknown>
  return typeof w.__TAURI_INTERNALS__ !== 'undefined' || typeof w.__TAURI__ !== 'undefined'
}

function isLoopback(url: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(url)
}

/**
 * Fetch для IPFS-шлюза. Локальную ноду (loopback) НИКОГДА не торифицируем —
 * Tor не ходит в 127.0.0.1, иначе Tier 1 стал бы неработоспособен при включённом
 * Tor. Публичный шлюз идёт через appFetch (при Tor включён — торифицируется, что
 * для пробы даже плюс к приватности).
 */
async function ipfsFetch(url: string, init?: RequestInit): Promise<Response> {
  if (isLoopback(url)) {
    const tf = await getTauriFetch()
    return (tf ?? globalThis.fetch)(url, init)
  }
  return appFetch(url, init)
}

/** Таймаут пробы: локальная нода на холодном CID может висеть — тогда падаем на
 *  публичный шлюз (Tier 1 → Tier 0). Публичный шлюз обычно отвечает быстро. */
const PROBE_TIMEOUT_MS = 8000

/**
 * Проба заголовков ответа gateway для выбора render-vs-download. Ranged GET
 * (первый байт) надёжнее HEAD на публичных gateway и почти бесплатен; тело не
 * читаем. При ошибке/таймауте — null (вызывающий деградирует к render/fallback).
 */
export async function probeContent(
  url: string,
  timeoutMs: number = PROBE_TIMEOUT_MS
): Promise<ProbedHeaders | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await ipfsFetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      signal: controller.signal,
    })
    const headers = {
      contentType: res.headers.get('content-type'),
      contentDisposition: res.headers.get('content-disposition'),
    }
    return headers
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    // Заголовки уже сняты — отпускаем тело/соединение, чтобы plugin-http не
    // копил висящие response-ресурсы на каждый клик.
    controller.abort()
  }
}

/**
 * Скачивание ресурса gateway на диск. В Tauri — диалог сохранения + запись через
 * plugin-fs (паттерн use-video-manager). В вебе — обычная ссылка-скачивание
 * (фича Tauri-only, ветка на будущее/консистентность).
 */
export async function saveIpfsResource(url: string, filename: string): Promise<void> {
  const res = await ipfsFetch(url)
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
