// Markdown статьи → дерево узлов справки. Разбирает markdown-it (таблицы и
// зачёркивание — как на GitHub), а выводят свои компоненты, без v-html: сырой
// HTML в приложение не попадает. Из HTML понимаем только то, что GitHub
// показывает сам: сворачиваемые <details>/<summary> и комментарии <!-- -->.
import MarkdownIt, { type Token } from 'markdown-it'
import { Slugger } from './help-slug'
import type {
  HelpAlertKind,
  HelpAlign,
  HelpBlock,
  HelpHeading,
  HelpInline,
  HelpLinkTarget,
} from './help-types'

const md = new MarkdownIt({ html: true, linkify: false, typographer: false })

export function tokenizeMarkdown(source: string): Token[] {
  return md.parse(source, {})
}

export interface HelpParseContext {
  /** Статья, которую разбираем: ссылка `#раздел` ведёт в неё же. */
  topic: string
  /** Путь картинки из статьи → URL в сборке; null — такой картинки нет. */
  resolveImage: (path: string) => string | null
  /** `bastyon://…` → путь в приложении; null — такого раздела нет. */
  resolveApp: (href: string) => string | null
}

export interface HelpParsedLink {
  to: HelpLinkTarget
  text: string
}

export interface HelpParsed {
  title: string
  blocks: HelpBlock[]
  headings: HelpHeading[]
  text: string
  links: HelpParsedLink[]
  problems: string[]
}

const ALERT_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]$/i
const DETAILS_OPEN_RE = /^<details(?:\s[^>]*)?>\s*(?:<summary>([\s\S]*?)<\/summary>)?$/i
const DETAILS_CLOSE_RE = /^<\/details>$/i
const COMMENT_RE = /^<!--[\s\S]*-->$/

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': '\u00a0',
}

function decodeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (e) => ENTITIES[e] ?? e)
}

function safeDecode(href: string): string {
  try {
    return decodeURI(href)
  } catch {
    return href
  }
}

/** Текст узлов без разметки: для якорей, поиска и подписей. */
export function plainText(nodes: HelpInline[]): string {
  let out = ''
  for (const node of nodes) {
    if (node.t === 'text' || node.t === 'code') out += node.v
    else if (node.t === 'br') out += ' '
    else if (node.t === 'image') out += node.alt
    else out += plainText(node.c)
  }
  return out
}

function pushText(list: HelpInline[], text: string): void {
  const last = list[list.length - 1]
  if (last?.t === 'text') last.v += text
  else list.push({ t: 'text', v: text })
}

function alignOf(tok: Token): HelpAlign {
  const style = String(tok.attrGet('style') ?? '')
  const m = /text-align:\s*(left|center|right)/.exec(style)
  return m ? (m[1] as HelpAlign) : null
}

