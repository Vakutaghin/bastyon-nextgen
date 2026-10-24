// Каналы в мессенджере: посты автора, которого пользователь решил читать здесь
// («Читать в мессенджере» в профиле). Подписка в блокчейне для этого не нужна:
// это выбор читателя, без транзакции.
//
// Список каналов и место, до которого прочитано, — в данных аккаунта Matrix
// (тип CHANNELS_ACCOUNT_DATA): так он один на всех устройствах. Два устройства
// могут менять его одновременно, поэтому у каждой записи своё время изменения и
// слияние идёт по записям, а не «кто последний записал весь список».

import { extractPlainTextFromContent } from '@/helpers/content/timecode-parser'
import { safeDecode } from '@/helpers/content/safe-decode'
import { getVideoEmbeds, type VideoEmbed } from '@/helpers/common/video-embed-url'
import type { AdaptedPost } from '@/types/adapted-post'

export const CHANNELS_ACCOUNT_DATA = 'app.bastyon.channels'

const CHANNEL_PREFIX = 'channel:'

/** id канала в мессенджере: в одном ряду с id комнат Matrix и mesh-диалогов. */
export function channelChatId(address: string): string {
  return `${CHANNEL_PREFIX}${address}`
}

export function isChannelChatId(id: string | null | undefined): id is string {
  return !!id && id.startsWith(CHANNEL_PREFIX)
}

/** Адрес автора по id канала; null — это не канал. */
export function channelAddressOf(id: string | null | undefined): string | null {
  return isChannelChatId(id) ? id.slice(CHANNEL_PREFIX.length) || null : null
}

export interface ChannelEntry {
  /** Читать ли автора в мессенджере. Выключенная запись остаётся, чтобы её время побеждало старое «включено» с другого устройства. */
  on: boolean
  /** Когда `on` менялся (мс). */
  t: number
  /** Время (мс) самого нового прочитанного поста. */
  seen?: number
}

export interface ChannelsDoc {
  v: 1
  items: Record<string, ChannelEntry>
}

export function emptyChannelsDoc(): ChannelsDoc {
  return { v: 1, items: {} }
}

const ADDRESS = /^P[1-9A-HJ-NP-Za-km-z]{25,34}$/

/** Документ из хранилища или с сервера; чужое и битое отбрасывается. */
export function parseChannelsDoc(raw: unknown): ChannelsDoc {
  const doc = emptyChannelsDoc()
  const items = (raw as { items?: unknown } | null)?.items
  if (!items || typeof items !== 'object') return doc
  for (const [address, value] of Object.entries(items as Record<string, unknown>)) {
    if (!ADDRESS.test(address) || !value || typeof value !== 'object') continue
    const e = value as Record<string, unknown>
    if (typeof e.on !== 'boolean' || typeof e.t !== 'number' || !Number.isFinite(e.t)) continue
    const entry: ChannelEntry = { on: e.on, t: e.t }
    if (typeof e.seen === 'number' && Number.isFinite(e.seen)) entry.seen = e.seen
    doc.items[address] = entry
  }
  return doc
}

/** Слияние двух копий: у каждого автора — более позднее «вкл/выкл» и самое дальнее прочитанное. */
export function mergeChannelsDoc(a: ChannelsDoc, b: ChannelsDoc): ChannelsDoc {
  const items: Record<string, ChannelEntry> = { ...a.items }
  for (const [address, theirs] of Object.entries(b.items)) {
    const ours = items[address]
    if (!ours) {
      items[address] = { ...theirs }
      continue
    }
    const base = theirs.t > ours.t ? theirs : ours
    const seen = Math.max(ours.seen ?? 0, theirs.seen ?? 0)
    items[address] = seen ? { on: base.on, t: base.t, seen } : { on: base.on, t: base.t }
  }
  return { v: 1, items }
}

export function sameChannelsDoc(a: ChannelsDoc, b: ChannelsDoc): boolean {
  const ka = Object.keys(a.items)
  if (ka.length !== Object.keys(b.items).length) return false
  return ka.every((k) => {
    const x = a.items[k]!
    const y = b.items[k]
    return !!y && x.on === y.on && x.t === y.t && (x.seen ?? 0) === (y.seen ?? 0)
  })
}

/** Включённые каналы, недавно добавленные первыми. */
export function channelAddresses(doc: ChannelsDoc): string[] {
  return Object.entries(doc.items)
    .filter(([, e]) => e.on)
    .sort((x, y) => y[1].t - x[1].t)
    .map(([address]) => address)
}

/** Что за пост — для подписи в списке и значка в ленте канала. */
export type ChannelPostKind = 'text' | 'image' | 'video' | 'article' | 'repost'

export interface ChannelPostPreview {
  txid: string
  /** Время публикации, мс. */
  time: number
  kind: ChannelPostKind
  /** Заголовок или начало текста; пусто — только картинка или видео. */
  text: string
}

export function postTime(post: Pick<AdaptedPost, 'timestamp'>): number {
  const ms = Date.parse(post.timestamp)
  return Number.isFinite(ms) ? ms : 0
}

/**
 * Ролик YouTube или Vimeo из ссылки поста (`u`) или его текста — как у
 * карточки в ленте. У видео Bastyon (PeerTube) свой плеер, ему это не нужно.
 */
export function postVideoEmbed(
  post: Pick<AdaptedPost, 'type' | 'videoUrl' | 'content'>
): VideoEmbed | null {
  if (post.type === 'video' || post.type === 'audio' || post.type === 'article') return null
  const raw = (post.videoUrl || '').trim()
  // Старые посты хранят ссылку целиком закодированной (`https%3A%2F%2F…`).
  const url = /^https?%3A/i.test(raw) ? safeDecode(raw) : raw
  return getVideoEmbeds(url, post.content)[0] ?? null
}

export function postKind(post: AdaptedPost): ChannelPostKind {
  if (post.repost) return 'repost'
  if (post.type === 'video' || post.type === 'audio') return 'video'
  if (post.type === 'article') return 'article'
  if (post.images.length > 0) return 'image'
  if (postVideoEmbed(post)) return 'video'
  return 'text'
}

/** Текст поста для ленты канала: без разметки, но с абзацами. У статьи — блоки Editor.js, у обычного поста бывает HTML. */
export function postBodyText(post: Pick<AdaptedPost, 'content'>): string {
  return extractPlainTextFromContent(post.content)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|li|h\d)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Текст поста одной строкой — для строки списка. */
export function postPlainText(post: Pick<AdaptedPost, 'content'>): string {
  return postBodyText(post).replace(/\s+/g, ' ')
}

const PREVIEW_LENGTH = 140

export function channelPostPreview(post: AdaptedPost): ChannelPostPreview {
  const title = post.title.replace(/\s+/g, ' ').trim()
  const body = title || postPlainText(post)
  return {
    txid: post.txid || String(post.id),
    time: postTime(post),
    kind: postKind(post),
    text: body.length > PREVIEW_LENGTH ? `${body.slice(0, PREVIEW_LENGTH).trimEnd()}…` : body,
  }
}

/** Сколько из последних постов новее прочитанного. */
export function countNewPosts(times: number[], seen: number | undefined): number {
  if (!seen) return 0
  return times.filter((t) => t > seen).length
}
