/**
 * «Медиастудия»: ролик на видеосервере — сведения, полное описание, правка
 * названия и описания, статистика просмотров и отметки «смотрят» от плеера.
 *
 * Видеосерверы Bastyon — форк PeerTube 4.2.2 (pocketnetteam/bastyon-video):
 *  - GET videos/:id и videos/:id/description — без входа;
 *  - PUT videos/:id — от автора; название 3–120 знаков, описание 3–10 000
 *    знаков или null (пустая строка не проходит проверку, поэтому JSON, а не
 *    multipart: в форме null не передать);
 *  - videos/:id/stats/{overall,timeseries/:metric,retention} — от автора;
 *  - POST videos/:id/views {currentTime, viewEvent?} — от плеера раз в 30 с,
 *    как у встроенного плеера в прежнем Bastyon (USER_VIEW_VIDEO_INTERVAL).
 *    Просмотр сервер засчитывает один раз на IP, а из отметок собирает
 *    зрителей, время просмотра, удержание и страны.
 */

import { peertubeInstanceFetch, type InstanceFetch } from './peertube-instance'

/** Пределы полей PeerTube 4.2 (CONSTRAINTS_FIELDS.VIDEOS). */
export const VIDEO_NAME_MIN = 3
export const VIDEO_NAME_MAX = 120
export const VIDEO_DESCRIPTION_MIN = 3
export const VIDEO_DESCRIPTION_MAX = 10_000

/** Файл ролика одного качества. */
export interface InstanceVideoFile {
  /** «720p», «Audio». */
  label: string
  /** Высота кадра; 0 — звук. */
  height: number
  /** Байты; 0 — сервер не сказал. */
  size: number
  fileUrl: string
}

/** Ролик на видеосервере — то, что видно в окне ролика. */
export interface InstanceVideoDetails {
  id: number
  uuid: string
  name: string
  duration: number
  /** Просмотры за всё время. */
  views: number
  isAudio: boolean
  /** Ширина / высота; null — сервер не знает. */
  aspectRatio: number | null
  /** 1 — опубликовано; 2, 3 — ещё обрабатывается. */
  stateId: number
  createdAt: string | null
  thumbnailPath: string | null
  previewPath: string | null
  /** Файлы по качествам, лучшие первыми: HLS и обычные вместе. */
  files: InstanceVideoFile[]
}

const instanceFetchFor = (host: string, fetchInstance?: InstanceFetch): InstanceFetch =>
  fetchInstance ?? ((path, init) => peertubeInstanceFetch(host, path, init))

const videoPath = (id: string | number, rest = ''): string =>
  `api/v1/videos/${encodeURIComponent(String(id))}${rest}`

const num = (value: unknown): number => (typeof value === 'number' && value > 0 ? value : 0)

interface RawFile {
  resolution?: { id?: number; label?: string }
  size?: number
  fileUrl?: string
}

interface RawVideo {
  id?: number
  uuid?: string
  name?: string
  duration?: number
  views?: number
  isAudio?: boolean
  aspectRatio?: number | null
  state?: { id?: number }
  createdAt?: string
  thumbnailPath?: string
  previewPath?: string
  files?: RawFile[]
  streamingPlaylists?: Array<{ files?: RawFile[] }>
}

/** Файлы ролика по качествам: без повторов (HLS и обычный файл одной высоты), лучшие первыми. */
export function videoFiles(
  raw: Pick<RawVideo, 'files' | 'streamingPlaylists'>
): InstanceVideoFile[] {
  const all = [
    ...(raw.streamingPlaylists ?? []).flatMap((p) => p.files ?? []),
    ...(raw.files ?? []),
  ]
  const byHeight = new Map<number, InstanceVideoFile>()
  for (const file of all) {
    if (!file?.fileUrl) continue
    const height = num(file.resolution?.id)
    if (byHeight.has(height)) continue
    byHeight.set(height, {
      label: file.resolution?.label || (height ? `${height}p` : 'Audio'),
      height,
      size: num(file.size),
      fileUrl: file.fileUrl,
    })
  }
  return [...byHeight.values()].sort((a, b) => b.height - a.height)
}

/** GET videos/:id без входа. null — ролика на сервере нет. */
export async function getInstanceVideoDetails(params: {
  host: string
  id: string | number
  fetchInstance?: InstanceFetch
}): Promise<InstanceVideoDetails | null> {
  const fetchInstance = instanceFetchFor(params.host, params.fetchInstance)
  const res = await fetchInstance(videoPath(params.id), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`peertube_video_details_${res.status}`)
  const raw = (await res.json()) as RawVideo | null
  if (!raw?.uuid) throw new Error('peertube_video_details_invalid')
  return {
    id: num(raw.id),
    uuid: raw.uuid,
    name: raw.name ?? '',
    duration: num(raw.duration),
    views: num(raw.views),
    isAudio: raw.isAudio === true,
    aspectRatio: num(raw.aspectRatio) || null,
    stateId: num(raw.state?.id) || 1,
    createdAt: raw.createdAt ?? null,
    thumbnailPath: raw.thumbnailPath ?? null,
    previewPath: raw.previewPath ?? null,
    files: videoFiles(raw),
  }
}

/** Описание целиком (в сведениях и списках — только первые 250 знаков). */
export async function getInstanceVideoDescription(params: {
  host: string
  id: string | number
  fetchInstance?: InstanceFetch
}): Promise<string> {
  const fetchInstance = instanceFetchFor(params.host, params.fetchInstance)
  const res = await fetchInstance(videoPath(params.id, '/description'), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`peertube_video_description_${res.status}`)
  const raw = (await res.json()) as { description?: string | null } | null
  return raw?.description ?? ''
}

