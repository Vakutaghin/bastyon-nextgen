/**
 * Текст статей (Editor.js) в блокчейне: каждое текстовое поле блока хранится
 * через encodeURIComponent. Так публикует старый клиент (functionsfirst.js:
 * `edjs.apply(content, articleEncode)`) и так читает (`articleDecode`).
 *
 * Раскодировать нужно по полям, а не всю JSON-строку разом: раскодированные
 * `"` (кавычки, `<a href="…">`) и переводы строк ломали JSON, и почти половина
 * статей старого клиента показывалась обрывками текста без картинок.
 */

import type { ArticleContent } from '@/blockchain/core/actions/post-action'
import { safeDecode } from './safe-decode'

interface EditorBlock {
  type?: unknown
  data?: unknown
  [key: string]: unknown
}

type TextCodec = (value: string) => string

/** Применяет codec к строке; остальное (undefined, числа) не трогает. */
const codeString = (value: unknown, codec: TextCodec): unknown =>
  typeof value === 'string' ? codec(value) : value

/** Пункты списка: строки (v1) и `{ content, items }` (v2) на любой глубине. */
function codeListItems(items: unknown, codec: TextCodec): unknown {
  if (!Array.isArray(items)) return items
  return items.map((item) => {
    if (typeof item === 'string') return codec(item)
    if (!item || typeof item !== 'object') return item
    const next = { ...(item as Record<string, unknown>) }
    if ('content' in next) next.content = codeString(next.content, codec)
    if ('items' in next) next.items = codeListItems(next.items, codec)
    return next
  })
}

/**
 * Текстовые поля каждого типа блока — те же, что кодирует старый клиент
 * (functionsfirst.js `encdec`). Остальные блоки (delimiter, table) он хранит
 * как есть, мы тоже.
 */
function codeBlockData(type: unknown, data: unknown, codec: TextCodec): unknown {
  if (type === 'carousel' && Array.isArray(data)) {
    return data.map((slide) =>
      slide && typeof slide === 'object'
        ? {
            ...slide,
            url: codeString((slide as { url?: unknown }).url, codec),
            ...('caption' in slide
              ? { caption: codeString((slide as { caption?: unknown }).caption, codec) }
              : {}),
          }
        : slide
    )
  }
  if (!data || typeof data !== 'object') return data
  const d = { ...(data as Record<string, unknown>) }
  const field = (name: string): void => {
    if (name in d) d[name] = codeString(d[name], codec)
  }
  switch (type) {
    case 'header':
    case 'paragraph':
      field('text')
      break
    case 'list':
      d.items = codeListItems(d.items, codec)
      break
    case 'image':
      field('caption')
      if (d.file && typeof d.file === 'object') {
        const file = { ...(d.file as Record<string, unknown>) }
        file.url = codeString(file.url, codec)
        d.file = file
      }
      break
    case 'quote':
      field('caption')
      field('text')
      break
    case 'code':
      field('code')
      break
    case 'warning':
      field('title')
      field('message')
      break
    case 'linkTool':
      field('link')
      if (d.meta && typeof d.meta === 'object') {
        const meta = { ...(d.meta as Record<string, unknown>) }
        meta.title = codeString(meta.title, codec)
        meta.description = codeString(meta.description, codec)
        if (meta.image && typeof meta.image === 'object') {
          const image = { ...(meta.image as Record<string, unknown>) }
          image.url = codeString(image.url, codec)
          meta.image = image
        }
        d.meta = meta
      }
      break
    case 'embed':
      field('embed')
      field('source')
      field('caption')
      break
    default:
      return data
  }
  return d
}

function codeArticle(content: ArticleContent, codec: TextCodec): ArticleContent {
  const blocks = Array.isArray(content.blocks) ? (content.blocks as EditorBlock[]) : []
  return {
    ...content,
    blocks: blocks.map((block) =>
      block && typeof block === 'object'
        ? { ...block, data: codeBlockData(block.type, block.data, codec) }
        : block
    ),
  }
}

/**
 * Текст статьи для блокчейна: каждое текстовое поле — через encodeURIComponent,
 * как публикует старый клиент (`articleEncode`). Некодированный текст с `%`
 * старый клиент при правке раскодировать не может.
 */
export function encodeArticleContent(content: ArticleContent): ArticleContent {
  return codeArticle(content, encodeURIComponent)
}

/**
 * Обратное к `encodeArticleContent`: текст статьи из блокчейна для показа и
 * правки. Как `trydecode` старого клиента — строку, которую не раскодировать,
 * оставляет как есть (наши статьи до кодирования).
 */
export function decodeArticleContent(content: ArticleContent): ArticleContent {
  return codeArticle(content, safeDecode)
}

/** Документ Editor.js из тела поста (`m`); null — это не статья или JSON битый. */
function parseArticle(body: string): ArticleContent | null {
  const trimmed = body.trim()
  if (!trimmed.startsWith('{')) return null
  try {
    const parsed: unknown = JSON.parse(trimmed)
    return parsed && typeof parsed === 'object' && Array.isArray((parsed as ArticleContent).blocks)
      ? (parsed as ArticleContent)
      : null
  } catch {
    return null
  }
}

/**
 * Тело поста из ответа ноды → текст для UI. Статья раскодируется по полям и
 * остаётся валидным JSON; обычный пост — целиком, как раньше.
 */
export function decodePostBody(body: string): string {
  if (!body) return ''
  const article = parseArticle(body)
  return article ? JSON.stringify(decodeArticleContent(article)) : safeDecode(body)
}
