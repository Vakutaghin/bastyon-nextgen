import { sanitizeHtml } from '@/helpers/content/sanitize-html'
import { escapeHtml } from '@/helpers/common/html-escape'

/**
 * @-меншены: `@<ник>` в начале строки или после не-словного символа. Рендерим
 * ссылкой на профиль (`/<ник>` — профиль резолвит ник в адрес, как авторские
 * ссылки). Навигацию по таким ссылкам перехватывает app-layout (`.mention-link`).
 */
const MENTION_REGEX = /(^|[^\w@/])@([A-Za-z0-9_]{2,30})/g

// Текст между меншенами НЕ экранируем — инлайн-HTML постов (`<b>`, `<br>`,
// `&nbsp;` …) должен сохраниться. Безопасность обеспечивает финальный
// `sanitizeHtml` в `formatBastyonLinks` (whitelist через библиотеку `xss`).
function linkifyMentions(text: string): string {
  let out = ''
  let lastIndex = 0
  let match: RegExpExecArray | null
  MENTION_REGEX.lastIndex = 0
  while ((match = MENTION_REGEX.exec(text)) !== null) {
    const [full, prefix, name] = match
    out += text.slice(lastIndex, match.index)
    out += prefix
    out += `<a href='/${encodeURIComponent(name)}' class='mention-link'>@${escapeHtml(name)}</a>`
    lastIndex = match.index + full.length
  }
  out += text.slice(lastIndex)
  return out
}

/**
 * Регулярка ссылки в плоском тексте. Фабрика, а не константа: у глобального
 * флага есть `lastIndex`, и общий инстанс ронял бы соседний вызов.
 *
 * Порядок важен: сначала bastyon://, потом ipfs://|ipns:// (файлообмен;
 * фрагмент `#key=…` приватной ссылки — часть URL), потом https?://, потом www.
 *
 * Экспортируется, чтобы обрезка превью резала текст по тем же границам, по
 * которым потом расставляются ссылки (иначе href уезжает обрезанным).
 */
export function createLinkRegex(): RegExp {
  return /(bastyon:\/\/[^\s<>'"]+|ipfs:\/\/[^\s<>'"]+|ipns:\/\/[^\s<>'"]+|https?:\/\/[^\s<>'"]+[^\s<>"'.,;:!?]|www\.[^\s<>'"]+[^\s<>"'.,;:!?])/gi
}

/**
 * Разбирает ПЛОСКИЙ текст (без разметки) на ссылки и остальной текст,
 * возвращая безопасный HTML. Вызывается только для текстовых узлов.
 */
function linkifyPlainText(text: string): string {
  const linkRegex = createLinkRegex()

  let out = ''
  let lastIndex = 0
  let match: RegExpExecArray | null

  linkRegex.lastIndex = 0
  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out += linkifyMentions(escapeHtml(text.slice(lastIndex, match.index)))
    }

    const url = match[0]
    let href = url
    let className: string | undefined
    let isExternal = true

    if (url.startsWith('bastyon://')) {
      // Внутренняя ссылка: клик перехватывает делегат app-layout (N15).
      className = 'bastyon-link'
      isExternal = false
    } else if (/^ipfs:\/\/|^ipns:\/\//i.test(url)) {
      // Открывает наш просмотрщик (делегат кликов), не новую вкладку.
      className = 'ipfs-link'
      isExternal = false
    } else if (url.startsWith('www.')) {
      href = `https://${url}`
    }

    const classAttr = className ? ` class='${escapeHtml(className)}'` : ''
    const targetAttr = isExternal ? " target='_blank' rel='noopener noreferrer'" : ''
    out += `<a href='${escapeHtml(href)}'${classAttr}${targetAttr}>${escapeHtml(url)}</a>`

    lastIndex = match.index + url.length
  }

  if (lastIndex < text.length) {
    out += linkifyMentions(escapeHtml(text.slice(lastIndex)))
  }

  return out
}

/**
 * Узлы, внутрь которых линкификация не заходит: в `<a>` вложенная ссылка
 * невалидна, в `<code>`/`<pre>` ссылка — часть кода.
 */
const SKIP_TAGS = new Set(['A', 'CODE', 'PRE', 'SCRIPT', 'STYLE', 'TEXTAREA'])

/** Обходит дерево и линкифицирует ТОЛЬКО текстовые узлы (S24). */
function linkifyTextNodes(root: ParentNode): void {
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === 3) {
      const text = child.textContent ?? ''
      if (!text) continue
      const html = linkifyPlainText(text)
      const holder = document.createElement('template')
      holder.innerHTML = html
      child.replaceWith(...Array.from(holder.content.childNodes))
      continue
    }
    if (child.nodeType === 1 && !SKIP_TAGS.has((child as Element).tagName)) {
      linkifyTextNodes(child as ParentNode)
    }
  }
}

/**
 * Форматирует текст поста: bastyon://, ipfs://, обычные URL и @меншены
 * становятся ссылками.
 *
 * Сначала санитайзер (whitelist через `xss`), потом линкификация по дереву —
 * и только по текстовым узлам. Раньше регулярка шла по сырой строке и
 * вставляла `<a>` ВНУТРЬ значений атрибутов: инлайновая `<a href="https://…">`
 * или `<img src="https://…">` в теле поста теряли href/src (S24).
 */
export function formatBastyonLinks(text: string): string {
  if (!text || typeof text !== 'string') {
    return text || ''
  }

  const safe = sanitizeHtml(text)
  const template = document.createElement('template')
  template.innerHTML = safe
  linkifyTextNodes(template.content)
  return template.innerHTML
}