/** Что меняется в ролике: undefined — поле не трогать. */
export interface VideoTextChanges {
  name?: string
  /** null — убрать описание. */
  description?: string | null
}

/** PUT videos/:id (JSON) от автора: название и описание. */
export async function updateInstanceVideo(params: {
  host: string
  id: string | number
  accessToken: string
  changes: VideoTextChanges
  fetchInstance?: InstanceFetch
}): Promise<void> {
  const fetchInstance = instanceFetchFor(params.host, params.fetchInstance)
  const res = await fetchInstance(videoPath(params.id), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params.changes),
  })
  if (!res.ok && res.status !== 204) throw new Error(`peertube_update_video_${res.status}`)
}

// ─── статистика ─────────────────────────────────────────────────────────────

/** Сводка за период (или за всё время, если дат нет). */
export interface VideoStatsOverall {
  /** Секунды. */
  averageWatchTime: number
  totalWatchTime: number
  totalViewers: number
  viewersPeak: number
  viewersPeakDate: string | null
  countries: Array<{ isoCode: string; viewers: number }>
}

export type VideoStatsMetric = 'viewers' | 'aggregateWatchTime'

/** Ряд по времени: шаг выбирает сервер по длине периода. */
export interface VideoStatsTimeserie {
  /** «one_day», «one_hour»… */
  groupInterval: string
  data: Array<{ date: string; value: number }>
}

/** Удержание: доля зрителей, досмотревших до секунды. */
export type VideoStatsRetention = Array<{ second: number; retentionPercent: number }>

/** Период статистики; без дат — с загрузки ролика до сейчас. */
export interface StatsPeriod {
  startDate?: string
  endDate?: string
}

interface StatsParams {
  host: string
  id: string | number
  accessToken: string
  fetchInstance?: InstanceFetch
}

async function getStats<T>(params: StatsParams, rest: string, period?: StatsPeriod): Promise<T> {
  const fetchInstance = instanceFetchFor(params.host, params.fetchInstance)
  const query = new URLSearchParams()
  // Сервер требует обе даты или ни одной.
  if (period?.startDate && period.endDate) {
    query.set('startDate', period.startDate)
    query.set('endDate', period.endDate)
  }
  // Не query.size: его нет в Safari 15 и Chromium 89.
  const search = query.toString() ? `?${query}` : ''
  const res = await fetchInstance(videoPath(params.id, `/stats/${rest}${search}`), {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${params.accessToken}` },
  })
  if (!res.ok) throw new Error(`peertube_video_stats_${res.status}`)
  return (await res.json()) as T
}

export async function getVideoStatsOverall(
  params: StatsParams & { period?: StatsPeriod }
): Promise<VideoStatsOverall> {
  const raw = await getStats<Partial<VideoStatsOverall> | null>(params, 'overall', params.period)
  return {
    averageWatchTime: num(raw?.averageWatchTime),
    totalWatchTime: num(raw?.totalWatchTime),
    totalViewers: num(raw?.totalViewers),
    viewersPeak: num(raw?.viewersPeak),
    viewersPeakDate: raw?.viewersPeakDate ?? null,
    countries: Array.isArray(raw?.countries)
      ? raw.countries
          .filter((c) => typeof c?.isoCode === 'string' && num(c.viewers) > 0)
          .map((c) => ({ isoCode: c.isoCode, viewers: num(c.viewers) }))
          .sort((a, b) => b.viewers - a.viewers)
      : [],
  }
}

export async function getVideoStatsTimeserie(
  params: StatsParams & { metric: VideoStatsMetric; period?: StatsPeriod }
): Promise<VideoStatsTimeserie> {
  const raw = await getStats<Partial<VideoStatsTimeserie> | null>(
    params,
    `timeseries/${params.metric}`,
    params.period
  )
  return {
    groupInterval: raw?.groupInterval ?? 'one_day',
    data: Array.isArray(raw?.data)
      ? raw.data
          .filter((point) => typeof point?.date === 'string')
          .map((point) => ({ date: point.date, value: Number(point.value) || 0 }))
      : [],
  }
}

export async function getVideoStatsRetention(params: StatsParams): Promise<VideoStatsRetention> {
  const raw = await getStats<{ data?: VideoStatsRetention } | null>(params, 'retention')
  return Array.isArray(raw?.data)
    ? raw.data
        .filter((point) => typeof point?.second === 'number')
        .map((point) => ({
          second: point.second,
          retentionPercent: Math.max(0, Math.min(100, Number(point.retentionPercent) || 0)),
        }))
    : []
}

// ─── просмотры ──────────────────────────────────────────────────────────────

/** Отметка плеера: где сейчас зритель; 'seek' — перед этим перемотал. */
export interface VideoViewReport {
  currentTime: number
  viewEvent?: 'seek'
}

/**
 * Что стало с отметкой: `accepted` — учтена; `rejected` — ролика нет или
 * время не то, дальше отмечать незачем; `failed` — сервер перегружен или
 * сбоит, следующую отметку стоит отправить.
 */
export type ViewReportResult = 'accepted' | 'rejected' | 'failed'

/**
 * POST videos/:id/views. 409 — просмотр с этого адреса уже засчитан: отметку
 * сервер всё равно учёл, это не ошибка.
 */
export async function reportVideoView(params: {
  host: string
  id: string
  report: VideoViewReport
  fetchInstance?: InstanceFetch
}): Promise<ViewReportResult> {
  const fetchInstance = instanceFetchFor(params.host, params.fetchInstance)
  const res = await fetchInstance(videoPath(params.id, '/views'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params.report),
  })
  if (res.ok || res.status === 409) return 'accepted'
  return res.status === 429 || res.status >= 500 ? 'failed' : 'rejected'
}
