/**
 * Минимальный markdown → HTML рендерер для changelog-файлов.
 *
 * Поддерживает только то, что реально нужно в changelog: H1-H3, параграфы,
 * списки (• и -, 1.), inline-форматирование (**bold**, *italic*, `code`),
 * ссылки [text](url) и горизонтальные разделители (---).
 *
 * Источник доверенный (наши собственные .md в репозитории), но HTML-эскейп
 * на тексте всё равно делаем — защита от случайных < и & в описаниях.
 */

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]!)
}

function renderInline(text: string): string {
  let s = escapeHtml(text)
  // links [text](url) — url мы НЕ эскейпили заранее, делаем отдельно
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, url: string) => {
    const safeUrl = escapeHtml(url)
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`
  })
  // inline code
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  // bold
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  // italic — после bold, чтобы не схватить **
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  return s
}

type Block =
  | { kind: 'h'; level: 1 | 2 | 3; text: string }
  | { kind: 'p'; lines: string[] }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'hr' }

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []

  let i = 0
  while (i < lines.length) {
    const raw = lines[i]!
    const line = raw.trim()

    if (!line) {
      i += 1
      continue
    }

    if (line === '---' || line === '***' || line === '___') {
      blocks.push({ kind: 'hr' })
      i += 1
      continue
    }

    const hMatch = /^(#{1,3})\s+(.+)$/.exec(line)
    if (hMatch) {
      const level = hMatch[1]!.length as 1 | 2 | 3
      blocks.push({ kind: 'h', level, text: hMatch[2]! })
      i += 1
      continue
    }

    if (/^[-*•]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length) {
        const cur = lines[i]!.trim()
        const m = /^[-*•]\s+(.*)$/.exec(cur)
        if (!m) break
        items.push(m[1]!)
        i += 1
      }
      blocks.push({ kind: 'ul', items })
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length) {
        const cur = lines[i]!.trim()
        const m = /^\d+\.\s+(.*)$/.exec(cur)
        if (!m) break
        items.push(m[1]!)
        i += 1
      }
      blocks.push({ kind: 'ol', items })
      continue
    }

    const paraLines: string[] = []
    while (i < lines.length) {
      const cur = lines[i]!.trim()
      if (!cur) break
      if (/^(#{1,3})\s+/.test(cur)) break
      if (/^[-*•]\s+/.test(cur)) break
      if (/^\d+\.\s+/.test(cur)) break
      if (cur === '---' || cur === '***' || cur === '___') break
      paraLines.push(cur)
      i += 1
    }
    blocks.push({ kind: 'p', lines: paraLines })
  }

  return blocks
}

export function renderMarkdown(md: string): string {
  const blocks = parseBlocks(md)
  const out: string[] = []

  for (const b of blocks) {
    switch (b.kind) {
      case 'h':
        out.push(`<h${b.level}>${renderInline(b.text)}</h${b.level}>`)
        break
      case 'p':
        out.push(`<p>${b.lines.map(renderInline).join(' ')}</p>`)
        break
      case 'ul':
        out.push(`<ul>${b.items.map((i) => `<li>${renderInline(i)}</li>`).join('')}</ul>`)
        break
      case 'ol':
        out.push(`<ol>${b.items.map((i) => `<li>${renderInline(i)}</li>`).join('')}</ol>`)
        break
      case 'hr':
        out.push('<hr />')
        break
    }
  }

  return out.join('\n')
}
