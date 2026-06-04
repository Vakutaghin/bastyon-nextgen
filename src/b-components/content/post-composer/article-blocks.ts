/**
 * Нормализация вывода Editor.js в формат, который рендерит block-content.vue / editorjs-parser.ts.
 *
 * Главное: @editorjs/list@2 отдаёт `items: [{ content, items }]`, а рендер ждёт `items: string[]`.
 * Здесь приводим списки к плоскому `string[]` (вложенные подпункты разворачиваем в плоский список).
 * Чистая функция — тестируется отдельно.
 */

import type { ArticleContent } from '@/blockchain/core/actions/post-action'

interface EditorBlock {
  type?: string
  data?: Record<string, unknown>
  [key: string]: unknown
}

/** Разворачивает items списка (v1 string[] либо v2 [{content, items}]) в плоский string[]. */
export function flattenListItems(items: unknown): string[] {
  if (!Array.isArray(items)) return []
  const out: string[] = []
  for (const item of items) {
    if (typeof item === 'string') {
      out.push(item)
    } else if (item && typeof item === 'object') {
      const obj = item as { content?: unknown; items?: unknown }
      if (typeof obj.content === 'string') out.push(obj.content)
      // Вложенные подпункты — разворачиваем в тот же плоский список (рендер плоский).
      if (Array.isArray(obj.items) && obj.items.length) out.push(...flattenListItems(obj.items))
    }
  }
  return out
}

/** Приводит вывод Editor.js к рендер-совместимому виду (списки → items: string[]). */
export function normalizeArticleBlocks(data: unknown): ArticleContent {
  const source = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const rawBlocks = Array.isArray(source.blocks) ? (source.blocks as EditorBlock[]) : []

  const blocks = rawBlocks.map((block) => {
    if (block?.type === 'list' && block.data && Array.isArray(block.data.items)) {
      return { ...block, data: { ...block.data, items: flattenListItems(block.data.items) } }
    }
    return block
  })

  return { ...source, blocks } as ArticleContent
}

/** Пустой ли документ статьи (нет блоков). */
export function isEmptyArticle(data: ArticleContent | null | undefined): boolean {
  return !data || !Array.isArray(data.blocks) || data.blocks.length === 0
}
