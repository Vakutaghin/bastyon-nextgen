/**
 * Извлечение инициалов из имени/текста.
 * Общая утилита для аватаров, пост-карточек и других компонентов.
 */

/**
 * Извлекает инициалы из текста.
 * - "Иван Петров" → "ИП"
 * - "Иван" → "И"
 * - "" / undefined → fallback
 *
 * @param text - Имя или текст для извлечения инициалов
 * @param options.maxLetters - Максимальное количество букв (по умолчанию 2)
 * @param options.fallback - Значение по умолчанию, если текст пуст (по умолчанию '?')
 */
export function getInitials(
  text: string | undefined | null,
  options: { maxLetters?: number; fallback?: string } = {},
): string {
  const { maxLetters = 2, fallback = '?' } = options

  if (!text || typeof text !== 'string') {
    return fallback
  }

  const words = text.trim().split(/\s+/).filter((w) => w.length > 0)

  if (words.length === 0) {
    return fallback
  }

  return words
    .slice(0, maxLetters)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
}
