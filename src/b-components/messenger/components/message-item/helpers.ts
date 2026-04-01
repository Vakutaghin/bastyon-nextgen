// Хелперы компонента message-item: форматирование текста, позиционирование

import { escapeHtml } from '@/helpers/common/html-escape'

import { MESSAGE_URL_PATTERN } from './consts'

/**
 * Форматирует текст сообщения: экранирует HTML и оборачивает URL в ссылки.
 */
export function formatMessageText(text: string): string {
  const parts = text.split(MESSAGE_URL_PATTERN)

  return parts.map((part) => {
    if (part.match(MESSAGE_URL_PATTERN)) {
      const escapedHref = escapeHtml(part)
      return `<a href="${escapedHref}" target="_blank" rel="noopener noreferrer" style="color: #007bff; text-decoration: none;">${escapedHref}</a>`
    }
    return escapeHtml(part)
  }).join('')
}

/**
 * Форматирует время сообщения: «08:23» или «23.01.2023, 08:23» если год другой.
 */
export function formatMessageTime(timestamp: number): string {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  const now = new Date()
  const timePart = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth() || d.getDate() !== now.getDate()) {
    const datePart = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
    return `${datePart}, ${timePart}`
  }

  return timePart
}

/**
 * Находит ближайшего прокручиваемого предка элемента.
 */
export function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let p = el?.parentElement ?? null
  while (p) {
    const ov = getComputedStyle(p).overflowY
    if ((ov === 'auto' || ov === 'scroll' || ov === 'overlay') && p.scrollHeight > p.clientHeight) {
      return p
    }
    p = p.parentElement
  }
  return null
}
