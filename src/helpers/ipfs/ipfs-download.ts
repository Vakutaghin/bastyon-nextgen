// Лёгкая проба типа IPFS-контента для выбора «показать или скачать». Чистая
// логика решения — в ipfs-content.ts. Само сохранение — в Rust (ipfs_save):
// потоком на диск, с публичного шлюза с проверкой по CID.
import { appFetch, getTauriFetch } from '@/helpers/api/fetch-strategies'

export type ProbedHeaders = {
  contentType: string | null
  contentDisposition: string | null
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
    // 4xx/5xx (504 шлюза, «not found» ноды) — это НЕ контент: иначе страница
    // ошибки классифицировалась бы как text/plain→render, а per-CID fallback
    // (`!probed`) не срабатывал бы на быстрый отказ.
    if (!res.ok) return null
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
