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
