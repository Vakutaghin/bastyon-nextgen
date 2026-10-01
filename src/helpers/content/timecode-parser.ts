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
 * Регэксп тайм-кода: H:MM:SS, HH:MM:SS, M:SS, MM:SS. Перед кодом не должно быть
 * цифры или двоеточия — это проверяет `nextTimecode`: lookbehind `(?<!…)` Safari
 * понимает только с 16.4, а на macOS 10.15 последний Safari — 15.6, и такой
 * литерал ронял разбор всего бандла.
 */
const TIMECODE_REGEX = /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?![\d:])/g

/**
 * Следующий тайм-код в `text`, начиная с позиции `from`: совпадение вида
 * [full, hours?, minutes, seconds] или null.
 */
export function nextTimecode(text: string, from = 0): RegExpExecArray | null {
  TIMECODE_REGEX.lastIndex = from
  let match: RegExpExecArray | null
  while ((match = TIMECODE_REGEX.exec(text)) !== null) {
    const before = match.index > 0 ? text[match.index - 1] : ''
    if (!before || !/[\d:]/.test(before)) return match
    // Код приклеен к цифре или двоеточию: ищем со следующего символа.
    TIMECODE_REGEX.lastIndex = match.index + 1
  }
  return null
}

/** Минимальная длина одной главы в секундах (YouTube требует 10s). */
const MIN_CHAPTER_LENGTH_SEC = 10

/** Минимальное количество глав, чтобы вообще включать режим глав. */
const MIN_CHAPTERS = 3

/**
 * Преобразует совпадение `nextTimecode` в число секунд.
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
    return editorJsToText(content)
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

/** Минимальная форма Editor.js блока, нужная для извлечения текста. */
interface EditorJsTextBlock {
  type?: string
  data?: { text?: unknown; items?: unknown }
}

function editorJsToText(data: unknown): string {
  const blocks =
    data && typeof data === 'object' ? (data as { blocks?: unknown }).blocks : undefined
  if (!Array.isArray(blocks)) return ''
  const lines: string[] = []
  for (const block of blocks as EditorJsTextBlock[]) {
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
    const match = nextTimecode(line)
    if (!match) continue

    const seconds = timecodeMatchToSeconds(match)
    if (seconds === null) continue

    const raw = match[0]
    // Метка = строка без тайм-кода, обрезанная от разделителей и пробелов.
    const before = line.slice(0, match.index)
    const after = line.slice(match.index + raw.length)
    let label = (before + ' ' + after).replace(/[-–—•:|·›»→\s]+/g, ' ').trim()

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
