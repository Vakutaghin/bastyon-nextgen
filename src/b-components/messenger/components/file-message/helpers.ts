/**
 * Хелперы для file-message: иконка по mime + форматирование размера.
 * Чистые функции, легко тестируются.
 */

export const iconForMime = (mime?: string, name?: string): string => {
  const m = (mime || '').toLowerCase()
  const ext = (name || '').toLowerCase().split('.').pop() || ''

  if (m.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext))
    return '🖼️'
  if (m.startsWith('video/') || ['mp4', 'mov', 'mkv', 'avi', 'webm'].includes(ext)) return '🎬'
  if (m.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext))
    return '🎵'
  if (m.includes('pdf') || ext === 'pdf') return '📕'
  if (
    m.includes('zip') ||
    m.includes('rar') ||
    m.includes('compress') ||
    m.includes('tar') ||
    m.includes('7z')
  )
    return '🗜️'
  if (['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2'].includes(ext)) return '🗜️'
  if (
    m.includes('word') ||
    m.includes('excel') ||
    m.includes('powerpoint') ||
    m.includes('sheet') ||
    m.includes('document')
  )
    return '📊'
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods'].includes(ext)) return '📊'
  if (m.startsWith('text/') || ['txt', 'md', 'rtf', 'csv', 'log'].includes(ext)) return '📝'
  if (
    m.includes('json') ||
    m.includes('xml') ||
    m.includes('javascript') ||
    m.includes('typescript')
  )
    return '🧾'
  if (
    [
      'js',
      'ts',
      'tsx',
      'jsx',
      'json',
      'xml',
      'html',
      'css',
      'py',
      'rb',
      'go',
      'rs',
      'java',
      'c',
      'cpp',
      'h',
    ].includes(ext)
  )
    return '🧾'
  return '📄'
}

/**
 * Форматирует размер байтов в человекочитаемый вид:
 *  - <1 КБ — байты;
 *  - КБ/МБ/ГБ — 1 или 2 знака после запятой в зависимости от величины.
 */
export const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} Б`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} КБ`
  const mb = kb / 1024
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : mb.toFixed(0)} МБ`
  const gb = mb / 1024
  return `${gb < 10 ? gb.toFixed(2) : gb.toFixed(1)} ГБ`
}