/** Разбор ссылки: куда она ведёт внутри справки или приложения. */
export function linkTarget(rawHref: string, topic: string, ctx: HelpParseContext): HelpLinkTarget {
  const href = safeDecode(rawHref)
  if (/^(https?:|mailto:)/i.test(href)) return { kind: 'external', href: rawHref }
  if (/^bastyon:\/\//i.test(href)) {
    const path = ctx.resolveApp(href)
    return path ? { kind: 'app', href, path } : { kind: 'broken', href }
  }
  if (href.startsWith('#')) return { kind: 'topic', topic, anchor: href.slice(1) || null }
  const m = /^(?:\.\/)?([A-Za-z0-9-]+)\.md(?:#(.*))?$/.exec(href)
  if (!m) return { kind: 'broken', href }
  const name = m[1] ?? ''
  const anchor = m[2] || null
  if (name === 'README') return { kind: 'home' }
  if (name === 'glossary' && anchor) return { kind: 'term', anchor }
  return { kind: 'topic', topic: name, anchor }
}

type Container = { t: 'strong' | 'em' | 's'; c: HelpInline[] } | { t: 'link'; c: HelpInline[] }

/** Обход плоского потока токенов markdown-it с курсором. */
class Converter {
  title = ''
  readonly problems: string[] = []
  readonly links: HelpParsedLink[] = []
  readonly headings: HelpHeading[] = []
  readonly texts: string[] = []
  private readonly slugger = new Slugger()
  private i = 0

  constructor(
    private readonly tokens: Token[],
    private readonly ctx: HelpParseContext
  ) {}

  run(): HelpBlock[] {
    return this.blocks(() => false)
  }

  private blocks(stop: (tok: Token) => boolean): HelpBlock[] {
    const out: HelpBlock[] = []
    while (this.i < this.tokens.length) {
      const tok = this.tokens[this.i] as Token
      if (stop(tok)) break
      const block = this.block(tok)
      if (block) out.push(block)
    }
    return out
  }

  private block(tok: Token): HelpBlock | null {
    switch (tok.type) {
      case 'heading_open':
        return this.heading(tok)
      case 'paragraph_open':
        return this.paragraph()
      case 'bullet_list_open':
      case 'ordered_list_open':
        return this.list(tok)
      case 'blockquote_open':
        return this.quote()
      case 'table_open':
        return this.table()
      case 'html_block':
        return this.html(tok)
      case 'fence':
      case 'code_block':
        this.i++
        this.texts.push(tok.content)
        return {
          t: 'code',
          lang: tok.info.trim().split(/\s+/)[0] ?? '',
          v: tok.content.replace(/\n$/, ''),
        }
      case 'hr':
        this.i++
        return { t: 'hr' }
      default:
        this.problems.push(`неожиданный элемент разметки: ${tok.type}`)
        this.i++
        return null
    }
  }

  private heading(open: Token): HelpBlock | null {
    const level = Number(open.tag.slice(1))
    const c = this.inlines(this.tokens[this.i + 1]?.children ?? [])
    this.i += 3
    const text = plainText(c).trim()
    // Заголовок первого уровня тоже занимает якорь — как на GitHub.
    const id = this.slugger.slug(text)
    if (level === 1) {
      if (this.title) this.problems.push(`второй заголовок первого уровня: «${text}»`)
      else this.title = text
      return null
    }
    this.headings.push({ id, level, text })
    this.texts.push(text)
    return { t: 'heading', level, id, c }
  }

  private paragraph(): HelpBlock {
    const c = this.inlines(this.tokens[this.i + 1]?.children ?? [])
    this.i += 3
    this.texts.push(plainText(c))
    return { t: 'p', c }
  }

  private list(open: Token): HelpBlock {
    const ordered = open.type === 'ordered_list_open'
    const close = ordered ? 'ordered_list_close' : 'bullet_list_close'
    const start = Number(open.attrGet('start') ?? 1)
    // В «плотном» списке markdown-it прячет абзацы пунктов.
    const tight = this.tokens[this.i + 2]?.hidden === true
    this.i++
    const items: HelpBlock[][] = []
    while (this.i < this.tokens.length && this.tokens[this.i]?.type !== close) {
      this.i++ // list_item_open
      items.push(this.blocks((t) => t.type === 'list_item_close'))
      this.i++ // list_item_close
    }
    this.i++
    return { t: 'list', ordered, start, tight, items }
  }

  private quote(): HelpBlock {
    this.i++
    const kind = this.alertMarker()
    let c = this.blocks((t) => t.type === 'blockquote_close')
    this.i++
    // Маркер врезки мог стоять отдельным абзацем.
    const first = c[0]
    if (kind && first?.t === 'p' && plainText(first.c).trim() === '') c = c.slice(1)
    return kind ? { t: 'alert', kind, c } : { t: 'quote', c }
  }

  /** Первая строка цитаты `[!NOTE]` — врезка GitHub. Маркер убираем из текста. */
  private alertMarker(): HelpAlertKind | null {
    const inline = this.tokens[this.i + 1]
    if (this.tokens[this.i]?.type !== 'paragraph_open' || inline?.type !== 'inline') return null
    const children = inline.children ?? []
    let lead = ''
    let n = 0
    while (n < children.length && children[n]?.type === 'text') {
      lead += children[n]?.content ?? ''
      n++
    }
    const m = ALERT_RE.exec(lead.trim())
    if (!m) return null
    const next = children[n]?.type
    if (next === 'softbreak' || next === 'hardbreak') n++
    inline.children = children.slice(n)
    return (m[1] ?? '').toLowerCase() as HelpAlertKind
  }

  private table(): HelpBlock {
    this.i++
    const align: HelpAlign[] = []
    const head: HelpInline[][] = []
    const rows: HelpInline[][][] = []
    let row: HelpInline[][] = []
    let inHead = false
    while (this.i < this.tokens.length) {
      const tok = this.tokens[this.i] as Token
      this.i++
      if (tok.type === 'table_close') break
      if (tok.type === 'thead_open') inHead = true
      else if (tok.type === 'thead_close') inHead = false
      else if (tok.type === 'tr_open') row = []
      else if (tok.type === 'tr_close' && !inHead) rows.push(row)
      else if (tok.type === 'th_open' && inHead) align.push(alignOf(tok))
      else if (tok.type === 'inline') {
        const cell = this.inlines(tok.children ?? [])
        this.texts.push(plainText(cell))
        if (inHead) head.push(cell)
        else row.push(cell)
      }
    }
    return { t: 'table', align, head, rows }
  }

  private html(tok: Token): HelpBlock | null {
    const content = tok.content.trim()
    this.i++
    if (COMMENT_RE.test(content)) return null
    const open = DETAILS_OPEN_RE.exec(content)
    if (open) {
      const summary = decodeEntities(open[1] ?? '').trim()
      if (!summary) this.problems.push('у <details> нет <summary>')
      const c = this.blocks(
        (t) => t.type === 'html_block' && DETAILS_CLOSE_RE.test(t.content.trim())
      )
      if (this.i < this.tokens.length) this.i++
      else this.problems.push('<details> не закрыт')
      this.texts.push(summary)
      return { t: 'details', summary, c }
    }
    if (DETAILS_CLOSE_RE.test(content)) {
      this.problems.push('лишний </details>')
      return null
    }
    this.problems.push(
      `HTML в статье не поддерживается (после </summary> нужна пустая строка): ${content.slice(0, 80)}`
    )
    return { t: 'p', c: [{ t: 'text', v: content }] }
  }

  private inlines(tokens: Token[]): HelpInline[] {
    const root: HelpInline[] = []
    const stack: { list: HelpInline[]; node: Container | null }[] = [{ list: root, node: null }]
    const top = (): HelpInline[] => (stack[stack.length - 1] as { list: HelpInline[] }).list
    const open = (node: Container): void => {
      top().push(node as HelpInline)
      stack.push({ list: node.c, node })
    }

    for (const tok of tokens) {
      switch (tok.type) {
        case 'text':
          pushText(top(), tok.content)
          break
        case 'softbreak':
          // В .md на GitHub перенос строки внутри абзаца — пробел.
          pushText(top(), ' ')
          break
        case 'hardbreak':
          top().push({ t: 'br' })
          break
        case 'code_inline':
          top().push({ t: 'code', v: tok.content })
          break
        case 'strong_open':
          open({ t: 'strong', c: [] })
          break
        case 'em_open':
          open({ t: 'em', c: [] })
          break
        case 's_open':
          open({ t: 's', c: [] })
          break
        case 'link_open': {
          const to = linkTarget(String(tok.attrGet('href') ?? ''), this.ctx.topic, this.ctx)
          open({ t: 'link', to, c: [] } as Container)
          break
        }
        case 'strong_close':
        case 'em_close':
        case 's_close':
        case 'link_close': {
          const closed = stack.length > 1 ? stack.pop() : undefined
          const node = closed?.node as (HelpInline & { t: 'link' }) | null | undefined
          if (node?.t === 'link') this.links.push({ to: node.to, text: plainText(node.c) })
          break
        }
        case 'image':
          top().push(this.image(tok))
          break
        case 'html_inline':
          this.problems.push(`HTML в тексте не поддерживается: ${tok.content}`)
          pushText(top(), tok.content)
          break
        default:
          pushText(top(), tok.content)
      }
    }
    return root
  }

  private image(tok: Token): HelpInline {
    const raw = safeDecode(String(tok.attrGet('src') ?? ''))
    const hash = raw.indexOf('#')
    const path = hash >= 0 ? raw.slice(0, hash) : raw
    const fragment = hash >= 0 ? raw.slice(hash + 1) : ''
    const theme =
      fragment === 'gh-dark-mode-only' ? 'dark' : fragment === 'gh-light-mode-only' ? 'light' : null
    const alt = plainText(this.inlines(tok.children ?? []))
    // Только свои картинки: внешняя выдала бы чужому серверу, кто читает справку.
    const src = /^[a-z]+:/i.test(path) ? null : this.ctx.resolveImage(path)
    if (!src) this.problems.push(`картинка не найдена (нужна своя, из help/images): ${raw}`)
    return { t: 'image', src: src ?? '', alt, theme }
  }
}

export function parseArticle(source: string, ctx: HelpParseContext): HelpParsed {
  const conv = new Converter(tokenizeMarkdown(source), ctx)
  const blocks = conv.run()
  if (!conv.title) conv.problems.push('нет заголовка первого уровня (# Заголовок)')
  return {
    title: conv.title,
    blocks,
    headings: conv.headings,
    text: conv.texts.join(' ').replace(/\s+/g, ' ').trim(),
    links: conv.links,
    problems: conv.problems,
  }
}

/** Блоки из готового куска токенов (для README: вступление до оглавления). */
export function convertTokens(
  tokens: Token[],
  ctx: HelpParseContext
): { title: string; blocks: HelpBlock[]; links: HelpParsedLink[]; problems: string[] } {
  const conv = new Converter(tokens, ctx)
  const blocks = conv.run()
  return { title: conv.title, blocks, links: conv.links, problems: conv.problems }
}
