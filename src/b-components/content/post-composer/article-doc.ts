/**
 * Статья: блоки Editor.js ↔ документ редактора (TipTap/ProseMirror JSON).
 *
 * В блокчейне статья хранится блоками Editor.js — так её читают и этот
 * клиент, и старый. Редактор работает со своим документом, а наружу отдаёт
 * те же блоки: абзац, заголовок, список, цитата, код, разделитель, картинка.
 * Строчная разметка — как у Editor.js: <b>, <i>, <u>, <s>, <code>, <a>, <br>.
 * Блок, которого редактор не знает (таблица, ссылка-карточка из старого
 * клиента), проходит насквозь как есть: правка статьи его не теряет.
 */

import type { JSONContent } from '@tiptap/core'

import type { ArticleContent } from '@/blockchain/core/actions/post-action'

import { flattenListItems } from './article-blocks'

/** Версия формата блоков, как у Editor.js, который статьи писал раньше. */
export const ARTICLE_FORMAT_VERSION = '2.31.6'

interface EditorBlock {
  id?: string
  type?: string
  data?: Record<string, unknown>
}

type Mark = NonNullable<JSONContent['marks']>[number]

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

// ── Строчная разметка: HTML Editor.js → узлы редактора ─────────────────

const MARK_BY_TAG: Record<string, string> = {
  B: 'bold',
  STRONG: 'bold',
  I: 'italic',
  EM: 'italic',
  U: 'underline',
  S: 'strike',
  STRIKE: 'strike',
  DEL: 'strike',
  CODE: 'code',
}

function walkInline(node: Node, marks: Mark[], out: JSONContent[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const value = (node.textContent ?? '').replace(/\u00a0/g, ' ')
    if (value)
      out.push(marks.length ? { type: 'text', text: value, marks } : { type: 'text', text: value })
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return
  const el = node as Element
  if (el.tagName === 'BR') {
    out.push({ type: 'hardBreak' })
    return
  }
  let next = marks
  const mark = MARK_BY_TAG[el.tagName]
  if (mark && !marks.some((m) => m.type === mark)) next = [...marks, { type: mark }]
  if (el.tagName === 'A') {
    const href = el.getAttribute('href')
    if (href) next = [...marks.filter((m) => m.type !== 'link'), { type: 'link', attrs: { href } }]
  }
  for (const child of Array.from(el.childNodes)) walkInline(child, next, out)
}

/** Строчный HTML абзаца Editor.js → узлы текста с отметками. */
export function inlineFromHtml(html: string): JSONContent[] {
  if (!html) return []
  const template = document.createElement('template')
  template.innerHTML = html
  const out: JSONContent[] = []
  for (const child of Array.from(template.content.childNodes)) walkInline(child, [], out)
  // Хвостовые переносы Editor.js — пустые строки, в редакторе они лишние.
  while (out.length && out[out.length - 1]!.type === 'hardBreak') out.pop()
  return out
}

// ── Строчная разметка: узлы редактора → HTML Editor.js ─────────────────

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const escapeAttr = (value: string): string => escapeHtml(value).replace(/"/g, '&quot;')

/** Порядок обёрток: ссылка снаружи, затем жирный, курсив, подчёркнутый, зачёркнутый, код. */
const WRAP: Record<string, [string, string]> = {
  bold: ['<b>', '</b>'],
  italic: ['<i>', '</i>'],
  underline: ['<u>', '</u>'],
  strike: ['<s>', '</s>'],
  code: ['<code class="inline-code">', '</code>'],
}
const WRAP_ORDER = ['bold', 'italic', 'underline', 'strike', 'code']

/** Узлы текста с отметками → строчный HTML для блока Editor.js. */
export function inlineToHtml(nodes: readonly JSONContent[] | undefined): string {
  if (!nodes) return ''
  let html = ''
  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      html += '<br>'
      continue
    }
    if (node.type !== 'text' || !node.text) continue
    let piece = escapeHtml(node.text)
    const marks = node.marks ?? []
    for (const name of [...WRAP_ORDER].reverse()) {
      if (marks.some((m) => m.type === name)) piece = WRAP[name]![0] + piece + WRAP[name]![1]
    }
    const link = marks.find((m) => m.type === 'link')
    const href = typeof link?.attrs?.href === 'string' ? link.attrs.href : ''
    if (href) piece = `<a href="${escapeAttr(href)}">${piece}</a>`
    html += piece
  }
  return html
}

// ── Блоки Editor.js → документ ─────────────────────────────────────────

const paragraph = (html: string): JSONContent => {
  const content = inlineFromHtml(html)
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
}

function listItems(items: unknown): JSONContent[] {
  return flattenListItems(items).map((item) => ({
    type: 'listItem',
    content: [paragraph(item)],
  }))
}

