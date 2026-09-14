/**
 * Фаза A — выбор PeerTube-хоста для загрузки видео.
 *
 * Нода отдаёт хост через `peertube/best`. Тот же контракт уже используется для
 * загрузки картинок (image-upload-service). Полноценный двухступенчатый выбор
 * (roys → детерминированный рой по адресу → best) — отдельный [should], здесь
 * минимально достаточный путь: best {type:'upload'} (нода сама берёт randroykey).
 */

import { fetchHttp } from '@/helpers/api/request'

/** Тип отбора инстанса под задачу (веса ранжирования на ноде различаются). */
export type PeertubeHostType = 'upload' | 'importVideo' | 'liveStream'

/**
 * Резолвит хост под задачу через ноду (`peertube/best`). Бросает, если нода не
 * вернула хост (все инстансы заполнены/недоступны — вызывающий показывает ретрай).
 */
export async function resolvePeertubeHost(type: PeertubeHostType = 'upload'): Promise<string> {
  const res = (await fetchHttp({ path: 'peertube/best', data: { type } })) as
    | { host?: string }
    | string
    | null

  const host = typeof res === 'string' ? res : res?.host
  if (!host) throw new Error('peertube_no_host')
  return host
}

// ─── allowlist хостов от ноды ────────────────────────────────────────────────

/** Как долго держать список инстансов в памяти (мс). */
const ALLOWLIST_TTL_MS = 10 * 60 * 1000

let allowlistCache: { hosts: Set<string>; fetchedAt: number } | null = null

/**
 * `peertube/allservers` отдаёт рои: `{ "0": [host, …], "1": [...] }` (или
 * массив массивов). Плоский набор хостов в нижнем регистре.
 */
export function parseAllServers(data: unknown): Set<string> {
  const out = new Set<string>()
  const roys: unknown[] = Array.isArray(data)
    ? data
    : data && typeof data === 'object'
      ? Object.values(data as Record<string, unknown>)
      : []
  for (const roy of roys) {
    const hosts: unknown[] = Array.isArray(roy)
      ? roy
      : roy && typeof roy === 'object'
        ? Object.keys(roy as Record<string, unknown>)
        : []
    for (const h of hosts) if (typeof h === 'string' && h.trim()) out.add(h.trim().toLowerCase())
  }
  return out
}

/**
 * Хосты PeerTube, которые знает нода (`peertube/allservers`), с кэшем на 10 мин.
 * Нужен там, где подпись пользователя уходит на хост из чужих данных
 * (mini-app `videos.remove`, K2): на неизвестный хост подпись не отправляем.
 * Бросает, если нода не ответила — вызывающий должен fail-closed.
 */
export async function fetchPeertubeHostAllowlist(
  fetch: typeof fetchHttp = fetchHttp,
  now: () => number = Date.now
): Promise<Set<string>> {
  if (allowlistCache && now() - allowlistCache.fetchedAt < ALLOWLIST_TTL_MS)
    return allowlistCache.hosts
  const res = (await fetch({ path: 'peertube/allservers', data: {} })) as
    | { data?: unknown }
    | unknown
  const data =
    res && typeof res === 'object' && 'data' in res ? (res as { data?: unknown }).data : res
  const hosts = parseAllServers(data)
  if (hosts.size === 0) throw new Error('peertube_allowlist_empty')
  allowlistCache = { hosts, fetchedAt: now() }
  return hosts
}

/** Сброс кэша (тесты). */
export function resetPeertubeHostAllowlistCache(): void {
  allowlistCache = null
}
