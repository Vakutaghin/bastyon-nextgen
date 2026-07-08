import { formatBastyonLinks } from '@/helpers/common/text-formatter'
import { sanitizeHtml } from '@/helpers/content/sanitize-html'

interface EditorJsBlock {
  type: string
  data: unknown
}

/** Сужает произвольное значение data блока до записи с известными полями. */
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

/**
 * Экранирует значение перед вставкой в HTML-атрибут (`src`, `alt`). Editor.js
 * `file.url`/`caption` — недоверенный ввод из блокчейна; без escape строка вроде
 * `x" onerror="…` вырывается из атрибута и инжектит обработчик (P1-1). Финальный
 * `sanitizeHtml` — второй рубеж (whitelist вырезает on*), это — первый.
 */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Пытается распарсить JSON, обрабатывая возможные проблемы
 */
function parseJson(str: string): unknown {
  try {
    return JSON.parse(str)
  } catch (e) {
    // Попытка 1: Замена HTML-сущностей
    let fixed = str.replace(/&quot;/g, '"')

    try {
      return JSON.parse(fixed)
    } catch (e2) {
      // Попытка 2: Экранирование управляющих символов (переносы строк)
      // Внимание: это может сломать валидные экранированные строки, но стоит попробовать
      fixed = str.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')

      try {
        return JSON.parse(fixed)
      } catch (e3) {
        throw e
      }
    }
  }
}

/**
 * Пытается извлечь текст из сырого JSON Editor.js (если парсинг не удался)
 */
function extractTextFromRawJson(str: string): string {
  // Ищем поля "text" или "caption"
  const regex = /"(?:text|caption|items)"\s*:\s*(?:"((?:[^"\\]|\\.)*)"|\[(.*?)\])/g
  let match
  let extracted = ''

  while ((match = regex.exec(str)) !== null) {
    if (match[1]) {
      // Это обычная строка в text или caption
      // Декодируем unicode символы и экранированные кавычки
      try {
        const text = JSON.parse(`"${match[1]}"`)
        extracted += text + '\n\n'
      } catch (e) {
        extracted += match[1] + '\n\n'
      }
    } else if (match[2]) {
      // Это массив items (для списков)
      // Внутри него могут быть строки "...", "..."
      const itemRegex = /"((?:[^"\\]|\\.)*)"/g
      let itemMatch
      while ((itemMatch = itemRegex.exec(match[2])) !== null) {
        try {
          const text = JSON.parse(`"${itemMatch[1]}"`)
          extracted += '• ' + text + '\n'
        } catch (e) {
          extracted += '• ' + itemMatch[1] + '\n'
        }
      }
      extracted += '\n'
    }
  }

  return extracted.trim()
}

/**
 * Парсит данные Editor.js и преобразует их в HTML строку
 */
export function editorjsToHtml(content: string | object): string {
  if (!content) return ''

  let data: unknown

  try {
    data = typeof content === 'string' ? parseJson(content) : content
  } catch (e) {
    // Если не удалось распарсить JSON, проверяем, похоже ли это на Editor.js
    const strContent = String(content).trim()
    if (strContent.startsWith('{"blocks":') || strContent.startsWith('{"time":')) {
      // Пытаемся извлечь текст из структуры
      const extracted = extractTextFromRawJson(strContent)
      if (extracted) {
        return formatPlainText(extracted)
      }
    }

    // Иначе считаем это обычным текстом
    return formatPlainText(strContent)
  }

  const blocks = asRecord(data).blocks
  if (!data || !Array.isArray(blocks)) {
    // Та же проверка для валидного JSON, но без нужной структуры
    const strContent = String(content).trim()
    if (strContent.startsWith('{"blocks":') || strContent.startsWith('{"time":')) {
      // Пытаемся извлечь текст из структуры (вдруг структура битая внутри)
      const extracted = extractTextFromRawJson(strContent)
      if (extracted) {
        return formatPlainText(extracted)
      }
    }

    return formatPlainText(strContent)
  }

  const html = (blocks as EditorJsBlock[])
    .map((block) => {
      switch (block.type) {
        case 'header':
          return parseHeader(block.data)
        case 'paragraph':
          return parseParagraph(block.data)
        case 'list':
          return parseList(block.data)
        case 'image':
          return parseImage(block.data)
        case 'quote':
          return parseQuote(block.data)
        case 'delimiter':
          return '<hr class="ce-delimiter">'
        case 'code':
          return parseCode(block.data)
        default:
          return ''
      }
    })
    .join('')

  // Финальный whitelist-прогон всей сборки (P1-1): построчные части уже
  // санитизируются через formatBastyonLinks, но img-атрибуты собираются
  // интерполяцией — sanitizeHtml вырезает on*/опасные протоколы как второй рубеж.
  return sanitizeHtml(html)
}

