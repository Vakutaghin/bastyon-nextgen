/**
 * Парсер тайм-кодов из описаний (как на YouTube).
 *
 * Правила YouTube для глав:
 *  1. Должно быть не меньше трёх тайм-кодов
 *  2. Первый обязан быть 0:00 (или 00:00, 0:00:00)
 *  3. Тайм-коды идут по возрастанию
 *  4. Каждая глава должна длиться не меньше 10 секунд
 *
 * Тайм-код на строке считается «началом главы», всё остальное на строке — название.
 * Поддерживаемые форматы: `0:00`, `00:00`, `0:00:00`, `00:00:00`.
 */

export interface Chapter {
  /** Начало главы в секундах */
  start: number
  /** Сырая строка тайм-кода, как она встречается в тексте */
  raw: string
  /** Название главы (текст строки без самого тайм-кода) */
  label: string
}

/**
 * Регэксп тайм-кода: H:MM:SS, HH:MM:SS, M:SS, MM:SS.
 * Глобальный, чтобы можно было находить все вхождения по строке.
 */
export const TIMECODE_REGEX = /(?<![\d:])(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?![\d:])/g

/** Минимальная длина одной главы в секундах (YouTube требует 10s). */
const MIN_CHAPTER_LENGTH_SEC = 10

/** Минимальное количество глав, чтобы вообще включать режим глав. */
const MIN_CHAPTERS = 3

/**
 * Преобразует совпадение TIMECODE_REGEX в число секунд.
 * @param match массив [full, hours?, minutes, seconds]
 */
export function timecodeMatchToSeconds(match: RegExpMatchArray | RegExpExecArray): number | null {
  const h = match[1] !== undefined ? Number(match[1]) : 0
  const m = Number(match[2])
  const s = Number(match[3])
  if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(s)) return null
  if (s >= 60) return null
  // Если нет часов, минут может быть до 99 (как у YouTube для длинных видео без часов).
  if (match[1] === undefined && m > 99) return null
  if (match[1] !== undefined && m >= 60) return null
  return h * 3600 + m * 60 + s
}

/**
 * Извлекает плоский текст из контента поста (plain или Editor.js JSON).
 * Нам нужен только текст для регэкспа — без HTML и без структуры блоков.
 */
export function extractPlainTextFromContent(content: string | object | null | undefined): string {
  if (!content) return ''

  // Editor.js JSON
  if (typeof content === 'object') {
    return editorJsToText(content as any)
  }

  const str = String(content).trim()
  if (!str) return ''

  if (str.startsWith('{') && str.includes('"blocks"')) {
    try {
      return editorJsToText(JSON.parse(str))
    } catch {
      // не валидный JSON — обрабатываем как обычный текст
    }
  }

  return str
}

function editorJsToText(data: any): string {
  if (!data || !Array.isArray(data.blocks)) return ''
  const lines: string[] = []
  for (const block of data.blocks) {
    if (!block || !block.data) continue
    switch (block.type) {
      case 'paragraph':
      case 'header':
      case 'quote':
        lines.push(stripHtml(String(block.data.text || '')))
        break
      case 'list':
        if (Array.isArray(block.data.items)) {
          for (const item of block.data.items) lines.push(stripHtml(String(item || '')))
        }
        break
      default:
        // прочие блоки игнорируем — у них вряд ли будут тайм-коды
        break
    }
  }
  return lines.join('\n')
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
}

/**
 * Парсит тайм-коды по строкам. По одной главе на строку.
 * Возвращает массив только если набор удовлетворяет YouTube-правилам, иначе пустой массив.
 */
export function parseTimecodes(content: string | object | null | undefined): Chapter[] {
  const text = extractPlainTextFromContent(content)
  if (!text) return []

  const lines = text.split(/\r?\n/)
  const chapters: Chapter[] = []

  for (const line of lines) {
    // Берём ПЕРВЫЙ тайм-код на строке — он и считается началом главы.
    TIMECODE_REGEX.lastIndex = 0
    const match = TIMECODE_REGEX.exec(line)
    if (!match) continue

    const seconds = timecodeMatchToSeconds(match)
    if (seconds === null) continue

    const raw = match[0]
    // Метка = строка без тайм-кода, обрезанная от разделителей и пробелов.
    const before = line.slice(0, match.index)
    const after = line.slice(match.index + raw.length)
    let label = (before + ' ' + after)
      .replace(/[-–—•:|·›»→\s]+/g, ' ')
      .trim()

    if (!label) label = raw

    chapters.push({ start: seconds, raw, label })
  }

  if (chapters.length < MIN_CHAPTERS) return []
  if (chapters[0].start !== 0) return []

  for (let i = 1; i < chapters.length; i++) {
    if (chapters[i].start <= chapters[i - 1].start) return []
    if (chapters[i].start - chapters[i - 1].start < MIN_CHAPTER_LENGTH_SEC) return []
  }

  return chapters
}

/**
 * Форматирует секунды в `M:SS` или `H:MM:SS`.
 */
export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  if (h > 0) {
    const mm = String(m).padStart(2, '0')
    return `${h}:${mm}:${ss}`
  }
  return `${m}:${ss}`
}

/**
 * Находит индекс активной главы по текущему времени воспроизведения.
 * Возвращает -1, если глав нет.
 */
export function findActiveChapterIndex(chapters: Chapter[], currentTime: number): number {
  if (!chapters.length) return -1
  let idx = -1
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].start <= currentTime) idx = i
    else break
  }
  return idx
}
