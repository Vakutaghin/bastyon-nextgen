// Хелперы компонента profile-sidebar

import { escapeHtml } from '@/helpers/common/html-escape'

/**
 * Декодирует URL-encoded текст (описание профиля, имя).
 * Безопасно обрабатывает ошибки декодирования.
 */
export function decodeProfileText(text: string): string {
  if (typeof text !== 'string') return ''

  if (/%[0-9A-Fa-f]{2}/.test(text)) {
    try {
      return decodeURIComponent(text.replace(/\+/g, ' '))
    } catch {
      return text
    }
  }

  return text
}

/**
 * Форматирует текст «О себе»: экранирует HTML и оборачивает URL в ссылки.
 */
export function formatUrlsInText(text: string): string {
  const escaped = escapeHtml(text)
  const urlRegex = /((https?:\/\/)|(www\.))[^\s]+/g

  return escaped.replace(urlRegex, (url) => {
    let href = url
    if (!href.match(/^https?:\/\//)) {
      href = 'https://' + href
    }
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`
  })
}

/**
 * Извлекает отображаемое имя пользователя из профиля.
 */
export function getDisplayName(profile: Record<string, any> | null): string {
  if (!profile) return ''
  return decodeProfileText(profile.name || profile.address || '')
}