function parseHeader(raw: unknown): string {
  const data = asRecord(raw) as { text?: string; level?: number }
  if (!data.text) return ''
  const level = data.level && data.level >= 1 && data.level <= 6 ? data.level : 2

  // Унифицируем переносы строк и <br>
  const text = data.text.replace(/<br\s*\/?>/gi, '\n')

  // Форматируем ссылки и экранируем HTML (переносы \n сохраняются)
  let formatted = formatBastyonLinks(text)

  // Преобразуем \n обратно в <br>
  formatted = formatted.replace(/\n/g, '<br>')

  return `<h${level}>${formatted}</h${level}>`
}

function parseParagraph(raw: unknown): string {
  const data = asRecord(raw) as { text?: string }
  if (!data.text) return ''

  // Унифицируем переносы строк и <br>
  const text = data.text.replace(/<br\s*\/?>/gi, '\n')

  // Форматируем ссылки и экранируем HTML (переносы \n сохраняются)
  let formatted = formatBastyonLinks(text)

  // Преобразуем \n обратно в <br>
  formatted = formatted.replace(/\n/g, '<br>')

  return `<p>${formatted}</p>`
}

function parseList(raw: unknown): string {
  const data = asRecord(raw) as { style?: 'ordered' | 'unordered'; items?: string[] }
  if (!data.items || !Array.isArray(data.items)) return ''

  const tag = data.style === 'ordered' ? 'ol' : 'ul'
  const items = data.items.map((item) => `<li>${formatBastyonLinks(item)}</li>`).join('')

  return `<${tag}>${items}</${tag}>`
}

function parseImage(raw: unknown): string {
  const data = asRecord(raw) as {
    file?: { url?: string }
    caption?: string
    withBorder?: boolean
    withBackground?: boolean
    stretched?: boolean
  }
  if (!data.file || !data.file.url) return ''

  const classes = ['ce-image']
  if (data.withBorder) classes.push('ce-image--with-border')
  if (data.withBackground) classes.push('ce-image--with-background')
  if (data.stretched) classes.push('ce-image--stretched')

  let captionHtml = ''
  if (data.caption) {
    captionHtml = `<div class="ce-image__caption">${formatBastyonLinks(data.caption)}</div>`
  }

  return `
    <div class="${classes.join(' ')}">
      <img src="${escapeAttr(data.file.url)}" alt="${escapeAttr(data.caption || '')}" />
      ${captionHtml}
    </div>
  `
}

function parseQuote(raw: unknown): string {
  const data = asRecord(raw) as { text?: string; caption?: string; alignment?: 'left' | 'center' }
  if (!data.text) return ''

  const alignment = data.alignment || 'left'
  let captionHtml = ''
  if (data.caption) {
    let captionText = data.caption.replace(/<br\s*\/?>/gi, '\n')
    captionText = formatBastyonLinks(captionText).replace(/\n/g, '<br>')
    captionHtml = `<footer class="ce-quote__caption">${captionText}</footer>`
  }

  let text = data.text.replace(/<br\s*\/?>/gi, '\n')
  text = formatBastyonLinks(text).replace(/\n/g, '<br>')

  return `
    <blockquote class="ce-quote ce-quote--${alignment}">
      <p>${text}</p>
      ${captionHtml}
    </blockquote>
  `
}

function parseCode(raw: unknown): string {
  const data = asRecord(raw) as { code?: string }
  if (!data.code) return ''
  // Экранируем HTML в коде, чтобы он отображался как код
  const code = data.code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

  return `<pre class="ce-code"><code>${code}</code></pre>`
}

function formatPlainText(text: string): string {
  if (!text) return ''

  // Переносы строк → <br>. Существующие <br> в контенте сохраняются. Контент
  // форматируется и санитизируется ОДНИМ вызовом — иначе построчное дробление
  // рвёт инлайн-теги, охватывающие несколько строк (напр. <b>…<br>…</b>).
  const withBreaks = text.replace(/\r\n|\r|\n/g, '<br>')

  return formatBastyonLinks(withBreaks)
}
