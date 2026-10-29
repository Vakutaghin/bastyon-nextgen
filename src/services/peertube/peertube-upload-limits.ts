/**
 * Лимиты загрузки для окна «Лимиты загрузки» в «Медиастудии» — как блок
 * «Дневные лимиты загрузки» в видеокабинете прежнего приложения
 * (videoCabinet → peertube.js getQuotaStatus): сколько ещё можно загрузить
 * сегодня на видеосервер и какие файлы он принимает.
 *
 * Дневной лимит видеосервер ставит аккаунту при входе — по его состоянию в
 * блокчейне (форк bastyon-video, ветка 4.2.2: blockChainAuth/quotaCalculator.js
 * и handleTokenBlockChain) — и считает за последние 24 часа. Форматы и
 * качество отдаёт открытый `api/v1/config`.
 */

import { getPeertubeChannel } from './peertube-auth'
import { peertubeInstanceFetch, type InstanceFetch } from './peertube-instance'
import { fetchDailyQuotaUsed } from './peertube-quota'

export type UploadQuotaTierId = 'everyone' | 'reputation' | 'full' | 'coins'

/**
 * Ступени дневного лимита по возрастанию. Сервер считает в десятичных байтах:
 * 250 МБ — это 250 000 000. Есть и ступень 25 ГБ для аккаунтов из списка
 * самого сервера — заработать её нельзя, поэтому её не показываем.
 */
export const UPLOAD_QUOTA_TIERS: readonly { id: UploadQuotaTierId; bytes: number }[] = [
  { id: 'everyone', bytes: 250_000_000 },
  { id: 'reputation', bytes: 500_000_000 },
  { id: 'full', bytes: 2_000_000_000 },
  { id: 'coins', bytes: 5_000_000_000 },
]

/** Ступень, на которой аккаунт; не совпал ни с одной — null. */
export function quotaTier(daily: number): UploadQuotaTierId | null {
  return UPLOAD_QUOTA_TIERS.find((tier) => tier.bytes === daily)?.id ?? null
}

export interface UploadQuota {
  /** Лимит за сутки, байты; меньше нуля — без ограничения. */
  daily: number
  /** Загружено за последние 24 часа. */
  usedDaily: number
}

/** Дневной лимит аккаунта на сервере и сколько из него ушло (Bearer). */
export async function getUploadQuota(params: {
  host: string
  accessToken: string
  fetchInstance?: InstanceFetch
}): Promise<UploadQuota> {
  const [channel, used] = await Promise.all([
    getPeertubeChannel(params),
    fetchDailyQuotaUsed(params),
  ])
  return { daily: channel.videoQuotaDaily, usedDaily: used.videoQuotaUsedDaily }
}

export interface InstanceUploadConfig {
  /** Какие файлы сервер принимает: '.mp4', '.mp3'… */
  extensions: string[]
  /** Наибольшее качество, в котором сервер хранит ролик (360, 480…); null — не сказал. */
  maxResolution: number | null
}

/**
 * Что принимает видеосервер на сегодня (peertube601, 29.10.2026) — пока его
 * `api/v1/config` не ответил или не ответит.
 */
export const DEFAULT_UPLOAD_EXTENSIONS: readonly string[] = [
  '.webm',
  '.ogv',
  '.ogg',
  '.mp4',
  '.mkv',
  '.mov',
  '.qt',
  '.mqv',
  '.m4v',
  '.flv',
  '.f4v',
  '.wmv',
  '.avi',
  '.3gp',
  '.3gpp',
  '.3g2',
  '.3gpp2',
  '.nut',
  '.mts',
  '.m2ts',
  '.mpv',
  '.m2v',
  '.m1v',
  '.mpg',
  '.mpe',
  '.mpeg',
  '.vob',
  '.mxf',
  '.mp3',
  '.wma',
  '.wav',
  '.flac',
  '.aac',
  '.m4a',
  '.ac3',
]

/** Звуковые из списка сервера — он отдаёт их вместе с видео. */
export const AUDIO_EXTENSIONS: ReadonlySet<string> = new Set([
  '.mp3',
  '.wma',
  '.wav',
  '.flac',
  '.aac',
  '.m4a',
  '.ac3',
  '.opus',
])

/** Открытые настройки сервера: какие файлы он берёт и в каком качестве хранит. */
export async function getInstanceUploadConfig(
  host: string,
  fetchInstance: InstanceFetch = (path, init) => peertubeInstanceFetch(host, path, init)
): Promise<InstanceUploadConfig> {
  const res = await fetchInstance('api/v1/config', { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`peertube_config_${res.status}`)
  const j = (await res.json()) as {
    video?: { file?: { extensions?: unknown } }
    transcoding?: { enabledResolutions?: unknown }
  } | null
  const extensions = Array.isArray(j?.video?.file?.extensions)
    ? j.video.file.extensions.filter((ext): ext is string => typeof ext === 'string')
    : []
  // 0 — «только звук» у PeerTube, это не качество видео.
  const resolutions = Array.isArray(j?.transcoding?.enabledResolutions)
    ? j.transcoding.enabledResolutions.filter((r): r is number => typeof r === 'number' && r > 0)
    : []
  return {
    extensions: extensions.length ? extensions : [...DEFAULT_UPLOAD_EXTENSIONS],
    maxResolution: resolutions.length ? Math.max(...resolutions) : null,
  }
}
