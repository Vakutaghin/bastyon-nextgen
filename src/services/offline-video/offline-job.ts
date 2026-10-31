// Что и откуда качать: качества ролика по описанию с PeerTube и задание для
// бэкенда. Источники — те же, что у плеера: файл рядом с плейлистом (у копии
// в архиве или на зеркале `fileUrl` ведёт на выведенную ноду), исходная нода,
// архив выведенной ноды.

import { besidePlaylist, type PeerTubeVideoInfo } from '@/helpers/api/peertube-url'
import { peertubeArchiveFor } from '@/helpers/api/peertube-archive'
import { getVideoThumbnailUrl } from '@/helpers/api/peertube-url'
import type { OfflineExtra, OfflineJob, OfflineMeta } from './types'

export interface OfflineQuality {
  height: number
  /** Байт; 0 — нода не сказала. */
  size: number
  fileUrl: string
  playlistUrl?: string
  sha256Url?: string
}

/** Ролик ещё обрабатывается: файлов качеств пока нет. */
export function isProcessing(info: PeerTubeVideoInfo): boolean {
  if (info.state && info.state.id !== 1) return true
  return offlineQualities(info).length === 0
}

/**
 * Качества для скачивания по возрастанию. Каждое качество HLS — один mp4 со
 * звуком; старые ролики без HLS — прямые файлы (без сумм фрагментов).
 */
export function offlineQualities(info: PeerTubeVideoInfo): OfflineQuality[] {
  const byHeight = new Map<number, OfflineQuality>()
  for (const playlist of info.streamingPlaylists ?? []) {
    for (const f of playlist?.files ?? []) {
      const height = f.resolution?.id ?? 0
      if (!f.fileUrl || height <= 0 || byHeight.has(height)) continue
      byHeight.set(height, {
        height,
        size: f.size ?? 0,
        fileUrl: f.fileUrl,
        playlistUrl: playlist.playlistUrl,
        sha256Url: playlist.segmentsSha256Url,
      })
    }
  }
  for (const f of info.files ?? []) {
    const height = f.resolution?.id ?? 0
    if (!f.fileUrl || height <= 0 || byHeight.has(height)) continue
    byHeight.set(height, { height, size: f.size ?? 0, fileUrl: f.fileUrl })
  }
  return [...byHeight.values()].sort((a, b) => a.height - b.height)
}

/** Ближайшее к запомненному не выше его; всё выше — самое маленькое. */
export function pickQuality(
  qualities: readonly OfflineQuality[],
  preferred: number
): OfflineQuality | null {
  if (!qualities.length) return null
  const fitting = qualities.filter((q) => q.height <= preferred)
  return fitting.length ? fitting[fitting.length - 1]! : qualities[0]!
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

function withHost(url: string, host: string): string | null {
  try {
    const u = new URL(url)
    u.host = host
    return u.href
  } catch {
    return null
  }
}

function isAbsolute(url: string | null | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url)
}

/** Тот же файл по всем известным адресам, без повторов. */
export function fileSources(fileUrl: string, playlistUrl?: string): string[] {
  const out: string[] = [besidePlaylist(fileUrl, playlistUrl), fileUrl]
  const host = hostOf(fileUrl)
  const archive = host ? peertubeArchiveFor(host) : null
  if (archive) out.push(withHost(fileUrl, archive) ?? '')
  return [...new Set(out.filter(isAbsolute))]
}

/** Адрес субтитров в dev идёт через vite-прокси — бэкенду нужен настоящий. */
export function absolutePeerTubeUrl(url: string): string | null {
  const proxied = /^\/api\/peertube\/([^/]+)(\/.*)$/.exec(url)
  if (proxied) return `https://${proxied[1]}${proxied[2]}`
  return isAbsolute(url) ? url : null
}

/** id папки: буквы, цифры, `-` и `_`. */
export function offlineId(uuid: string, height: number): string {
  const safe = uuid.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80) || 'video'
  return `${safe}-${height}`
}

/** Что известно о посте с роликом — из карточки, без сети. */
export interface OfflineSource {
  peertubeUrl: string
  kind: 'video' | 'audio'
  postId?: string
  title: string
  description?: string
  author: { address: string; name?: string; avatarUrl?: string | null }
  duration?: number
}

export interface OfflineCaptionSource {
  language: string
  label: string
  url: string
}

export function buildOfflineJob(args: {
  source: OfflineSource
  info: PeerTubeVideoInfo
  quality: OfflineQuality
  captions: readonly OfflineCaptionSource[]
  account: string
  /**
   * Взять и плейлист качества (Android): ExoPlayer фонового звука не умеет
   * перематывать фрагментированный mp4 PeerTube — по плейлисту с BYTERANGE
   * умеет.
   */
  withPlaylist?: boolean
  now?: number
}): { job: OfflineJob; meta: OfflineMeta } {
  const { source, info, quality, account } = args
  const id = offlineId(info.uuid, quality.height)
  const servedBy = info.servedBy ?? hostOf(quality.fileUrl) ?? ''
  const extras: OfflineExtra[] = []
  const thumb = getVideoThumbnailUrl(info, servedBy)
  if (isAbsolute(thumb)) extras.push({ name: 'thumb.jpg', url: thumb })
  if (isAbsolute(source.author.avatarUrl)) {
    extras.push({ name: 'avatar.jpg', url: source.author.avatarUrl })
  }
  const captions: NonNullable<OfflineMeta['captions']> = []
  for (const c of args.captions) {
    const lang = c.language.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32)
    const url = absolutePeerTubeUrl(c.url)
    if (!lang || !url || captions.some((x) => x.language === lang)) continue
    const file = `captions/${lang}.vtt`
    extras.push({ name: file, url })
    captions.push({ language: lang, label: c.label || lang, file })
  }
  const fileName = quality.fileUrl.split(/[?#]/)[0]!.split('/').pop() ?? ''
  const sources = fileSources(quality.fileUrl, quality.playlistUrl)
  // Плейлист качества лежит рядом с файлом: `…-144-fragmented.mp4` → `…-144.m3u8`.
  if (args.withPlaylist && quality.playlistUrl && /-fragmented\.mp4$/.test(sources[0] ?? '')) {
    extras.push({ name: 'playlist.m3u8', url: sources[0]!.replace(/-fragmented\.mp4$/, '.m3u8') })
  }
  const job: OfflineJob = {
    id,
    sources,
    fileName,
    sha256Urls: quality.sha256Url ? fileSources(quality.sha256Url, quality.playlistUrl) : [],
    extras,
    size: quality.size,
  }
  const meta: OfflineMeta = {
    id,
    peertubeUrl: source.peertubeUrl,
    kind: source.kind,
    uuid: info.uuid,
    ...(source.postId ? { postId: source.postId } : {}),
    title: source.title || info.name || '',
    ...(source.description ? { description: source.description } : {}),
    author: {
      address: source.author.address,
      ...(source.author.name ? { name: source.author.name } : {}),
    },
    thumb: extras.some((e) => e.name === 'thumb.jpg'),
    avatar: extras.some((e) => e.name === 'avatar.jpg'),
    ...((source.duration ?? info.duration) ? { duration: source.duration ?? info.duration } : {}),
    height: quality.height,
    size: quality.size,
    captions,
    createdAt: args.now ?? Date.now(),
    accounts: [account],
  }
  return { job, meta }
}
