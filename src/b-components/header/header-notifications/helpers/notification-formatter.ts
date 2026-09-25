// Форматтеры для дропдауна нотификаций: обрезка текста (время — в date-formatter).

/** Лимит для превью текста комментария (символов). */
export const COMMENT_PREVIEW_LIMIT = 160

/** Лимит для превью текста родительского поста (символов). */
export const POST_REF_PREVIEW_LIMIT = 80

/** Сжимает пробелы и обрезает текст до max символов с многоточием. */
export function trimText(text: string | undefined, max: number): string {
  if (!text) return ''
  const plain = text.replace(/\s+/g, ' ').trim()
  if (plain.length <= max) return plain
  return plain.slice(0, max).trimEnd() + '…'
}
