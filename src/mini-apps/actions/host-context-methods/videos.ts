/**
 * HostContext methods: видео для мини-приложений — сведения о роликах
 * (`get.videos`) и окно загрузки своего ролика (`videos.opendialog`).
 *
 * `get.videos` прежнего клиента (`sdk.videos.info`) отдавал по каждой ссылке
 * `{link, meta, data}`, где `data.original` — сведения о ролике с видеосервера,
 * которые кэширует нода (`peertube/videos`). Barteron читает оттуда состояние
 * обработки (`original.state.id`), плейлист
 * (`original.streamingPlaylists[0].playlistUrl`) и обложку (`data.thumbnail`).
 * Раньше действие звало несуществующий метод ноды, и видео в объявлении
 * считалось «не найдено или удалено».
 *
 * `videos.opendialog` прежнего клиента открывал окно загрузки и отвечал
 * `{link, name}` — указатель `peertube://host/uuid` и имя ролика; закрыли окно —
 * пустой ответ.
 */

import type { HostContext } from '../host-context'

export interface LegacyVideoItem {
  link: string
  meta: { type: 'peertube'; id: string; host_name: string }
  data: {
    image: string | null
    thumbnail: string | null
    views: number
    viewers: number
    duration: number
    aspectRatio: number
    isLive: boolean
    isCorrect: boolean
    original: Record<string, unknown>
  }
}

export interface UploadedAppVideo {
  link: string
  name: string
}

export interface VideoDeps {
  /** Сведения ноды по ссылкам; о чём нода не знает, того в ответе нет. */
  fetchInfo: (urls: string[], update: boolean) => Promise<Map<string, Record<string, unknown>>>
  parsePointer: (url: string) => { host: string; videoId: string } | null
  /** Полный адрес картинки ролика по пути от сервера (учитывает архивные серверы). */
  mediaUrl: (url: string, path: string | undefined) => string | null
  openDialog: (appName: string, signal?: AbortSignal) => Promise<UploadedAppVideo | null>
}

export type VideoMethods = Pick<HostContext, 'getVideosInfo' | 'openVideoUploadDialog'>

/** Ссылок в одном запросе к ноде — как у карточек разделов «Видео». */
const BATCH = 40

/** Ролики до 19.05.2021 и эфиры прежний клиент показывал 16:9: своих пропорций у них нет. */
const OLD_VIDEO_BEFORE = new Date(2021, 4, 19).getTime()

const num = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function legacyVideoItem(
  url: string,
  raw: Record<string, unknown>,
  deps: Pick<VideoDeps, 'parsePointer' | 'mediaUrl'>
): LegacyVideoItem | null {
  const parsed = deps.parsePointer(url)
  if (!parsed) return null
  const created = new Date(String(raw.createdAt ?? '')).getTime()
  const isLive = raw.isLive === true
  const fallbackAspect = isLive || (Number.isFinite(created) && created < OLD_VIDEO_BEFORE)
  const path = (key: string) => (typeof raw[key] === 'string' ? (raw[key] as string) : undefined)
  return {
    link: url,
    meta: { type: 'peertube', id: parsed.videoId, host_name: parsed.host },
    data: {
      image: deps.mediaUrl(url, path('previewPath')),
      thumbnail: deps.mediaUrl(url, path('thumbnailPath')),
      views: num(raw.views),
      viewers: num(raw.viewers),
      duration: num(raw.duration),
      aspectRatio: fallbackAspect ? 1.78 : num(raw.aspectRatio) || 1,
      isLive,
      isCorrect: typeof raw.uuid === 'string' && raw.uuid.length > 0,
      original: raw,
    },
  }
}

export function createVideoMethods(deps: VideoDeps): VideoMethods {
  return {
    getVideosInfo: async (urls, update) => {
      const known = new Map<string, Record<string, unknown>>()
      const peertube = [...new Set(urls)].filter((u) => deps.parsePointer(u))
      for (let i = 0; i < peertube.length; i += BATCH) {
        const batch = peertube.slice(i, i + BATCH)
        for (const [url, raw] of await deps.fetchInfo(batch, update)) known.set(url, raw)
      }
      return urls.map((url) => {
        const raw = known.get(url)
        return raw ? legacyVideoItem(url, raw, deps) : null
      })
    },

    openVideoUploadDialog: (appName, signal) => deps.openDialog(appName, signal),
  }
}
