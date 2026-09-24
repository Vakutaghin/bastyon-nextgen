/**
 * Общая нормализация блоков Editor.js для обоих рендереров (S25).
 *
 * Рендерера два: строковый `editorjs-parser` (превью в ленте) и компонентный
 * `block-content` (полный вид). Они расходились: превью не знало `table` и
 * `link`, полный вид не знал `delimiter` и рисовал его пустым абзацем, а
 * элементы списка Editor.js v2 (объекты `{content, items}`) в обоих
 * превращались в `[object Object]`. Общие правила живут здесь.
 */

/** Набор типов блоков, который обязаны понимать ОБА рендерера. */
export const SUPPORTED_BLOCK_TYPES = [
  'header',
  'paragraph',
  'list',
  'image',
  'quote',
  'delimiter',
  'code',
  'link',
  'table',
] as const

export type SupportedBlockType = (typeof SUPPORTED_BLOCK_TYPES)[number]

/** Элемент списка v2: `{ content, items }` вместо простой строки. */
interface ListItemObject {
  content?: unknown
  text?: unknown
  items?: unknown
}

function itemToText(item: unknown): string {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object') {
    const obj = item as ListItemObject
    if (typeof obj.content === 'string') return obj.content
    if (typeof obj.text === 'string') return obj.text
  }
  return ''
}

/**
 * Плоский список строк из `data.items` в обеих схемах Editor.js.
 * Вложенные пункты (v2) разворачиваются следом за родителем — отступ в плоском
 * `<li>` всё равно не передать, а текст терять нельзя.
 */
export function normalizeListItems(items: unknown): string[] {
  if (!Array.isArray(items)) return []
  const out: string[] = []
  for (const item of items) {
    const text = itemToText(item)
    if (text) out.push(text)
    const nested = item && typeof item === 'object' ? (item as ListItemObject).items : undefined
    if (Array.isArray(nested)) out.push(...normalizeListItems(nested))
  }
  return out
}

/** Строки таблицы: всегда массив массивов строк. */
export function normalizeTableRows(content: unknown): string[][] {
  if (!Array.isArray(content)) return []
  return content
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => row.map((cell) => (typeof cell === 'string' ? cell : itemToText(cell))))
}
