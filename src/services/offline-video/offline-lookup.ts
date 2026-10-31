// Есть ли у ролика скачанная копия — для плеера, фонового звука, обложки и
// субтитров. Локальная копия важнее сети и при живой сети: экономит трафик.
//
// Без Pinia: модуль зовут хелперы PeerTube. Список кладёт стор скачанного
// (offline-videos-store); до него первый вопрос сам спросит бэкенд.

import { parsePeerTubeUrl } from '@/helpers/api/peertube-parser'
import { offlineBackend } from './backend'
import type { OfflineFile, OfflineItem } from './types'

/** Ключ ролика: id из ссылки (обычно uuid) — одинаковый у копий в архиве и зеркалах. */
export function offlineVideoKey(peertubeUrl: string | undefined | null): string | null {
  const parsed = peertubeUrl ? parsePeerTubeUrl(peertubeUrl) : null
  return parsed ? parsed.videoId.toLowerCase() : null
}

const byKey = new Map<string, OfflineItem>()
let loaded: Promise<void> | null = null
/** Адрес копии для страницы → для ExoPlayer: при сворачивании ждать нельзя. */
const nativeByPageUrl = new Map<string, string>()

function keysOf(item: OfflineItem): string[] {
  const keys = [offlineVideoKey(item.meta.peertubeUrl), item.meta.uuid?.toLowerCase()]
  return keys.filter((k): k is string => !!k)
}

function forget(id: string): void {
  for (const [key, item] of byKey) if (item.id === id) byKey.delete(key)
}

/** Весь список (стор после чтения у бэкенда). */
export function rememberOfflineItems(items: readonly OfflineItem[]): void {
  byKey.clear()
  for (const item of items) for (const key of keysOf(item)) byKey.set(key, item)
  loaded = Promise.resolve()
}

/** Один ролик изменился; null — удалён. */
export function rememberOfflineItem(id: string, item: OfflineItem | null): void {
  forget(id)
  if (item) for (const key of keysOf(item)) byKey.set(key, item)
}

async function ensureLoaded(): Promise<void> {
  loaded ??= offlineBackend()
    .then((backend) => backend?.list() ?? [])
    .then(rememberOfflineItems)
    .catch(() => {
      loaded = null
    })
  await loaded
}

/** Скачанная копия, если уже известно о ней (без запроса к бэкенду). */
export function knownLocalCopy(peertubeUrl: string | undefined | null): OfflineItem | null {
  const key = offlineVideoKey(peertubeUrl)
  const item = key ? byKey.get(key) : undefined
  return item?.state.status === 'done' ? item : null
}

/** Скачанная до конца копия ролика или null. */
export async function localCopy(peertubeUrl: string): Promise<OfflineItem | null> {
  if (!offlineVideoKey(peertubeUrl)) return null
  await ensureLoaded()
  return knownLocalCopy(peertubeUrl)
}

/** Адрес файла копии для `<video>`, `<img>` или `fetch`; null — копии нет. */
export async function offlineFileUrl(
  peertubeUrl: string,
  file: OfflineFile
): Promise<string | null> {
  const item = await localCopy(peertubeUrl)
  if (!item) return null
  if (file === 'thumb.jpg' && !item.meta.thumb) return null
  if (file === 'avatar.jpg' && !item.meta.avatar) return null
  const backend = await offlineBackend()
  return backend ? backend.fileUrl(item.id, file).catch(() => null) : null
}

export interface OfflineSources {
  /** Для `<video>` и `<audio>` страницы. */
  url: string
  /** Для ExoPlayer фонового звука (Android); null — нет нативного плеера. */
  nativeUrl: string | null
}

/** Откуда играть скачанное; null — копии нет. */
export async function offlineSources(peertubeUrl: string): Promise<OfflineSources | null> {
  const item = await localCopy(peertubeUrl)
  if (!item) return null
  const backend = await offlineBackend()
  if (!backend) return null
  try {
    const url = await backend.fileUrl(item.id, 'video.mp4')
    const nativeUrl = backend.nativeUrl ? await backend.nativeUrl(item.id) : null
    if (nativeUrl) nativeByPageUrl.set(url, nativeUrl)
    return { url, nativeUrl }
  } catch {
    return null
  }
}

/**
 * Что отдать ExoPlayer вместо адреса страницы. `undefined` — это не скачанная
 * копия; `null` — копия, но нативного адреса для неё не знаем.
 */
export function nativeUrlForPageUrl(pageUrl: string): string | null | undefined {
  const known = nativeByPageUrl.get(pageUrl)
  if (known) return known
  return pageUrl.includes('/_offline_/') ? null : undefined
}

export interface OfflineCaptionTrack {
  language: string
  label: string
  url: string
}

/** Субтитры копии; null — копии нет (тогда — с ноды). */
export async function offlineCaptions(peertubeUrl: string): Promise<OfflineCaptionTrack[] | null> {
  const item = await localCopy(peertubeUrl)
  if (!item) return null
  const backend = await offlineBackend()
  if (!backend) return null
  const out: OfflineCaptionTrack[] = []
  for (const c of item.meta.captions ?? []) {
    const url = await backend.fileUrl(item.id, c.file as OfflineFile).catch(() => null)
    if (url) out.push({ language: c.language, label: c.label, url })
  }
  return out
}

/** Для тестов. */
export function resetOfflineLookup(): void {
  byKey.clear()
  nativeByPageUrl.clear()
  loaded = null
}
