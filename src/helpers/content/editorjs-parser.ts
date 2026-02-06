import { formatBastyonLinks } from '@/helpers/common/text-formatter'

interface EditorJsBlock {
  type: string
  data: any
}

interface EditorJsData {
  time?: number
  blocks: EditorJsBlock[]
  version?: string
}

/**
 * Пытается распарсить JSON, обрабатывая возможные проблемы
 */
function parseJson(str: string): any {
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

  let data: EditorJsData

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

  if (!data || !data.blocks || !Array.isArray(data.blocks)) {
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

  return data.blocks.map(block => {
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
  }).join('')
}

function parseHeader(data: { text?: string; level?: number }): string {
  if (!data || !data.text) return ''
  const level = data.level && data.level >= 1 && data.level <= 6 ? data.level : 2

  // Унифицируем переносы строк и <br>
  let text = data.text.replace(/<br\s*\/?>/gi, '\n')

  // Форматируем ссылки и экранируем HTML (переносы \n сохраняются)
  let formatted = formatBastyonLinks(text)

  // Преобразуем \n обратно в <br>
  formatted = formatted.replace(/\n/g, '<br>')

  return `<h${level}>${formatted}</h${level}>`
}

function parseParagraph(data: { text?: string }): string {
  if (!data || !data.text) return ''

  // Унифицируем переносы строк и <br>
  let text = data.text.replace(/<br\s*\/?>/gi, '\n')

  // Форматируем ссылки и экранируем HTML (переносы \n сохраняются)
  let formatted = formatBastyonLinks(text)

  // Преобразуем \n обратно в <br>
  formatted = formatted.replace(/\n/g, '<br>')

  return `<p>${formatted}</p>`
}

function parseList(data: { style?: 'ordered' | 'unordered'; items?: string[] }): string {
  if (!data || !data.items || !Array.isArray(data.items)) return ''

  const tag = data.style === 'ordered' ? 'ol' : 'ul'
  const items = data.items.map(item => `<li>${formatBastyonLinks(item)}</li>`).join('')

  return `<${tag}>${items}</${tag}>`
}

function parseImage(data: { file?: { url?: string }; caption?: string; withBorder?: boolean; withBackground?: boolean; stretched?: boolean }): string {
  if (!data || !data.file || !data.file.url) return ''

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
      <img src="${data.file.url}" alt="${data.caption || ''}" />
      ${captionHtml}
    </div>
  `
}

function parseQuote(data: { text?: string; caption?: string; alignment?: 'left' | 'center' }): string {
  if (!data || !data.text) return ''

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

function parseCode(data: { code?: string }): string {
  if (!data || !data.code) return ''
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

  // Преобразуем <br />, <br/>, <br> в \n для унификации
  let normalized = text.replace(/<br\s*\/?>/gi, '\n')

  // Разбиваем по \n и оборачиваем каждую строку в <p>
  const lines = normalized.split('\n').filter((line) => line.trim() !== '')
  if (lines.length === 0) return ''

  return lines.map((line) => `<p>${formatBastyonLinks(line)}</p>`).join('')
}
