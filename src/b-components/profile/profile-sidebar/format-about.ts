// Форматирование полей профиля. «О себе»: оппортунистический URI-decode старых
// записей, HTML-escape и линкификация URL. Чистые функции — вынесено из
// profile-sidebar.vue (аудит крупных файлов 2026-08).
import { safeDecode } from '@/helpers/content/safe-decode'

export function formatAbout(raw: string): string {
  let text = raw
  if (!text) return ''

  // URI-encoded описание встречается в старых записях — декодируем оппортунистически
  // (общий safeDecode: битые последовательности остаются как есть, `+` — не пробел).
  text = safeDecode(text)

  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

  const urlRegex = /((https?:\/\/)|(www\.))[^\s]+/g

  return escapedText.replace(urlRegex, (url) => {
    let href = url
    if (!href.match(/^https?:\/\//)) href = 'https://' + href
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`
  })
}

/** Репутация с одним знаком после запятой: нода отдаёт число или строку. */
export function formatReputation(value: unknown): string {
  const num = typeof value === 'number' ? value : Number(value || 0)
  return (Number.isFinite(num) ? num : 0).toFixed(1)
}
