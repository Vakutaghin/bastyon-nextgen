/**
 * Пункты списка статьи. Списки Editor.js v2 (@editorjs/list@2, старые статьи)
 * хранят `items: [{ content, items }]`, а лента рисует плоский `string[]`:
 * вложенные подпункты разворачиваются следом за родителем. Чистая функция.
 */

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
