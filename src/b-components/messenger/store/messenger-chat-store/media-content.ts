// Разбор медиа-контента matrix-события (m.audio / m.image / m.video / m.file)
// в поля Message: type, url, info, text. Чистая функция — резолвер mxc→http
// приходит аргументом. Ветки восстановлены из старого стора (потерялись при
// консолидации `fb599f9`, аудит K3): без них входящие фото/видео/файлы
// маппились как текст и в чате показывался hex-ключ медиа.

import { extractUrl } from '../../helpers'
import type { Message } from '../../types'

export type MediaMessageType = Extract<Message['type'], 'audio' | 'image' | 'video' | 'file'>

/** msgtype → тип сообщения; всё остальное — текст (или транзакция). */
export const MEDIA_MSGTYPES: Readonly<Record<string, MediaMessageType>> = {
  'm.audio': 'audio',
  'm.image': 'image',
  'm.video': 'video',
  'm.file': 'file',
}

export const mediaTypeOf = (msgtype: unknown): MediaMessageType | null =>
  typeof msgtype === 'string' ? (MEDIA_MSGTYPES[msgtype] ?? null) : null

/** Контент медиа-события: url-поля динамичны (mxc/http, вложенные file/info). */
export interface MediaContent {
  msgtype?: string
  body?: unknown
  url?: unknown
  file?: { url?: unknown }
  filename?: unknown
  info?: Record<string, unknown> | null
}

export interface MappedMedia {
  type: MediaMessageType
  url: string | undefined
  info: Record<string, unknown>
  text: string
}

type ResolveMxc = (mxcOrHttp: string) => string

const pickUrl = (c: MediaContent): string | null =>
  extractUrl(c.url) ||
  extractUrl(c.file?.url) ||
  extractUrl(c.info?.url) ||
  extractUrl((c.info?.file as { url?: unknown } | undefined)?.url) ||
  (typeof c.body === 'string' && c.body.startsWith('http') ? c.body : null)

const bodyAsName = (body: unknown): string | null =>
  typeof body === 'string' && body && !body.startsWith('http') && !body.startsWith('{')
    ? body
    : null

/** bastyon-chat / forta.chat кладут fileInfo в body m.file как JSON-строку. */
function parseFileBody(body: unknown): {
  name?: string
  type?: string
  size?: number
  url?: string
  secrets?: unknown
} | null {
  if (typeof body !== 'string' || !body.startsWith('{')) return null
  try {
    const obj = JSON.parse(body)
    return obj && typeof obj === 'object' ? obj : null
  } catch {
    return null
  }
}

export function mapMediaContent(
  content: MediaContent,
  type: MediaMessageType,
  resolveMxc: ResolveMxc
): MappedMedia {
  // Копия info: событие matrix мутировать нельзя (оно живёт в таймлайне).
  const info: Record<string, unknown> = content.info ? { ...content.info } : {}
  if (content.file && !info.file) info.file = content.file

  const parsed = type === 'file' ? parseFileBody(content.body) : null
  const rawUrl = (parsed?.url && extractUrl(parsed.url)) || pickUrl(content)
  const url = typeof rawUrl === 'string' && rawUrl.length > 0 ? resolveMxc(rawUrl) : undefined

  if (type === 'video') {
    // Постер: mxc → http, чтобы показать сразу, без расшифровки видео.
    const thumb = info.thumbnail_url
    if (typeof thumb === 'string' && thumb.startsWith('mxc://')) info.posterUrl = resolveMxc(thumb)
  }

  if (type === 'file') {
    const name =
      parsed?.name ||
      (typeof content.filename === 'string' ? content.filename : null) ||
      bodyAsName(content.body)
    if (name && !info.name) info.name = name
    if (parsed?.size && !info.size) info.size = parsed.size
    if (parsed?.type && !info.mimetype) info.mimetype = parsed.type
    if (parsed?.secrets && !info.secrets) info.secrets = parsed.secrets
  } else if (type !== 'audio') {
    const name = bodyAsName(content.body)
    if (name && !info.name) info.name = name
  }

  // Текст медиа-сообщения — только имя (для поиска/цитаты); превью диалога и
  // карточка ориентируются на type. Секреты медиа-ключа в text не попадают никогда.
  const text = type === 'audio' ? '' : typeof info.name === 'string' ? info.name : ''

  return { type, url, info, text }
}