function blockToNodes(block: EditorBlock): JSONContent[] {
  const data = block.data ?? {}
  switch (block.type) {
    case 'paragraph':
      return [paragraph(text(data.text))]
    case 'header': {
      const level = Number(data.level)
      const content = inlineFromHtml(text(data.text))
      return [
        {
          type: 'heading',
          attrs: { level: level >= 1 && level <= 6 ? level : 2 },
          ...(content.length ? { content } : {}),
        },
      ]
    }
    case 'list': {
      const items = listItems(data.items)
      if (!items.length) return []
      return [{ type: data.style === 'ordered' ? 'orderedList' : 'bulletList', content: items }]
    }
    case 'quote':
      return [
        {
          type: 'blockquote',
          attrs: { caption: text(data.caption), alignment: text(data.alignment) || 'left' },
          content: [paragraph(text(data.text))],
        },
      ]
    case 'code': {
      const code = text(data.code)
      return [
        code
          ? { type: 'codeBlock', content: [{ type: 'text', text: code }] }
          : { type: 'codeBlock' },
      ]
    }
    case 'delimiter':
      return [{ type: 'horizontalRule' }]
    case 'image': {
      const file = (data.file ?? {}) as { url?: unknown }
      const url = text(file.url) || text(data.url)
      if (!url) return []
      return [
        {
          type: 'articleImage',
          attrs: {
            src: url,
            caption: text(data.caption),
            withBorder: !!data.withBorder,
            stretched: !!data.stretched,
            withBackground: !!data.withBackground,
          },
        },
      ]
    }
    default:
      // Незнакомый блок (таблица, ссылка-карточка…) — как есть, без правки.
      return block.type ? [{ type: 'rawBlock', attrs: { block: JSON.stringify(block) } }] : []
  }
}

/** Статья в блоках Editor.js → документ редактора. Пустая — один пустой абзац. */
export function articleToDoc(article: ArticleContent | null | undefined): JSONContent {
  const blocks = Array.isArray(article?.blocks) ? (article.blocks as EditorBlock[]) : []
  const content = blocks.flatMap((block) =>
    block && typeof block === 'object' ? blockToNodes(block) : []
  )
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
}

// ── Документ → блоки Editor.js ─────────────────────────────────────────

/** Текст абзацев внутри узла (цитата, пункт списка) — строки через <br>. */
function paragraphsHtml(node: JSONContent): string {
  return (node.content ?? [])
    .filter((child) => child.type === 'paragraph' || child.type === 'heading')
    .map((child) => inlineToHtml(child.content))
    .filter(Boolean)
    .join('<br>')
}

/** Пункты списка плоско: вложенные — следом за родителем, как рисует лента. */
function flattenList(node: JSONContent): string[] {
  const out: string[] = []
  for (const item of node.content ?? []) {
    const own = paragraphsHtml(item)
    if (own) out.push(own)
    for (const child of item.content ?? []) {
      if (child.type === 'bulletList' || child.type === 'orderedList')
        out.push(...flattenList(child))
    }
  }
  return out
}

function plainText(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  return (node.content ?? []).map(plainText).join('')
}

function nodeToBlocks(node: JSONContent): EditorBlock[] {
  const attrs = node.attrs ?? {}
  switch (node.type) {
    case 'paragraph': {
      const html = inlineToHtml(node.content)
      return html ? [{ type: 'paragraph', data: { text: html } }] : []
    }
    case 'heading': {
      const html = inlineToHtml(node.content)
      return html ? [{ type: 'header', data: { text: html, level: Number(attrs.level) || 2 } }] : []
    }
    case 'bulletList':
    case 'orderedList': {
      const items = flattenList(node)
      if (!items.length) return []
      return [
        {
          type: 'list',
          data: { style: node.type === 'orderedList' ? 'ordered' : 'unordered', items },
        },
      ]
    }
    case 'blockquote': {
      const html = paragraphsHtml(node)
      if (!html) return []
      return [
        {
          type: 'quote',
          data: {
            text: html,
            caption: text(attrs.caption),
            alignment: text(attrs.alignment) || 'left',
          },
        },
      ]
    }
    case 'codeBlock': {
      const code = plainText(node)
      return code ? [{ type: 'code', data: { code } }] : []
    }
    case 'horizontalRule':
      return [{ type: 'delimiter', data: {} }]
    case 'articleImage': {
      const url = text(attrs.src)
      if (!url) return []
      return [
        {
          type: 'image',
          data: {
            file: { url },
            caption: text(attrs.caption),
            withBorder: !!attrs.withBorder,
            stretched: !!attrs.stretched,
            withBackground: !!attrs.withBackground,
          },
        },
      ]
    }
    case 'rawBlock': {
      try {
        const block = JSON.parse(text(attrs.block)) as EditorBlock
        return block && typeof block === 'object' && block.type ? [block] : []
      } catch {
        return []
      }
    }
    default:
      return []
  }
}

/** Документ редактора → статья в блоках Editor.js; пустые абзацы не попадают. */
export function docToArticle(doc: JSONContent, now: number = Date.now()): ArticleContent {
  const blocks = (doc.content ?? []).flatMap(nodeToBlocks)
  return { time: now, blocks, version: ARTICLE_FORMAT_VERSION }
}
