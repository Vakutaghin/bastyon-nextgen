/**
 * Экранирует HTML символы для безопасности
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#039;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Форматирует текст, преобразуя bastyon:// ссылки и обычные URL в кликабельные HTML ссылки
 * @param text - Текст для форматирования
 * @returns HTML строка с преобразованными ссылками
 */
export function formatBastyonLinks(text: string): string {
  if (!text || typeof text !== 'string') {
    return text || ''
  }

  // Комбинированное регулярное выражение для поиска всех типов ссылок
  // Порядок важен: сначала bastyon://, потом https?://, потом www.
  const linkRegex = /(bastyon:\/\/[^\s<>'"]+|https?:\/\/[^\s<>'"]+[^\s<>"'.,;:!?]|www\.[^\s<>'"]+[^\s<>"'.,;:!?])/gi

  const parts: Array<{ type: 'text' | 'link'; content: string; url?: string; className?: string; isExternal?: boolean }> = []
  let lastIndex = 0

  let match
  while ((match = linkRegex.exec(text)) !== null) {
    // Добавляем текст до ссылки
    if (match.index > lastIndex) {
      const textPart = text.substring(lastIndex, match.index)
      if (textPart) {
        parts.push({ type: 'text', content: textPart })
      }
    }

    // Определяем тип ссылки и обрабатываем
    const url = match[0]
    let href = url
    let className: string | undefined
    let isExternal = true // По умолчанию все ссылки внешние

    if (url.startsWith('bastyon://')) {
      className = 'bastyon-link'
      isExternal = false // bastyon:// ссылки внутренние
    } else if (url.startsWith('www.')) {
      href = `https://${url}`
    }

    parts.push({ type: 'link', content: url, url: href, className, isExternal })
    lastIndex = match.index + match[0].length
  }

  // Добавляем оставшийся текст
  if (lastIndex < text.length) {
    const textPart = text.substring(lastIndex)
    if (textPart) {
      parts.push({ type: 'text', content: textPart })
    }
  }

  // Если ссылок не найдено, просто экранируем весь текст
  if (parts.length === 0) {
    return escapeHtml(text)
  }

  // Собираем результат
  return parts
    .map((part) => {
      if (part.type === 'link' && part.url) {
        const escapedUrl = escapeHtml(part.content)
        const escapedHref = escapeHtml(part.url)
        const classAttr = part.className ? ` class='${escapeHtml(part.className)}'` : ''
        // Только внешние ссылки (не bastyon://) открываются в новой вкладке
        const targetAttr = part.isExternal ? ' target=\'_blank\' rel=\'noopener noreferrer\'' : ''
        return `<a href='${escapedHref}'${classAttr}${targetAttr}>${escapedUrl}</a>`
      } else {
        return escapeHtml(part.content)
      }
    })
    .join('')
}
