/**
 * Источник для режимов редактирования/репоста композера.
 *
 * Структурный интерфейс — принимает и нормализованный Post из ленты (post-card),
 * и сырой пост. Чистые хелперы тестируются отдельно и не зависят от Vue/стора.
 */

import type { ArticleContent } from '@/blockchain/core/actions/post-action'

export type ComposerMode = 'create' | 'edit' | 'repost'

export interface ComposerSource {
  txid?: string
  hash?: string
  id?: string | number
  /** Тип контента ('article' для статей). */
  type?: string
  /** Тело поста: строка (обычный пост) или Editor.js-объект `{blocks}` (статья). */
  message?: string
  content?: string | Record<string, unknown>
  /** Заголовок (видео/статья): сырое `caption` или нормализованное `title`. */
  caption?: string
  title?: string
  tags?: string[]
  images?: string[]
  author?: { name?: string; address?: string; avatar?: string | null }
  /** Время публикации (для превью репоста). */
  timestamp?: string
}

/** Похоже ли содержимое на документ Editor.js (`{ blocks: [...] }`). */
function looksLikeArticle(content: unknown): boolean {
  if (content && typeof content === 'object')
    return Array.isArray((content as { blocks?: unknown }).blocks)
  if (typeof content === 'string') {
    const s = content.trim()
    return s.startsWith('{"blocks"') || s.startsWith('{"time"')
  }
  return false
}

/** Источник — статья? (по type или по структуре content). */
export function isArticleSource(src: ComposerSource): boolean {
  return src.type === 'article' || looksLikeArticle(src.content)
}

/** Парсит content источника в ArticleContent (`{blocks}`); null если не статья/не распарсилось. */
export function parseArticleContent(src: ComposerSource): ArticleContent | null {
  const raw = src.content
  let data: unknown = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (data && typeof data === 'object' && Array.isArray((data as { blocks?: unknown }).blocks)) {
    return data as ArticleContent
  }
  return null
}

/** txid/hash/id источника как строка (для txidEdit/txidRepost). */
export function sourceId(src: ComposerSource): string {
  return String(src.txid || src.hash || src.id || '')
}

export interface PrefillData {
  message: string
  caption: string
  tags: string[]
  images: string[]
}

/** Извлекает поля для префилла формы при редактировании (обычный пост). */
export function postToComposerData(src: ComposerSource): PrefillData {
  const contentStr = typeof src.content === 'string' ? src.content : ''
  return {
    message: src.message ?? contentStr,
    caption: src.caption ?? src.title ?? '',
    tags: src.tags ? [...src.tags] : [],
    images: src.images ? [...src.images] : [],
  }
}
