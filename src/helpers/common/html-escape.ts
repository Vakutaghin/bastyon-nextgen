// Экранирование HTML-символов для безопасного отображения пользовательского контента

/**
 * Экранирует спецсимволы HTML для предотвращения XSS.
 * Заменяет &, <, >, ", ' на соответствующие HTML-сущности.
 *
 * @param text - исходный текст
 * @returns экранированный текст, безопасный для вставки в HTML
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Обратное экранирование HTML-сущностей.
 *
 * @param text - текст с HTML-сущностями
 * @returns текст с восстановленными символами
 */
export function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
}
