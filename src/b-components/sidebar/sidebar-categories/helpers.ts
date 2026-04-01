// Хелперы компонента sidebar-categories

/**
 * Очищает имя категории: заменяет пробелы на _, убирает спецсимволы.
 */
export function sanitizeTagName(input: string): string {
  let val = input.trim()
  val = val.replace(/\s+/g, '_')
  val = val.replace(/[^\p{L}\p{N}_]/gu, '')
  return val
}

/**
 * Проверяет, существует ли категория с таким именем в списке.
 */
export function isCategoryExists(tagName: string, categories: Array<{ tags: string[] }>): boolean {
  const normalized = tagName.toLowerCase()
  return categories.some((cat) =>
    cat.tags.some((t) => t.toLowerCase() === normalized),
  )
}
