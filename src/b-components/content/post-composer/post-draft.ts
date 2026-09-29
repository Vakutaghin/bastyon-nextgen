// Черновик поста (только режим create), привязанный к аккаунту (N8/Р5):
// раньше один `bastyon_post_draft` на устройство — следующий аккаунт
// публиковал чужой текст одним нажатием. Черновик гостя переезжает к первому
// аккаунту, который его читает.
//
// Текст — в localStorage: он нужен сразу при открытии окна, синхронно.
// Остальное (теги, картинки, опрос, видимость, язык, время, статья, видео) —
// в IndexedDB: картинки — data-URL по сотням КБ, в localStorage они не влезут.
// Картинки лежат отдельным ключом, чтобы набор подписи или опроса не
// переписывал их при каждом изменении. Все ключи начинаются с
// `bastyon_post_draft` — по этому префиксу черновики стираются при выходе.
import type { ArticleContent } from '@/blockchain/core/actions/post-action'
import {
  POST_DRAFT_FIELDS_KEY,
  POST_DRAFT_IMAGES_KEY,
  POST_DRAFT_KEY,
} from '@/blockchain/constants/storage'
import {
  accountScopedKey,
  adoptLegacyLocalKey,
  adoptLegacySettingsKey,
} from '@/blockchain/storage/account-scoped-key'
import { settingsAPI } from '@/db/apis/settings-api'

import { MAX_IMAGES, MAX_POLL_OPTIONS, MAX_TAGS } from './consts'

export function postDraftKey(address: string | null | undefined): string {
  return accountScopedKey(POST_DRAFT_KEY, address)
}

export function readDraft(address: string | null | undefined): string {
  try {
    adoptLegacyLocalKey(POST_DRAFT_KEY, address)
    return localStorage.getItem(postDraftKey(address)) || ''
  } catch {
    return ''
  }
}

export function writeDraft(address: string | null | undefined, text: string): void {
  try {
    const key = postDraftKey(address)
    if (text.trim()) localStorage.setItem(key, text)
    else localStorage.removeItem(key)
  } catch {
    /* приватный режим — игнорируем */
  }
}

/** Всё, что черновик хранит кроме текста и картинок. */
export interface PostDraftFields {
  caption: string
  tags: string[]
  /** Видимость `s.f`: '0' — все, дальше подписчики, зарегистрированные, платные. */
  visibility: string
  language: string
  poll: { active: boolean; title: string; options: string[] }
  /** Отложенная публикация, unix-секунды; 0 — сразу. */
  scheduledTime: number
  articleMode: boolean
  articleContent: ArticleContent | null
  /** Указатель своего загруженного видео (`peertube://…`): файл уже на сервере. */
  videoUrl: string
  /** Ссылка, чью карточку убрали крестиком. */
  dismissedLinkUrl: string
}

export interface StoredPostDraft {
  fields: PostDraftFields | null
  images: string[]
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '')
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []

/** Записанное когда-то и кем-то: берём только то, что похоже на поля черновика. */
export function parseDraftFields(raw: unknown): PostDraftFields | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const poll = (r.poll && typeof r.poll === 'object' ? r.poll : {}) as Record<string, unknown>
  const content = r.articleContent as { blocks?: unknown } | null | undefined
  return {
    caption: str(r.caption),
    tags: strings(r.tags).filter(Boolean).slice(0, MAX_TAGS),
    visibility: str(r.visibility) || '0',
    language: str(r.language),
    poll: {
      active: poll.active === true,
      title: str(poll.title),
      options: strings(poll.options).slice(0, MAX_POLL_OPTIONS),
    },
    scheduledTime:
      typeof r.scheduledTime === 'number' && Number.isFinite(r.scheduledTime) ? r.scheduledTime : 0,
    articleMode: r.articleMode === true,
    articleContent:
      content && typeof content === 'object' && Array.isArray(content.blocks)
        ? (content as ArticleContent)
        : null,
    videoUrl: str(r.videoUrl),
    dismissedLinkUrl: str(r.dismissedLinkUrl),
  }
}

/** Картинки черновика: data-URL картинок или уже загруженные http(s)-адреса. */
export function parseDraftImages(raw: unknown): string[] {
  return strings(raw)
    .filter((s) => s.startsWith('data:image/') || /^https?:\/\//.test(s))
    .slice(0, MAX_IMAGES)
}

/** Черновик аккаунта из IndexedDB (черновик гостя переезжает к нему). */
export async function readStoredDraft(
  address: string | null | undefined
): Promise<StoredPostDraft> {
  const [fields, images] = await Promise.all([
    adoptLegacySettingsKey(settingsAPI, POST_DRAFT_FIELDS_KEY, address),
    adoptLegacySettingsKey(settingsAPI, POST_DRAFT_IMAGES_KEY, address),
  ])
  return { fields: parseDraftFields(fields), images: parseDraftImages(images) }
}

/** `null` — полей нет (всё по умолчанию): запись удаляется. */
export async function writeDraftFields(
  address: string | null | undefined,
  fields: PostDraftFields | null
): Promise<void> {
  const key = accountScopedKey(POST_DRAFT_FIELDS_KEY, address)
  // IndexedDB не принимает реактивные прокси Vue — только простые объекты.
  if (fields) await settingsAPI.set(key, JSON.parse(JSON.stringify(fields)))
  else await settingsAPI.remove(key)
}

export async function writeDraftImages(
  address: string | null | undefined,
  images: readonly string[]
): Promise<void> {
  const key = accountScopedKey(POST_DRAFT_IMAGES_KEY, address)
  if (images.length) await settingsAPI.set(key, [...images])
  else await settingsAPI.remove(key)
}
