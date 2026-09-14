// Форматирование текста «О себе» профиля: оппортунистический URI-decode старых
// записей, HTML-escape и линкификация URL. Чистая функция — вынесено из
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
