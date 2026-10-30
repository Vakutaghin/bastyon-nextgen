/**
 * Отправка медиа-сообщений (аудио/изображение/видео/файл/PKOIN-донат) и
 * `uploadContent` — общая обёртка над `client.uploadContent` с прокидыванием
 * onProgress.
 *
 * Каждый sender вынесен в отдельную функцию, принимающую MatrixClient — это
 * позволяет тестировать send-логику без поднятия полноценного MatrixService
 * и облегчает чтение (раньше всё жило в одном файле на 800+ строк).
 *
 * См. CODE_AUDIT.md §1.
 */
import type { MatrixClient, MatrixEventContent, SecretsBlock } from './types'
import { resolveMxcHttpUrl } from './mxc-resolver'
import { matrixFetch } from '@/helpers/api/fetch-strategies'
import { torRoutingMode } from '@/helpers/tor/tor-gate'

export interface UploadOpts {
  name?: string
  type?: string
  onProgress?: (loaded: number, total?: number) => void
}

/** Загрузка контента в matrix media-store; возвращает `mxc://...` URI. */
export async function uploadContent(
  client: MatrixClient,
  file: Blob | File,
  opts: UploadOpts = {}
): Promise<string> {
  const progressCb = opts.onProgress
    ? (info: { loaded: number; total?: number }) => {
        try {
          opts.onProgress?.(info.loaded, info.total)
        } catch {
          /* ignore */
        }
      }
    : undefined

  // SDK отправляет файл XMLHttpRequest'ом окна — мимо Tor, с токеном. Под
  // Tor (и пока он подключается) — нашим fetch, который ждёт Tor или падает.
  const res =
    (await torRoutingMode()) === 'direct'
      ? await client.uploadContent(file, {
          name: opts.name,
          type: opts.type || (file as { type?: string })?.type,
          progressHandler: progressCb,
        })
      : await uploadThroughFetch(client, file, opts)
  // matrix-js-sdk may return a string (mxc://...) or { content_uri: 'mxc://...' }.
  const uri =
    typeof res === 'string'
      ? res
      : res && typeof res === 'object' && (res as { content_uri?: string }).content_uri

  if (!uri || typeof uri !== 'string') {
    throw new Error('Upload content failed: invalid response')
  }
  return uri
}

/** Предел на загрузку через Tor: 2 мин плюс секунда на каждые 32 КБ, не больше 30 мин. */
export function torUploadTimeoutMs(size: number): number {
  return Math.min(30 * 60_000, 120_000 + Math.ceil(size / 32_768) * 1000)
}

/** `POST /_matrix/media/v3/upload` через `matrixFetch` — как делает SDK. */
async function uploadThroughFetch(
  client: MatrixClient,
  file: Blob | File,
  opts: UploadOpts
): Promise<unknown> {
  const base = (client.getHomeserverUrl?.() ?? '').replace(/\/+$/, '')
  const token = client.getAccessToken?.()
  if (!base || !token) throw new Error('Upload content failed: no session')
  const url = new URL(`${base}/_matrix/media/v3/upload`)
  const name = opts.name ?? (file as { name?: string }).name
  if (name) url.searchParams.set('filename', name)
  const res = await matrixFetch(
    url.toString(),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': opts.type || file.type || 'application/octet-stream',
      },
      body: file,
    },
    { timeoutMs: torUploadTimeoutMs(file.size) }
  )
  if (!res.ok) throw new Error(`Upload content failed: HTTP ${res.status}`)
  const json = (await res.json()) as unknown
  // Через Tor файл уходит одним вызовом — прогресс только в конце.
  try {
    opts.onProgress?.(file.size, file.size)
  } catch {
    /* ignore */
  }
  return json
}

// ─── Audio ───────────────────────────────────────────────────────────────────

export interface SendAudioData {
  blob?: Blob
  mxcUrl?: string
  name?: string
  mimetype?: string
  duration?: number
  size?: number
  secrets?: SecretsBlock
  block?: number
}

