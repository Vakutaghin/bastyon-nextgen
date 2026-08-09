// Форматирование текста «О себе» профиля: оппортунистический URI-decode старых
// записей, HTML-escape и линкификация URL. Чистая функция — вынесено из
// profile-sidebar.vue (см. LARGE_FILE_SPLIT_AUDIT.md).
export function formatAbout(raw: string): string {
  let text = raw
  if (!text) return ''

  // URI-encoded описание встречается в старых записях — декодируем оппортунистически.
  if (/%[0-9A-Fa-f]{2}/.test(text)) {
    try {
      text = decodeURIComponent(text.replace(/\+/g, ' '))
    } catch {
      // оставляем как есть
    }
  }

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