export async function sendAudio(
  client: MatrixClient,
  roomId: string,
  data: SendAudioData,
  onProgress?: (loaded: number, total?: number) => void
) {
  let mxcUrl = data.mxcUrl
  let mimetype = data.mimetype
  let size = data.size

  if (!mxcUrl && data.blob) {
    mimetype = mimetype || (data.blob as { type?: string }).type || 'audio/webm'
    size = size || data.blob.size
    mxcUrl = await uploadContent(client, data.blob, {
      name: data.name || 'voice-message',
      type: mimetype,
      onProgress,
    })
  }

  if (!mxcUrl) throw new Error('sendAudio failed: missing mxcUrl')

  const httpUrl = resolveMxcHttpUrl(client, mxcUrl)

  const bodyName = httpUrl || data.name || 'voice-message'
  const info: MatrixEventContent = {
    mimetype: mimetype || 'audio/webm',
    size: size || 0,
  }
  if (typeof data.duration === 'number') {
    info.duration = Math.round(data.duration * 1000) // ms per spec
  }
  // Дублируем URL внутри info — некоторые клиенты читают именно info.url.
  info.url = mxcUrl
  if (httpUrl) info.httpUrl = httpUrl
  if (data.secrets) info.secrets = data.secrets

  const content: MatrixEventContent = {
    msgtype: 'm.audio',
    body: bodyName,
    url: httpUrl || mxcUrl,
    info,
  }
  if (typeof data.block === 'number') content.block = data.block
  if (data.secrets?.v) content.version = data.secrets.v
  return client.sendEvent(roomId, 'm.room.message', content)
}

// ─── Image ───────────────────────────────────────────────────────────────────

export interface SendImageData {
  blob?: Blob
  mxcUrl?: string
  name?: string
  mimetype?: string
  width?: number
  height?: number
  size?: number
  secrets?: SecretsBlock
  block?: number
}

export async function sendImage(
  client: MatrixClient,
  roomId: string,
  data: SendImageData,
  onProgress?: (loaded: number, total?: number) => void
) {
  let mxcUrl = data.mxcUrl
  let mimetype = data.mimetype
  let size = data.size

  if (!mxcUrl && data.blob) {
    mimetype = mimetype || (data.blob as { type?: string }).type || 'image/jpeg'
    size = size || data.blob.size
    mxcUrl = await uploadContent(client, data.blob, {
      name: data.name || 'image',
      type: mimetype,
      onProgress,
    })
  }

  if (!mxcUrl) throw new Error('sendImage failed: missing mxcUrl')

  const httpUrl = resolveMxcHttpUrl(client, mxcUrl)

  const info: MatrixEventContent = {
    mimetype: mimetype || 'image/jpeg',
    size: size || 0,
  }
  if (typeof data.width === 'number') info.w = data.width
  if (typeof data.height === 'number') info.h = data.height
  info.url = mxcUrl
  if (httpUrl) info.httpUrl = httpUrl
  if (data.secrets) info.secrets = data.secrets

  const content: MatrixEventContent = {
    msgtype: 'm.image',
    body: data.name || httpUrl || 'image',
    url: httpUrl || mxcUrl,
    info,
  }
  if (typeof data.block === 'number') content.block = data.block
  if (data.secrets?.v) content.version = data.secrets.v
  return client.sendEvent(roomId, 'm.room.message', content)
}

// ─── Video ───────────────────────────────────────────────────────────────────

export interface SendVideoData {
  blob?: Blob
  mxcUrl?: string
  name?: string
  mimetype?: string
  width?: number
  height?: number
  duration?: number
  size?: number
  thumbnailUrl?: string
  thumbnailMimetype?: string
  thumbnailWidth?: number
  thumbnailHeight?: number
  thumbnailSize?: number
  secrets?: SecretsBlock
  block?: number
}

export async function sendVideo(
  client: MatrixClient,
  roomId: string,
  data: SendVideoData,
  onProgress?: (loaded: number, total?: number) => void
) {
  let mxcUrl = data.mxcUrl
  let mimetype = data.mimetype
  let size = data.size

  if (!mxcUrl && data.blob) {
    mimetype = mimetype || (data.blob as { type?: string }).type || 'video/mp4'
    size = size || data.blob.size
    mxcUrl = await uploadContent(client, data.blob, {
      name: data.name || 'video',
      type: mimetype,
      onProgress,
    })
  }

  if (!mxcUrl) throw new Error('sendVideo failed: missing mxcUrl')

  const httpUrl = resolveMxcHttpUrl(client, mxcUrl)

  const info: MatrixEventContent = {
    mimetype: mimetype || 'video/mp4',
    size: size || 0,
  }
  if (typeof data.duration === 'number') info.duration = Math.round(data.duration * 1000)
  if (typeof data.width === 'number') info.w = data.width
  if (typeof data.height === 'number') info.h = data.height
  info.url = mxcUrl
  if (httpUrl) info.httpUrl = httpUrl
  if (data.secrets) info.secrets = data.secrets
  if (data.thumbnailUrl) {
    info.thumbnail_url = data.thumbnailUrl
    info.thumbnail_info = {
      mimetype: data.thumbnailMimetype || 'image/jpeg',
      w: data.thumbnailWidth,
      h: data.thumbnailHeight,
      size: data.thumbnailSize,
    }
  }

  const content: MatrixEventContent = {
    msgtype: 'm.video',
    body: data.name || httpUrl || 'video',
    url: httpUrl || mxcUrl,
    info,
  }
  if (typeof data.block === 'number') content.block = data.block
  if (data.secrets?.v) content.version = data.secrets.v
  return client.sendEvent(roomId, 'm.room.message', content)
}

// ─── File ────────────────────────────────────────────────────────────────────

export interface SendFileData {
  blob?: Blob
  mxcUrl?: string
  name?: string
  mimetype?: string
  size?: number
  secrets?: SecretsBlock
  block?: number
}

export async function sendFile(
  client: MatrixClient,
  roomId: string,
  data: SendFileData,
  onProgress?: (loaded: number, total?: number) => void
) {
  let mxcUrl = data.mxcUrl
  let mimetype = data.mimetype
  let size = data.size

  if (!mxcUrl && data.blob) {
    mimetype = mimetype || (data.blob as { type?: string }).type || 'application/octet-stream'
    size = size || data.blob.size
    mxcUrl = await uploadContent(client, data.blob, {
      name: data.name || 'file',
      type: mimetype,
      onProgress,
    })
  }

  if (!mxcUrl) throw new Error('sendFile failed: missing mxcUrl')

  const httpUrl = resolveMxcHttpUrl(client, mxcUrl)
  const fileName = data.name || 'file'
  const fileType = mimetype || 'application/octet-stream'
  const fileSize = size || 0

  // Совместимость с bastyon-chat / forta.chat: для m.file `body` — это
  // JSON-строка с { name, type, size, url, secrets? }. Старые клиенты
  // парсят body как JSON и достают оттуда имя/размер/url. Если положить
  // в body просто имя файла (Matrix-стандарт), они показывают «NaN undefined».
  const fileBody: Record<string, unknown> = {
    name: fileName,
    type: fileType,
    size: fileSize,
    url: httpUrl || mxcUrl,
  }
  if (data.secrets) fileBody.secrets = data.secrets

  const info: MatrixEventContent = {
    mimetype: fileType,
    size: fileSize,
  }
  info.url = mxcUrl
  if (httpUrl) info.httpUrl = httpUrl
  if (data.secrets) info.secrets = data.secrets

  const content: MatrixEventContent = {
    msgtype: 'm.file',
    body: JSON.stringify(fileBody),
    // Дублируем поля для Matrix-стандарта (Element и т.п.).
    filename: fileName,
    url: httpUrl || mxcUrl,
    info,
  }
  if (typeof data.block === 'number') content.block = data.block
  if (data.secrets?.v) content.version = data.secrets.v
  return client.sendEvent(roomId, 'm.room.message', content)
}
